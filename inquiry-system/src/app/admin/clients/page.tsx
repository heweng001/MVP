import { prisma } from "@/lib/prisma";
import { ClientList } from "@/components/ClientList";
import { PageHeader } from "@/components/PageHeader";
import {
  CLIENT_LIST_TABS,
  clientListTabFrom,
  parseClientListTab,
  parseClientSort,
  type ClientSortField,
  type SortDir,
} from "@/lib/list-tabs";

function compareNullableDate(
  a: string | null,
  b: string | null,
  dir: SortDir,
) {
  const av = a ? new Date(a).getTime() : null;
  const bv = b ? new Date(b).getTime() : null;
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;
  return dir === "asc" ? av - bv : bv - av;
}

function sortClients<
  T extends {
    serviceStart: string | null;
    serviceEnd: string | null;
    lastVisitAt: string | null;
    name: string;
  },
>(rows: T[], sort: ClientSortField, order: SortDir) {
  const list = [...rows];
  list.sort((a, b) => {
    let cmp = 0;
    if (sort === "serviceStart") cmp = compareNullableDate(a.serviceStart, b.serviceStart, order);
    else if (sort === "serviceEnd") cmp = compareNullableDate(a.serviceEnd, b.serviceEnd, order);
    else cmp = compareNullableDate(a.lastVisitAt, b.lastVisitAt, order);
    if (cmp !== 0) return cmp;
    return a.name.localeCompare(b.name, "zh-CN");
  });
  return list;
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string; sort?: string; order?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const tab = parseClientListTab(sp.tab);
  const { sort, order } = parseClientSort(sp.sort, sp.order);

  const clients = await prisma.client.findMany({
    where: {
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

  const filtered = sortClients(
    classified
      .filter((x) => x.listTab === tab)
      .map((x) => ({
        id: x.client.id,
        name: x.client.name,
        contactName: x.client.contactName,
        phone: x.client.phone,
        address: x.client.address,
        notes: x.client.notes,
        serviceStart: x.client.serviceStart?.toISOString() ?? null,
        serviceEnd: x.client.serviceEnd?.toISOString() ?? null,
        lastVisitAt: x.client.lastVisitAt?.toISOString() ?? null,
        _count: x.client._count,
        promo: x.client.promo
          ? {
              id: x.client.promo.id,
              lastSubmittedBy: x.client.promo.lastSubmittedBy,
              lastSubmittedAt: x.client.promo.lastSubmittedAt?.toISOString() ?? null,
            }
          : null,
      })),
    sort,
    order,
  );

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
            <p>默认按服务结束升序；可点击服务开始/结束或最近上门切换升降序。</p>
          </div>
        }
      />
      <ClientList
        initialQ={q}
        tab={tab}
        sort={sort}
        order={order}
        tabs={CLIENT_LIST_TABS.map((t) => ({
          key: t.key,
          label: t.label,
          hint: t.hint,
          count: tabCounts[t.key],
        }))}
        initialClients={filtered}
      />
    </div>
  );
}
