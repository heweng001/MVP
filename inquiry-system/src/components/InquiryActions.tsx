"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function InquiryActions({
  id,
  mode,
  compact = false,
  forwarded = false,
}: {
  id: string;
  mode: "review" | "detail";
  compact?: boolean;
  /** 已转发则不可标垃圾（回撤） */
  forwarded?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function run(action: string, extra?: Record<string, string>) {
    setBusy(true);
    setMsg("");
    const res = await fetch(`/api/admin/inquiries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error || "操作失败");
      return;
    }
    router.refresh();
  }

  const btn = compact
    ? "text-[11px] px-1.5 py-0.5 rounded disabled:opacity-50 whitespace-nowrap"
    : "text-sm rounded-lg px-3 py-1.5 disabled:opacity-50";

  return (
    <div className={`flex flex-wrap items-center ${compact ? "gap-1" : "gap-2"}`}>
      {mode === "review" ? (
        <>
          <button
            disabled={busy}
            onClick={() => run("approve_review")}
            className={`${btn} bg-[var(--brand)] text-white`}
          >
            通过发送
          </button>
          <button
            disabled={busy}
            onClick={() => run("reject_review")}
            className={`${btn} bg-[var(--danger)] text-white`}
          >
            驳回
          </button>
        </>
      ) : (
        <>
          <button
            disabled={busy}
            onClick={() => run("resend")}
            className={`${btn} border border-[var(--line)] bg-white`}
          >
            补发
          </button>
          <button
            disabled={busy}
            onClick={() => run("set_status", { status: "valid" })}
            className={`${btn} bg-[var(--brand)] text-white`}
          >
            有效
          </button>
          <button
            disabled={busy}
            onClick={() => run("set_status", { status: "invalid" })}
            className={`${btn} bg-[var(--warn)] text-white`}
          >
            无效
          </button>
          {!forwarded ? (
            <button
              disabled={busy}
              onClick={() => run("set_status", { status: "review_spam" })}
              className={`${btn} bg-[var(--danger)] text-white`}
            >
              垃圾
            </button>
          ) : null}
        </>
      )}
      {msg ? <span className="text-[11px] text-[var(--danger)]">{msg}</span> : null}
    </div>
  );
}
