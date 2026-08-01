"use client";

import { useState } from "react";
import { PROMO_TABS, type PromoTabKey } from "@/lib/promo";

export function PromoPublicEditor({
  token,
  clientName,
  expiresAt,
  initial,
}: {
  token: string;
  clientName: string;
  expiresAt: string | null;
  initial: {
    keywords: string;
    productPoints: string;
    adPoints: string;
  };
}) {
  const [tab, setTab] = useState<PromoTabKey>("keywords");
  const [keywords, setKeywords] = useState(initial.keywords);
  const [productPoints, setProductPoints] = useState(initial.productPoints);
  const [adPoints, setAdPoints] = useState(initial.adPoints);
  const [submitterName, setSubmitterName] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

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

  async function submit() {
    setBusy(true);
    setErr("");
    const res = await fetch(`/api/promo/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keywords,
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
        <h1 className="text-xl font-semibold">填写主推信息</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          客户：{clientName}
          {expiresAt ? (
            <span className="ml-2">· 请于 {new Date(expiresAt).toLocaleString("zh-CN")} 前提交</span>
          ) : null}
        </p>
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

      <div className="bg-white border border-[var(--line)] rounded-xl p-4 space-y-3">
        <label className="block text-sm space-y-1">
          <span className="text-xs text-[var(--muted)]">
            {PROMO_TABS.find((t) => t.key === tab)?.label}
          </span>
          <textarea
            value={values[tab]}
            onChange={(e) => setters[tab](e.target.value)}
            className="w-full border border-[var(--line)] rounded-lg px-3 py-2 text-sm min-h-[200px]"
            placeholder="请填写本页内容，切换页签可编辑其它内容"
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
          {busy ? "提交中…" : "提交全部内容"}
        </button>
        {err ? <p className="text-sm text-[var(--danger)]">{err}</p> : null}
      </div>
    </div>
  );
}
