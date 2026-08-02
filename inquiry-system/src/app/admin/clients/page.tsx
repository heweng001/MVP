import { prisma } from "@/lib/prisma";
import { ClientList } from "@/components/ClientList";
import { PageHeader } from "@/components/PageHeader";
import {
  CLIENT_LIST_TABS,
  clientListTabFrom,
  parseClientListTab,
} from "@/lib/list-tabs";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; q?: string; tab?: string }>;
}) {
  const sp = await searchParams;
  const tier = sp.tier || "";
  const q = (sp.q || "").trim();
  const tab = parseClientListTab(sp.tab);

  const clients = await prisma.client.findMany({
    where: {
      ...(tier ? { tier } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { contactName: { contains: q } },
              { phone: { contains: q } },
              { address: { contains: q } },
              { notes: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      sites: { select: { siteType: true } },
      _count: { select: { sites: true } },
      promo: {
        select: { id: true, lastSubmittedBy: true, lastSubmittedAt: true },
      },
    },
  });

  const classified = clients.map((c) => ({
    client: c,
    listTab: clientListTabFrom(c),
  }));

  const tabCounts = Object.fromEntries(
    CLIENT_LIST_TABS.map((t) => [t.key, classified.filter((x) => x.listTab === t.key).length]),
  ) as Record<(typeof CLIENT_LIST_TABS)[number]["key"], number>;

  const filtered = classified
    .filter((x) => x.listTab === tab)
    .map((x) => x.client);

  return (
    <div>
      <PageHeader
        title="客户列表"
        hint={
          <div className="space-y-1.5">
            <p>管理客户档案；一个客户可对应多个网站。</p>
            <p>
              <strong>服务开始/结束</strong>
              ：由下属网站日期自动汇总（最早开始、最晚结束）。服务结束日早于今天归入「到期客户」。
            </p>
            <p>
              未到期客户按网站类型分栏：含 SEO 型网站归入「SEO型客户」，其余为「展示型客户」。
            </p>
          </div>
        }
      />
      <ClientList
        initialTier={tier}
        initialQ={q}
        tab={tab}
        tabs={CLIENT_LIST_TABS.map((t) => ({
          key: t.key,
          label: t.label,
          hint: t.hint,
          count: tabCounts[t.key],
        }))}
        initialClients={filtered.map((c) => ({
          id: c.id,
          name: c.name,
          tier: c.tier,
          contactName: c.contactName,
          phone: c.phone,
          address: c.address,
          notes: c.notes,
          serviceStart: c.serviceStart?.toISOString() ?? null,
          serviceEnd: c.serviceEnd?.toISOString() ?? null,
          lastVisitAt: c.lastVisitAt?.toISOString() ?? null,
          _count: c._count,
          promo: c.promo
            ? {
                id: c.promo.id,
                lastSubmittedBy: c.promo.lastSubmittedBy,
                lastSubmittedAt: c.promo.lastSubmittedAt?.toISOString() ?? null,
              }
            : null,
        }))}
      />
    </div>
  );
}
