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
  review: "待审核(历史)",
  pending: "待标记",
  valid: "有效",
  invalid: "无效",
  timeout_unmarked: "超时未标记",
  auto_spam: "自动垃圾",
  review_spam: "审核垃圾(历史)",
};

/** 询盘状态 / 列表页签悬停说明 */
export const STATUS_HINTS: Record<string, string> = {
  all: "显示当前筛选条件下的所有询盘。",
  review: "历史状态：旧版人工审核队列。新询盘不再进入此状态；存量会由 cron 按 DeepSeek 重判迁移。",
  spam: "未发给客户的垃圾询盘：含 DeepSeek 自动判定的「自动垃圾」，以及历史「审核垃圾」。补发后会进入待标记。",
  auto_spam: "DeepSeek 判定为垃圾，未发给客户；补发后进入待标记。",
  review_spam: "历史：管理员标为垃圾的询盘。",
  forwarded: "已成功发给客户的询盘（含待标记、有效、无效）。",
  pending: "已转发且等待客户点有效/无效。发信超过 72 小时后不可再标无效，仍可标有效。",
  timeout_unmarked: "已废弃的历史状态，系统会归一为待标记。",
  valid: "客户（或管理员）已标记为有效询盘；客户端不可再改为无效。",
  invalid: "客户（或管理员）已标记为无效；客户可将无效改为有效。",
};

export function spamThreshold() {
  return Number(process.env.SPAM_THRESHOLD || 80);
}

export function markHours() {
  return Number(process.env.MARK_HOURS || 72);
}

export function appUrl() {
  return (process.env.APP_URL || "http://localhost:3001").replace(/\/$/, "");
}
