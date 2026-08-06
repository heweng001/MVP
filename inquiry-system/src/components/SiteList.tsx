"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SITE_TYPES, formatDate, toDateInputValue } from "@/lib/labels";
import type { SiteListTab, SiteSortField, SortDir } from "@/lib/list-tabs";
import { compareSemver } from "@/lib/semver";
import { SiteFormConfigPanel } from "./SiteFormConfigPanel";

export type SiteRow = {
  id: string;
  domain: string;
  siteType: string;
  startDate: string | null;
  endDate: string | null;
  siteKey: string;
  productKeywords: string;
  spamExtraWords: string;
  mailHiddenFields: string[];
  wpAdminUrl: string;
  wpUsername: string;
  hasWpCredentials: boolean;
  hasWpPassword: boolean;
  enabled: boolean;
  clientId: string;
  clientName: string;
  forms: {
    id: string;
    formId: string;
    label: string;
    toEmails: string;
    ccEmails: string;
    enabled: boolean;
  }[];
  formCount: number;
};

type ClientOpt = { id: string; name: string };

type SiteTab = {
  key: SiteListTab;
  label: string;
  hint: string;
  count: number;
};

const emptyForm = {
  clientId: "",
  domain: "",
  siteType: "展示型",
  startDate: "",
  endDate: "",
  wpAdminUrl: "",
  wpUsername: "",
  wpPassword: "",
  enabled: true,
};

type BatchPluginProgress = {
  phase: "detect" | "update" | "done";
  percent: number;
  label: string;
  total: number;
  checked: number;
  needUpdate: number;
  updated: number;
  failed: number;
  unreachable: number;
  current?: string;
  errors: string[];
};

export function SiteList({
  initialSites,
  clients,
  ingestUrl,
  latestPluginVersion,
  filters,
  tab,
  tabs,
}: {
  initialSites: SiteRow[];
  clients: ClientOpt[];
  ingestUrl: string;
  latestPluginVersion: string;
  filters: {
    clientId: string;
    q: string;
    enabled: string;
    tab: SiteListTab;
    sort: SiteSortField | null;
    order: SortDir;
  };
  tab: SiteListTab;
  tabs: SiteTab[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SiteRow | null>(null);
  const [configSite, setConfigSite] = useState<SiteRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [batchProgress, setBatchProgress] = useState<BatchPluginProgress | null>(null);

  function buildHref(overrides: Record<string, string | null | undefined> = {}) {
    const p = new URLSearchParams();
    const next = {
      tab: filters.tab,
      clientId: filters.clientId,
      q: filters.q,
      enabled: filters.enabled,
      sort: filters.sort || "",
      order: filters.sort ? filters.order : "",
      ...overrides,
    };
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
    }
    const qs = p.toString();
    return qs ? `/admin/sites?${qs}` : "/admin/sites";
  }

  function sortHref(field: SiteSortField) {
    const same = filters.sort === field;
    const nextOrder: SortDir = same && filters.order === "asc" ? "desc" : "asc";
    return buildHref({ sort: field, order: nextOrder });
  }

  function sortMark(field: SiteSortField) {
    if (filters.sort !== field) return "";
    return filters.order === "asc" ? " ↑" : " ↓";
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, clientId: filters.clientId || clients[0]?.id || "" });
    setCreating(true);
    setError("");
  }

  function openEdit(s: SiteRow) {
    setCreating(false);
    setEditing(s);
    setForm({
      clientId: s.clientId,
      domain: s.domain,
      siteType: s.siteType || "展示型",
      startDate: toDateInputValue(s.startDate),
      endDate: toDateInputValue(s.endDate),
      wpAdminUrl: s.wpAdminUrl || "",
      wpUsername: s.wpUsername || "",
      wpPassword: "",
      enabled: s.enabled,
    });
    setError("");
  }

  function closeModal() {
    setCreating(false);
    setEditing(null);
    setError("");
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const url = editing ? `/api/admin/sites/${editing.id}` : "/api/admin/sites";
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "保存失败");
      return;
    }
    closeModal();
    router.refresh();
  }

  async function remove(s: SiteRow) {
    if (!confirm(`确认删除网站「${s.domain}」？相关询盘也会删除。`)) return;
    setBusy(true);
    await fetch(`/api/admin/sites/${s.id}`, { method: "DELETE" });
    setBusy(false);
    if (configSite?.id === s.id) setConfigSite(null);
    router.refresh();
  }

  async function enterWpAdmin(s: SiteRow) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/sites/${s.id}/wp-login`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "无法进入后台");
        return;
      }
      const formEl = document.createElement("form");
      formEl.method = "POST";
      formEl.action = data.loginUrl;
      formEl.target = "_blank";
      formEl.acceptCharset = "UTF-8";
      const fields: Record<string, string> = {
        log: data.username,
        pwd: data.password,
        "wp-submit": "Log In",
        redirect_to: data.redirectTo || "",
        testcookie: "1",
      };
      for (const [name, value] of Object.entries(fields)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        formEl.appendChild(input);
      }
      document.body.appendChild(formEl);
      formEl.submit();
      formEl.remove();
    } finally {
      setBusy(false);
    }
  }

  async function batchUpdatePlugins() {
    if (!latestPluginVersion) {
      alert("无法读取中心最新插件版本，请稍后重试。");
      return;
    }
    if (
      !confirm(
        `将检测全部网站的 Inquiry Bridge 版本，并把低于 ${latestPluginVersion} 的站点自动更新。是否继续？`,
      )
    ) {
      return;
    }

    setBusy(true);
    setBatchProgress({
      phase: "detect",
      percent: 2,
      label: "正在加载网站列表…",
      total: 0,
      checked: 0,
      needUpdate: 0,
      updated: 0,
      failed: 0,
      unreachable: 0,
      errors: [],
    });

    try {
      const listRes = await fetch("/api/admin/sites", { cache: "no-store" });
      const listData = await listRes.json().catch(() => ({}));
      if (!listRes.ok) {
        throw new Error(listData.error || "加载网站列表失败");
      }
      const sites: { id: string; domain: string }[] = Array.isArray(listData.sites)
        ? listData.sites.map((s: { id: string; domain: string }) => ({
            id: String(s.id),
            domain: String(s.domain || ""),
          }))
        : [];

      if (sites.length === 0) {
        setBatchProgress({
          phase: "done",
          percent: 100,
          label: "没有可检测的网站",
          total: 0,
          checked: 0,
          needUpdate: 0,
          updated: 0,
          failed: 0,
          unreachable: 0,
          errors: [],
        });
        return;
      }

      const outdated: { id: string; domain: string; version: string }[] = [];
      let checked = 0;
      let unreachable = 0;
      const errors: string[] = [];

      for (const site of sites) {
        checked += 1;
        setBatchProgress({
          phase: "detect",
          percent: Math.round((checked / sites.length) * 45),
          label: `正在检测 ${site.domain}（${checked}/${sites.length}）`,
          total: sites.length,
          checked,
          needUpdate: outdated.length,
          updated: 0,
          failed: 0,
          unreachable,
          current: site.domain,
          errors: [...errors],
        });

        try {
          const res = await fetch(`/api/admin/sites/${site.id}/plugin-version`, {
            cache: "no-store",
          });
          const data = await res.json().catch(() => ({}));
          if (data.ok && data.version) {
            const ver = String(data.version);
            if (compareSemver(ver, latestPluginVersion) < 0) {
              outdated.push({ id: site.id, domain: site.domain, version: ver });
            }
          } else {
            unreachable += 1;
            errors.push(`${site.domain}：${data.error || "无法获取版本"}`);
          }
        } catch (e) {
          unreachable += 1;
          errors.push(
            `${site.domain}：${e instanceof Error ? e.message : "检测失败"}`,
          );
        }
      }

      if (outdated.length === 0) {
        setBatchProgress({
          phase: "done",
          percent: 100,
          label: "检测完成：全部可访问站点均为最新版，无需更新",
          total: sites.length,
          checked,
          needUpdate: 0,
          updated: 0,
          failed: 0,
          unreachable,
          errors,
        });
        return;
      }

      let updated = 0;
      let failed = 0;
      for (let i = 0; i < outdated.length; i++) {
        const site = outdated[i];
        const base = 45;
        const span = 55;
        setBatchProgress({
          phase: "update",
          percent: Math.round(base + ((i + 0.3) / outdated.length) * span),
          label: `正在更新 ${site.domain}（${site.version} → ${latestPluginVersion}，${i + 1}/${outdated.length}）`,
          total: sites.length,
          checked,
          needUpdate: outdated.length,
          updated,
          failed,
          unreachable,
          current: site.domain,
          errors: [...errors],
        });

        try {
          const res = await fetch(`/api/admin/sites/${site.id}/update-plugin`, {
            method: "POST",
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            failed += 1;
            errors.push(`${site.domain}：${data.error || "更新失败"}`);
          } else {
            updated += 1;
          }
        } catch (e) {
          failed += 1;
          errors.push(
            `${site.domain}：${e instanceof Error ? e.message : "更新失败"}`,
          );
        }

        setBatchProgress({
          phase: "update",
          percent: Math.round(base + ((i + 1) / outdated.length) * span),
          label: `已处理 ${i + 1}/${outdated.length} 个待更新站点`,
          total: sites.length,
          checked,
          needUpdate: outdated.length,
          updated,
          failed,
          unreachable,
          current: site.domain,
          errors: [...errors],
        });
      }

      setBatchProgress({
        phase: "done",
        percent: 100,
        label: `完成：需更新 ${outdated.length} 个，成功 ${updated} 个${failed ? `，失败 ${failed} 个` : ""}`,
        total: sites.length,
        checked,
        needUpdate: outdated.length,
        updated,
        failed,
        unreachable,
        errors,
      });
    } catch (e) {
      setBatchProgress({
        phase: "done",
        percent: 100,
        label: "批量更新中断",
        total: 0,
        checked: 0,
        needUpdate: 0,
        updated: 0,
        failed: 0,
        unreachable: 0,
        errors: [e instanceof Error ? e.message : String(e)],
      });
    } finally {
      setBusy(false);
    }
  }

  const showModal = creating || !!editing;
  // Keep config panel in sync with refreshed list data
  const configLive =
    configSite && initialSites.find((s) => s.id === configSite.id)
      ? initialSites.find((s) => s.id === configSite.id)!
      : configSite;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => batchUpdatePlugins()}
          disabled={busy || !latestPluginVersion}
          className="bg-[var(--brand)] text-white rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
          title={
            latestPluginVersion
              ? `检测全部网站并更新到 ${latestPluginVersion}`
              : "无法读取中心插件版本"
          }
        >
          插件更新
          {latestPluginVersion ? (
            <span className="ml-1 opacity-80 text-xs">→ {latestPluginVersion}</span>
          ) : null}
        </button>
      </div>
      <form className="flex flex-wrap gap-2 bg-white border border-[var(--line)] rounded-xl p-3 shadow-sm">
        <input type="hidden" name="tab" value={tab} />
        {filters.sort ? (
          <>
            <input type="hidden" name="sort" value={filters.sort} />
            <input type="hidden" name="order" value={filters.order} />
          </>
        ) : null}
        <select
          name="clientId"
          defaultValue={filters.clientId}
          className="border border-[var(--line)] rounded-lg px-2 py-1.5 text-sm"
        >
          <option value="">全部客户</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          name="enabled"
          defaultValue={filters.enabled}
          className="border border-[var(--line)] rounded-lg px-2 py-1.5 text-sm"
          title="对接是否开启：开启=询盘进本系统；关闭=拒收推送"
        >
          <option value="">全部对接状态</option>
          <option value="1">对接中</option>
          <option value="0">已关闭对接</option>
        </select>
        <input
          name="q"
          defaultValue={filters.q}
          placeholder="搜索域名/客户名"
          className="border border-[var(--line)] rounded-lg px-2 py-1.5 text-sm flex-1 min-w-[160px]"
        />
        <button className="bg-[var(--brand)] text-white rounded-lg px-3 py-1.5 text-sm">筛选</button>
        {filters.sort ? (
          <Link
            href={buildHref({ sort: null, order: null })}
            className="border border-[var(--line)] rounded-lg px-3 py-1.5 text-sm bg-white text-[var(--muted)] hover:text-[var(--ink)]"
          >
            清除排序
          </Link>
        ) : null}
        <button
          type="button"
          onClick={openCreate}
          disabled={clients.length === 0}
          className="border border-[var(--line)] rounded-lg px-3 py-1.5 text-sm bg-white disabled:opacity-50"
        >
          新增网站
        </button>
      </form>

      {clients.length === 0 ? (
        <p className="text-sm text-[var(--warn)]">请先在「客户」中创建客户，再新增网站。</p>
      ) : null}

      <div className="flex flex-wrap gap-1 border-b border-[var(--line)]">
        {tabs.map((t) => {
          const active = t.key === tab;
          return (
            <span key={t.key} className="relative group/tab">
              <Link
                href={buildHref({ tab: t.key })}
                className={`inline-block px-2.5 py-1.5 text-xs rounded-t-md border border-b-0 -mb-px ${
                  active
                    ? "bg-white border-[var(--line)] text-[var(--brand)] font-medium"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                {t.label}
                <span className="ml-1 tabular-nums">{t.count}</span>
              </Link>
              {t.hint ? (
                <span
                  role="tooltip"
                  className="pointer-events-none absolute left-0 top-full z-40 mt-1.5 w-64 max-w-[min(16rem,calc(100vw-2rem))] rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-2 text-[11px] leading-relaxed text-[var(--ink)] shadow-lg opacity-0 invisible group-hover/tab:opacity-100 group-hover/tab:visible transition-opacity"
                >
                  {t.hint}
                </span>
              ) : null}
            </span>
          );
        })}
      </div>

      <div className="bg-white border border-[var(--line)] rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[980px]">
          <thead className="bg-black/[0.02] text-left text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2">域名</th>
              <th className="px-3 py-2">所属客户</th>
              <th className="px-3 py-2">站点类型</th>
              <th className="px-3 py-2">
                <Link href={sortHref("startDate")} className="hover:text-[var(--ink)]" title="按开始日期排序">
                  开始日期{sortMark("startDate")}
                </Link>
              </th>
              <th className="px-3 py-2">
                <Link href={sortHref("endDate")} className="hover:text-[var(--ink)]" title="按结束日期排序">
                  结束日期{sortMark("endDate")}
                </Link>
              </th>
              <th className="px-3 py-2" title="是否接受该站 WordPress 插件推送的询盘">
                对接状态
              </th>
              <th className="px-3 py-2">
                <Link href={sortHref("formCount")} className="hover:text-[var(--ink)]" title="按表单数排序">
                  表单数{sortMark("formCount")}
                </Link>
              </th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {initialSites.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-[var(--muted)]">
                  暂无网站
                </td>
              </tr>
            ) : (
              initialSites.map((s) => (
                <tr key={s.id} className="border-t border-[var(--line)]">
                  <td className="px-3 py-2 font-medium">
                    <a
                      href={
                        /^https?:\/\//i.test(s.domain)
                          ? s.domain
                          : `https://${s.domain}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--brand)] hover:underline"
                      title="在新窗口打开网站"
                    >
                      {s.domain}
                    </a>
                  </td>
                  <td className="px-3 py-2">{s.clientName}</td>
                  <td className="px-3 py-2">{s.siteType}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(s.startDate)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(s.endDate)}</td>
                  <td className="px-3 py-2">
                    {s.enabled ? (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-800"
                        title="本系统接受该站插件推送的询盘"
                      >
                        对接中
                      </span>
                    ) : (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
                        title="本系统拒收该站推送；询盘由 WPForms 原生邮件发送，不进统计"
                      >
                        已关闭
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">{s.formCount}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap space-x-2">
                    {s.hasWpCredentials ? (
                      <button
                        type="button"
                        className="text-[var(--brand)]"
                        disabled={busy}
                        onClick={() => enterWpAdmin(s)}
                        title="新窗口自动提交 WP 登录（遇验证码/安全插件可能失败）"
                      >
                        进入后台
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="text-[var(--brand)] font-medium"
                      onClick={() => setConfigSite(s)}
                    >
                      配置对接
                    </button>
                    <button type="button" className="text-[var(--brand)]" onClick={() => openEdit(s)}>
                      编辑
                    </button>
                    <button
                      type="button"
                      className="text-[var(--danger)]"
                      disabled={busy}
                      onClick={() => remove(s)}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {batchProgress ? (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-5 shadow-lg space-y-4">
            <h3 className="text-base font-semibold">插件批量更新</h3>
            {latestPluginVersion ? (
              <p className="text-xs text-[var(--muted)]">中心最新版：{latestPluginVersion}</p>
            ) : null}
            <div className="space-y-2">
              <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--brand)] transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, batchProgress.percent))}%` }}
                />
              </div>
              <p className="text-sm text-[var(--ink)]">{batchProgress.label}</p>
              {batchProgress.current && batchProgress.phase !== "done" ? (
                <p className="text-xs text-[var(--muted)] break-all">当前：{batchProgress.current}</p>
              ) : null}
              <div className="grid grid-cols-2 gap-2 text-xs text-[var(--muted)]">
                <div>已检测：{batchProgress.checked}/{batchProgress.total || "—"}</div>
                <div>需更新：{batchProgress.needUpdate}</div>
                <div className="text-teal-700">成功更新：{batchProgress.updated}</div>
                <div className={batchProgress.failed ? "text-[var(--danger)]" : ""}>
                  失败：{batchProgress.failed}
                  {batchProgress.unreachable ? ` · 无法检测 ${batchProgress.unreachable}` : ""}
                </div>
              </div>
              {batchProgress.errors.length > 0 ? (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-[var(--line)] bg-black/[0.02] p-2 text-xs text-[var(--danger)] space-y-1">
                  {batchProgress.errors.slice(0, 30).map((err) => (
                    <p key={err}>{err}</p>
                  ))}
                  {batchProgress.errors.length > 30 ? (
                    <p>…另有 {batchProgress.errors.length - 30} 条</p>
                  ) : null}
                </div>
              ) : null}
            </div>
            {batchProgress.phase === "done" ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  className="bg-[var(--brand)] text-white rounded-lg px-3 py-1.5 text-sm"
                  onClick={() => setBatchProgress(null)}
                >
                  关闭
                </button>
              </div>
            ) : (
              <p className="text-xs text-[var(--muted)]">进行中请勿关闭页面…</p>
            )}
          </div>
        </div>
      ) : null}

      {showModal ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form
            onSubmit={save}
            className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-3 shadow-lg"
          >
            <h2 className="text-lg font-semibold">{editing ? "编辑网站" : "新增网站"}</h2>
            <div className="grid gap-3">
              <label className="text-sm">
                <span className="text-xs text-[var(--muted)]">所属客户 *</span>
                <select
                  required
                  value={form.clientId}
                  onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                  className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5"
                >
                  <option value="">选择客户</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="text-xs text-[var(--muted)]">网站域名 *</span>
                <input
                  required
                  value={form.domain}
                  onChange={(e) => setForm({ ...form, domain: e.target.value })}
                  placeholder="example.com"
                  className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5"
                />
              </label>
              <label className="text-sm">
                <span className="text-xs text-[var(--muted)]">站点类型</span>
                <select
                  value={form.siteType}
                  onChange={(e) => setForm({ ...form, siteType: e.target.value })}
                  className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5"
                >
                  {SITE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  <span className="text-xs text-[var(--muted)]">开始日期</span>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5"
                  />
                </label>
                <label className="text-sm">
                  <span className="text-xs text-[var(--muted)]">结束日期</span>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5"
                  />
                </label>
              </div>
              <div className="rounded-lg border border-[var(--line)] bg-black/[0.02] p-3 space-y-3">
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  WordPress 运维（可选）：用于「进入后台」与「更新插件」。密码加密存储；遇验证码/双因素时自动登录可能失败。
                </p>
                <label className="text-sm block">
                  <span className="text-xs text-[var(--muted)]">后台入口</span>
                  <input
                    value={form.wpAdminUrl}
                    onChange={(e) => setForm({ ...form, wpAdminUrl: e.target.value })}
                    placeholder="https://example.com/wp-admin"
                    className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm">
                    <span className="text-xs text-[var(--muted)]">用户名</span>
                    <input
                      value={form.wpUsername}
                      onChange={(e) => setForm({ ...form, wpUsername: e.target.value })}
                      autoComplete="off"
                      className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="text-xs text-[var(--muted)]">
                      密码
                      {editing?.hasWpPassword ? "（留空不修改）" : ""}
                    </span>
                    <input
                      type="password"
                      value={form.wpPassword}
                      onChange={(e) => setForm({ ...form, wpPassword: e.target.value })}
                      autoComplete="new-password"
                      placeholder={editing?.hasWpPassword ? "••••••••" : ""}
                      className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5"
                    />
                  </label>
                </div>
              </div>
              <div className="rounded-lg border border-[var(--line)] bg-black/[0.02] p-3 space-y-2">
                <label className="text-sm flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={form.enabled}
                    onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                  />
                  <span>
                    <span className="font-medium">启用询盘对接</span>
                    <span className="block text-xs text-[var(--muted)] mt-1 leading-relaxed">
                      勾选后：该站 WordPress 插件可用 site_key 把表单询盘推到本系统（垃圾过滤、代发客户、统计有效询盘）。
                      <br />
                      取消勾选后：本系统<strong>立即拒收</strong>该站推送；网站表单仍可提交，但询盘会走
                      WPForms 原生邮件，且<strong>不会</strong>出现在本系统列表/报表中。适合服务暂停或临时下线对接。
                    </span>
                  </span>
                </label>
              </div>
            </div>
            {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="border border-[var(--line)] rounded-lg px-3 py-1.5 text-sm"
              >
                取消
              </button>
              <button
                disabled={busy}
                className="bg-[var(--brand)] text-white rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {configLive ? (
        <SiteFormConfigPanel
          siteId={configLive.id}
          domain={configLive.domain}
          siteKey={configLive.siteKey}
          ingestUrl={ingestUrl}
          forms={configLive.forms}
          mailHiddenFields={configLive.mailHiddenFields}
          onClose={() => setConfigSite(null)}
        />
      ) : null}
    </div>
  );
}
