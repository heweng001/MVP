"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  initial: {
    autoSpamMin: number;
    reviewMin: number;
  };
};

export function SpamRoutingSettingsForm({ initial }: Props) {
  const router = useRouter();
  const [autoSpamMin, setAutoSpamMin] = useState(String(initial.autoSpamMin));
  const [reviewMin, setReviewMin] = useState(String(initial.reviewMin));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const autoN = Number(autoSpamMin);
  const reviewN = Number(reviewMin);
  const directMax = Number.isFinite(reviewN) ? Math.max(0, reviewN - 1) : "—";

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    const res = await fetch("/api/admin/settings/spam-routing", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        autoSpamMin: Number(autoSpamMin),
        reviewMin: Number(reviewMin),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(data.error || "保存失败");
      return;
    }
    if (data.spamRouting) {
      setAutoSpamMin(String(data.spamRouting.autoSpamMin));
      setReviewMin(String(data.spamRouting.reviewMin));
    }
    setMsg("已保存垃圾分流转阈值");
    router.refresh();
  }

  return (
    <form
      onSubmit={onSave}
      className="bg-white border border-[var(--line)] rounded-xl p-5 space-y-4 max-w-xl"
    >
      <div>
        <div className="text-sm font-medium">垃圾分流转阈值</div>
        <p className="text-xs text-[var(--muted)] mt-1 leading-relaxed">
          按垃圾分决定：自动垃圾 / 人工审核 / 直接转发客户。分数范围 0–100；人工审核下限须小于自动垃圾阈值。
        </p>
      </div>

      <label className="block text-sm space-y-1">
        <span>自动垃圾</span>
        <div className="flex items-center gap-2">
          <span className="text-[var(--muted)] text-xs whitespace-nowrap">分数 ≥</span>
          <input
            type="number"
            min={1}
            max={100}
            required
            value={autoSpamMin}
            onChange={(e) => setAutoSpamMin(e.target.value)}
            className="w-24 border border-[var(--line)] rounded-lg px-3 py-2"
          />
          <span className="text-xs text-[var(--muted)]">→ 系统自动拦截，不发客户</span>
        </div>
      </label>

      <label className="block text-sm space-y-1">
        <span>人工审核</span>
        <div className="flex items-center gap-2">
          <span className="text-[var(--muted)] text-xs whitespace-nowrap">分数 ≥</span>
          <input
            type="number"
            min={0}
            max={100}
            required
            value={reviewMin}
            onChange={(e) => setReviewMin(e.target.value)}
            className="w-24 border border-[var(--line)] rounded-lg px-3 py-2"
          />
          <span className="text-xs text-[var(--muted)]">
            且 {"<"} {Number.isFinite(autoN) ? autoN : "自动垃圾阈值"} → 进入待审核
          </span>
        </div>
      </label>

      <label className="block text-sm space-y-1">
        <span>直接转发客户</span>
        <div className="flex items-center gap-2">
          <span className="text-[var(--muted)] text-xs whitespace-nowrap">分数 ≤</span>
          <input
            type="number"
            min={0}
            max={99}
            value={String(directMax)}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isFinite(v)) return;
              setReviewMin(String(Math.min(100, Math.max(0, Math.round(v) + 1))));
            }}
            className="w-24 border border-[var(--line)] rounded-lg px-3 py-2"
          />
          <span className="text-xs text-[var(--muted)]">→ 不经人工审核，直接代发</span>
        </div>
        <p className="text-[11px] text-[var(--muted)]">
          与「人工审核」下限联动：直接转发最高分 = 人工审核阈值 − 1
          {Number.isFinite(reviewN) ? `（当前 ${directMax}）` : ""}
        </p>
      </label>

      <div className="rounded-lg border border-[var(--line)] bg-slate-50 px-3 py-2 text-xs text-[var(--muted)] leading-relaxed">
        当前规则预览：
        {Number.isFinite(autoN) && Number.isFinite(reviewN) ? (
          <>
            {" "}
            ≥{autoN} 自动垃圾；{reviewN}–{Math.max(reviewN, autoN - 1)} 人工审核；≤
            {Math.max(0, reviewN - 1)} 直接转发
          </>
        ) : (
          " —"
        )}
      </div>

      <button
        type="submit"
        disabled={busy}
        className="bg-[var(--brand)] text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50"
      >
        保存阈值
      </button>

      {msg ? <p className="text-sm text-[var(--brand)]">{msg}</p> : null}
      {err ? <p className="text-sm text-[var(--danger)]">{err}</p> : null}
    </form>
  );
}
