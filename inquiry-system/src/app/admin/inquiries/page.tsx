import { prisma } from "@/lib/prisma";
import { InquiryStatus } from "@/lib/constants";
import { InquiryListBoard } from "@/components/InquiryListBoard";
import { format } from "date-fns";

const TABS = [
  {
    key: "all",
    label: "全部",
    status: "",
    hint: "显示当前筛选条件下的所有询盘，包含下方各状态；超时未标记也会出现在这里。",
  },
  {
    key: "review",
    label: "待审核",
    status: InquiryStatus.REVIEW,
    hint: "垃圾分处于中间带，系统不敢自动拦截也不直接转发。需人工「通过发送」或「驳回」。超过 6 小时未处理将自动发给客户。",
  },
  {
    key: "auto_spam",
    label: "自动垃圾",
    status: InquiryStatus.AUTO_SPAM,
    hint: "系统判定为明显垃圾（或待审核中被驳回），未发给客户。仅后台可查，可批量改状态或补发（补发后会发给客户）。",
  },
  {
    key: "pending",
    label: "待标记",
    status: InquiryStatus.PENDING,
    hint: "已成功发给客户，且仍在发信后 72 小时内，等待客户在邮件中点击有效/无效（期间也可改判）。",
  },
  {
    key: "valid",
    label: "已标记有效",
    status: InquiryStatus.VALID,
    hint: "客户（或管理员）已标记为有效询盘，计入月度有效数。",
  },
  {
    key: "invalid",
    label: "已标记无效",
    status: InquiryStatus.INVALID,
    hint: "客户（或管理员）已标记为垃圾/无效，不计入有效询盘。",
  },
  {
    key: "timeout_unmarked",
    label: "超时未标记",
    status: InquiryStatus.TIMEOUT_UNMARKED,
    hint: "发信成功起算已满 72 小时，客户未做任何标记。状态保持为「超时未标记」（不会自动改成有效），但月度统计时计入有效询盘数。",
  },
] as const;

function tabFromParam(tab: string | undefined, status: string | undefined) {
  if (tab && TABS.some((t) => t.key === tab)) return tab;
  if (status) {
    const hit = TABS.find((t) => t.status === status);
    if (hit) return hit.key;
  }
  return "all";
}

export default async function InquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string; q?: string; siteId?: string }>;
}) {
  const sp = await searchParams;
  const tab = tabFromParam(sp.tab, sp.status);
  const q = (sp.q || "").trim();
  const siteId = sp.siteId || "";
  const tabDef = TABS.find((t) => t.key === tab) || TABS[0];

  const baseWhere = {
    ...(siteId ? { siteId } : {}),
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

  const [sites, countsRaw, items] = await Promise.all([
    prisma.site.findMany({ orderBy: { domain: "asc" } }),
    prisma.inquiry.groupBy({
      by: ["status"],
      where: baseWhere,
      _count: { _all: true },
    }),
    prisma.inquiry.findMany({
      where: {
        ...baseWhere,
        ...(tabDef.status ? { status: tabDef.status } : {}),
      },
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

  const tabs = TABS.map((t) => ({
    key: t.key,
    label: t.label,
    status: t.status,
    hint: t.hint,
    count: t.key === "all" ? totalCount : countByStatus[t.status] || 0,
  }));

  return (
    <InquiryListBoard
      tab={tab}
      tabs={tabs}
      showStatusColumn={tab === "all"}
      filterQuery={q}
      siteId={siteId}
      sites={sites.map((s) => ({ id: s.id, domain: s.domain }))}
      items={items.map((item) => ({
        id: item.id,
        status: item.status,
        name: item.name,
        email: item.email,
        message: item.message,
        markReason: item.markReason || "",
        spamScore: item.spamScore,
        submittedAt: format(item.submittedAt, "MM-dd HH:mm"),
        domain: item.site.domain,
        clientName: item.site.client.name,
      }))}
    />
  );
}
