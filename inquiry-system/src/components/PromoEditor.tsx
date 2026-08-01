"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PROMO_TABS, type PromoNoteKey, type PromoTabKey } from "@/lib/promo";
import { formatDateTime } from "@/lib/labels";

type HistoryRow = { id: string; submittedBy: string; createdAt: string };

type PromoData = {
  id: string;
  keywords: string;
  productPoints: string;
  adPoints: string;
  keywordsNote: string;
  productPointsNote: string;
  adPointsNote: string;
  lastSubmittedBy: string;
  lastSubmittedAt: string | null;
  editTokenExpires: string | null;
  editUrl: string | null;
  client: { id: string; name: string };
  histories: HistoryRow[];
};

export function PromoEditor({
  initial,
  defaultEmail = "",
}: {
  initial: PromoData;
  defaultEmail?: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<PromoTabKey>("keywords");
  const [keywords, setKeywords] = useState(initial.keywords);
  const [productPoints, setProductPoints] = useState(initial.productPoints);
  const [adPoints, setAdPoints] = useState(initial.adPoints);
  const [keywordsNote, setKeywordsNote] = useState(initial.keywordsNote);
  const [productPointsNote, setProductPointsNote] = useState(initial.productPointsNote);
  const [adPointsNote, setAdPointsNote] = useState(initial.adPointsNote);
  const [histories, setHistories] = useState(initial.histories);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState(initial.editUrl);
  const [expiresAt, setExpiresAt] = useState(initial.editTokenExpires);
  const [sendTo, setSendTo] = useState(defaultEmail);
  const [lastBy, setLastBy] = useState(initial.lastSubmittedBy);
  const [lastAt, setLastAt] = useState(initial.lastSubmittedAt);

  const values: Record<PromoTabKey, string> = {
    keywords,
    productPoints,
    adPoints,
  };
  const setters: Record<PromoTabKey, (v: string) => void> = {
    keywords: setKeywords,
    productPoints: setProductPoints,
    adPoints: setAdPoints,
  };
  const notes: Record<PromoNoteKey, string> = {
    keywordsNote,
    productPointsNote,
    adPointsNote,
  };
  const noteSetters: Record<PromoNoteKey, (v: string) => void> = {
    keywordsNote: setKeywordsNote,
    productPointsNote: setProductPointsNote,
    adPointsNote: setAdPointsNote,
  };

  const currentTab = PROMO_TABS.find((t) => t.key === tab)!;

  async function save() {
    setBusy(true);
    setMsg(null);
    setErr(null);
    const res = await fetch(`/api/admin/promos/${initial.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keywords,
        productPoints,
        adPoints,
        keywordsNote,
        productPointsNote,
        adPointsNote,
        submitterName: "管理员",
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(data.error || "保存失败");
      return;
    }
    setLastBy(data.item?.lastSubmittedBy || "管理员");
    setLastAt(data.item?.lastSubmittedAt || new Date().toISOString());
    if (Array.isArray(data.item?.histories)) {
      setHistories(
        data.item.histories.map((h: { id: string; submittedBy: string; createdAt: string | Date }) => ({
          id: h.id,
          submittedBy: h.submittedBy,
          createdAt: typeof h.createdAt === "string" ? h.createdAt : new Date(h.createdAt).toISOString(),
        })),
      );
    }
    setMsg("已保存");
    router.refresh();
  }

  async function issueLink(send: boolean) {
    setBusy(true);
    setMsg(null);
    setErr(null);
    const res = await fetch(`/api/admin/promos/${initial.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: send ? "send_link" : "issue_link",
        to: sendTo,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (data.editUrl) {
      setEditUrl(data.editUrl);
      setExpiresAt(data.expiresAt || null);
    }
    if (!res.ok) {
      setErr(data.error || "操作失败");
      return;
    }
    if (send) setMsg(`编辑链接已发送至 ${sendTo.trim()}`);
    else setMsg("已生成 7 天有效编辑链接，可复制发给客户");
    router.refresh();
  }

  async function copyLink() {
    if (!editUrl) {
      await issueLink(false);
      return;
    }
    try {
      await navigator.clipboard.writeText(editUrl);
      setMsg("链接已复制到剪贴板");
    } catch {
      setErr("复制失败，请手动选择链接复制");
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="text-sm text-[var(--muted)]">
        客户：<strong className="text-[var(--ink)]">{initial.client.name}</strong>
        {lastBy || lastAt ? (
          <span className="ml-3">
            最近更新：{lastBy || "—"} · {formatDateTime(lastAt)}
          </span>
        ) : (
          <span className="ml-3">尚未有人更新</span>
        )}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-[var(--line)]">
        {PROMO_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm rounded-t-lg ${
              tab === t.key
                ? "bg-white border border-[var(--line)] border-b-white -mb-px font-medium"
                : "text-[var(--muted)] hover:bg-black/5"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-[var(--line)] rounded-xl p-4 -mt-px space-y-3">
        <label className="block text-sm space-y-1">
          <span className="text-xs text-[var(--muted)]">{currentTab.label}（客户可见）</span>
          <textarea
            value={values[tab]}
            onChange={(e) => setters[tab](e.target.value)}
            className="w-full border border-[var(--line)] rounded-lg px-3 py-2 text-sm min-h-[180px]"
            placeholder="客户可看到并编辑的内容…"
          />
        </label>
        <label className="block text-sm space-y-1">
          <span className="text-xs text-[var(--warn)]">内部备注（仅后台可见，客户链接看不到）</span>
          <textarea
            value={notes[currentTab.noteKey]}
            onChange={(e) => noteSetters[currentTab.noteKey](e.target.value)}
            className="w-full border border-[var(--warn)]/40 bg-[var(--warn)]/5 rounded-lg px-3 py-2 text-sm min-h-[100px]"
            placeholder="内部备注，不会出现在客户编辑页…"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={save}
          className="bg-[var(--brand)] text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50"
        >
          保存全部页签
        </button>
      </div>

      <div className="bg-white border border-[var(--line)] rounded-xl p-4 space-y-3">
        <div className="text-sm font-medium">客户编辑链接（有效期 7 天）</div>
        <p className="text-xs text-[var(--muted)]">
          客户只能编辑三个页签的正文，看不到内部备注。提交时须填写姓名。
        </p>
        {editUrl ? (
          <div className="text-xs break-all bg-black/[0.03] rounded-lg px-3 py-2 border border-[var(--line)]">
            {editUrl}
            {expiresAt ? (
              <div className="mt-1 text-[var(--muted)]">有效期至 {formatDateTime(expiresAt)}</div>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-[var(--warn)]">尚未生成有效链接</p>
        )}
        <div className="flex flex-wrap gap-2 items-end">
          <button
            type="button"
            disabled={busy}
            onClick={() => issueLink(false)}
            className="border border-[var(--line)] rounded-lg px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-50"
          >
            生成新链接
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={copyLink}
            className="border border-[var(--line)] rounded-lg px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-50"
          >
            复制链接
          </button>
        </div>
        <div className="flex flex-wrap gap-2 items-end pt-1">
          <label className="text-sm flex-1 min-w-[200px]">
            <span className="text-xs text-[var(--muted)]">发送到邮箱</span>
            <input
              value={sendTo}
              onChange={(e) => setSendTo(e.target.value)}
              placeholder="client@example.com"
              className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="button"
            disabled={busy || !sendTo.trim()}
            onClick={() => issueLink(true)}
            className="bg-[var(--brand)] text-white rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
          >
            生成并发送
          </button>
        </div>
      </div>

      <div className="bg-white border border-[var(--line)] rounded-xl p-4 space-y-2">
        <div className="text-sm font-medium">更新记录</div>
        {histories.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">暂无更新记录</p>
        ) : (
          <ul className="text-sm divide-y divide-[var(--line)] max-h-64 overflow-y-auto">
            {histories.map((h) => (
              <li key={h.id} className="py-2 flex justify-between gap-3">
                <span>{h.submittedBy}</span>
                <span className="text-[var(--muted)] whitespace-nowrap">
                  {formatDateTime(h.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {msg && <p className="text-sm text-[var(--brand)]">{msg}</p>}
      {err && <p className="text-sm text-[var(--danger)]">{err}</p>}
    </div>
  );
}
