import { prisma } from "@/lib/prisma";
import { SiteList } from "@/components/SiteList";
import { PageHeader } from "@/components/PageHeader";
import { appUrl } from "@/lib/constants";
import { decryptSecret, hasWpRemoteCreds } from "@/lib/site-credentials";
import { readPluginVersion } from "@/lib/plugin-meta";
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
>(rows: T[], sort: SiteSortField, order: SortDir) {
  const list = [...rows];
  list.sort((a, b) => {
    let cmp = 0;
    if (sort === "formCount") {
      const diff = a.formCount - b.formCount;
      cmp = order === "asc" ? diff : -diff;
    } else if (sort === "startDate") {
      cmp = compareNullableDate(a.startDate, b.startDate, order);
    } else {
      cmp = compareNullableDate(a.endDate, b.endDate, order);
    }
    if (cmp !== 0) return cmp;
    const byClient = a.clientName.localeCompare(b.clientName, "zh-CN");
    if (byClient !== 0) return byClient;
    return a.domain.localeCompare(b.domain, "zh-CN");
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
      promo: {
        select: {
          id: true,
          lastSubmittedBy: true,
          lastSubmittedAt: true,
        },
      },
      _count: { select: { forms: true } },
    },
  });

  const mapped = sites.map((s) => ({
    id: s.id,
    domain: s.domain,
    siteType: s.siteType,
    tier: s.tier,
    startDate: s.startDate?.toISOString() ?? null,
    endDate: s.endDate?.toISOString() ?? null,
    siteKey: s.siteKey,
    productKeywords: s.productKeywords,
    spamExtraWords: s.spamExtraWords,
    wpAdminUrl: s.wpAdminUrl,
    wpUsername: s.wpUsername,
    wpPassword: s.wpPasswordEnc ? decryptSecret(s.wpPasswordEnc) : "",
    hasWpCredentials: hasWpRemoteCreds(s),
    hasWpPassword: Boolean(s.wpPasswordEnc),
    enabled: s.enabled,
    clientId: s.clientId,
    clientName: s.client.name,
    promo: s.promo
      ? {
          id: s.promo.id,
          lastSubmittedBy: s.promo.lastSubmittedBy,
          lastSubmittedAt: s.promo.lastSubmittedAt?.toISOString() ?? null,
        }
      : null,
    forms: s.forms.map((f) => ({
      id: f.id,
      formId: f.formId,
      label: f.label,
      toEmails: f.toEmails,
      ccEmails: f.ccEmails,
      enabled: f.enabled,
    })),
    formCount: s._count.forms,
    gscSyncEnabled: s.gscSyncEnabled,
    gscPropertyUrl: s.gscPropertyUrl,
    gscPeriodDays: s.gscPeriodDays,
    gscLastSyncAt: s.gscLastSyncAt?.toISOString() ?? null,
    gscLastError: s.gscLastError,
    gscKeywordCount: s.gscKeywordCount,
    gscPageCount: s.gscPageCount,
    gscAvgPosition: s.gscAvgPosition,
    gaSyncEnabled: s.gaSyncEnabled,
    gaPropertyId: s.gaPropertyId,
    gaPeriodDays: s.gaPeriodDays,
    gaLastSyncAt: s.gaLastSyncAt?.toISOString() ?? null,
    gaLastError: s.gaLastError,
    gaSessions: s.gaSessions,
    gaUsers: s.gaUsers,
    gaConversions: s.gaConversions,
    gaEngagementRate: s.gaEngagementRate,
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

  let latestPluginVersion = "";
  try {
    latestPluginVersion = await readPluginVersion();
  } catch {
    latestPluginVersion = "";
  }

  return (
    <div>
      <PageHeader
        title="网站列表"
        hint={
          <div className="space-y-1.5">
            <p>管理客户下属网站；右侧「配置对接」按步骤安装插件并完成收件配置。</p>
            <p>
              页签右侧「插件更新」会先并行检测全部网站，仅自动更新已装插件且非最新的站点；未检测到插件的站点直接跳过。
            </p>
            <p>
              未到期网站按类型分「SEO型 / 展示型」；结束日早于今天归入「到期」。列表默认按结束日期升序，同客户多域名默认折叠。
            </p>
            <p>分层（重点/正常/维护）在列表展示；若已关联信息核对，显示最近更新人与时间。</p>
          </div>
        }
      />
      <SiteList
        ingestUrl={`${appUrl()}/api/ingest`}
        latestPluginVersion={latestPluginVersion}
        filters={{ clientId, q, enabled, tab, sort, order }}
        tab={tab}
        tabs={SITE_LIST_TABS.map((t) => ({
          key: t.key,
          label: t.label,
          hint: t.hint,
          count: tabCounts[t.key],
        }))}
        clients={clients.map((c) => ({
          id: c.id,
          name: c.name,
          contactName: c.contactName,
          phone: c.phone,
          address: c.address,
          notes: c.notes,
          lastVisitAt: c.lastVisitAt?.toISOString() ?? null,
        }))}
        initialSites={filtered.map(({ listTab: _listTab, ...row }) => row)}
      />
    </div>
  );
}
