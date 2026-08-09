import { gscDateRange, sleep } from "./common.mjs";

async function queryAnalytics(searchconsole, siteUrl, opts) {
  const res = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: opts,
  });
  return res.data.rows || [];
}

/**
 * @param {object} site - seo-worker sites 项（含 gsc 子对象或扁平字段）
 */
export async function syncGscSite(searchconsole, site, defaults, rangeOverride = null) {
  const gsc = site.gsc || {};
  const periodDays = gsc.periodDays || site.periodDays || defaults.gscPeriodDays;
  const { startDate, endDate } = rangeOverride || gscDateRange(periodDays);
  const propertyUrl = gsc.propertyUrl || site.propertyUrl;
  if (!propertyUrl) {
    throw new Error("缺少 GSC propertyUrl");
  }

  const targetKeywords = Array.isArray(gsc.targetKeywords)
    ? gsc.targetKeywords
    : Array.isArray(site.targetKeywords)
      ? site.targetKeywords
      : [];
  let keywordRows = [];

  if (targetKeywords.length) {
    const byKey = new Map();
    for (const kw of targetKeywords) {
      const rows = await queryAnalytics(searchconsole, propertyUrl, {
        startDate,
        endDate,
        dimensions: ["query"],
        rowLimit: 5,
        dimensionFilterGroups: [
          {
            filters: [
              {
                dimension: "query",
                operator: "equals",
                expression: kw,
              },
            ],
          },
        ],
      });
      const r = rows[0];
      if (r) {
        byKey.set(kw.toLowerCase(), {
          keyword: kw,
          position: Number(r.position) || 0,
          clicks: Number(r.clicks) || 0,
          impressions: Number(r.impressions) || 0,
          ctr: Number(r.ctr) || 0,
        });
      } else {
        byKey.set(kw.toLowerCase(), {
          keyword: kw,
          position: 0,
          clicks: 0,
          impressions: 0,
          ctr: 0,
        });
      }
      await sleep(120);
    }
    keywordRows = [...byKey.values()];
  } else {
    const rows = await queryAnalytics(searchconsole, propertyUrl, {
      startDate,
      endDate,
      dimensions: ["query"],
      rowLimit: defaults.topQueries,
      startRow: 0,
    });
    keywordRows = rows
      .map((r) => ({
        keyword: String(r.keys?.[0] || "").trim(),
        position: Number(r.position) || 0,
        clicks: Number(r.clicks) || 0,
        impressions: Number(r.impressions) || 0,
        ctr: Number(r.ctr) || 0,
      }))
      .filter((r) => r.keyword);
  }

  const pageRowsRaw = await queryAnalytics(searchconsole, propertyUrl, {
    startDate,
    endDate,
    dimensions: ["page"],
    rowLimit: defaults.topPages,
    startRow: 0,
  });
  const pages = pageRowsRaw
    .map((r) => ({
      pageUrl: String(r.keys?.[0] || "").trim(),
      position: Number(r.position) || 0,
      clicks: Number(r.clicks) || 0,
      impressions: Number(r.impressions) || 0,
      ctr: Number(r.ctr) || 0,
    }))
    .filter((r) => r.pageUrl);

  const withImpr = keywordRows.filter((k) => k.impressions > 0 && k.position > 0);
  const avgPosition = withImpr.length
    ? withImpr.reduce((s, k) => s + k.position, 0) / withImpr.length
    : null;

  return {
    siteId: site.id,
    propertyUrl,
    periodDays,
    startDate,
    endDate,
    syncedAt: new Date().toISOString(),
    summary: {
      avgPosition,
      keywordCount: keywordRows.length,
      pageCount: pages.length,
    },
    keywords: keywordRows,
    pages,
  };
}
