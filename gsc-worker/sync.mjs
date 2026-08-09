/**
 * 新加坡 GSC Worker（方案 A）
 * 1) 从阿里云拉取待同步站点
 * 2) 用服务账号调 Google Search Console API
 * 3) 把结果 POST 回阿里云入库
 *
 * 用法：
 *   export $(grep -v '^#' .env | xargs)
 *   npm run sync
 */
import fs from "fs";
import { google } from "googleapis";

function env(name, fallback = "") {
  return String(process.env[name] ?? fallback).trim();
}

function requireEnv(name) {
  const v = env(name);
  if (!v) throw new Error(`缺少环境变量 ${name}`);
  return v;
}

function loadServiceAccount() {
  const jsonInline = env("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (jsonInline) return JSON.parse(jsonInline);
  const path = env("GOOGLE_APPLICATION_CREDENTIALS");
  if (!path) {
    throw new Error("请配置 GOOGLE_APPLICATION_CREDENTIALS 或 GOOGLE_SERVICE_ACCOUNT_JSON");
  }
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

function dateRange(periodDays) {
  const end = new Date();
  // GSC 数据常延迟 2～3 天
  end.setUTCDate(end.getUTCDate() - 3);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (periodDays - 1));
  return { startDate: ymd(start), endDate: ymd(end) };
}

async function api(base, secret, path, { method = "GET", body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-gsc-worker-secret": secret,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status} ${path}`);
  }
  return data;
}

async function queryAnalytics(searchconsole, siteUrl, opts) {
  const res = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: opts,
  });
  return res.data.rows || [];
}

async function syncSite(searchconsole, site, defaults) {
  const periodDays = site.periodDays || defaults.periodDays;
  const { startDate, endDate } = dateRange(periodDays);
  const propertyUrl = site.propertyUrl;
  if (!propertyUrl) {
    throw new Error("缺少 GSC propertyUrl");
  }

  const targetKeywords = Array.isArray(site.targetKeywords) ? site.targetKeywords : [];
  let keywordRows = [];

  if (targetKeywords.length) {
    // 逐词 equals 查询（GSC filter 组不支持可靠 OR）；词量通常不大
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
  const pages = pageRowsRaw.map((r) => ({
    pageUrl: String(r.keys?.[0] || "").trim(),
    position: Number(r.position) || 0,
    clicks: Number(r.clicks) || 0,
    impressions: Number(r.impressions) || 0,
    ctr: Number(r.ctr) || 0,
  })).filter((r) => r.pageUrl);

  const withImpr = keywordRows.filter((k) => k.impressions > 0 && k.position > 0);
  const avgPosition = withImpr.length
    ? withImpr.reduce((s, k) => s + k.position, 0) / withImpr.length
    : null;

  return {
    siteId: site.id,
    propertyUrl,
    periodDays,
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const base = requireEnv("INQUIRY_API_BASE").replace(/\/$/, "");
  const secret = requireEnv("GSC_WORKER_SECRET");
  const defaults = {
    periodDays: Number(env("GSC_PERIOD_DAYS", "28")) || 28,
    topQueries: Number(env("GSC_TOP_QUERIES", "50")) || 50,
    topPages: Number(env("GSC_TOP_PAGES", "100")) || 100,
    delayMs: Number(env("GSC_SITE_DELAY_MS", "800")) || 800,
  };

  const sa = loadServiceAccount();
  const auth = new google.auth.GoogleAuth({
    credentials: sa,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
  const searchconsole = google.searchconsole({ version: "v1", auth });

  const list = await api(base, secret, "/api/gsc-worker/sites");
  const sites = Array.isArray(list.sites) ? list.sites : [];
  console.log(`[gsc-worker] sites=${sites.length} base=${base}`);

  let ok = 0;
  let fail = 0;
  for (const site of sites) {
    const label = `${site.domain} (${site.id})`;
    try {
      console.log(`[gsc-worker] sync ${label} → ${site.propertyUrl}`);
      const payload = await syncSite(searchconsole, site, defaults);
      await api(base, secret, "/api/gsc-worker/ingest", {
        method: "POST",
        body: payload,
      });
      console.log(
        `[gsc-worker] ok ${label} keywords=${payload.keywords.length} pages=${payload.pages.length}`,
      );
      ok++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[gsc-worker] fail ${label}:`, msg);
      try {
        await api(base, secret, "/api/gsc-worker/ingest", {
          method: "POST",
          body: {
            siteId: site.id,
            propertyUrl: site.propertyUrl,
            periodDays: site.periodDays || defaults.periodDays,
            syncedAt: new Date().toISOString(),
            error: msg,
          },
        });
      } catch (e2) {
        console.error(`[gsc-worker] ingest error report failed:`, e2);
      }
      fail++;
    }
    if (defaults.delayMs > 0) await sleep(defaults.delayMs);
  }

  console.log(`[gsc-worker] done ok=${ok} fail=${fail}`);
  if (fail && !ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error("[gsc-worker] fatal", e);
  process.exit(1);
});
