"use client";

import { FormEvent, useEffect, useState } from "react";
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

type PluginVerState =
  | { status: "loading" }
  | { status: "ok"; version: string }
  | { status: "error"; error: string };

type UpdateProgress = {
  siteId: string;
  domain: string;
  percent: number;
  label: string;
  done?: boolean;
  error?: string;
  resultVersion?: string;
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
  const [pluginVers, setPluginVers] = useState<Record<string, PluginVerState>>({});
  const [updateProgress, setUpdateProgress] = useState<UpdateProgress | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    const sites = initialSites;
    const ids = sites.map((s) => s.id);
    setPluginVers((prev) => {
      const next: Record<string, PluginVerState> = {};
      for (const id of ids) {
        next[id] = { status: "loading" };
      }
      // keep unrelated cached entries out of current tab
      return next;
    });

    void (async () => {
      await Promise.all(
        sites.map(async (s) => {
          try {
            const res = await fetch(`/api/admin/sites/${s.id}/plugin-version`, {
              cache: "no-store",
            });
            const data = await res.json().catch(() => ({}));
            if (cancelled) return;
            if (data.ok && data.version) {
              setPluginVers((prev) => ({
                ...prev,
                [s.id]: { status: "ok", version: String(data.version) },
              }));
            } else {
              setPluginVers((prev) => ({
                ...prev,
                [s.id]: {
                  status: "error",
                  error: String(data.error || "无法获取版本"),
                },
              }));
            }
          } catch (e) {
            if (cancelled) return;
            setPluginVers((prev) => ({
              ...prev,
              [s.id]: {
                status: "error",
                error: e instanceof Error ? e.message : "检测失败",
              },
            }));
          }
        }),
      );
    })();

    return () => {
      cancelled = true;
    };
    // 仅按当前列表站点 id 集合刷新检测
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSites.map((s) => s.id).join(",")]);

  async function updatePluginFromVersion(s: SiteRow) {
    if (!s.hasWpCredentials) {
      alert("请先在编辑中配置后台入口、用户名和密码，再更新插件。");
      return;
    }
    if (
      !confirm(
        `将「${s.domain}」的插件更新到中心最新版${latestPluginVersion ? ` ${latestPluginVersion}` : ""}？`,
      )
    ) {
      return;
    }

    setBusy(true);
    setUpdateProgress({
      siteId: s.id,
      domain: s.domain,
      percent: 8,
      label: "正在连接站点…",
    });

    const steps = [
      { at: 1200, percent: 28, label: "正在校验 site_key…" },
      { at: 2800, percent: 48, label: "正在下载最新插件包…" },
      { at: 5200, percent: 72, label: "正在覆盖安装…" },
      { at: 8000, percent: 88, label: "即将完成，请稍候…" },
    ];
    const timers = steps.map((step) =>
      window.setTimeout(() => {
        setUpdateProgress((prev) =>
          prev && prev.siteId === s.id && !prev.done && !prev.error
            ? { ...prev, percent: Math.max(prev.percent, step.percent), label: step.label }
            : prev,
        );
      }, step.at),
    );

    try {
      const res = await fetch(`/api/admin/sites/${s.id}/update-plugin`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      timers.forEach((t) => window.clearTimeout(t));
      if (!res.ok) {
        setUpdateProgress({
          siteId: s.id,
          domain: s.domain,
          percent: 100,
          label: "更新失败",
          done: true,
          error: data.error || "更新失败",
        });
        return;
      }
      const remoteVer =
        typeof data.remote?.version === "string"
          ? data.remote.version
          : typeof data.latestVersion === "string"
            ? data.latestVersion
            : latestPluginVersion;
      setUpdateProgress({
        siteId: s.id,
        domain: s.domain,
        percent: 100,
        label: "更新完成",
        done: true,
        resultVersion: remoteVer,
      });
      if (remoteVer) {
        setPluginVers((prev) => ({
          ...prev,
          [s.id]: { status: "ok", version: remoteVer },
        }));
      }
    } catch (e) {
      timers.forEach((t) => window.clearTimeout(t));
      setUpdateProgress({
        siteId: s.id,
        domain: s.domain,
        percent: 100,
        label: "更新失败",
        done: true,
        error: e instanceof Error ? e.message : "更新失败",
      });
    } finally {
      setBusy(false);
    }
  }

  function renderPluginVersionCell(s: SiteRow) {
    const st = pluginVers[s.id];
    if (!st || st.status === "loading") {
      return <span className="text-xs text-[var(--muted)]">检测中…</span>;
    }
    if (st.status === "error") {
      return (
        <span className="text-xs text-[var(--muted)]" title={st.error}>
          未知
        </span>
      );
    }
    const outdated =
      Boolean(latestPluginVersion) && compareSemver(st.version, latestPluginVersion) < 0;
    if (outdated) {
      return (
        <button
          type="button"
          disabled={busy}
          onClick={() => updatePluginFromVersion(s)}
          className="text-left disabled:opacity-50"
          title={`当前 ${st.version}，最新 ${latestPluginVersion}，点击更新`}
        >
          <span className="text-[var(--brand)] font-medium underline underline-offset-2">
            {st.version}
          </span>
          <span className="block text-[10px] text-amber-700 mt-0.5">可更新 → {latestPluginVersion}</span>
        </button>
      );
    }
    return (
      <span className="text-xs" title={latestPluginVersion ? `已是最新（${latestPluginVersion}）` : ""}>
        {st.version}
        {latestPluginVersion && compareSemver(st.version, latestPluginVersion) >= 0 ? (
          <span className="ml-1 text-[10px] text-teal-700">最新</span>
        ) : null}
      </span>
    );
  }

  const showModal = creating || !!editing;
  // Keep config panel in sync with refreshed list data
  const configLive =
    configSite && initialSites.find((s) => s.id === configSite.id)
      ? initialSites.find((s) => s.id === configSite.id)!
      : configSite;

  return (
    <div className="space-y-4">
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
        <table className="w-full text-sm min-w-[1080px]">
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
              <th
                className="px-3 py-2"
                title={
                  latestPluginVersion
                    ? `中心最新插件 ${latestPluginVersion}；非最新可点击版本号更新`
                    : "各站 Inquiry Bridge 插件版本"
                }
              >
                插件版本
                {latestPluginVersion ? (
                  <span className="block text-[10px] font-normal text-[var(--muted)]">
                    最新 {latestPluginVersion}
                  </span>
                ) : null}
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
                <td colSpan={9} className="px-3 py-10 text-center text-[var(--muted)]">
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
                  <td className="px-3 py-2 whitespace-nowrap">{renderPluginVersionCell(s)}</td>
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

      {updateProgress ? (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-lg space-y-4">
            <h3 className="text-base font-semibold">更新插件</h3>
            <p className="text-sm text-[var(--muted)] break-all">{updateProgress.domain}</p>
            <div className="space-y-2">
              <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    updateProgress.error ? "bg-[var(--danger)]" : "bg-[var(--brand)]"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, updateProgress.percent))}%` }}
                />
              </div>
              <p className="text-sm text-[var(--ink)]">{updateProgress.label}</p>
              {updateProgress.error ? (
                <p className="text-sm text-[var(--danger)] whitespace-pre-wrap">{updateProgress.error}</p>
              ) : null}
              {updateProgress.done && !updateProgress.error && updateProgress.resultVersion ? (
                <p className="text-sm text-teal-700">当前版本：{updateProgress.resultVersion}</p>
              ) : null}
            </div>
            {updateProgress.done ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  className="bg-[var(--brand)] text-white rounded-lg px-3 py-1.5 text-sm"
                  onClick={() => setUpdateProgress(null)}
                >
                  关闭
                </button>
              </div>
            ) : (
              <p className="text-xs text-[var(--muted)]">更新过程中请勿关闭页面…</p>
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
