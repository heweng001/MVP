"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SITE_TYPES, formatDate, toDateInputValue } from "@/lib/labels";
import type { SiteListTab, SiteSortField, SortDir } from "@/lib/list-tabs";
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

export function SiteList({
  initialSites,
  clients,
  ingestUrl,
  filters,
  tab,
  tabs,
}: {
  initialSites: SiteRow[];
  clients: ClientOpt[];
  ingestUrl: string;
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
      const form = document.createElement("form");
      form.method = "POST";
      form.action = data.loginUrl;
      form.target = "_blank";
      form.acceptCharset = "UTF-8";
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
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
      form.remove();
    } finally {
      setBusy(false);
    }
  }

  async function updatePlugin(s: SiteRow) {
    if (
      !confirm(
        `向「${s.domain}」推送中心最新插件？\n需该站已安装 Inquiry Bridge（含自更新），且 site_key 配置正确。`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/sites/${s.id}/update-plugin`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "更新失败");
        return;
      }
      const remoteVer =
        typeof data.remote?.version === "string" ? data.remote.version : "";
      alert(
        `已触发更新${data.latestVersion ? `（中心版本 ${data.latestVersion}` : ""}${
          remoteVer ? `，远程 ${remoteVer}` : ""
        }${data.latestVersion || remoteVer ? "）" : ""}`,
      );
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
                      <>
                        <button
                          type="button"
                          className="text-[var(--brand)]"
                          disabled={busy}
                          onClick={() => enterWpAdmin(s)}
                          title="新窗口自动提交 WP 登录（遇验证码/安全插件可能失败）"
                        >
                          进入后台
                        </button>
                        <button
                          type="button"
                          className="text-[var(--brand)]"
                          disabled={busy}
                          onClick={() => updatePlugin(s)}
                          title="通过插件自更新接口拉取中心最新 zip"
                        >
                          更新插件
                        </button>
                      </>
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
