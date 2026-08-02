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
  justApplied,
  applyError,
}: {
  token: string;
  canMark: boolean;
  reason: string;
  currentStatus: string;
  remainingMs: number;
  /** 本次从邮件链接一键完成了标记 */
  justApplied?: boolean;
  applyError?: string;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [error, setError] = useState(applyError || "");
  const [busy, setBusy] = useState(false);
  const marked = status === "valid" || status === "invalid";

  async function submit(action: "valid" | "invalid") {
    setBusy(true);
    setError("");
    const res = await fetch("/api/mark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "标记失败");
      return;
    }
    setStatus(data.status);
  }

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

  if (marked) {
    return (
      <div className="space-y-3">
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
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        {canMark ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={busy || status === "valid"}
              onClick={() => submit("valid")}
              className="bg-[var(--brand)] text-white rounded-md px-3 py-2 text-sm disabled:opacity-40"
            >
              改为有效
            </button>
            <button
              type="button"
              disabled={busy || status === "invalid"}
              onClick={() => submit("invalid")}
              className="bg-[var(--warn)] text-white rounded-md px-3 py-2 text-sm disabled:opacity-40"
            >
              改为无效
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  // 未带邮件动作打开页面：直接一点即标记（无二次确认）
  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--muted)]">请选择标记结果（点击后立即生效）：</p>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => submit("valid")}
          className="bg-[var(--brand)] text-white rounded-md px-4 py-2 text-sm disabled:opacity-50"
        >
          有效询盘
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => submit("invalid")}
          className="bg-[var(--warn)] text-white rounded-md px-4 py-2 text-sm disabled:opacity-50"
        >
          垃圾/无效
        </button>
      </div>
      <p className="text-xs text-[var(--muted)]">
        剩余可改时间：{formatMarkRemaining(remainingMs)}
      </p>
    </div>
  );
}
