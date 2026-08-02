import { prisma } from "./prisma";
import { InquiryStatus } from "./constants";

export type MonthKey = { year: number; month: number };

export type SiteMonthStat = {
  siteId: string;
  total: number;
  /** 系统自动垃圾 */
  autoSpam: number;
  /** 审核垃圾 */
  reviewSpam: number;
  /** 拦截 = 自动垃圾 + 审核垃圾（列表「拦截」列） */
  intercepted: number;
  forwarded: number;
  valid: number;
  invalid: number;
  timeoutUnmarked: number;
  pending: number;
  /** 待标记 + 超时未标记（有效占比分子用） */
  unmarked: number;
  review: number;
  effective: number;
  effectiveRate: number;
};

export function monthRange(year: number, month: number, timeZone = "Asia/Shanghai") {
  const start = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00+08:00`);
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const end = new Date(`${endYear}-${String(endMonth).padStart(2, "0")}-01T00:00:00+08:00`);
  void timeZone;
  return { start, end };
}

export function prevMonth(year: number, month: number) {
  if (month <= 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

export function emptySiteStat(siteId = ""): SiteMonthStat {
  return {
    siteId,
    total: 0,
    autoSpam: 0,
    reviewSpam: 0,
    intercepted: 0,
    forwarded: 0,
    valid: 0,
    invalid: 0,
    timeoutUnmarked: 0,
    pending: 0,
    unmarked: 0,
    review: 0,
    effective: 0,
    effectiveRate: 0,
  };
}

export function sumSiteStats(stats: SiteMonthStat[]): SiteMonthStat {
  const acc = emptySiteStat();
  for (const s of stats) {
    acc.total += s.total;
    acc.autoSpam += s.autoSpam;
    acc.reviewSpam += s.reviewSpam;
    acc.intercepted += s.intercepted;
    acc.forwarded += s.forwarded;
    acc.valid += s.valid;
    acc.invalid += s.invalid;
    acc.timeoutUnmarked += s.timeoutUnmarked;
    acc.pending += s.pending;
    acc.unmarked += s.unmarked;
    acc.review += s.review;
    acc.effective += s.effective;
  }
  acc.effectiveRate = acc.forwarded > 0 ? acc.effective / acc.forwarded : 0;
  return acc;
}

export async function siteMonthStats(
  siteId: string | undefined,
  year: number,
  month: number,
): Promise<SiteMonthStat[]> {
  const { start, end } = monthRange(year, month);
  const where = {
    submittedAt: { gte: start, lt: end },
    ...(siteId ? { siteId } : {}),
  };

  const rows = await prisma.inquiry.findMany({
    where,
    select: { status: true, sentAt: true, siteId: true },
  });

  const bySite = new Map<
    string,
    {
      total: number;
      autoSpam: number;
      reviewSpam: number;
      forwarded: number;
      valid: number;
      invalid: number;
      timeoutUnmarked: number;
      pending: number;
      review: number;
    }
  >();

  const bump = (id: string) => {
    if (!bySite.has(id)) {
      bySite.set(id, {
        total: 0,
        autoSpam: 0,
        reviewSpam: 0,
        forwarded: 0,
        valid: 0,
        invalid: 0,
        timeoutUnmarked: 0,
        pending: 0,
        review: 0,
      });
    }
    return bySite.get(id)!;
  };

  for (const r of rows) {
    const s = bump(r.siteId);
    s.total++;
    if (r.status === InquiryStatus.AUTO_SPAM) s.autoSpam++;
    if (r.status === InquiryStatus.REVIEW_SPAM) s.reviewSpam++;
    if (r.status === InquiryStatus.REVIEW) s.review++;
    if (r.status === InquiryStatus.PENDING) s.pending++;
    if (r.status === InquiryStatus.VALID) s.valid++;
    if (r.status === InquiryStatus.INVALID) s.invalid++;
    if (r.status === InquiryStatus.TIMEOUT_UNMARKED) s.timeoutUnmarked++;
    if (r.sentAt) s.forwarded++;
  }

  return Array.from(bySite.entries()).map(([id, s]) => {
    const unmarked = s.pending + s.timeoutUnmarked;
    const intercepted = s.autoSpam + s.reviewSpam;
    // 有效占比 = (标记有效 + 待标记 + 超时未标记) / 已转发
    const effective = s.valid + unmarked;
    const rate = s.forwarded > 0 ? effective / s.forwarded : 0;
    return {
      siteId: id,
      ...s,
      intercepted,
      unmarked,
      effective,
      effectiveRate: rate,
    };
  });
}

/** 漏斗各层数量（逐层「上一步 − 本步剔除」收窄） */
export function funnelLayers(s: SiteMonthStat) {
  const submitted = s.total;
  const unmarked = s.pending + s.timeoutUnmarked;
  // 自动拦截后剩 = 提交 − 自动垃圾（审核垃圾在后续「未转发」中体现）
  const afterAutoRemain = Math.max(0, submitted - s.autoSpam);
  const reviewRemoved = Math.max(0, afterAutoRemain - s.forwarded);
  const afterReviewRemain = Math.max(0, afterAutoRemain - reviewRemoved);
  const pendingTimeoutPlusValid = unmarked + s.valid;
  const markedValid = s.valid;

  return [
    {
      key: "submitted",
      label: "本月提交",
      hint: "本月全部入库询盘",
      value: submitted,
      removed: 0,
      removedLabel: "",
    },
    {
      key: "after_auto",
      label: "自动拦截后剩",
      hint: "本月提交 − 自动垃圾",
      value: afterAutoRemain,
      removed: s.autoSpam,
      removedLabel: "自动垃圾",
    },
    {
      key: "after_review",
      label: "人工审核后剩",
      hint: "自动拦截后剩 − 未转发（待审核、审核垃圾等）",
      value: afterReviewRemain,
      removed: reviewRemoved,
      removedLabel: "未转发",
    },
    {
      key: "unmarked_plus_valid",
      label: "待标记+超时未标记+有效",
      hint: "待标记 + 超时未标记 + 标记有效",
      value: pendingTimeoutPlusValid,
      removed: 0,
      removedLabel: "",
    },
    {
      key: "valid",
      label: "标记有效",
      hint: "客户（或管理员）标记为有效",
      value: markedValid,
      removed: 0,
      removedLabel: "",
    },
  ] as const;
}
