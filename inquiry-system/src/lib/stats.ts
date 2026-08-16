import { prisma } from "./prisma";
import { InquiryStatus } from "./constants";

export type MonthKey = { year: number; month: number };

export type SiteMonthStat = {
  siteId: string;
  total: number;
  /** 系统自动垃圾 */
  autoSpam: number;
  /** 历史审核垃圾（旧流程） */
  reviewSpam: number;
  /** 拦截 = DeepSeek 自动垃圾 + 历史审核垃圾（列表「拦截」列） */
  intercepted: number;
  forwarded: number;
  valid: number;
  invalid: number;
  pending: number;
  /** 待标记（有效占比分子用） */
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
    if (r.status === InquiryStatus.PENDING) {
      s.pending++;
    }
    if (r.status === InquiryStatus.VALID) s.valid++;
    if (r.status === InquiryStatus.INVALID) s.invalid++;
    if (r.sentAt) s.forwarded++;
  }

  return Array.from(bySite.entries()).map(([id, s]) => {
    const unmarked = s.pending;
    const intercepted = s.autoSpam + s.reviewSpam;
    // 有效占比 = (标记有效 + 待标记) / 已转发
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

/** 漏斗四层：提交 → 已转发 → 未标记无效 → 标记有效 */
export function funnelLayers(s: SiteMonthStat) {
  const submitted = s.total;
  const unmarked = s.pending;
  const forwarded = s.forwarded;
  const pendingPlusValid = unmarked + s.valid;
  const markedValid = s.valid;

  return [
    {
      key: "submitted",
      label: "本月提交",
      hint: "本月全部入库的询盘（含 DeepSeek 拦截未发的）",
      value: submitted,
      removed: 0,
      removedLabel: "",
    },
    {
      key: "forwarded",
      label: "已转发",
      hint: "已成功发给客户第一封邮件的询盘（有发信记录）",
      value: forwarded,
      removed: 0,
      removedLabel: "",
    },
    {
      key: "unmarked_plus_valid",
      label: "未标记无效",
      hint: "已转发中：待客户标记 + 已标有效（不含已标无效）",
      value: pendingPlusValid,
      removed: 0,
      removedLabel: "",
    },
    {
      key: "valid",
      label: "标记有效",
      hint: "客户或管理员已标记为有效的询盘",
      value: markedValid,
      removed: 0,
      removedLabel: "",
    },
  ] as const;
}
