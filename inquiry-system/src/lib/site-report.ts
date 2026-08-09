import { randomBytes } from "crypto";
import { countryCodeToZh } from "./countries";
import { prisma } from "./prisma";
import { emptySiteStat, prevMonth, siteMonthStats, type SiteMonthStat } from "./stats";
import { countWpPublicPages } from "./wp-page-count";

export type ReportRowKeyword = {
  keyword: string;
  position: number;
  clicks: number;
  impressions: number;
  ctr: number;
};

export type ReportRowPage = {
  pageUrl: string;
  position: number;
  clicks: number;
  impressions: number;
  ctr: number;
};

export type ReportRowChannel = {
  channelGroup: string;
  sessions: number;
  engagedSessions: number;
  conversions: number;
  engagementRate: number;
};

export type ReportRowLanding = {
  pagePath: string;
  sessions: number;
  engagedSessions: number;
  conversions: number;
  engagementRate: number;
  pageViews?: number;
  /** 平均互动时长（秒） */
  avgEngagementTimeSec?: number;
  bounceRate?: number;
};

export type ReportRowCountry = {
  countryId: string;
  country: string;
  /** 展示用中文名（组装时填） */
  countryLabel?: string;
  sessions: number;
  engagedSessions: number;
  users: number;
  pageViews: number;
  engagementRate: number;
  conversions: number;
};

export type ReportKpiBlock = {
  gscClicks: number;
  gscImpressions: number;
  gscCtr: number;
  gscAvgPosition: number | null;
  gscKeywordCount: number;
  gscPageCount: number;
  gaSessions: number;
  gaUsers: number;
  gaPageViews: number;
  gaEngagedSessions: number;
  gaConversions: number;
  gaEngagementRate: number | null;
  inquiry: SiteMonthStat;
};

export type ReportFunnelStep = {
  key: string;
  label: string;
  /** null = 数据不可用（如 WP 页面总数拉取失败） */
  value: number | null;
  /** 上月同口径，供环比；无上月则为 null/缺省 */
  prevValue?: number | null;
  hint?: string;
};

/** 搜索可见性：上=页面覆盖，下=关键词排名（已拆分，避免页/词混算转化） */
export type SearchVisibilityFunnel = {
  title: string;
  sitePageSource: "wp_rest" | "unknown";
  pageSteps: ReportFunnelStep[];
  keywordSteps: ReportFunnelStep[];
};

/** 流量与询盘漏斗 */
export type TrafficInquiryFunnel = {
  title: string;
  steps: ReportFunnelStep[];
};

export type SiteReportPayload = {
  clientName: string;
  domain: string;
  siteType: string;
  year: number;
  month: number;
  periodLabel: string;
  generatedAt: string;
  meta: {
    /** calendar_month = 与询盘同自然月；legacy_rolling = 旧快照 */
    periodKind: "calendar_month" | "legacy_rolling";
    startDate: string;
    endDate: string;
    gscPeriodDays: number;
    gaPeriodDays: number;
    gscSyncedAt: string | null;
    gaSyncedAt: string | null;
    gscEnabled: boolean;
    gaEnabled: boolean;
  };
  kpi: ReportKpiBlock;
  prev: ReportKpiBlock | null;
  searchFunnel: SearchVisibilityFunnel;
  trafficFunnel: TrafficInquiryFunnel;
  topKeywords: ReportRowKeyword[];
  opportunityKeywords: ReportRowKeyword[];
  topPages: ReportRowPage[];
  topChannels: ReportRowChannel[];
  topLandings: ReportRowLanding[];
  /** GA 按 pagePath 的主要浏览页（含平均互动时长） */
  topGaPages: ReportRowLanding[];
  topCountries: ReportRowCountry[];
  highlights: string[];
};

function newViewToken() {
  return randomBytes(24).toString("hex");
}

function periodLabel(year: number, month: number) {
  return `${year}年${month}月`;
}

function sumClicks(rows: { clicks: number }[]) {
  return rows.reduce((a, r) => a + r.clicks, 0);
}

function sumImpressions(rows: { impressions: number }[]) {
  return rows.reduce((a, r) => a + r.impressions, 0);
}

function countKeywordsWithin(keywords: ReportRowKeyword[], maxPosition: number) {
  return keywords.filter(
    (k) => k.impressions > 0 && k.position > 0 && k.position <= maxPosition,
  ).length;
}

function resolveEngagedSessions(
  stored: number,
  sessions: number,
  engagementRate: number | null,
) {
  if (stored > 0) return stored;
  if (engagementRate != null && engagementRate > 0 && sessions > 0) {
    return Math.round(sessions * engagementRate);
  }
  return 0;
}

function withPrev(
  steps: ReportFunnelStep[],
  prevByKey?: Record<string, number | null | undefined> | null,
): ReportFunnelStep[] {
  if (!prevByKey) return steps;
  return steps.map((s) => ({
    ...s,
    prevValue:
      s.prevValue !== undefined
        ? s.prevValue
        : prevByKey[s.key] !== undefined
          ? prevByKey[s.key]!
          : null,
  }));
}

function funnelPrevByKey(
  funnel: SearchVisibilityFunnel | null | undefined,
  kpiPrev?: ReportKpiBlock | null,
): Record<string, number | null | undefined> {
  const map: Record<string, number | null | undefined> = {};
  for (const s of funnel?.pageSteps || []) map[s.key] = s.value;
  for (const s of funnel?.keywordSteps || []) map[s.key] = s.value;
  // 旧快照无分层时，用 KPI 补可见页 / 有展示词
  if (map.visiblePages == null && kpiPrev?.gscPageCount != null) {
    map.visiblePages = kpiPrev.gscPageCount;
  }
  if (map.keywordsShown == null && kpiPrev?.gscKeywordCount != null) {
    map.keywordsShown = kpiPrev.gscKeywordCount;
  }
  return map;
}

export type SearchFunnelCounts = {
  keywordsShown?: number;
  top100?: number;
  top30?: number;
};

function buildSearchFunnel(
  sitePageCount: number | null,
  visiblePages: number,
  keywords: ReportRowKeyword[],
  prevByKey?: Record<string, number | null | undefined> | null,
  counts?: SearchFunnelCounts | null,
): SearchVisibilityFunnel {
  const withImp = counts?.keywordsShown ?? keywords.filter((k) => k.impressions > 0).length;
  const top100 = counts?.top100 ?? countKeywordsWithin(keywords, 100);
  const top30 = counts?.top30 ?? countKeywordsWithin(keywords, 30);
  const hasWp = sitePageCount != null && sitePageCount > 0;
  const fromSummary = counts?.keywordsShown != null;
  const pageSteps = withPrev(
    [
      {
        key: "sitePages",
        label: "网站页面数",
        value: hasWp ? sitePageCount : null,
        hint: hasWp
          ? "WordPress 已发布文章+页面"
          : "未能拉取 WP 页面总数，故不展示（≠用可见页占位）",
      },
      {
        key: "visiblePages",
        label: "可见页数",
        value: visiblePages,
        hint: "GSC 同期有展示的页面数（≠完整收录）",
      },
    ],
    prevByKey,
  );
  const keywordSteps = withPrev(
    [
      {
        key: "keywordsShown",
        label: "有展示关键词",
        value: withImp,
        hint: fromSummary
          ? "GSC 同期有展示查询词（全量统计，非仅 Top 详情）"
          : "GSC 近周期有展示的查询词（若仅同步了部分词，各层可能失真）",
      },
      {
        key: "top100",
        label: "排名前 100",
        value: top100,
      },
      {
        key: "top30",
        label: "排名前 30",
        value: top30,
      },
    ],
    prevByKey,
  );
  return {
    title: "搜索可见性",
    sitePageSource: hasWp ? "wp_rest" : "unknown",
    pageSteps,
    keywordSteps,
  };
}

/** 兼容旧快照：单一 steps 列表 → 上下两段；去掉前 10 */
function normalizeSearchFunnel(
  raw: (SearchVisibilityFunnel & { steps?: ReportFunnelStep[] }) | null | undefined,
  visiblePages: number,
  keywords: ReportRowKeyword[],
  prevByKey?: Record<string, number | null | undefined> | null,
): SearchVisibilityFunnel {
  const legacySteps = Array.isArray(raw?.steps) ? raw!.steps! : [];
  const hasSplit =
    (raw?.pageSteps?.length ?? 0) > 0 || (raw?.keywordSteps?.length ?? 0) > 0;

  if (hasSplit) {
    const pageSteps = withPrev(
      (raw!.pageSteps || []).map((s) => ({ ...s })),
      prevByKey,
    );
    const keywordSteps = withPrev(
      (raw!.keywordSteps || [])
        .filter((s) => s.key !== "top10")
        .map((s) => ({ ...s })),
      prevByKey,
    );
    return {
      title: raw!.title || "搜索可见性",
      sitePageSource: raw!.sitePageSource || "unknown",
      pageSteps:
        pageSteps.length > 0
          ? pageSteps
          : buildSearchFunnel(null, visiblePages, keywords, prevByKey).pageSteps,
      keywordSteps:
        keywordSteps.length > 0
          ? keywordSteps
          : buildSearchFunnel(null, visiblePages, keywords, prevByKey).keywordSteps,
    };
  }

  if (legacySteps.length > 0) {
    const pageKeys = new Set(["sitePages", "visiblePages"]);
    const keywordKeys = new Set(["keywordsShown", "top100", "top30"]);
    return {
      title: raw?.title || "搜索可见性",
      sitePageSource: raw?.sitePageSource || "unknown",
      pageSteps: withPrev(
        legacySteps.filter((s) => pageKeys.has(s.key)).map((s) => ({ ...s })),
        prevByKey,
      ),
      keywordSteps: withPrev(
        legacySteps.filter((s) => keywordKeys.has(s.key)).map((s) => ({ ...s })),
        prevByKey,
      ),
    };
  }

  return buildSearchFunnel(null, visiblePages, keywords, prevByKey);
}

function buildTrafficFunnel(
  pageViews: number,
  sessions: number,
  engagedSessions: number,
  inquiry: SiteMonthStat,
  prevByKey?: Record<string, number | null | undefined> | null,
): TrafficInquiryFunnel {
  return {
    title: "流量与询盘漏斗",
    steps: withPrev(
      [
        {
          key: "pageViews",
          label: "页面浏览量",
          value: pageViews,
          hint: "GA4 screenPageViews",
        },
        {
          key: "sessions",
          label: "会话",
          value: sessions,
          hint: "GA4 sessions",
        },
        {
          key: "engagedSessions",
          label: "互动会话",
          value: engagedSessions,
          hint: "GA4 engagedSessions",
        },
        {
          key: "inquiries",
          label: "询盘数",
          value: inquiry.total,
          hint: "自然月提交总数",
        },
        {
          key: "nonInvalid",
          label: "非无效询盘",
          value: inquiry.effective,
          hint: "标记有效 + 未标记（待标记）",
        },
        {
          key: "valid",
          label: "有效询盘",
          value: inquiry.valid,
        },
      ],
      prevByKey,
    ),
  };
}

function pickOpportunity(keywords: ReportRowKeyword[], limit = 8): ReportRowKeyword[] {
  const scored = keywords
    .filter((k) => k.impressions >= 30)
    .map((k) => {
      const lowCtr = k.impressions > 0 && k.ctr < 0.02 && k.position <= 20;
      const midRank = k.position >= 8 && k.position <= 20;
      const score = (lowCtr ? 2 : 0) + (midRank ? 2 : 0) + Math.min(k.impressions / 100, 3);
      return { k, score };
    })
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score || b.k.impressions - a.k.impressions);
  return scored.slice(0, limit).map((x) => x.k);
}

function pctDelta(curr: number, prev: number | null | undefined): number | null {
  if (prev == null || !Number.isFinite(prev) || prev === 0) return null;
  return (curr - prev) / Math.abs(prev);
}

function formatMomPct(d: number | null): string {
  if (d == null || !Number.isFinite(d)) return "";
  const sign = d > 0 ? "↑" : d < 0 ? "↓" : "→";
  return `${sign}${Math.abs(d * 100).toFixed(0)}%`;
}

function buildHighlights(kpi: ReportKpiBlock, prev: ReportKpiBlock | null): string[] {
  const lines: string[] = [];
  if (prev) {
    const clickD = pctDelta(kpi.gscClicks, prev.gscClicks);
    if (clickD != null) {
      lines.push(`自然搜索点击环比 ${formatMomPct(clickD)}（${prev.gscClicks} → ${kpi.gscClicks}）`);
    }
    const sessD = pctDelta(kpi.gaSessions, prev.gaSessions);
    if (sessD != null) {
      lines.push(`网站会话环比 ${formatMomPct(sessD)}（${prev.gaSessions} → ${kpi.gaSessions}）`);
    }
    const inqD = pctDelta(kpi.inquiry.total, prev.inquiry.total);
    if (inqD != null) {
      lines.push(`询盘提交环比 ${formatMomPct(inqD)}（${prev.inquiry.total} → ${kpi.inquiry.total}）`);
    }
    if (kpi.gscAvgPosition != null && prev.gscAvgPosition != null) {
      const better = kpi.gscAvgPosition < prev.gscAvgPosition;
      lines.push(
        `平均排名 ${prev.gscAvgPosition.toFixed(1)} → ${kpi.gscAvgPosition.toFixed(1)}（${better ? "提升" : "回落"}）`,
      );
    }
  } else {
    lines.push("暂无上月快照，环比将在连续生成两个月报告后显示。");
  }

  if (kpi.inquiry.forwarded > 0) {
    lines.push(
      `本月已转发 ${kpi.inquiry.forwarded} 条，有效占比 ${(kpi.inquiry.effectiveRate * 100).toFixed(0)}%（有效+待标记）`,
    );
  } else if (kpi.inquiry.total > 0) {
    lines.push(`本月收到 ${kpi.inquiry.total} 条询盘提交，尚未形成有效转发统计。`);
  }

  if (kpi.gscKeywordCount > 0) {
    lines.push(`搜索侧近周期覆盖约 ${kpi.gscKeywordCount} 个有展示词、${kpi.gscPageCount} 个有展示页。`);
  }

  return lines.slice(0, 5);
}

function parsePayload(raw: string): SiteReportPayload | null {
  try {
    return JSON.parse(raw) as SiteReportPayload;
  } catch {
    return null;
  }
}

export function parseReportPayload(raw: string): SiteReportPayload | null {
  const p = parsePayload(raw);
  if (!p) return null;
  return ensureReportFunnels(p);
}

/** 兼容旧快照：缺少漏斗字段时按 kpi / 词表补齐；搜索漏斗规范为上下两段 */
export function ensureReportFunnels(payload: SiteReportPayload): SiteReportPayload {
  const keywords = payload.topKeywords || [];
  const visible = payload.kpi?.gscPageCount ?? 0;
  const rawSf = payload.searchFunnel as SearchVisibilityFunnel & {
    steps?: ReportFunnelStep[];
  };
  // 旧报告无分层 prevValue 时，用上月 KPI 补可见页 / 有展示词
  const prevByKey = funnelPrevByKey(null, payload.prev);
  const searchFunnel = normalizeSearchFunnel(rawSf, visible, keywords, prevByKey);
  const engaged = resolveEngagedSessions(
    payload.kpi?.gaEngagedSessions ?? 0,
    payload.kpi?.gaSessions ?? 0,
    payload.kpi?.gaEngagementRate ?? null,
  );
  const pageViews =
    payload.kpi?.gaPageViews && payload.kpi.gaPageViews > 0
      ? payload.kpi.gaPageViews
      : payload.kpi?.gaSessions ?? 0;
  const sessions = payload.kpi?.gaSessions ?? 0;
  const prevTraffic: Record<string, number | null | undefined> = {};
  for (const s of payload.trafficFunnel?.steps || []) prevTraffic[s.key] = s.prevValue;
  // 旧快照可能是「浏览量→用户→互动」；统一按 KPI 重算为「浏览量→会话→互动」
  const trafficFunnel = buildTrafficFunnel(
    pageViews,
    sessions,
    engaged,
    payload.kpi?.inquiry ?? emptySiteStat(),
    {
      ...prevTraffic,
      pageViews: prevTraffic.pageViews ?? payload.prev?.gaPageViews,
      sessions: prevTraffic.sessions ?? payload.prev?.gaSessions,
      engagedSessions: prevTraffic.engagedSessions ?? payload.prev?.gaEngagedSessions,
      inquiries: prevTraffic.inquiries ?? payload.prev?.inquiry?.total,
      nonInvalid: prevTraffic.nonInvalid ?? payload.prev?.inquiry?.effective,
      valid: prevTraffic.valid ?? payload.prev?.inquiry?.valid,
    },
  );
  return {
    ...payload,
    meta: {
      periodKind: payload.meta?.periodKind || "legacy_rolling",
      startDate: payload.meta?.startDate || "",
      endDate: payload.meta?.endDate || "",
      gscPeriodDays: payload.meta?.gscPeriodDays ?? 28,
      gaPeriodDays: payload.meta?.gaPeriodDays ?? 28,
      gscSyncedAt: payload.meta?.gscSyncedAt ?? null,
      gaSyncedAt: payload.meta?.gaSyncedAt ?? null,
      gscEnabled: payload.meta?.gscEnabled ?? false,
      gaEnabled: payload.meta?.gaEnabled ?? false,
    },
    kpi: {
      ...payload.kpi,
      gaPageViews: payload.kpi?.gaPageViews ?? pageViews,
      gaEngagedSessions: payload.kpi?.gaEngagedSessions ?? engaged,
    },
    searchFunnel,
    trafficFunnel,
    topGaPages: payload.topGaPages || [],
    topCountries: payload.topCountries || [],
  };
}

type MonthGscJson = {
  startDate?: string;
  endDate?: string;
  summary?: {
    avgPosition?: number | null;
    keywordCount?: number;
    pageCount?: number;
    /** 全量统计（seo-worker 分页拉取后写入）；优先于 keywords[] 截断列表 */
    top100Count?: number;
    top30Count?: number;
    top10Count?: number;
    queriesFetched?: number;
    pagesFetched?: number;
    truncated?: boolean;
  };
  keywords?: ReportRowKeyword[];
  pages?: ReportRowPage[];
  error?: string;
};

type MonthGaJson = {
  startDate?: string;
  endDate?: string;
  summary?: {
    sessions?: number;
    users?: number;
    pageViews?: number;
    engagedSessions?: number;
    engagementRate?: number | null;
    conversions?: number;
    avgEngagementTimeSec?: number;
  };
  landingPages?: ReportRowLanding[];
  pages?: ReportRowLanding[];
  channels?: ReportRowChannel[];
  countries?: ReportRowCountry[];
  error?: string;
};

function normalizeLandingRow(r: ReportRowLanding): ReportRowLanding {
  return {
    pagePath: String(r.pagePath || "").trim(),
    sessions: Math.max(0, Math.round(Number(r.sessions) || 0)),
    engagedSessions: Math.max(0, Math.round(Number(r.engagedSessions) || 0)),
    conversions: Math.max(0, Math.round(Number(r.conversions) || 0)),
    engagementRate: Number(r.engagementRate) || 0,
    pageViews: Math.max(0, Math.round(Number(r.pageViews) || 0)),
    avgEngagementTimeSec: Math.max(0, Number(r.avgEngagementTimeSec) || 0),
    bounceRate: Math.max(0, Number(r.bounceRate) || 0),
  };
}

function normalizeCountryRow(r: ReportRowCountry): ReportRowCountry {
  const countryId = String(r.countryId || "").trim().toUpperCase();
  const country = String(r.country || "").trim();
  const label = countryId ? countryCodeToZh(countryId) : country;
  return {
    countryId,
    country,
    countryLabel: label && label !== countryId ? label : country || countryId || "—",
    sessions: Math.max(0, Math.round(Number(r.sessions) || 0)),
    engagedSessions: Math.max(0, Math.round(Number(r.engagedSessions) || 0)),
    users: Math.max(0, Math.round(Number(r.users) || 0)),
    pageViews: Math.max(0, Math.round(Number(r.pageViews) || 0)),
    engagementRate: Number(r.engagementRate) || 0,
    conversions: Math.max(0, Math.round(Number(r.conversions) || 0)),
  };
}

function daysInclusive(startDate: string, endDate: string) {
  if (!startDate || !endDate) return 0;
  const a = new Date(`${startDate}T00:00:00Z`).getTime();
  const b = new Date(`${endDate}T00:00:00Z`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.round((b - a) / 86400000) + 1;
}

export async function buildReportPayload(
  siteId: string,
  year: number,
  month: number,
): Promise<SiteReportPayload> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { client: true },
  });
  if (!site) throw new Error("网站不存在");

  const needsSeo = site.gscSyncEnabled || site.gaSyncEnabled;
  const seoSnap = await prisma.siteMonthSeoSnapshot.findUnique({
    where: { siteId_year_month: { siteId, year, month } },
  });

  if (needsSeo && !seoSnap) {
    throw new Error(
      `尚未同步 ${year}年${month}月 的 GSC/GA 自然月数据。请在新加坡 seo-worker 执行：npm run sync:month -- ${year}-${String(month).padStart(2, "0")}（或等待日常 sync 写入当月 MTD）后重试。`,
    );
  }
  if (needsSeo && seoSnap && !seoSnap.gscJson && !seoSnap.gaJson) {
    const err = [seoSnap.gscError, seoSnap.gaError].filter(Boolean).join("；");
    throw new Error(
      err ||
        `该月 GSC/GA 同步未成功。请检查新加坡 worker 日志后执行：npm run sync:month -- ${year}-${String(month).padStart(2, "0")}`,
    );
  }

  let gsc: MonthGscJson = {};
  let ga: MonthGaJson = {};
  if (seoSnap?.gscJson) {
    try {
      gsc = JSON.parse(seoSnap.gscJson) as MonthGscJson;
    } catch {
      gsc = {};
    }
  }
  if (seoSnap?.gaJson) {
    try {
      ga = JSON.parse(seoSnap.gaJson) as MonthGaJson;
    } catch {
      ga = {};
    }
  }

  const keywords: ReportRowKeyword[] = Array.isArray(gsc.keywords) ? gsc.keywords : [];
  const gscPages: ReportRowPage[] = Array.isArray(gsc.pages) ? gsc.pages : [];
  const channels: ReportRowChannel[] = Array.isArray(ga.channels) ? ga.channels : [];
  const landings = (Array.isArray(ga.landingPages) ? ga.landingPages : [])
    .map(normalizeLandingRow)
    .filter((r) => r.pagePath);
  const gaPages = (Array.isArray(ga.pages) ? ga.pages : [])
    .map(normalizeLandingRow)
    .filter((r) => r.pagePath);
  const countries = (Array.isArray(ga.countries) ? ga.countries : [])
    .map(normalizeCountryRow)
    .filter((r) => r.countryId || r.country);

  const gscClicks = sumClicks(keywords);
  const gscImpressions = sumImpressions(keywords);
  const gscCtr = gscImpressions > 0 ? gscClicks / gscImpressions : 0;
  const gscAvgPosition =
    gsc.summary?.avgPosition != null ? Number(gsc.summary.avgPosition) : null;
  const gscKeywordCount = gsc.summary?.keywordCount ?? keywords.length;
  const gscPageCount = gsc.summary?.pageCount ?? gscPages.length;

  const gaSessions = Math.max(0, Math.round(Number(ga.summary?.sessions) || 0));
  const gaUsers = Math.max(0, Math.round(Number(ga.summary?.users) || 0));
  const gaPageViewsRaw = Math.max(0, Math.round(Number(ga.summary?.pageViews) || 0));
  const gaEngagedRaw = Math.max(0, Math.round(Number(ga.summary?.engagedSessions) || 0));
  const gaConversions = Math.max(0, Math.round(Number(ga.summary?.conversions) || 0));
  const engRaw = Number(ga.summary?.engagementRate);
  const gaEngagementRate = Number.isFinite(engRaw) ? engRaw : null;
  const gaEngagedSessions = resolveEngagedSessions(gaEngagedRaw, gaSessions, gaEngagementRate);
  const gaPageViews = gaPageViewsRaw > 0 ? gaPageViewsRaw : gaSessions;

  const inquiryRows = await siteMonthStats(siteId, year, month);
  const inquiry = inquiryRows[0] || emptySiteStat(siteId);

  const wpPages = await countWpPublicPages(site);
  const visiblePages = Math.max(gscPageCount, gscPages.length);

  const kpi: ReportKpiBlock = {
    gscClicks,
    gscImpressions,
    gscCtr,
    gscAvgPosition,
    gscKeywordCount,
    gscPageCount,
    gaSessions,
    gaUsers,
    gaPageViews,
    gaEngagedSessions,
    gaConversions,
    gaEngagementRate,
    inquiry,
  };

  const pm = prevMonth(year, month);
  const prevReport = await prisma.siteMonthlyReport.findUnique({
    where: { siteId_year_month: { siteId, year: pm.year, month: pm.month } },
  });
  const prevPayload = prevReport ? parsePayload(prevReport.payload) : null;
  const prev = prevPayload?.kpi ?? null;
  const prevSearchNormalized = prevPayload
    ? normalizeSearchFunnel(
        prevPayload.searchFunnel as SearchVisibilityFunnel & { steps?: ReportFunnelStep[] },
        prev?.gscPageCount ?? 0,
        prevPayload.topKeywords || [],
        null,
      )
    : null;
  // 仅当新版 worker 写入 top100/top30 计数时采用 summary（避免旧快照 keywordCount=截断条数）
  const funnelCounts: SearchFunnelCounts | null =
    gsc.summary?.top100Count != null && gsc.summary?.top30Count != null
      ? {
          keywordsShown: gsc.summary.keywordCount ?? undefined,
          top100: gsc.summary.top100Count,
          top30: gsc.summary.top30Count,
        }
      : null;
  const searchFunnel = buildSearchFunnel(
    wpPages?.total ?? null,
    visiblePages,
    keywords,
    funnelPrevByKey(prevSearchNormalized, prev),
    funnelCounts,
  );

  const trafficFunnel = buildTrafficFunnel(
    gaPageViews,
    gaSessions,
    gaEngagedSessions,
    inquiry,
    {
      pageViews: prev?.gaPageViews,
      sessions: prev?.gaSessions,
      engagedSessions: prev?.gaEngagedSessions,
      inquiries: prev?.inquiry?.total,
      nonInvalid: prev?.inquiry?.effective,
      valid: prev?.inquiry?.valid,
    },
  );
  if (gaPageViewsRaw <= 0 && gaSessions > 0) {
    const step = trafficFunnel.steps.find((s) => s.key === "pageViews");
    if (step) {
      step.hint = "该月快照无 screenPageViews，暂用会话数占位";
    }
  }

  const startDate = seoSnap?.startDate || gsc.startDate || ga.startDate || "";
  const endDate = seoSnap?.endDate || gsc.endDate || ga.endDate || "";
  const spanDays = daysInclusive(startDate, endDate);

  return {
    clientName: site.client.name,
    domain: site.domain,
    siteType: site.siteType,
    year,
    month,
    periodLabel: periodLabel(year, month),
    generatedAt: new Date().toISOString(),
    meta: {
      periodKind: "calendar_month",
      startDate,
      endDate,
      gscPeriodDays: spanDays || daysInclusive(
        `${year}-${String(month).padStart(2, "0")}-01`,
        endDate,
      ),
      gaPeriodDays: spanDays,
      gscSyncedAt: seoSnap?.syncedAt?.toISOString() ?? null,
      gaSyncedAt: seoSnap?.syncedAt?.toISOString() ?? null,
      gscEnabled: site.gscSyncEnabled,
      gaEnabled: site.gaSyncEnabled,
    },
    kpi,
    prev,
    searchFunnel,
    trafficFunnel,
    topKeywords: keywords.slice(0, 10),
    opportunityKeywords: pickOpportunity(keywords),
    topPages: gscPages.slice(0, 10),
    topChannels: channels.slice(0, 10),
    topLandings: landings.slice(0, 10),
    topGaPages: gaPages.slice(0, 10),
    topCountries: countries.slice(0, 15),
    highlights: buildHighlights(kpi, prev),
  };
}

/** 生成或刷新当月快照；默认保留已有 viewToken 与人工备注 */
export async function upsertMonthlyReport(
  siteId: string,
  year: number,
  month: number,
  opts?: { rotateToken?: boolean; preserveNotes?: boolean },
) {
  const payload = await buildReportPayload(siteId, year, month);
  const existing = await prisma.siteMonthlyReport.findUnique({
    where: { siteId_year_month: { siteId, year, month } },
  });

  const viewToken =
    opts?.rotateToken || !existing ? newViewToken() : existing.viewToken;
  const preserveNotes = opts?.preserveNotes !== false;
  const workDone = preserveNotes && existing ? existing.workDone : "";
  const nextPlan = preserveNotes && existing ? existing.nextPlan : "";
  const highlightsEdit =
    preserveNotes && existing ? existing.highlightsEdit || "" : "";
  const hiddenSections =
    preserveNotes && existing ? existing.hiddenSections || "[]" : "[]";

  const row = await prisma.siteMonthlyReport.upsert({
    where: { siteId_year_month: { siteId, year, month } },
    create: {
      siteId,
      year,
      month,
      viewToken,
      payload: JSON.stringify(payload),
      workDone,
      nextPlan,
      highlightsEdit,
      hiddenSections,
      generatedAt: new Date(),
    },
    update: {
      viewToken,
      payload: JSON.stringify(payload),
      ...(preserveNotes
        ? {}
        : { workDone: "", nextPlan: "", highlightsEdit: "", hiddenSections: "[]" }),
      generatedAt: new Date(),
    },
  });

  return row;
}

export async function getReportByToken(token: string) {
  const t = String(token || "").trim();
  if (!t) return null;
  return prisma.siteMonthlyReport.findUnique({
    where: { viewToken: t },
    include: { site: { include: { client: true } } },
  });
}

export async function getReport(siteId: string, year: number, month: number) {
  return prisma.siteMonthlyReport.findUnique({
    where: { siteId_year_month: { siteId, year, month } },
  });
}

/**
 * 为「上个月」自动建月报（仅当不存在时）。
 * 由独立 cron `task=monthly-report`（建议每月 1 号）触发，不再塞进日常任务。
 */
export async function autoSnapshotPreviousMonth() {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Shanghai" }),
  );
  const pm = prevMonth(now.getFullYear(), now.getMonth() + 1);
  const sites = await prisma.site.findMany({
    where: {
      OR: [{ gscSyncEnabled: true }, { gaSyncEnabled: true }],
    },
    select: { id: true },
  });

  let created = 0;
  const errors: string[] = [];
  for (const s of sites) {
    const exists = await prisma.siteMonthlyReport.findUnique({
      where: {
        siteId_year_month: { siteId: s.id, year: pm.year, month: pm.month },
      },
      select: { id: true },
    });
    if (exists) continue;
    try {
      await upsertMonthlyReport(s.id, pm.year, pm.month, { preserveNotes: true });
      created++;
    } catch (e) {
      errors.push(`${s.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { year: pm.year, month: pm.month, created, errors };
}

export function momLabel(
  curr: number,
  prev: number | null | undefined,
  opts?: { invertBetter?: boolean },
): { text: string; better: boolean | null } {
  if (prev == null || !Number.isFinite(prev)) {
    return { text: "—", better: null };
  }
  if (prev === 0 && curr === 0) return { text: "→0%", better: null };
  if (prev === 0) return { text: "新增", better: true };
  const d = (curr - prev) / Math.abs(prev);
  const better = opts?.invertBetter ? d < 0 : d > 0;
  const sign = d > 0 ? "↑" : d < 0 ? "↓" : "→";
  return { text: `${sign}${Math.abs(d * 100).toFixed(0)}%`, better: d === 0 ? null : better };
}
