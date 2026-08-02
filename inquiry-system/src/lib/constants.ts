export const InquiryStatus = {
  REVIEW: "review",
  PENDING: "pending",
  VALID: "valid",
  INVALID: "invalid",
  TIMEOUT_UNMARKED: "timeout_unmarked",
  /** 系统自动判定垃圾 */
  AUTO_SPAM: "auto_spam",
  /** 管理员审核标为垃圾 / 手动标为垃圾 */
  REVIEW_SPAM: "review_spam",
} as const;

export type InquiryStatusValue =
  (typeof InquiryStatus)[keyof typeof InquiryStatus];

export const SPAM_STATUSES = [
  InquiryStatus.AUTO_SPAM,
  InquiryStatus.REVIEW_SPAM,
] as const;

export function isSpamStatus(status: string) {
  return (
    status === InquiryStatus.AUTO_SPAM || status === InquiryStatus.REVIEW_SPAM
  );
}

export const STATUS_LABELS: Record<string, string> = {
  review: "待审核",
  pending: "待标记",
  valid: "有效",
  invalid: "无效",
  timeout_unmarked: "超时未标记",
  auto_spam: "自动垃圾",
  review_spam: "审核垃圾",
};

/** 询盘状态 / 列表页签悬停说明 */
export const STATUS_HINTS: Record<string, string> = {
  all: "显示当前筛选条件下的所有询盘。",
  review: "垃圾分达到人工审核阈值且未达自动拦截阈值，可审核通过（发给客户）或标为垃圾（不发给客户）；超过 6 小时未处理将自动发给客户。",
  spam: "未发给客户的垃圾询盘：含系统自动判定的「自动垃圾」，以及管理员标为垃圾的「审核垃圾」。",
  auto_spam: "系统按垃圾分自动判定为明显垃圾，未发给客户；可补发。",
  review_spam: "管理员在待审核中标为垃圾，或对未转发询盘手动标为垃圾。",
  forwarded: "已成功发给客户的询盘（含待标记、超时未标记、有效、无效）。",
  pending: "已转发且仍在标记窗口内，等待客户点有效/无效。",
  timeout_unmarked: "发信已满 72 小时仍未标记；展示为超时未标记，统计上可与待标记一并计入有效占比分子。",
  valid: "客户（或管理员）已标记为有效询盘。",
  invalid: "客户（或管理员）已标记为无效。",
};

export function spamThreshold() {
  return Number(process.env.SPAM_THRESHOLD || 80);
}

export function reviewHours() {
  return Number(process.env.REVIEW_HOURS || 6);
}

export function markHours() {
  return Number(process.env.MARK_HOURS || 72);
}

export function appUrl() {
  return (process.env.APP_URL || "http://localhost:3001").replace(/\/$/, "");
}
