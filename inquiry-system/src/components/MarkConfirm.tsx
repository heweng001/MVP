"use client";

import { useState } from "react";
import { STATUS_LABELS } from "@/lib/constants";

export function MarkConfirm({
  token,
  preferredAction,
  canMark,
  reason,
  currentStatus,
}: {
  token: string;
  preferredAction: "" | "valid" | "invalid";
  canMark: boolean;
  reason: string;
  currentStatus: string;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

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
    setDone(true);
  }

  if (!canMark) {
    return (
      <div className="space-y-2">
        <p className="text-sm">{reason || "当前无法标记。"}</p>
        <p className="text-sm text-[var(--muted)]">
          状态：{STATUS_LABELS[status] || status}
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-2">
        <p className="text-[var(--brand)] font-medium">
          已标记为「{STATUS_LABELS[status] || status}」
        </p>
        <p className="text-sm text-[var(--muted)]">
          发信后 72 小时内仍可返回此页修改。
        </p>
        <div className="flex gap-2 pt-2">
          <button
            disabled={busy}
            onClick={() => submit("valid")}
            className="bg-[var(--brand)] text-white rounded-lg px-3 py-2 text-sm"
          >
            改为有效
          </button>
          <button
            disabled={busy}
            onClick={() => submit("invalid")}
            className="bg-[var(--warn)] text-white rounded-lg px-3 py-2 text-sm"
          >
            改为无效
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm">
        请确认将本封询盘标记为：
        <strong className="ml-1">
          {preferredAction === "invalid" ? "垃圾/无效" : preferredAction === "valid" ? "有效询盘" : "请选择"}
        </strong>
      </p>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          disabled={busy}
          onClick={() => submit("valid")}
          className="bg-[var(--brand)] text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50"
        >
          确认：有效询盘
        </button>
        <button
          disabled={busy}
          onClick={() => submit("invalid")}
          className="bg-[var(--warn)] text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50"
        >
          确认：垃圾/无效
        </button>
      </div>
      <p className="text-xs text-[var(--muted)]">
        当前状态：{STATUS_LABELS[status] || status}。需二次确认以防邮件客户端误触。
      </p>
    </div>
  );
}
