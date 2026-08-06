"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const ACTION_CONFIRMS: Record<string, string> = {
  approve_review:
    "确认「审核通过」？\n\n确认后将把该询盘发给客户邮箱（含有效/无效标记链接）。",
  reject_review:
    "确认「标为垃圾」？\n\n确认后状态变为「审核垃圾」，不会发给客户；可在垃圾列表中查看或补发。",
  valid:
    "确认标为「有效」？\n\n确认后该询盘状态将变为有效，并计入有效询盘统计；服务期内将异步发送含买家邮箱的第二封邮件。",
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
  defaultToEmails = "",
  defaultCcEmails = "",
}: {
  id: string;
  mode: "review" | "detail";
  compact?: boolean;
  forwarded?: boolean;
  defaultToEmails?: string;
  defaultCcEmails?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [resendOpen, setResendOpen] = useState(false);
  const [phase, setPhase] = useState<"mark" | "followup">("mark");
  const [toEmails, setToEmails] = useState(defaultToEmails);
  const [ccEmails, setCcEmails] = useState(defaultCcEmails);

  async function run(action: string, extra?: Record<string, unknown>) {
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
    setResendOpen(false);
    router.refresh();
  }

  async function submitResend() {
    if (!toEmails.trim()) {
      setMsg("请填写收件邮箱");
      return;
    }
    await run("resend", {
      phase,
      toEmails: toEmails.trim(),
      ccEmails: ccEmails.trim(),
    });
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
            onClick={() => {
              setToEmails(defaultToEmails);
              setCcEmails(defaultCcEmails);
              setPhase("mark");
              setResendOpen((v) => !v);
              setMsg("");
            }}
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

      {resendOpen ? (
        <div className="w-full mt-2 rounded-lg border border-[var(--line)] bg-black/[0.02] p-3 space-y-2 text-sm">
          <div className="font-medium text-[13px]">补发询盘邮件</div>
          <div className="flex flex-wrap gap-3 text-xs">
            <label className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                name={`phase-${id}`}
                checked={phase === "mark"}
                onChange={() => setPhase("mark")}
              />
              第一封（标记邮件，不含买家邮箱）
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                name={`phase-${id}`}
                checked={phase === "followup"}
                onChange={() => setPhase("followup")}
              />
              第二封（含买家邮箱，可回复）
            </label>
          </div>
          <label className="block text-xs space-y-1">
            <span className="text-[var(--muted)]">收件人（逗号分隔）</span>
            <input
              value={toEmails}
              onChange={(e) => setToEmails(e.target.value)}
              className="w-full rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
              placeholder="to@example.com"
            />
          </label>
          <label className="block text-xs space-y-1">
            <span className="text-[var(--muted)]">抄送（可选）</span>
            <input
              value={ccEmails}
              onChange={(e) => setCcEmails(e.target.value)}
              className="w-full rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
              placeholder="cc@example.com"
            />
          </label>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => submitResend()}
              className="bg-[var(--brand)] text-white rounded-md px-3 py-1.5 text-sm disabled:opacity-50"
            >
              确认补发
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setResendOpen(false)}
              className="border border-[var(--line)] bg-white rounded-md px-3 py-1.5 text-sm"
            >
              取消
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
