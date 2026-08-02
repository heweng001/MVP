export const InquiryStatus = {
  REVIEW: "review",
  PENDING: "pending",
  VALID: "valid",
  INVALID: "invalid",
  TIMEOUT_UNMARKED: "timeout_unmarked",
  AUTO_SPAM: "auto_spam",
} as const;

export type InquiryStatusValue =
  (typeof InquiryStatus)[keyof typeof InquiryStatus];

export const STATUS_LABELS: Record<string, string> = {
  review: "待审核",
  pending: "待标记",
  valid: "有效",
  invalid: "无效",
  timeout_unmarked: "超时未标记",
  auto_spam: "自动垃圾",
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
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}
