"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate, toDateInputValue } from "@/lib/labels";

export type ClientRow = {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  address: string;
  notes: string;
  lastVisitAt: string | null;
};

const emptyForm = {
  name: "",
  contactName: "",
  phone: "",
  address: "",
  notes: "",
  lastVisitAt: "",
};

function contactLine(c: { contactName: string; phone: string }) {
  const name = (c.contactName || "").trim();
  const phone = (c.phone || "").trim();
  if (name && phone) return `${name} ${phone}`;
  return name || phone || "—";
}

export function ClientList({
  initialClients,
  initialQ,
}: {
  initialClients: ClientRow[];
  initialQ: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

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
    const url = editing ? `/api/admin/clients/${editing.id}` : "/api/admin/clients";
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
      <form
        action="/admin/clients"
        method="get"
        className="flex flex-wrap gap-2 bg-white border border-[var(--line)] rounded-xl p-3"
      >
        <input
          name="q"
          defaultValue={initialQ}
          placeholder="搜索名称 / 联系人 / 电话 / 地址 / 备注"
          className="border border-[var(--line)] rounded-lg px-2 py-1.5 text-sm flex-1 min-w-[200px]"
        />
        <button className="bg-[var(--brand)] text-white rounded-lg px-3 py-1.5 text-sm">搜索</button>
        <button
          type="button"
          onClick={openCreate}
          className="border border-[var(--line)] rounded-lg px-3 py-1.5 text-sm bg-white"
        >
          新增客户
        </button>
      </form>

      <div className="bg-white border border-[var(--line)] rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-black/[0.02] text-left text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2">客户名称</th>
              <th className="px-3 py-2">联系人称呼电话</th>
              <th className="px-3 py-2 whitespace-nowrap">最近上门日期</th>
              <th className="px-3 py-2">地址</th>
              <th className="px-3 py-2">备注</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {initialClients.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-[var(--muted)]">
                  暂无客户，请点击「新增客户」
                </td>
              </tr>
            ) : (
              initialClients.map((c) => (
                <tr key={c.id} className="border-t border-[var(--line)] align-top">
                  <td className="px-3 py-2 font-medium">{c.name}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{contactLine(c)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(c.lastVisitAt)}</td>
                  <td className="px-3 py-2 max-w-[200px] break-words">{c.address || "—"}</td>
                  <td className="px-3 py-2 max-w-[220px] break-words text-[var(--muted)]">
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
