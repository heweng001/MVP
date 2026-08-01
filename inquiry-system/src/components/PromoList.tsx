"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/labels";

type Row = {
  id: string;
  lastSubmittedBy: string;
  lastSubmittedAt: string | null;
  updatedAt: string;
  client: { id: string; name: string; tier: string };
};

export function PromoList({
  items,
  clientsWithoutPromo,
}: {
  items: Row[];
  clientsWithoutPromo: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(clientsWithoutPromo[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function createPromo() {
    if (!clientId) return;
    setBusy(true);
    setErr("");
    const res = await fetch("/api/admin/promos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(data.error || "创建失败");
      return;
    }
    router.push(`/admin/promos/${data.item.id}`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {clientsWithoutPromo.length > 0 ? (
        <div className="bg-white border border-[var(--line)] rounded-xl p-3 flex flex-wrap gap-2 items-end">
          <label className="text-sm flex-1 min-w-[200px]">
            <span className="text-xs text-[var(--muted)]">为客户创建主推信息</span>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5 text-sm"
            >
              {clientsWithoutPromo.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={busy || !clientId}
            onClick={createPromo}
            className="bg-[var(--brand)] text-white rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
          >
            创建并编辑
          </button>
          {err ? <p className="w-full text-sm text-[var(--danger)]">{err}</p> : null}
        </div>
      ) : null}

      <div className="bg-white border border-[var(--line)] rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-black/[0.02] text-left text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2">客户</th>
              <th className="px-3 py-2">最近提交人</th>
              <th className="px-3 py-2">最近提交时间</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-10 text-center text-[var(--muted)]">
                  暂无主推信息。请先选择客户创建。
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id} className="border-t border-[var(--line)]">
                  <td className="px-3 py-2 font-medium">{row.client.name}</td>
                  <td className="px-3 py-2">{row.lastSubmittedBy || "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatDateTime(row.lastSubmittedAt)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/admin/promos/${row.id}`}
                      className="text-[var(--brand)] hover:underline"
                    >
                      编辑
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
