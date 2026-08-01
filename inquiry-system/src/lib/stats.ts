import { prisma } from "./prisma";
import { InquiryStatus } from "./constants";

export type MonthKey = { year: number; month: number };

export function monthRange(year: number, month: number, timeZone = "Asia/Shanghai") {
  // Build range in local Shanghai by constructing UTC offsets roughly via Date
  // Simpler approach: use offset +08:00 fixed for MVP
  const start = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00+08:00`);
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const end = new Date(`${endYear}-${String(endMonth).padStart(2, "0")}-01T00:00:00+08:00`);
  void timeZone;
  return { start, end };
}

export async function siteMonthStats(siteId: string | undefined, year: number, month: number) {
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
    if (r.status === InquiryStatus.REVIEW) s.review++;
    if (r.status === InquiryStatus.PENDING) s.pending++;
    if (r.status === InquiryStatus.VALID) s.valid++;
    if (r.status === InquiryStatus.INVALID) s.invalid++;
    if (r.status === InquiryStatus.TIMEOUT_UNMARKED) s.timeoutUnmarked++;
    if (r.sentAt) s.forwarded++;
  }

  return Array.from(bySite.entries()).map(([id, s]) => {
    const effective = s.valid + s.timeoutUnmarked;
    const rate = s.forwarded > 0 ? effective / s.forwarded : 0;
    return {
      siteId: id,
      ...s,
      effective,
      effectiveRate: rate,
    };
  });
}
