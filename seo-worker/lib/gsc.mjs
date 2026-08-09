import { gscDateRange, sleep } from "./common.mjs";

/** GSC Search Analytics 单次 rowLimit 上限 */
const GSC_PAGE_SIZE = 25000;

async function queryAnalytics(searchconsole, siteUrl, opts) {
  const res = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: opts,
  });
  return res.data.rows || [];
}

/**
 * 分页拉全量（或至 maxRows）。用于漏斗统计，避免只拿 Top50 导致各层都是同一数字。
 */
async function queryAnalyticsPaged(searchconsole, siteUrl, baseOpts, maxRows) {
  const cap = Math.max(1, Math.min(Number(maxRows) || GSC_PAGE_SIZE, 100000));
  const all = [];
  let startRow = 0;
  while (all.length < cap) {
    const limit = Math.min(GSC_PAGE_SIZE, cap - all.length);
    const rows = await queryAnalytics(searchconsole, siteUrl, {
      ...baseOpts,
      rowLimit: limit,
      startRow,
    });
    if (!rows.length) break;
    all.push(...rows);
    if (rows.length < limit) break;
    startRow += rows.length;
    await sleep(150);
  }
  return all;
}

function mapQueryRow(r) {
  return {
    keyword: String(r.keys?.[0] || "").trim(),
    position: Number(r.position) || 0,
    clicks: Number(r.clicks) || 0,
    impressions: Number(r.impressions) || 0,
    ctr: Number(r.ctr) || 0,
  };
}

function mapPageRow(r) {
  return {
    pageUrl: String(r.keys?.[0] || "").trim(),
    position: Number(r.position) || 0,
    clicks: Number(r.clicks) || 0,
    impressions: Number(r.impressions) || 0,
    ctr: Number(r.ctr) || 0,
  };
}

function funnelFromKeywords(keywordRows) {
  const withImp = keywordRows.filter((k) => k.impressions > 0);
  const ranked = withImp.filter((k) => k.position > 0);
  return {
    keywordCount: withImp.length,
    top100Count: ranked.filter((k) => k.position <= 100).length,
    top30Count: ranked.filter((k) => k.position <= 30).length,
    top10Count: ranked.filter((k) => k.position <= 10).length,
  };
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

  // 漏斗 / 月报：始终按 query 维度分页拉量（默认尽量拉全，上限可配）
  const maxQueries =
    Number(defaults.maxQueries || defaults.topQueries || GSC_PAGE_SIZE) || GSC_PAGE_SIZE;
  const maxPages = Number(defaults.maxPages || defaults.topPages || GSC_PAGE_SIZE) || GSC_PAGE_SIZE;
  // 入库详情条数（点击 Top），避免 JSON/DB 过大；漏斗用 summary 计数
  const storeQueries = Math.max(50, Number(defaults.topQueries) || 250);
  const storePages = Math.max(50, Number(defaults.topPages) || 250);

  const queryRowsRaw = await queryAnalyticsPaged(
    searchconsole,
    propertyUrl,
    { startDate, endDate, dimensions: ["query"] },
    maxQueries,
  );
  const byKey = new Map();
  for (const r of queryRowsRaw) {
    const row = mapQueryRow(r);
    if (!row.keyword) continue;
    byKey.set(row.keyword.toLowerCase(), row);
  }

  const queriesTruncated = queryRowsRaw.length >= maxQueries;

  // 目标词：全量里没有的直接记 0；仅当全量触顶截断时才精确补查（否则多半仍是空）
  for (const kw of targetKeywords) {
    const key = String(kw || "")
      .trim()
      .toLowerCase();
    if (!key || byKey.has(key)) continue;
    if (!queriesTruncated) {
      byKey.set(key, {
        keyword: String(kw).trim(),
        position: 0,
        clicks: 0,
        impressions: 0,
        ctr: 0,
      });
      continue;
    }
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
    byKey.set(
      key,
      r
        ? {
            keyword: String(kw).trim(),
            position: Number(r.position) || 0,
            clicks: Number(r.clicks) || 0,
            impressions: Number(r.impressions) || 0,
            ctr: Number(r.ctr) || 0,
          }
        : {
            keyword: String(kw).trim(),
            position: 0,
            clicks: 0,
            impressions: 0,
            ctr: 0,
          },
    );
    await sleep(120);
  }

  const allKeywords = [...byKey.values()];
  const funnel = funnelFromKeywords(allKeywords);
  const withImpr = allKeywords.filter((k) => k.impressions > 0 && k.position > 0);
  const avgPosition = withImpr.length
    ? withImpr.reduce((s, k) => s + k.position, 0) / withImpr.length
    : null;

  // 详情：有展示的按点击排序截断；目标词优先保留
  const targetSet = new Set(
    targetKeywords.map((k) =>
      String(k || "")
        .trim()
        .toLowerCase(),
    ),
  );
  const sorted = [...allKeywords].sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);
  const keywordRows = [];
  const seen = new Set();
  for (const k of sorted) {
    const key = k.keyword.toLowerCase();
    if (targetSet.has(key)) {
      keywordRows.push(k);
      seen.add(key);
    }
  }
  for (const k of sorted) {
    if (keywordRows.length >= storeQueries) break;
    const key = k.keyword.toLowerCase();
    if (seen.has(key)) continue;
    if (k.impressions <= 0) continue;
    keywordRows.push(k);
    seen.add(key);
  }

  const pageRowsRaw = await queryAnalyticsPaged(
    searchconsole,
    propertyUrl,
    { startDate, endDate, dimensions: ["page"] },
    maxPages,
  );
  const allPages = pageRowsRaw.map(mapPageRow).filter((r) => r.pageUrl);
  const pages = [...allPages]
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .slice(0, storePages);

  return {
    siteId: site.id,
    propertyUrl,
    periodDays,
    startDate,
    endDate,
    syncedAt: new Date().toISOString(),
    summary: {
      avgPosition,
      keywordCount: funnel.keywordCount,
      top100Count: funnel.top100Count,
      top30Count: funnel.top30Count,
      top10Count: funnel.top10Count,
      pageCount: allPages.filter((p) => p.impressions > 0).length,
      /** 全量拉取到的 query 行数（含无展示）；用于排查是否触顶 */
      queriesFetched: allKeywords.length,
      pagesFetched: allPages.length,
      truncated: queriesTruncated || allPages.length >= maxPages,
    },
    keywords: keywordRows,
    pages,
  };
}
