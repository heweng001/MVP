import { prisma } from "./prisma";
import { InquiryStatus, isSpamStatus, markHours } from "./constants";
import { mailContentGate } from "./mail-content-gate";
import { extractHiddenFields } from "./wp-fields";

export type MarkAction = "valid" | "invalid";

export const INVALID_MARK_EXPIRED_TIP =
  "发信已超过 72 小时，无法再标记为无效。你仍可将询盘标记为有效，以便在反馈页查看完整详情。";

export type MarkCapabilities = {
  /** 已发送给客户，可进入反馈页交互 */
  canInteract: boolean;
  reason: string;
  canMarkValid: boolean;
  canMarkInvalid: boolean;
  canEditReason: boolean;
  /** 超过 72 小时导致不可标无效时的提示 */
  invalidBlockedReason: string;
  /** SEO 未到期：标记有效后可看详细信息 */
  unlockAvailable: boolean;
  /** SEO 未到期且已标有效：展示 geo / journey / hidden */
  showUnlockedDetails: boolean;
};

export async function getInquiryByToken(token: string) {
  return prisma.inquiry.findUnique({
    where: { markToken: token },
    include: { site: { include: { client: true } } },
  });
}

/** 发信后是否已超过可标「无效」的时限 */
export function isInvalidMarkExpired(sentAt: Date | null, now = new Date()) {
  if (!sentAt) return false;
  const deadline = sentAt.getTime() + markHours() * 60 * 60 * 1000;
  return now.getTime() > deadline;
}

export function getMarkCapabilities(inquiry: {
  status: string;
  sentAt: Date | null;
  site: { siteType: string; endDate: Date | string | null };
}): MarkCapabilities {
  if (!inquiry.sentAt) {
    return {
      canInteract: false,
      reason: "该询盘尚未发送给客户，无法标记。",
      canMarkValid: false,
      canMarkInvalid: false,
      canEditReason: false,
      invalidBlockedReason: "",
      unlockAvailable: false,
      showUnlockedDetails: false,
    };
  }

  if (isSpamStatus(inquiry.status) || inquiry.status === InquiryStatus.REVIEW) {
    return {
      canInteract: false,
      reason: "该询盘未发送给客户，无法标记。",
      canMarkValid: false,
      canMarkInvalid: false,
      canEditReason: false,
      invalidBlockedReason: "",
      unlockAvailable: false,
      showUnlockedDetails: false,
    };
  }

  const gate = mailContentGate(inquiry.site);
  const isValid = inquiry.status === InquiryStatus.VALID;
  const isInvalid = inquiry.status === InquiryStatus.INVALID;
  const unmarked =
    inquiry.status === InquiryStatus.PENDING ||
    inquiry.status === InquiryStatus.TIMEOUT_UNMARKED;
  const invalidExpired = isInvalidMarkExpired(inquiry.sentAt);

  return {
    canInteract: true,
    reason: "",
    // 未标记，或已标无效 → 可改为有效；已有效不可再改状态
    canMarkValid: unmarked || isInvalid,
    // 仅未标记且未超 72 小时可标无效
    canMarkInvalid: unmarked && !invalidExpired,
    canEditReason: isInvalid,
    invalidBlockedReason:
      unmarked && invalidExpired ? INVALID_MARK_EXPIRED_TIP : "",
    unlockAvailable: gate.seoUnlock,
    showUnlockedDetails: isValid && gate.seoUnlock,
  };
}

/** @deprecated 使用 getMarkCapabilities */
export function markWindowInfo(sentAt: Date | null) {
  if (!sentAt) {
    return { canMark: false, reason: "该询盘尚未发送给客户，无法标记。", remainingMs: 0 };
  }
  return { canMark: true, reason: "", remainingMs: Number.POSITIVE_INFINITY };
}

function normalizeReason(reason?: string | null) {
  return String(reason ?? "")
    .trim()
    .slice(0, 500);
}

export async function applyMark(token: string, action: MarkAction, reason?: string | null) {
  const inquiry = await getInquiryByToken(token);
  if (!inquiry) return { ok: false as const, error: "无效链接" };

  const caps = getMarkCapabilities(inquiry);
  if (!caps.canInteract) {
    return { ok: false as const, error: caps.reason || "当前无法标记。" };
  }

  if (action === "valid") {
    if (!caps.canMarkValid) {
      return { ok: false as const, error: "当前状态不可标记为有效。" };
    }
    const updated = await prisma.inquiry.update({
      where: { id: inquiry.id },
      data: {
        status: InquiryStatus.VALID,
        markedAt: new Date(),
        markReason: "",
      },
      include: { site: true },
    });
    return { ok: true as const, inquiry: updated };
  }

  // invalid：已有效不可改；超 72 小时不可标无效
  if (inquiry.status === InquiryStatus.VALID) {
    return { ok: false as const, error: "已标记为有效的询盘不可再改为无效。" };
  }
  if (isInvalidMarkExpired(inquiry.sentAt)) {
    return { ok: false as const, error: INVALID_MARK_EXPIRED_TIP };
  }
  if (
    inquiry.status !== InquiryStatus.PENDING &&
    inquiry.status !== InquiryStatus.TIMEOUT_UNMARKED &&
    inquiry.status !== InquiryStatus.INVALID
  ) {
    return { ok: false as const, error: "当前状态不可标记为无效。" };
  }

  const markReason = reason !== undefined ? normalizeReason(reason) : undefined;
  const updated = await prisma.inquiry.update({
    where: { id: inquiry.id },
    data: {
      status: InquiryStatus.INVALID,
      markedAt: new Date(),
      ...(markReason !== undefined ? { markReason } : {}),
    },
    include: { site: true },
  });

  return { ok: true as const, inquiry: updated };
}

/** 仅更新反馈原因（仅无效询盘） */
export async function saveMarkReason(token: string, reason: string) {
  const inquiry = await getInquiryByToken(token);
  if (!inquiry) return { ok: false as const, error: "无效链接" };

  if (inquiry.status !== InquiryStatus.INVALID) {
    return { ok: false as const, error: "仅无效询盘可填写反馈原因。" };
  }

  const caps = getMarkCapabilities(inquiry);
  if (!caps.canEditReason) {
    return { ok: false as const, error: caps.reason || "当前无法保存反馈原因。" };
  }

  const updated = await prisma.inquiry.update({
    where: { id: inquiry.id },
    data: { markReason: normalizeReason(reason) },
    include: { site: true },
  });

  return { ok: true as const, inquiry: updated };
}

export function unlockedDetailFields(rawPayload: string | null | undefined) {
  return extractHiddenFields(rawPayload).map((f) => ({
    label: f.label,
    value: f.value,
    html: !!f.html,
  }));
}
