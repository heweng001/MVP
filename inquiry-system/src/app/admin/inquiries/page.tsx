import { prisma } from "@/lib/prisma";
import { InquiryStatus } from "@/lib/constants";
import { InquiryListBoard } from "@/components/InquiryListBoard";
import { monthRange } from "@/lib/stats";
import { format } from "date-fns";
import type { Prisma } from "@prisma/client";

const TABS = [
  {
    key: "all",
    label: "全部",
    status: "",
    hint: "显示当前筛选条件下的所有询盘，包含下方各状态。",
  },
  {
    key: "review",
    label: "待审核",
    status: InquiryStatus.REVIEW,
    hint: "垃圾分达到人工审核阈值且未达自动拦截阈值。可「审核通过」（发给客户）或「标为垃圾」（状态变为审核垃圾、不发给客户）；支持批量。每天中午 12:00 仍待审核的将自动发给客户。阈值可在「发件设置」中配置。",
  },
  {
    key: "spam",
    label: "垃圾",
    status: "",
    hint: "未发给客户的垃圾询盘：含系统自动判定的「自动垃圾」，以及管理员标为垃圾的「审核垃圾」。",
  },
  {
    key: "forwarded",
    label: "已转发",
    status: "",
    hint: "已成功发给客户的询盘（含待标记、有效、无效）。",
  },
  {
    key: "pending",
    label: "待标记",
    status: InquiryStatus.PENDING,
    hint: "已转发且等待客户点有效/无效。",
  },
  {
    key: "valid",
    label: "已标记有效",
    status: InquiryStatus.VALID,
    hint: "客户（或管理员）已标记为有效询盘。",
  },
  {
    key: "invalid",
    label: "已标记无效",
    status: InquiryStatus.INVALID,
    hint: "客户（或管理员）已标记为无效。",
  },
] as const;

function tabFromParam(tab: string | undefined, status: string | undefined) {
  // 兼容旧「未标记 / 超时未标记」页签
  if (tab === "unmarked" || tab === "timeout_unmarked") return "pending";
  // 废弃状态，展示并入待标记
  if (status === InquiryStatus.TIMEOUT_UNMARKED) return "pending";
  if (tab === "auto_spam" || tab === "review_spam") return "spam";
  if (tab && TABS.some((t) => t.key === tab)) return tab;
  if (status === InquiryStatus.AUTO_SPAM || status === InquiryStatus.REVIEW_SPAM) {
    return "spam";
  }
  if (status) {
    const hit = TABS.find((t) => t.status === status);
    if (hit) return hit.key;
  }
  return "all";
}

function tabWhere(tab: string): Prisma.InquiryWhereInput {
  if (tab === "forwarded") return { sentAt: { not: null } };
  if (tab === "spam") {
    return {
      status: { in: [InquiryStatus.AUTO_SPAM, InquiryStatus.REVIEW_SPAM] },
    };
  }
  if (tab === "pending") {
    return {
      status: { in: [InquiryStatus.PENDING, InquiryStatus.TIMEOUT_UNMARKED] },
    };
  }
  const tabDef = TABS.find((t) => t.key === tab);
  if (tabDef?.status) return { status: tabDef.status };
  return {};
}

export default async function InquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    status?: string;
    q?: string;
    siteId?: string;
    year?: string;
    month?: string;
  }>;
}) {
  const sp = await searchParams;
  const tab = tabFromParam(sp.tab, sp.status);
  const q = (sp.q || "").trim();
  const siteId = sp.siteId || "";
  const year = sp.year ? Number(sp.year) : undefined;
  const month = sp.month ? Number(sp.month) : undefined;
  const hasMonth =
    year != null &&
    month != null &&
    Number.isFinite(year) &&
    Number.isFinite(month) &&
    month >= 1 &&
    month <= 12;

  const monthFilter = hasMonth ? monthRange(year!, month!) : null;

  const baseWhere: Prisma.InquiryWhereInput = {
    ...(siteId ? { siteId } : {}),
    ...(monthFilter
      ? { submittedAt: { gte: monthFilter.start, lt: monthFilter.end } }
      : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
            { message: { contains: q } },
            { phone: { contains: q } },
            { markReason: { contains: q } },
          ],
        }
      : {}),
  };

  const extraWhere = tabWhere(tab);

  const [sites, countsRaw, forwardedCount, spamCount, items] = await Promise.all([
    prisma.site.findMany({ orderBy: { domain: "asc" } }),
    prisma.inquiry.groupBy({
      by: ["status"],
      where: baseWhere,
      _count: { _all: true },
    }),
    prisma.inquiry.count({
      where: { ...baseWhere, sentAt: { not: null } },
    }),
    prisma.inquiry.count({
      where: {
        ...baseWhere,
        status: { in: [InquiryStatus.AUTO_SPAM, InquiryStatus.REVIEW_SPAM] },
      },
    }),
    prisma.inquiry.findMany({
      where: { ...baseWhere, ...extraWhere },
      orderBy:
        tab === "review"
          ? [{ reviewEnteredAt: "asc" }, { submittedAt: "asc" }]
          : { submittedAt: "desc" },
      take: 200,
      include: { site: { include: { client: true } } },
    }),
  ]);

  const countByStatus = Object.fromEntries(
    countsRaw.map((c) => [c.status, c._count._all]),
  ) as Record<string, number>;
  const totalCount = countsRaw.reduce((sum, c) => sum + c._count._all, 0);

  const pendingCount =
    (countByStatus[InquiryStatus.PENDING] || 0) +
    (countByStatus[InquiryStatus.TIMEOUT_UNMARKED] || 0);

  const tabs = TABS.map((t) => ({
    key: t.key,
    label: t.label,
    status: t.status,
    hint: t.hint,
    count:
      t.key === "all"
        ? totalCount
        : t.key === "forwarded"
          ? forwardedCount
          : t.key === "spam"
            ? spamCount
            : t.key === "pending"
              ? pendingCount
              : countByStatus[t.status] || 0,
  }));

  return (
    <InquiryListBoard
      tab={tab}
      tabs={tabs}
      showStatusColumn={tab === "all" || tab === "forwarded" || tab === "spam"}
      filterQuery={q}
      siteId={siteId}
      year={hasMonth ? year : undefined}
      month={hasMonth ? month : undefined}
      sites={sites.map((s) => ({ id: s.id, domain: s.domain }))}
      items={items.map((item) => {
        let aiReasons: string[] = [];
        try {
          const parsed = JSON.parse(item.aiReasonsJson || "[]");
          aiReasons = Array.isArray(parsed)
            ? parsed.map((x: unknown) => String(x)).filter(Boolean)
            : [];
        } catch {
          aiReasons = [];
        }
        return {
          id: item.id,
          status: item.status,
          name: item.name,
          email: item.email,
          message: item.message,
          markReason: item.markReason || "",
          spamScore: item.spamScore,
          aiSpamLabel: item.aiSpamLabel || "",
          aiConfidence: item.aiConfidence,
          aiReasons,
          aiSummaryZh: item.aiSummaryZh || "",
          aiMessageZh: item.aiMessageZh || "",
          aiError: item.aiError || "",
          submittedAt: format(item.submittedAt, "MM-dd HH:mm"),
          domain: item.site.domain,
          clientName: item.site.client.name,
        };
      })}
    />
  );
}
