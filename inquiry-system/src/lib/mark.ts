import { prisma } from "./prisma";
import { InquiryStatus, markHours, isSpamStatus } from "./constants";

export type MarkAction = "valid" | "invalid";

export async function getInquiryByToken(token: string) {
  return prisma.inquiry.findUnique({
    where: { markToken: token },
    include: { site: { include: { client: true } } },
  });
}

export function markWindowInfo(sentAt: Date | null) {
  if (!sentAt) {
    return { canMark: false, reason: "该询盘尚未发送给客户，无法标记。", remainingMs: 0 };
  }
  const deadline = sentAt.getTime() + markHours() * 60 * 60 * 1000;
  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) {
    return { canMark: false, reason: "已超过 72 小时标记时限，无法再修改。", remainingMs: 0 };
  }
  return { canMark: true, reason: "", remainingMs };
}

function normalizeReason(reason?: string | null) {
  return String(reason ?? "")
    .trim()
    .slice(0, 500);
}

export async function applyMark(token: string, action: MarkAction, reason?: string | null) {
  const inquiry = await getInquiryByToken(token);
  if (!inquiry) return { ok: false as const, error: "无效链接" };

  if (isSpamStatus(inquiry.status) || inquiry.status === InquiryStatus.REVIEW) {
    return { ok: false as const, error: "该询盘未发送给客户，无法标记。" };
  }

  if (inquiry.status === InquiryStatus.TIMEOUT_UNMARKED) {
    return { ok: false as const, error: "已超时未标记，无法再修改。" };
  }

  const window = markWindowInfo(inquiry.sentAt);
  if (!window.canMark) {
    return { ok: false as const, error: window.reason };
  }

  const status = action === "valid" ? InquiryStatus.VALID : InquiryStatus.INVALID;
  const markReason = normalizeReason(reason);

  const updated = await prisma.inquiry.update({
    where: { id: inquiry.id },
    data: {
      status,
      markedAt: new Date(),
      ...(reason !== undefined ? { markReason } : {}),
    },
    include: { site: true },
  });

  return { ok: true as const, inquiry: updated };
}

/** 仅更新反馈原因（已标记且仍在窗口内） */
export async function saveMarkReason(token: string, reason: string) {
  const inquiry = await getInquiryByToken(token);
  if (!inquiry) return { ok: false as const, error: "无效链接" };

  if (inquiry.status !== InquiryStatus.VALID && inquiry.status !== InquiryStatus.INVALID) {
    return { ok: false as const, error: "请先完成有效/无效标记后再填写原因。" };
  }

  const window = markWindowInfo(inquiry.sentAt);
  if (!window.canMark) {
    return { ok: false as const, error: window.reason };
  }

  const updated = await prisma.inquiry.update({
    where: { id: inquiry.id },
    data: { markReason: normalizeReason(reason) },
    include: { site: true },
  });

  return { ok: true as const, inquiry: updated };
}
