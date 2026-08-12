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
  editUrl: string | null;
  editTokenExpires: string | null;
  site: { id: string; domain: string; client: { id: string; name: string } } | null;
};

export function PromoList({
  items,
  initialQ,
}: {
  items: Row[];
  initialQ: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [links, setLinks] = useState<Record<string, { editUrl: string; expiresAt: string | null }>>(
    () => {
      const init: Record<string, { editUrl: string; expiresAt: string | null }> = {};
      for (const row of items) {
        if (row.editUrl) {
          init[row.id] = { editUrl: row.editUrl, expiresAt: row.editTokenExpires };
        }
      }
      return init;
    },
  );

  async function createPromo() {
    setBusyId("__create__");
    setErr("");
    setMsg("");
    const res = await fetch("/api/admin/promos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setErr(data.error || "创建失败");
      return;
    }
    router.push(`/admin/promos/${data.item.id}`);
    router.refresh();
  }

  async function issueLink(id: string): Promise<string | null> {
    setBusyId(id);
    setErr("");
    setMsg("");
    const res = await fetch(`/api/admin/promos/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "issue_link" }),
    });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok || !data.editUrl) {
      setErr(data.error || "生成链接失败");
      return null;
    }
    setLinks((prev) => ({
      ...prev,
      [id]: { editUrl: data.editUrl, expiresAt: data.expiresAt || null },
    }));
    setMsg("已生成 7 天有效编辑链接");
    return String(data.editUrl);
  }

  async function copyLink(id: string) {
    let url = links[id]?.editUrl || items.find((r) => r.id === id)?.editUrl || "";
    if (!url) {
      url = (await issueLink(id)) || "";
    }
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setMsg("链接已复制到剪贴板");
      setErr("");
    } catch {
      setErr("复制失败，请先「生成链接」后手动复制");
    }
  }

  async function removePromo(id: string) {
    if (!confirm("确认删除此信息核对？内容与更新记录将一并删除。")) return;
    setBusyId(id);
    setErr("");
    setMsg("");
    const res = await fetch(`/api/admin/promos/${id}`, { method: "DELETE" });
    setBusyId(null);
    if (!res.ok) {
      setErr("删除失败");
      return;
    }
    setMsg("已删除");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap gap-2 bg-white border border-[var(--line)] rounded-xl p-3">
        <input
          name="q"
          defaultValue={initialQ}
          placeholder="按 ID / 域名 / 客户名查找"
          className="border border-[var(--line)] rounded-lg px-2 py-1.5 text-sm flex-1 min-w-[200px]"
        />
        <button className="bg-[var(--brand)] text-white rounded-lg px-3 py-1.5 text-sm">查找</button>
        <button
          type="button"
          disabled={!!busyId}
          onClick={createPromo}
          className="bg-[var(--brand)] text-white rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
        >
          新建信息核对
        </button>
        {initialQ ? (
          <Link
            href="/admin/promos"
            className="border border-[var(--line)] rounded-lg px-3 py-1.5 text-sm hover:bg-black/5"
          >
            清除
          </Link>
        ) : null}
        {msg ? <p className="w-full text-sm text-[var(--brand)]">{msg}</p> : null}
        {err ? <p className="w-full text-sm text-[var(--danger)]">{err}</p> : null}
      </form>

      <div className="bg-white border border-[var(--line)] rounded-xl overflow-x-auto">
        <table className="admin-table w-full text-sm min-w-[900px]">
          <thead className="bg-black/[0.02] text-left text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">关联网站</th>
              <th className="px-3 py-2">最近更新人</th>
              <th className="px-3 py-2">最近更新时间</th>
              <th className="px-3 py-2">客户链接</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-[var(--muted)]">
                  {initialQ ? "未找到匹配的信息核对" : "暂无记录，点击「新建信息核对」开始。"}
                </td>
              </tr>
            ) : (
              items.map((row) => {
                const link = links[row.id];
                const busy = busyId === row.id;
                return (
                  <tr key={row.id} className="admin-tr align-top">
                    <td className="px-3 py-2 font-mono text-xs">{row.id.slice(0, 10)}…</td>
                    <td className="px-3 py-2">
                      {row.site ? (
                        <span title={row.site.client.name}>
                          {row.site.domain}
                          <span className="text-[var(--muted)] text-xs ml-1">
                            ({row.site.client.name})
                          </span>
                        </span>
                      ) : (
                        <span className="text-[var(--muted)]">未关联</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{row.lastSubmittedBy || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatDateTime(row.lastSubmittedAt)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2 items-center">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => issueLink(row.id)}
                          className="text-[var(--brand)] hover:underline disabled:opacity-50 text-xs"
                        >
                          生成链接
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => copyLink(row.id)}
                          className="text-[var(--brand)] hover:underline disabled:opacity-50 text-xs"
                        >
                          复制链接
                        </button>
                      </div>
                      {link?.expiresAt ? (
                        <p className="text-[11px] text-[var(--muted)] mt-1">
                          有效至 {formatDateTime(link.expiresAt)}
                        </p>
                      ) : row.editTokenExpires && row.editUrl ? (
                        <p className="text-[11px] text-[var(--muted)] mt-1">
                          有效至 {formatDateTime(row.editTokenExpires)}
                        </p>
                      ) : (
                        <p className="text-[11px] text-[var(--muted)] mt-1">尚未生成</p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap space-x-2">
                      <Link
                        href={`/admin/promos/${row.id}`}
                        className="text-[var(--brand)] hover:underline"
                      >
                        查看/编辑
                      </Link>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => removePromo(row.id)}
                        className="text-[var(--danger)] hover:underline disabled:opacity-50"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
