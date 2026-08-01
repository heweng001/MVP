"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CLIENT_TIERS, formatDate, toDateInputValue } from "@/lib/labels";

export type ClientRow = {
  id: string;
  name: string;
  tier: string;
  contactName: string;
  phone: string;
  address: string;
  notes: string;
  serviceStart: string | null;
  serviceEnd: string | null;
  lastVisitAt: string | null;
  _count: { sites: number };
};

const emptyForm = {
  name: "",
  tier: "正常",
  contactName: "",
  phone: "",
  address: "",
  notes: "",
  lastVisitAt: "",
};

export function ClientList({
  initialClients,
  initialTier,
  initialQ,
}: {
  initialClients: ClientRow[];
  initialTier: string;
  initialQ: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  const tierClass = useMemo(
    () =>
      ({
        重点: "bg-rose-100 text-rose-800",
        正常: "bg-slate-100 text-slate-700",
        维护: "bg-amber-100 text-amber-800",
      }) as Record<string, string>,
    [],
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setCreating(true);
    setError("");
  }

  function openEdit(c: ClientRow) {
    setCreating(false);
    setEditing(c);
    setForm({
      name: c.name,
      tier: c.tier || "正常",
      contactName: c.contactName || "",
      phone: c.phone || "",
      address: c.address || "",
      notes: c.notes || "",
      lastVisitAt: toDateInputValue(c.lastVisitAt),
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
    const payload = { ...form };
    const url = editing ? `/api/admin/clients/${editing.id}` : "/api/admin/clients";
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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

  async function remove(c: ClientRow) {
    if (!confirm(`确认删除客户「${c.name}」？其下属网站与询盘也会一并删除。`)) return;
    setBusy(true);
    await fetch(`/api/admin/clients/${c.id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  const showModal = creating || !!editing;

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap gap-2 bg-white border border-[var(--line)] rounded-xl p-3">
        <select
          name="tier"
          defaultValue={initialTier}
          className="border border-[var(--line)] rounded-lg px-2 py-1.5 text-sm"
        >
          <option value="">全部分层</option>
          {CLIENT_TIERS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          name="q"
          defaultValue={initialQ}
          placeholder="搜索名称/联系人/电话/地址"
          className="border border-[var(--line)] rounded-lg px-2 py-1.5 text-sm flex-1 min-w-[200px]"
        />
        <button className="bg-[var(--brand)] text-white rounded-lg px-3 py-1.5 text-sm">筛选</button>
        <button
          type="button"
          onClick={openCreate}
          className="border border-[var(--line)] rounded-lg px-3 py-1.5 text-sm bg-white"
        >
          新增客户
        </button>
      </form>

      <div className="bg-white border border-[var(--line)] rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead className="bg-black/[0.02] text-left text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2">客户名称</th>
              <th className="px-3 py-2">分层</th>
              <th className="px-3 py-2">联系人称呼</th>
              <th className="px-3 py-2">电话</th>
              <th className="px-3 py-2">地址</th>
              <th className="px-3 py-2">服务开始</th>
              <th className="px-3 py-2">服务结束</th>
              <th className="px-3 py-2">最近上门</th>
              <th className="px-3 py-2">备注</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {initialClients.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-10 text-center text-[var(--muted)]">
                  暂无客户，请点击「新增客户」
                </td>
              </tr>
            ) : (
              initialClients.map((c) => (
                <tr key={c.id} className="border-t border-[var(--line)] align-top">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium">{c.name}</span>
                      <Link
                        href={`/admin/sites?clientId=${encodeURIComponent(c.id)}`}
                        className="text-[11px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-800 hover:bg-teal-200 whitespace-nowrap"
                        title={`查看该客户的 ${c._count.sites} 个网站`}
                      >
                        {c._count.sites} 站
                      </Link>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${tierClass[c.tier] || ""}`}>
                      {c.tier}
                    </span>
                  </td>
                  <td className="px-3 py-2">{c.contactName || "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{c.phone || "—"}</td>
                  <td className="px-3 py-2 max-w-[160px] truncate" title={c.address}>
                    {c.address || "—"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(c.serviceStart)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(c.serviceEnd)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(c.lastVisitAt)}</td>
                  <td className="px-3 py-2 max-w-[140px] truncate text-[var(--muted)]" title={c.notes}>
                    {c.notes || "—"}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      className="text-[var(--brand)] mr-2"
                      onClick={() => openEdit(c)}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className="text-[var(--danger)]"
                      disabled={busy}
                      onClick={() => remove(c)}
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
            className="bg-white rounded-2xl w-full max-w-xl p-5 space-y-3 shadow-lg max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-lg font-semibold">{editing ? "编辑客户" : "新增客户"}</h2>
            <p className="text-xs text-[var(--muted)]">
              服务开始/结束由下属网站日期自动汇总：取所有网站中最早的开始、最晚的结束，无需手动填写。
            </p>
            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-sm md:col-span-2">
                <span className="text-xs text-[var(--muted)]">客户名称 *</span>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5"
                />
              </label>
              <label className="text-sm">
                <span className="text-xs text-[var(--muted)]">客户分层</span>
                <select
                  value={form.tier}
                  onChange={(e) => setForm({ ...form, tier: e.target.value })}
                  className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5"
                >
                  {CLIENT_TIERS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="text-xs text-[var(--muted)]">联系人称呼</span>
                <input
                  value={form.contactName}
                  onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5"
                  placeholder="如：张总"
                />
              </label>
              <label className="text-sm">
                <span className="text-xs text-[var(--muted)]">电话</span>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5"
                />
              </label>
              <label className="text-sm">
                <span className="text-xs text-[var(--muted)]">最近上门日期</span>
                <input
                  type="date"
                  value={form.lastVisitAt}
                  onChange={(e) => setForm({ ...form, lastVisitAt: e.target.value })}
                  className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5"
                />
              </label>
              <label className="text-sm md:col-span-2">
                <span className="text-xs text-[var(--muted)]">地址</span>
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5"
                />
              </label>
              <label className="text-sm md:col-span-2">
                <span className="text-xs text-[var(--muted)]">备注</span>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5 min-h-[70px]"
                />
              </label>
            </div>
            {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
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
    </div>
  );
}
