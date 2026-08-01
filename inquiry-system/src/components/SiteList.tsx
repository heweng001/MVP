"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { SITE_TYPES, formatDate, toDateInputValue } from "@/lib/labels";
import { SiteFormConfigPanel } from "./SiteFormConfigPanel";
import { HelpCallout } from "./HelpCallout";

export type SiteRow = {
  id: string;
  domain: string;
  siteType: string;
  startDate: string | null;
  endDate: string | null;
  siteKey: string;
  productKeywords: string;
  spamExtraWords: string;
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

const emptyForm = {
  clientId: "",
  domain: "",
  siteType: "展示型",
  startDate: "",
  endDate: "",
  enabled: true,
};

export function SiteList({
  initialSites,
  clients,
  ingestUrl,
  filters,
}: {
  initialSites: SiteRow[];
  clients: ClientOpt[];
  ingestUrl: string;
  filters: { clientId: string; siteType: string; q: string; enabled: string };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SiteRow | null>(null);
  const [configSite, setConfigSite] = useState<SiteRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

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

  const showModal = creating || !!editing;
  // Keep config panel in sync with refreshed list data
  const configLive =
    configSite && initialSites.find((s) => s.id === configSite.id)
      ? initialSites.find((s) => s.id === configSite.id)!
      : configSite;

  return (
    <div className="space-y-4">
      <HelpCallout title="网站列表说明">
        <p>
          一个客户可对应多个网站。保存网站的<strong>开始/结束日期</strong>后，客户的「服务开始/结束」会自动取：所有网站中最早的开始、最晚的结束。
        </p>
        <p>
          <strong>对接状态</strong>：开启后接收该站插件推送；关闭后拒收，询盘降级走 WPForms
          原生邮件，不进本系统统计。
        </p>
        <p>
          新站接入：点右侧<strong>配置对接</strong>，按清单依次安装插件 → 填写 Site Key →
          配置收件人。
        </p>
      </HelpCallout>

      <form className="flex flex-wrap gap-2 bg-white border border-[var(--line)] rounded-xl p-3">
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
          name="siteType"
          defaultValue={filters.siteType}
          className="border border-[var(--line)] rounded-lg px-2 py-1.5 text-sm"
        >
          <option value="">全部类型</option>
          {SITE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
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

      <div className="bg-white border border-[var(--line)] rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[980px]">
          <thead className="bg-black/[0.02] text-left text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2">域名</th>
              <th className="px-3 py-2">所属客户</th>
              <th className="px-3 py-2">站点类型</th>
              <th className="px-3 py-2">开始日期</th>
              <th className="px-3 py-2">结束日期</th>
              <th className="px-3 py-2" title="是否接受该站 WordPress 插件推送的询盘">
                对接状态
              </th>
              <th className="px-3 py-2">表单数</th>
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
            className="bg-white rounded-2xl w-full max-w-lg p-5 space-y-3 shadow-lg"
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
          productKeywords={configLive.productKeywords}
          spamExtraWords={configLive.spamExtraWords}
          forms={configLive.forms}
          onClose={() => setConfigSite(null)}
        />
      ) : null}
    </div>
  );
}
