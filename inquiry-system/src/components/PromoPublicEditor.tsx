"use client";

import { useState } from "react";
import Link from "next/link";
import { PROMO_TABS, countKeywordLines, type PromoTabKey } from "@/lib/promo";

export function PromoPublicEditor({
  token,
  displayLabel,
  expiresAt,
  initial,
}: {
  token: string;
  displayLabel: string;
  expiresAt: string | null;
  initial: {
    keywords: string;
    productPoints: string;
    adPoints: string;
  };
}) {
  const [tab, setTab] = useState<Exclude<PromoTabKey, "keywords">>("productPoints");
  const [productPoints, setProductPoints] = useState(initial.productPoints);
  const [adPoints, setAdPoints] = useState(initial.adPoints);
  const [submitterName, setSubmitterName] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const keywordLines = countKeywordLines(initial.keywords);

  async function submit() {
    setBusy(true);
    setErr("");
    const res = await fetch(`/api/promo/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productPoints,
        adPoints,
        submitterName,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(data.error || "提交失败");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-[var(--brand)] font-medium">已提交，感谢配合。</p>
        <p className="text-[var(--muted)]">提交人：{submitterName.trim()}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">填写信息核对</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          {displayLabel}
          {expiresAt ? (
            <span className="ml-2">· 请于 {new Date(expiresAt).toLocaleString("zh-CN")} 前提交</span>
          ) : null}
        </p>
      </div>

      <div className="rounded-xl border border-[var(--line)] bg-black/[0.02] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <div className="font-medium">关键词列表</div>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            点进另页编辑 · 当前 {keywordLines} 行
          </p>
        </div>
        <Link
          href={`/p/${token}/keywords`}
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
            onClick={() => setTab(t.key as Exclude<PromoTabKey, "keywords">)}
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

      <div className="bg-white border border-[var(--line)] rounded-xl p-4 space-y-3">
        <label className="block text-sm space-y-1">
          <span className="text-xs text-[var(--muted)]">
            {PROMO_TABS.find((t) => t.key === tab)?.label}
          </span>
          <textarea
            value={tab === "productPoints" ? productPoints : adPoints}
            onChange={(e) =>
              tab === "productPoints"
                ? setProductPoints(e.target.value)
                : setAdPoints(e.target.value)
            }
            className="w-full border border-[var(--line)] rounded-lg px-3 py-2 text-sm min-h-[180px]"
            placeholder="请填写本页内容"
          />
        </label>
        <label className="block text-sm space-y-1">
          <span className="text-xs text-[var(--muted)]">您的姓名（提交必填）</span>
          <input
            value={submitterName}
            onChange={(e) => setSubmitterName(e.target.value)}
            className="w-full border border-[var(--line)] rounded-lg px-3 py-2 text-sm"
            placeholder="请输入姓名"
            required
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="bg-[var(--brand)] text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50"
        >
          {busy ? "提交中…" : "提交产品/广告要点"}
        </button>
        {err ? <p className="text-sm text-[var(--danger)]">{err}</p> : null}
      </div>
    </div>
  );
}
