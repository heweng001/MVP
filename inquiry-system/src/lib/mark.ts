import { after } from "next/server";
import { prisma } from "./prisma";
import { InquiryStatus, isSpamStatus, markHours } from "./constants";
import { mailContentGate, MAIL_TIPS } from "./mail-content-gate";
import { buildFeedbackDetailFields } from "./inquiry-mail-fields";
import { sendInquiryFollowupById } from "./pipeline";

export type MarkAction = "valid" | "invalid";

export const INVALID_MARK_EXPIRED_TIP =
  "发信已超过 72 小时，无法再标记为无效。你仍可将询盘标记为有效；标记有效后系统将发送含买家邮箱的新邮件。";

export type MarkCapabilities = {
  canInteract: boolean;
  reason: string;
  canMarkValid: boolean;
  canMarkInvalid: boolean;
  canEditReason: boolean;
  invalidBlockedReason: string;
  /** 服务期内：引导标有效以收第二封 */
  unlockAvailable: boolean;
  /** 到期站：展示字段区 + 续费提示 */
  showUnlockedDetails: boolean;
  followupTip: string;
};

export async function getInquiryByToken(token: string) {
  return prisma.inquiry.findUnique({
    where: { markToken: token },
    include: { site: { include: { client: true } } },
  });
}

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
      followupTip: "",
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
      followupTip: "",
    };
  }

  const gate = mailContentGate(inquiry.site);
  const isValid = inquiry.status === InquiryStatus.VALID;
  const isInvalid = inquiry.status === InquiryStatus.INVALID;
  const unmarked = inquiry.status === InquiryStatus.PENDING;
  const invalidExpired = isInvalidMarkExpired(inquiry.sentAt);

  let followupTip = "";
  if (gate.expired) {
    // 到期站：反馈页统一提示需续费才能收第二封（不发第二封）
    followupTip = MAIL_TIPS.expiredRenewFeedback;
  } else if (isValid) {
    followupTip = MAIL_TIPS.followupSentFeedback;
  } else if (unmarked) {
    followupTip = MAIL_TIPS.markValidToGetFollowup;
  }

  return {
    canInteract: true,
    reason: "",
    canMarkValid: unmarked || isInvalid,
    canMarkInvalid: unmarked && !invalidExpired,
    canEditReason: isInvalid,
    invalidBlockedReason:
      unmarked && invalidExpired
        ? gate.expired
          ? "发信已超过 72 小时，无法再标记为无效。你仍可将询盘标记为有效。"
          : INVALID_MARK_EXPIRED_TIP
        : "",
    unlockAvailable: !gate.expired && (unmarked || isInvalid),
    /** 到期站第一封已与到期前一致，反馈页不再铺「解锁详情」 */
    showUnlockedDetails: false,
    followupTip,
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

/** 响应返回后再发第二封，避免阻塞标记页 */
function scheduleFollowupSend(inquiryId: string, source: "mark" | "admin") {
  after(() => {
    void sendInquiryFollowupById(inquiryId).catch((e) => {
      console.error(`[${source}] followup send failed`, inquiryId, e);
    });
  });
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
    const wasAlreadyValid = inquiry.status === InquiryStatus.VALID;
    const updated = await prisma.inquiry.update({
      where: { id: inquiry.id },
      data: {
        status: InquiryStatus.VALID,
        markedAt: new Date(),
        // 保留此前「无效」时填写的反馈原因，不清空
      },
      include: { site: true },
    });

    const gate = mailContentGate(updated.site);
    if (!wasAlreadyValid && !gate.expired) {
      scheduleFollowupSend(updated.id, "mark");
    }

    const fresh = await getInquiryByToken(token);
    return {
      ok: true as const,
      inquiry: fresh ?? updated,
      followupError: "",
    };
  }

  if (inquiry.status === InquiryStatus.VALID) {
    return { ok: false as const, error: "已标记为有效的询盘不可再改为无效。" };
  }
  if (isInvalidMarkExpired(inquiry.sentAt)) {
    return { ok: false as const, error: INVALID_MARK_EXPIRED_TIP };
  }
  if (
    inquiry.status !== InquiryStatus.PENDING &&
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

export function unlockedDetailFields(inquiry: {
  rawPayload: string;
  status: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  pageUrl: string;
  site: { siteType: string; endDate: Date | string | null };
}) {
  return buildFeedbackDetailFields({
    site: inquiry.site,
    rawPayload: inquiry.rawPayload,
    status: inquiry.status,
    name: inquiry.name,
    email: inquiry.email,
    phone: inquiry.phone,
    message: inquiry.message,
    pageUrl: inquiry.pageUrl,
  });
}

/** 管理员将状态改为有效时触发第二封（服务期内，异步） */
export async function maybeSendFollowupAfterAdminValid(inquiryId: string) {
  const inquiry = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    include: { site: true },
  });
  if (!inquiry) return;
  const gate = mailContentGate(inquiry.site);
  if (gate.expired) return;
  scheduleFollowupSend(inquiryId, "admin");
}
