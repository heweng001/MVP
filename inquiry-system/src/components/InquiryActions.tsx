"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const ACTION_CONFIRMS: Record<string, string> = {
  approve_review:
    "确认「审核通过」？\n\n确认后将把该询盘发给客户邮箱（含有效/无效标记链接）。",
  reject_review:
    "确认「标为垃圾」？\n\n确认后状态变为「审核垃圾」，不会发给客户；可在垃圾列表中查看或补发。",
  resend:
    "确认补发？\n\n确认后将再次向客户邮箱发送该询盘邮件（含有效/无效标记链接）。",
  valid:
    "确认标为「有效」？\n\n确认后该询盘状态将变为有效，并计入有效询盘统计（会覆盖客户此前的标记结果）。",
  invalid:
    "确认标为「无效」？\n\n确认后该询盘状态将变为无效，不计入有效询盘统计（会覆盖客户此前的标记结果）。",
  review_spam:
    "确认标为「垃圾」？\n\n确认后该询盘将进入「审核垃圾」，不会按正常询盘发给客户；可在垃圾列表中查看或补发。",
};

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
    const key = action === "set_status" ? String(extra?.status || "") : action;
    const tip = ACTION_CONFIRMS[key];
    if (tip && !confirm(tip)) return;

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
            审核通过
          </button>
          <button
            disabled={busy}
            onClick={() => run("reject_review")}
            className={`${btn} bg-[var(--danger)] text-white`}
          >
            标为垃圾
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
