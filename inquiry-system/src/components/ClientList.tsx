"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDate, toDateInputValue } from "@/lib/labels";
import type { ClientListTab, ClientSortField, SortDir } from "@/lib/list-tabs";

export type ClientRow = {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  address: string;
  notes: string;
  serviceStart: string | null;
  serviceEnd: string | null;
  lastVisitAt: string | null;
  _count: { sites: number };
};

type ClientTab = {
  key: ClientListTab;
  label: string;
  hint: string;
  count: number;
};

const emptyForm = {
  name: "",
  contactName: "",
  phone: "",
  address: "",
  notes: "",
  lastVisitAt: "",
};

export function ClientList({
  initialClients,
  initialQ,
  tab,
  tabs,
  sort,
  order,
}: {
  initialClients: ClientRow[];
  initialQ: string;
  tab: ClientListTab;
  tabs: ClientTab[];
  sort: ClientSortField;
  order: SortDir;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  function buildHref(overrides: Record<string, string | null | undefined> = {}) {
    const p = new URLSearchParams();
    const next = {
      tab,
      q: initialQ,
      sort,
      order,
      ...overrides,
    };
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
    }
    const qs = p.toString();
    return qs ? `/admin/clients?${qs}` : "/admin/clients";
  }

  function sortHref(field: ClientSortField) {
    const same = sort === field;
    const nextOrder: SortDir = same && order === "asc" ? "desc" : "asc";
    return buildHref({ sort: field, order: nextOrder });
  }

  function sortMark(field: ClientSortField) {
    if (sort !== field) return "";
    return order === "asc" ? " ↑" : " ↓";
  }

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
        <input type="hidden" name="tab" value={tab} />
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="order" value={order} />
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
        <table className="w-full text-sm min-w-[1100px]">
          <thead className="bg-black/[0.02] text-left text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2">客户名称</th>
              <th className="px-3 py-2">联系人称呼</th>
              <th className="px-3 py-2">电话</th>
              <th className="px-3 py-2">地址</th>
              <th className="px-3 py-2">
                <Link href={sortHref("serviceStart")} className="hover:text-[var(--ink)]" title="按服务开始排序">
                  服务开始{sortMark("serviceStart")}
                </Link>
              </th>
              <th className="px-3 py-2">
                <Link href={sortHref("serviceEnd")} className="hover:text-[var(--ink)]" title="按服务结束排序">
                  服务结束{sortMark("serviceEnd")}
                </Link>
              </th>
              <th className="px-3 py-2">
                <Link href={sortHref("lastVisitAt")} className="hover:text-[var(--ink)]" title="按最近上门排序">
                  最近上门{sortMark("lastVisitAt")}
                </Link>
              </th>
              <th className="px-3 py-2">备注</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {initialClients.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-[var(--muted)]">
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
