import type { SiteReportPayload } from "./site-report";

/** 固定模版案例，不依赖真实同步数据 */
export function getDemoReportPayload(): SiteReportPayload {
  const inquiry = {
    siteId: "demo",
    total: 48,
    autoSpam: 6,
    reviewSpam: 2,
    intercepted: 8,
    forwarded: 36,
    valid: 22,
    invalid: 5,
    pending: 9,
    unmarked: 9,
    review: 4,
    effective: 31,
    effectiveRate: 31 / 36,
  };

  const prevInquiry = {
    ...inquiry,
    total: 41,
    forwarded: 30,
    valid: 18,
    invalid: 6,
    pending: 6,
    unmarked: 6,
    effective: 24,
    effectiveRate: 24 / 30,
    intercepted: 7,
    autoSpam: 5,
    reviewSpam: 2,
    review: 4,
  };

  return {
    clientName: "示例科技",
    domain: "demo.example.com",
    siteType: "SEO型",
    year: 2026,
    month: 7,
    periodLabel: "2026年7月",
    generatedAt: "2026-08-01T02:00:00.000Z",
    meta: {
      periodKind: "calendar_month",
      startDate: "2026-07-01",
      endDate: "2026-07-28",
      gscPeriodDays: 28,
      gaPeriodDays: 28,
      gscSyncedAt: "2026-08-01T02:00:00.000Z",
      gaSyncedAt: "2026-08-01T02:00:00.000Z",
      gscEnabled: true,
      gaEnabled: true,
    },
    kpi: {
      gscClicks: 1260,
      gscImpressions: 42800,
      gscCtr: 1260 / 42800,
      gscAvgPosition: 18.4,
      gscKeywordCount: 186,
      gscPageCount: 64,
      gaSessions: 3920,
      gaUsers: 3180,
      gaPageViews: 8640,
      gaEngagedSessions: 2430,
      gaConversions: 54,
      gaEngagementRate: 0.62,
      inquiry,
    },
    prev: {
      gscClicks: 1080,
      gscImpressions: 40100,
      gscCtr: 1080 / 40100,
      gscAvgPosition: 21.2,
      gscKeywordCount: 172,
      gscPageCount: 58,
      gaSessions: 3510,
      gaUsers: 2890,
      gaPageViews: 7420,
      gaEngagedSessions: 2030,
      gaConversions: 47,
      gaEngagementRate: 0.58,
      inquiry: prevInquiry,
    },
    searchFunnel: {
      title: "搜索可见性漏斗",
      sitePageSource: "wp_rest",
      steps: [
        { key: "sitePages", label: "网站页面数", value: 128, hint: "WordPress 已发布文章+页面" },
        { key: "visiblePages", label: "可见页数", value: 64, hint: "GSC 同期有展示的页面数（≠完整收录）" },
        { key: "keywordsShown", label: "有展示关键词", value: 186, hint: "GSC 近周期有展示的查询词" },
        { key: "top100", label: "排名前 100", value: 142 },
        { key: "top30", label: "排名前 30", value: 68 },
        { key: "top10", label: "排名前 10", value: 24 },
      ],
    },
    trafficFunnel: {
      title: "流量与询盘漏斗",
      steps: [
        { key: "pageViews", label: "页面浏览量", value: 8640, hint: "GA4 screenPageViews" },
        { key: "users", label: "用户数", value: 3180 },
        { key: "engagedSessions", label: "互动会话", value: 2430, hint: "GA4 engagedSessions" },
        { key: "inquiries", label: "询盘数", value: 48, hint: "自然月提交总数" },
        { key: "nonInvalid", label: "非无效询盘", value: 31, hint: "标记有效 + 未标记（待标记）" },
        { key: "valid", label: "有效询盘", value: 22 },
      ],
    },
    topKeywords: [
      { keyword: "industrial valve supplier", position: 6.2, clicks: 210, impressions: 4200, ctr: 0.05 },
      { keyword: "stainless steel ball valve", position: 9.1, clicks: 168, impressions: 5100, ctr: 0.033 },
      { keyword: "OEM valve manufacturer China", position: 11.4, clicks: 142, impressions: 3900, ctr: 0.036 },
      { keyword: "butterfly valve wholesale", position: 14.8, clicks: 96, impressions: 6200, ctr: 0.015 },
      { keyword: "gate valve factory", position: 8.6, clicks: 88, impressions: 2800, ctr: 0.031 },
      { keyword: "custom CNC machining parts", position: 16.2, clicks: 74, impressions: 4500, ctr: 0.016 },
      { keyword: "pneumatic actuator valve", position: 12.0, clicks: 61, impressions: 2100, ctr: 0.029 },
      { keyword: "flange ball valve", position: 7.4, clicks: 55, impressions: 1900, ctr: 0.029 },
      { keyword: "check valve manufacturer", position: 19.5, clicks: 42, impressions: 3400, ctr: 0.012 },
      { keyword: "API 6D valve", position: 22.1, clicks: 38, impressions: 2600, ctr: 0.015 },
    ],
    opportunityKeywords: [
      { keyword: "butterfly valve wholesale", position: 14.8, clicks: 96, impressions: 6200, ctr: 0.015 },
      { keyword: "custom CNC machining parts", position: 16.2, clicks: 74, impressions: 4500, ctr: 0.016 },
      { keyword: "check valve manufacturer", position: 19.5, clicks: 42, impressions: 3400, ctr: 0.012 },
      { keyword: "API 6D valve", position: 22.1, clicks: 38, impressions: 2600, ctr: 0.015 },
    ],
    topPages: [
      {
        pageUrl: "https://demo.example.com/products/ball-valve/",
        position: 8.2,
        clicks: 320,
        impressions: 9800,
        ctr: 0.033,
      },
      {
        pageUrl: "https://demo.example.com/products/butterfly-valve/",
        position: 12.5,
        clicks: 210,
        impressions: 11200,
        ctr: 0.019,
      },
      {
        pageUrl: "https://demo.example.com/about/",
        position: 15.0,
        clicks: 88,
        impressions: 3200,
        ctr: 0.028,
      },
      {
        pageUrl: "https://demo.example.com/contact/",
        position: 10.1,
        clicks: 76,
        impressions: 2100,
        ctr: 0.036,
      },
      {
        pageUrl: "https://demo.example.com/blog/valve-selection-guide/",
        position: 18.4,
        clicks: 64,
        impressions: 5600,
        ctr: 0.011,
      },
    ],
    topChannels: [
      { channelGroup: "Organic Search", sessions: 1680, engagedSessions: 1180, conversions: 28, engagementRate: 0.7 },
      { channelGroup: "Direct", sessions: 920, engagedSessions: 540, conversions: 12, engagementRate: 0.59 },
      { channelGroup: "Referral", sessions: 610, engagedSessions: 380, conversions: 9, engagementRate: 0.62 },
      { channelGroup: "Paid Search", sessions: 420, engagedSessions: 290, conversions: 4, engagementRate: 0.69 },
      { channelGroup: "Email", sessions: 180, engagedSessions: 120, conversions: 1, engagementRate: 0.67 },
    ],
    topLandings: [
      { pagePath: "/products/ball-valve/", sessions: 680, engagedSessions: 490, conversions: 18, engagementRate: 0.72 },
      { pagePath: "/", sessions: 540, engagedSessions: 310, conversions: 6, engagementRate: 0.57 },
      { pagePath: "/products/butterfly-valve/", sessions: 410, engagedSessions: 280, conversions: 11, engagementRate: 0.68 },
      { pagePath: "/contact/", sessions: 260, engagedSessions: 210, conversions: 14, engagementRate: 0.81 },
      { pagePath: "/blog/valve-selection-guide/", sessions: 190, engagedSessions: 140, conversions: 2, engagementRate: 0.74 },
    ],
    highlights: [
      "自然搜索点击环比 ↑17%（1080 → 1260）",
      "网站会话环比 ↑12%（3510 → 3920）",
      "询盘提交环比 ↑17%（41 → 48）",
      "平均排名 21.2 → 18.4（提升）",
      "本月已转发 36 条，有效占比 86%（有效+待标记）",
    ],
  };
}

export const DEMO_WORK_DONE = `1. 优化球阀/蝶阀品类页标题与 meta，强化 OEM / wholesale 卖点
2. 新增《阀门选型指南》博客并做内链至产品页
3. 修复联系页移动端表单遮挡，缩短表单字段
4. 提交 sitemap，处理 3 个软 404 产品旧链`;

export const DEMO_NEXT_PLAN = `1. 针对 butterfly valve wholesale 等机会词改写标题与首屏
2. 补齐 check valve / API 6D 专题页大纲与上线
3. 加强 Organic 落地页 CTA，目标将表单完成率再提升一档
4. 复盘付费与自然搜索重叠词，避免互相抢量`;
