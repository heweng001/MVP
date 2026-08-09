import { gaDateRange } from "./common.mjs";

// rangeOverride: { startDate, endDate }

function metricMap(row, metricHeaders) {
  const out = {};
  const values = row.metricValues || [];
  for (let i = 0; i < metricHeaders.length; i++) {
    const name = metricHeaders[i]?.name;
    if (!name) continue;
    out[name] = Number(values[i]?.value) || 0;
  }
  return out;
}

async function runReport(analyticsdata, propertyId, requestBody) {
  const res = await analyticsdata.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody,
  });
  return res.data || {};
}

/**
 * @param {object} site - seo-worker sites 项（含 ga 子对象）
 */
export async function syncGaSite(analyticsdata, site, defaults, rangeOverride = null) {
  const ga = site.ga || {};
  const propertyId = String(ga.propertyId || "").trim();
  if (!propertyId) {
    throw new Error("缺少 GA4 propertyId");
  }
  if (!/^\d+$/.test(propertyId)) {
    throw new Error("GA4 propertyId 应为纯数字（非 G-XXXX）");
  }

  const periodDays = ga.periodDays || defaults.gaPeriodDays;
  const { startDate, endDate } = rangeOverride || gaDateRange(periodDays);

  const summaryMetrics = [
    { name: "sessions" },
    { name: "totalUsers" },
    { name: "screenPageViews" },
    { name: "engagedSessions" },
    { name: "engagementRate" },
    { name: "conversions" },
  ];

  const summaryRes = await runReport(analyticsdata, propertyId, {
    dateRanges: [{ startDate, endDate }],
    metrics: summaryMetrics,
  });
  const summaryRow = (summaryRes.rows || [])[0];
  const sm = summaryRow
    ? metricMap(summaryRow, summaryRes.metricHeaders || summaryMetrics)
    : {
        sessions: 0,
        totalUsers: 0,
        screenPageViews: 0,
        engagedSessions: 0,
        engagementRate: 0,
        conversions: 0,
      };

  const landingMetrics = [
    { name: "sessions" },
    { name: "engagedSessions" },
    { name: "conversions" },
    { name: "engagementRate" },
  ];
  const landingRes = await runReport(analyticsdata, propertyId, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "landingPage" }],
    metrics: landingMetrics,
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: defaults.topLanding,
  });
  const landingHeaders = landingRes.metricHeaders || landingMetrics;
  const landingPages = (landingRes.rows || [])
    .map((r) => {
      const m = metricMap(r, landingHeaders);
      return {
        pagePath: String(r.dimensionValues?.[0]?.value || "").trim(),
        sessions: m.sessions || 0,
        engagedSessions: m.engagedSessions || 0,
        conversions: m.conversions || 0,
        engagementRate: m.engagementRate || 0,
      };
    })
    .filter((r) => r.pagePath && r.pagePath !== "(not set)");

  const channelRes = await runReport(analyticsdata, propertyId, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "sessionDefaultChannelGroup" }],
    metrics: landingMetrics,
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: defaults.topChannels,
  });
  const channelHeaders = channelRes.metricHeaders || landingMetrics;
  const channels = (channelRes.rows || [])
    .map((r) => {
      const m = metricMap(r, channelHeaders);
      return {
        channelGroup: String(r.dimensionValues?.[0]?.value || "").trim(),
        sessions: m.sessions || 0,
        engagedSessions: m.engagedSessions || 0,
        conversions: m.conversions || 0,
        engagementRate: m.engagementRate || 0,
      };
    })
    .filter((r) => r.channelGroup);

  return {
    siteId: site.id,
    propertyId,
    periodDays,
    syncedAt: new Date().toISOString(),
    startDate,
    endDate,
    summary: {
      sessions: sm.sessions || 0,
      users: sm.totalUsers || 0,
      pageViews: sm.screenPageViews || 0,
      engagedSessions: sm.engagedSessions || 0,
      engagementRate: sm.engagementRate || 0,
      conversions: sm.conversions || 0,
    },
    landingPages,
    channels,
  };
}
