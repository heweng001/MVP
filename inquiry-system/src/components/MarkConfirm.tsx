"use client";

import { useState } from "react";
import { STATUS_LABELS } from "@/lib/constants";

export type MarkDetailField = {
  label: string;
  value: string;
  html?: boolean;
};

export function MarkConfirm({
  token,
  canInteract,
  reason,
  currentStatus,
  canMarkValid,
  canMarkInvalid,
  canEditReason,
  invalidBlockedReason = "",
  unlockAvailable = false,
  showUnlockedDetails,
  unlockedFields = [],
  messageTip = "",
  followupTip = "",
  followupError = "",
  initialMarkReason = "",
  justApplied,
  applyError,
}: {
  token: string;
  canInteract: boolean;
  reason: string;
  currentStatus: string;
  canMarkValid: boolean;
  canMarkInvalid: boolean;
  canEditReason: boolean;
  invalidBlockedReason?: string;
  unlockAvailable?: boolean;
  showUnlockedDetails: boolean;
  unlockedFields?: MarkDetailField[];
  messageTip?: string;
  followupTip?: string;
  followupError?: string;
  initialMarkReason?: string;
  justApplied?: boolean;
  applyError?: string;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [markReason, setMarkReason] = useState(initialMarkReason);
  const [savedReason, setSavedReason] = useState(initialMarkReason);
  const [error, setError] = useState(applyError || "");
  const [okMsg, setOkMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(showUnlockedDetails);
  const [detailFields, setDetailFields] = useState(unlockedFields);
  const [bodyTip, setBodyTip] = useState(messageTip);
  const [followTip, setFollowTip] = useState(followupTip);
  const [followErr, setFollowErr] = useState(followupError);

  const marked = status === "valid" || status === "invalid";

  async function submitMark(action: "valid" | "invalid") {
    setBusy(true);
    setError("");
    setOkMsg("");
    const res = await fetch("/api/mark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        action,
        reason: action === "invalid" ? markReason : undefined,
      }),
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
    setDetailsVisible(!!data.showUnlockedDetails);
    if (Array.isArray(data.unlockedFields)) {
      setDetailFields(data.unlockedFields);
    }
    if (typeof data.messageTip === "string") {
      setBodyTip(data.messageTip);
    }
    if (typeof data.followupTip === "string") {
      setFollowTip(data.followupTip);
    }
    if (typeof data.followupError === "string" && data.followupError) {
      setFollowErr(data.followupError);
    }
    setOkMsg(
      action === "valid"
        ? "已标记为有效，新邮件正在发送"
        : "已标记为无效",
    );
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

  if (!canInteract && !marked) {
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
      {!marked ? (
        <div className="rounded-lg bg-teal-50/80 border border-teal-100 px-3.5 py-3 text-sm leading-relaxed text-[var(--ink)]">
          感谢你配合对询盘质量进行反馈。我们将根据你反馈的信息，针对性调整网站引流方向，持续提升询盘质量。
        </div>
      ) : null}

      {marked ? (
        <div className="text-center py-1">
          <p className="text-[var(--brand)] font-semibold text-xl sm:text-2xl tracking-tight">
            {justApplied ? "已成功标记为" : "当前标记为"}「{STATUS_LABELS[status] || status}」
          </p>
          {status === "valid" && followTip ? (
            <p className="text-sm text-[var(--brand)] mt-3 leading-relaxed bg-teal-50 border border-teal-100 rounded-md px-3 py-2">
              {followTip}
            </p>
          ) : null}
          {followErr ? (
            <p className="text-sm text-[var(--danger)] mt-2">第二封邮件发送失败：{followErr}</p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-1">
          <p className="text-sm text-[var(--ink)]">请选择标记结果（点击后立即生效）：</p>
          {unlockAvailable && followTip ? (
            <p className="text-xs text-[var(--muted)] leading-relaxed">{followTip}</p>
          ) : null}
          {invalidBlockedReason ? (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-2">
              {invalidBlockedReason}
            </p>
          ) : null}
        </div>
      )}

      {detailsVisible && (bodyTip || detailFields.length > 0) ? (
        <div className="rounded-lg border border-[var(--line)] bg-white overflow-hidden -mx-0">
          <div className="px-3 py-2 text-sm font-medium bg-black/[0.02] border-b border-[var(--line)]">
            询盘详细信息
          </div>
          <div className="divide-y divide-[var(--line)]">
            {bodyTip ? (
              <div className="px-3 py-2.5 text-sm">
                <div className="text-[11px] text-[var(--muted)] mb-1">Message</div>
                <div className="rounded-md bg-amber-50 border border-amber-200 px-2.5 py-2 text-[13px] leading-relaxed text-amber-900">
                  {bodyTip}
                </div>
              </div>
            ) : null}
            {detailFields.map((f) => (
              <div key={`${f.label}-${f.value.slice(0, 24)}`} className="px-3 py-2.5 text-sm">
                <div className="text-[11px] text-[var(--muted)] mb-1">{f.label}</div>
                {f.html ? (
                  <div
                    className="text-[13px] leading-relaxed overflow-x-auto -mx-1 px-1 [&_table]:min-w-[28rem] sm:[&_table]:min-w-0 [&_table]:w-full [&_table]:text-xs [&_td]:border [&_td]:border-[var(--line)] [&_td]:px-1.5 [&_td]:py-1"
                    dangerouslySetInnerHTML={{ __html: sanitizeJourneyHtml(f.value) }}
                  />
                ) : isHttpUrl(f.value) ? (
                  <a
                    href={f.value.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] leading-relaxed text-[var(--brand)] break-all underline underline-offset-2 hover:opacity-80"
                  >
                    {f.value.trim()}
                  </a>
                ) : (
                  <div className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">{f.value}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {status === "invalid" ? (
        <div className="space-y-1.5">
          <label className="text-sm text-[var(--ink)]" htmlFor="mark-reason">
            反馈原因
          </label>
          <textarea
            id="mark-reason"
            value={markReason}
            onChange={(e) => setMarkReason(e.target.value)}
            disabled={!canEditReason}
            maxLength={500}
            rows={3}
            placeholder="请帮忙反馈标记此询盘为无效的主要原因，以便我们针对性调整网站引流方向和内容，降低无效询盘比例"
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)] disabled:bg-slate-50 disabled:text-[var(--muted)]"
          />
          <p className="text-[11px] text-[var(--muted)]">{markReason.length}/500</p>
        </div>
      ) : null}

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      {okMsg ? <p className="text-sm text-[var(--brand)]">{okMsg}</p> : null}

      {canInteract ? (
        <div className="flex flex-wrap items-stretch sm:items-center gap-2 pt-0.5 [&_button]:flex-1 sm:[&_button]:flex-none [&_button]:min-h-11 sm:[&_button]:min-h-0">
          {marked ? (
            <>
              {status === "invalid" ? (
                <>
                  <button
                    type="button"
                    disabled={busy || !reasonDirty || !canEditReason}
                    onClick={() => submitReasonOnly()}
                    className="bg-[var(--brand)] text-white rounded-md px-3 py-2 text-sm disabled:opacity-40"
                  >
                    保存反馈
                  </button>
                  {canMarkValid ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => submitMark("valid")}
                      className="border border-[var(--line)] bg-white rounded-md px-3 py-2 text-sm disabled:opacity-40"
                    >
                      改为有效
                    </button>
                  ) : null}
                </>
              ) : null}
            </>
          ) : (
            <>
              {canMarkValid ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => submitMark("valid")}
                  className="bg-[var(--brand)] text-white rounded-md px-4 py-2 text-sm disabled:opacity-50"
                >
                  有效询盘
                </button>
              ) : null}
              {canMarkInvalid ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => submitMark("invalid")}
                  className="bg-[var(--warn)] text-white rounded-md px-4 py-2 text-sm disabled:opacity-50"
                >
                  无效
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** 仅保留旅程表格常用标签 */
function sanitizeJourneyHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "");
}

function isHttpUrl(value: string) {
  const v = value.trim();
  if (!/^https?:\/\/\S+$/i.test(v)) return false;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
