"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PROMO_TABS, countKeywordLines, type PromoNoteKey, type PromoTabKey } from "@/lib/promo";
import { formatDateTime } from "@/lib/labels";
import { PromoRichEditor } from "@/components/promo/PromoRichEditor";

type HistoryRow = { id: string; submittedBy: string; createdAt: string };

type SiteOpt = {
  id: string;
  domain: string;
  clientName: string;
};

type PromoData = {
  id: string;
  siteId: string | null;
  keywords: string;
  productPoints: string;
  adPoints: string;
  keywordsNote: string;
  productPointsNote: string;
  adPointsNote: string;
  lastSubmittedBy: string;
  lastSubmittedAt: string | null;
  site: { id: string; domain: string; client: { id: string; name: string } } | null;
  histories: HistoryRow[];
};

export function PromoEditor({
  initial,
  siteOptions,
}: {
  initial: PromoData;
  siteOptions: SiteOpt[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<PromoTabKey>("productPoints");
  const [siteId, setSiteId] = useState(initial.siteId || "");
  const [productPoints, setProductPoints] = useState(initial.productPoints);
  const [adPoints, setAdPoints] = useState(initial.adPoints);
  const [productPointsNote, setProductPointsNote] = useState(initial.productPointsNote);
  const [adPointsNote, setAdPointsNote] = useState(initial.adPointsNote);
  const [histories, setHistories] = useState(initial.histories);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lastBy, setLastBy] = useState(initial.lastSubmittedBy);
  const [lastAt, setLastAt] = useState(initial.lastSubmittedAt);

  const keywordLines = countKeywordLines(initial.keywords);

  const notes: Partial<Record<PromoNoteKey, string>> = {
    productPointsNote,
    adPointsNote,
  };
  const noteSetters: Partial<Record<PromoNoteKey, (v: string) => void>> = {
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
        siteId: siteId || null,
        productPoints,
        adPoints,
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
    setMsg("已提交");
    router.refresh();
  }

  function cancel() {
    router.push("/admin/promos");
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="text-sm text-[var(--muted)] flex flex-wrap gap-x-3 gap-y-1">
        <span>
          ID：<code className="text-[var(--ink)] text-xs">{initial.id}</code>
        </span>
        {initial.site ? (
          <span>
            网站：
            <strong className="text-[var(--ink)]">{initial.site.domain}</strong>
          </span>
        ) : null}
        {lastBy || lastAt ? (
          <span>
            最近更新：{lastBy || "—"} · {formatDateTime(lastAt)}
          </span>
        ) : (
          <span>尚未有人更新</span>
        )}
      </div>

      <div className="bg-white border border-[var(--line)] rounded-xl p-4">
        <label className="text-sm block">
          <span className="text-xs text-[var(--muted)]">关联网站（一站一条，可空）</span>
          <select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5"
          >
            <option value="">不关联</option>
            {siteOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.domain}
                {s.clientName ? ` · ${s.clientName}` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="bg-white border border-[var(--line)] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <div className="font-medium">关键词列表</div>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            另页编辑 · 当前 {keywordLines} 行 · 客户链接请在列表页生成/复制
          </p>
        </div>
        <Link
          href={`/admin/promos/${initial.id}/keywords`}
          className="bg-[var(--brand)] text-white rounded-lg px-3 py-1.5 text-sm"
        >
          编辑关键词
        </Link>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-[var(--line)]">
        {PROMO_TABS.filter((t) => t.key !== "keywords").map((t) => (
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
        <div className="space-y-1">
          <span className="text-xs text-[var(--muted)]">{currentTab.label}（客户可见）</span>
          {tab === "productPoints" ? (
            <PromoRichEditor
              key="productPoints"
              value={productPoints}
              onChange={setProductPoints}
            />
          ) : (
            <PromoRichEditor key="adPoints" value={adPoints} onChange={setAdPoints} />
          )}
        </div>
        <label className="block text-sm space-y-1">
          <span className="text-xs text-[var(--warn)]">内部备注（仅后台可见，客户链接看不到）</span>
          <textarea
            value={notes[currentTab.noteKey] || ""}
            onChange={(e) => noteSetters[currentTab.noteKey]?.(e.target.value)}
            className="w-full border border-[var(--warn)]/40 bg-[var(--warn)]/5 rounded-lg px-3 py-2 text-sm min-h-[100px]"
            placeholder="内部备注，不会出现在客户编辑页…"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={save}
            className="bg-[var(--brand)] text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50"
          >
            {busy ? "提交中…" : "提交"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={cancel}
            className="border border-[var(--line)] rounded-lg px-4 py-2 text-sm hover:bg-black/5 disabled:opacity-50"
          >
            取消
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
