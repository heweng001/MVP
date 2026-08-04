import { prisma } from "@/lib/prisma";
import { SiteList } from "@/components/SiteList";
import { PageHeader } from "@/components/PageHeader";
import { appUrl } from "@/lib/constants";
import { parseMailHiddenFields } from "@/lib/mail-hidden-config";
import {
  SITE_LIST_TABS,
  parseSiteListTab,
  parseSiteSort,
  siteListTabFrom,
  type SiteSortField,
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

function sortSites<
  T extends {
    startDate: string | null;
    endDate: string | null;
    formCount: number;
    clientName: string;
    domain: string;
  },
>(rows: T[], sort: SiteSortField | null, order: SortDir) {
  const list = [...rows];
  if (!sort) {
    list.sort((a, b) => {
      const byClient = a.clientName.localeCompare(b.clientName, "zh-CN");
      if (byClient !== 0) return byClient;
      return a.domain.localeCompare(b.domain, "zh-CN");
    });
    return list;
  }
  list.sort((a, b) => {
    if (sort === "formCount") {
      const diff = a.formCount - b.formCount;
      return order === "asc" ? diff : -diff;
    }
    if (sort === "startDate") return compareNullableDate(a.startDate, b.startDate, order);
    return compareNullableDate(a.endDate, b.endDate, order);
  });
  return list;
}

export default async function SitesPage({
  searchParams,
}: {
  searchParams: Promise<{
    clientId?: string;
    q?: string;
    enabled?: string;
    tab?: string;
    sort?: string;
    order?: string;
  }>;
}) {
  const sp = await searchParams;
  const clientId = sp.clientId || "";
  const q = (sp.q || "").trim();
  const enabled = sp.enabled || "";
  const tab = parseSiteListTab(sp.tab);
  const { sort, order } = parseSiteSort(sp.sort, sp.order);

  const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });
  const sites = await prisma.site.findMany({
    where: {
      ...(clientId ? { clientId } : {}),
      ...(enabled === "1" ? { enabled: true } : enabled === "0" ? { enabled: false } : {}),
      ...(q
        ? {
            OR: [{ domain: { contains: q } }, { client: { name: { contains: q } } }],
          }
        : {}),
    },
    include: {
      client: true,
      forms: true,
      _count: { select: { forms: true } },
    },
  });

  const mapped = sites.map((s) => ({
    id: s.id,
    domain: s.domain,
    siteType: s.siteType,
    startDate: s.startDate?.toISOString() ?? null,
    endDate: s.endDate?.toISOString() ?? null,
    siteKey: s.siteKey,
    productKeywords: s.productKeywords,
    spamExtraWords: s.spamExtraWords,
    mailHiddenFields: parseMailHiddenFields(s.mailHiddenFields),
    enabled: s.enabled,
    clientId: s.clientId,
    clientName: s.client.name,
    forms: s.forms.map((f) => ({
      id: f.id,
      formId: f.formId,
      label: f.label,
      toEmails: f.toEmails,
      ccEmails: f.ccEmails,
      enabled: f.enabled,
    })),
    formCount: s._count.forms,
    listTab: siteListTabFrom(s),
  }));

  const tabCounts = Object.fromEntries(
    SITE_LIST_TABS.map((t) => [t.key, mapped.filter((x) => x.listTab === t.key).length]),
  ) as Record<(typeof SITE_LIST_TABS)[number]["key"], number>;

  const filtered = sortSites(
    mapped.filter((x) => x.listTab === tab),
    sort,
    order,
  );

  return (
    <div>
      <PageHeader
        title="网站列表"
        hint={
          <div className="space-y-1.5">
            <p>管理客户下属网站；右侧「配置对接」按步骤安装插件并完成收件配置。</p>
            <p>
              未到期网站按类型分「SEO型 / 展示型」；结束日早于今天归入「到期」。
            </p>
            <p>
              默认同属一个客户的网站排在一起；可点击开始/结束日期或表单数切换升降序。
            </p>
          </div>
        }
      />
      <SiteList
        ingestUrl={`${appUrl()}/api/ingest`}
        filters={{ clientId, q, enabled, tab, sort, order }}
        tab={tab}
        tabs={SITE_LIST_TABS.map((t) => ({
          key: t.key,
          label: t.label,
          hint: t.hint,
          count: tabCounts[t.key],
        }))}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        initialSites={filtered.map(({ listTab: _listTab, ...row }) => row)}
      />
    </div>
  );
}
