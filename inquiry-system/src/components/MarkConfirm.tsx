"use client";

import { useState } from "react";
import { STATUS_LABELS } from "@/lib/constants";
import { formatMarkRemaining } from "@/lib/wp-fields";

export function MarkConfirm({
  token,
  canMark,
  reason,
  currentStatus,
  remainingMs,
  initialMarkReason = "",
  justApplied,
  applyError,
}: {
  token: string;
  canMark: boolean;
  reason: string;
  currentStatus: string;
  remainingMs: number;
  initialMarkReason?: string;
  /** 本次从邮件链接一键完成了标记 */
  justApplied?: boolean;
  applyError?: string;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [markReason, setMarkReason] = useState(initialMarkReason);
  const [savedReason, setSavedReason] = useState(initialMarkReason);
  const [error, setError] = useState(applyError || "");
  const [okMsg, setOkMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const marked = status === "valid" || status === "invalid";

  async function submitMark(action: "valid" | "invalid") {
    setBusy(true);
    setError("");
    setOkMsg("");
    const res = await fetch("/api/mark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action, reason: markReason }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "标记失败");
      return;
    }
    setStatus(data.status);
    if (typeof data.markReason === "string") {
      setMarkReason(data.markReason);
      setSavedReason(data.markReason);
    }
    setOkMsg("已更新标记结果");
  }

  async function submitReasonOnly() {
    setBusy(true);
    setError("");
    setOkMsg("");
    const res = await fetch("/api/mark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action: "reason", reason: markReason }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "保存失败");
      return;
    }
    if (typeof data.markReason === "string") {
      setMarkReason(data.markReason);
      setSavedReason(data.markReason);
    }
    setOkMsg("反馈已保存，感谢你的配合");
  }

  const reasonDirty = markReason.trim() !== savedReason.trim();

  if (!canMark && !marked) {
    return (
      <div className="space-y-2">
        <p className="text-sm">{reason || "当前无法标记。"}</p>
        <p className="text-sm text-[var(--muted)]">
          状态：{STATUS_LABELS[status] || status}
        </p>
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-teal-50/80 border border-teal-100 px-3.5 py-3 text-sm leading-relaxed text-[var(--ink)]">
        感谢你配合对询盘质量进行反馈。我们将根据你反馈的信息，针对性调整网站引流方向，持续提升询盘质量。
      </div>

      {marked ? (
        <div className="space-y-1">
          <p className="text-[var(--brand)] font-medium text-base">
            {justApplied ? "已成功标记为" : "当前标记为"}「{STATUS_LABELS[status] || status}」
          </p>
          {canMark ? (
            <p className="text-sm text-[var(--muted)]">
              仍可修改，剩余时间：{formatMarkRemaining(remainingMs)}
            </p>
          ) : (
            <p className="text-sm text-[var(--muted)]">{reason || "标记窗口已结束，不可再改。"}</p>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          <p className="text-sm text-[var(--ink)]">请选择标记结果（点击后立即生效）：</p>
          <p className="text-xs text-[var(--muted)]">
            剩余可改时间：{formatMarkRemaining(remainingMs)}
          </p>
        </div>
      )}

      {canMark || marked ? (
        <div className="space-y-1.5">
          <label className="text-sm text-[var(--ink)]" htmlFor="mark-reason">
            反馈原因 <span className="text-[var(--muted)] font-normal">（选填）</span>
          </label>
          <textarea
            id="mark-reason"
            value={markReason}
            onChange={(e) => setMarkReason(e.target.value)}
            disabled={!canMark}
            maxLength={500}
            rows={3}
            placeholder="例如：询盘与业务无关、重复提交、联系方式虚假、质量较好等"
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)] disabled:bg-slate-50 disabled:text-[var(--muted)]"
          />
          <p className="text-[11px] text-[var(--muted)]">{markReason.length}/500</p>
        </div>
      ) : null}

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      {okMsg ? <p className="text-sm text-[var(--brand)]">{okMsg}</p> : null}

      {canMark ? (
        <div className="flex flex-wrap gap-2 pt-0.5">
          {marked ? (
            <>
              <button
                type="button"
                disabled={busy || !reasonDirty}
                onClick={() => submitReasonOnly()}
                className="bg-[var(--brand)] text-white rounded-md px-3 py-2 text-sm disabled:opacity-40"
              >
                保存反馈
              </button>
              <button
                type="button"
                disabled={busy || status === "valid"}
                onClick={() => submitMark("valid")}
                className="border border-[var(--line)] bg-white rounded-md px-3 py-2 text-sm disabled:opacity-40"
              >
                改为有效
              </button>
              <button
                type="button"
                disabled={busy || status === "invalid"}
                onClick={() => submitMark("invalid")}
                className="border border-[var(--line)] bg-white rounded-md px-3 py-2 text-sm disabled:opacity-40"
              >
                改为无效
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => submitMark("valid")}
                className="bg-[var(--brand)] text-white rounded-md px-4 py-2 text-sm disabled:opacity-50"
              >
                有效询盘
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => submitMark("invalid")}
                className="bg-[var(--warn)] text-white rounded-md px-4 py-2 text-sm disabled:opacity-50"
              >
                垃圾/无效
              </button>
            </>
          )}
        </div>
      ) : marked && savedReason ? (
        <p className="text-sm text-[var(--muted)] whitespace-pre-wrap">你填写的反馈：{savedReason}</p>
      ) : null}
    </div>
  );
}
