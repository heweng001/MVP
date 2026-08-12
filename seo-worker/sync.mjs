/**
 * 新加坡 SEO Worker（GSC + GA4 合并）
 * 1) 从阿里云拉取待同步站点
 * 2) 滚动近 N 天 → 列表缓存
 * 3) 自然月（当月 MTD；月初 1～3 日再补上月）→ 月报快照
 *
 * 用法：
 *   npm run sync
 *   npm run sync:month -- 2026-07
 */
import { google } from "googleapis";
import {
  api,
  calendarMonthDateRange,
  env,
  loadServiceAccount,
  prevCalendarMonth,
  requireEnv,
  shanghaiYmdParts,
  sleep,
} from "./lib/common.mjs";
import { syncGscSite } from "./lib/gsc.mjs";
import { syncGaSite } from "./lib/ga.mjs";

function parseSitesFilter() {
  const argv = process.argv.slice(2);
  const eq = argv.find((a) => a.startsWith("--sites="));
  if (eq) {
    return eq
      .slice("--sites=".length)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const idx = argv.indexOf("--sites");
  if (idx >= 0 && argv[idx + 1]) {
    return argv[idx + 1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return null;
}

function parseGscOnly() {
  return process.argv.slice(2).includes("--gsc-only");
}

function parseReportMonthArg() {
  const argv = process.argv.slice(2);
  const eq = argv.find((a) => a.startsWith("--report-month="));
  if (eq) return eq.split("=")[1];
  const idx = argv.indexOf("--report-month");
  if (idx >= 0 && argv[idx + 1]) return argv[idx + 1];
  // npm run sync:month -- 2026-07
  const bare = argv.find((a) => /^\d{4}-\d{1,2}$/.test(a));
  return bare || env("REPORT_MONTH");
}

function monthsToSyncFromNow() {
  const { year, month, day } = shanghaiYmdParts();
  const list = [{ year, month }];
  if (day >= 1 && day <= 3) {
    list.push(prevCalendarMonth(year, month));
  }
  return list;
}

async function syncSiteMonth(base, secret, searchconsole, analyticsdata, site, defaults, year, month) {
  const label = `${site.domain} ${year}-${String(month).padStart(2, "0")}`;
  const gscRange = calendarMonthDateRange(year, month, 3);
  const gaRange = calendarMonthDateRange(year, month, 2);
  const doGsc = Boolean(site.gsc?.enabled);
  const doGa = Boolean(site.ga?.enabled);

  if (doGsc) {
    try {
      const payload = await syncGscSite(searchconsole, site, defaults, gscRange);
      await api(base, secret, "/api/seo-worker/month-ingest", {
        method: "POST",
        body: {
          siteId: site.id,
          year,
          month,
          startDate: gscRange.startDate,
          endDate: gscRange.endDate,
          syncedAt: payload.syncedAt,
          gsc: {
            startDate: payload.startDate,
            endDate: payload.endDate,
            summary: payload.summary,
            keywords: payload.keywords,
            pages: payload.pages,
          },
        },
      });
      console.log(
        `[seo-worker] month GSC ok ${label} kw=${payload.keywords.length} pages=${payload.pages.length}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[seo-worker] month GSC fail ${label}:`, msg);
      await api(base, secret, "/api/seo-worker/month-ingest", {
        method: "POST",
        body: {
          siteId: site.id,
          year,
          month,
          startDate: gscRange.startDate,
          endDate: gscRange.endDate,
          gsc: { error: msg },
        },
      }).catch(() => {});
    }
  }

  if (doGa) {
    try {
      const payload = await syncGaSite(analyticsdata, site, defaults, gaRange);
      await api(base, secret, "/api/seo-worker/month-ingest", {
        method: "POST",
        body: {
          siteId: site.id,
          year,
          month,
          startDate: gaRange.startDate,
          endDate: gaRange.endDate,
          syncedAt: payload.syncedAt,
          ga: {
            startDate: payload.startDate,
            endDate: payload.endDate,
            summary: payload.summary,
            landingPages: payload.landingPages,
            pages: payload.pages,
            channels: payload.channels,
            countries: payload.countries,
          },
        },
      });
      console.log(
        `[seo-worker] month GA  ok ${label} sessions=${payload.summary.sessions}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[seo-worker] month GA  fail ${label}:`, msg);
      await api(base, secret, "/api/seo-worker/month-ingest", {
        method: "POST",
        body: {
          siteId: site.id,
          year,
          month,
          startDate: gaRange.startDate,
          endDate: gaRange.endDate,
          ga: { error: msg },
        },
      }).catch(() => {});
    }
  }

  if (!doGsc && !doGa) {
    console.log(`[seo-worker] month skip ${label}（未开启 GSC/GA）`);
  }
}

async function main() {
  const base = requireEnv("INQUIRY_API_BASE").replace(/\/$/, "");
  const secret =
    env("SEO_WORKER_SECRET") || env("GSC_WORKER_SECRET") || env("CRON_SECRET");
  if (!secret) {
    throw new Error("缺少环境变量 SEO_WORKER_SECRET / GSC_WORKER_SECRET / CRON_SECRET");
  }
  const defaults = {
    gscPeriodDays: Number(env("GSC_PERIOD_DAYS", "28")) || 28,
    gaPeriodDays: Number(env("GA_PERIOD_DAYS", "28")) || 28,
    // 入库详情条数（点击 Top）；漏斗统计另按 maxQueries 分页拉全量
    topQueries: Number(env("GSC_TOP_QUERIES", "500")) || 500,
    topPages: Number(env("GSC_TOP_PAGES", "500")) || 500,
    maxQueries: Number(env("GSC_MAX_QUERIES", "25000")) || 25000,
    maxPages: Number(env("GSC_MAX_PAGES", "25000")) || 25000,
    topLanding: Number(env("GA_TOP_LANDING", "100")) || 100,
    topChannels: Number(env("GA_TOP_CHANNELS", "20")) || 20,
    topCountries: Number(env("GA_TOP_COUNTRIES", "25")) || 25,
    delayMs: Number(env("SEO_SITE_DELAY_MS", env("GSC_SITE_DELAY_MS", "800"))) || 800,
  };

  const onlyMonth = parseReportMonthArg();
  const sa = loadServiceAccount();
  const auth = new google.auth.GoogleAuth({
    credentials: sa,
    scopes: [
      "https://www.googleapis.com/auth/webmasters.readonly",
      "https://www.googleapis.com/auth/analytics.readonly",
    ],
  });
  const searchconsole = google.searchconsole({ version: "v1", auth });
  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });

  const list = await api(base, secret, "/api/seo-worker/sites");
  let sites = Array.isArray(list.sites) ? list.sites : [];
  const sitesFilter = parseSitesFilter();
  if (sitesFilter?.length) {
    const want = new Set(sitesFilter);
    sites = sites.filter((s) => want.has(s.id) || want.has(s.domain));
    console.log(`[seo-worker] filter sites=${sites.length} ids/domains=${sitesFilter.join(",")}`);
  }
  const gscOnly = parseGscOnly();
  if (gscOnly) console.log("[seo-worker] gsc-only mode");
  console.log(`[seo-worker] sites=${sites.length} base=${base}`);

  if (onlyMonth) {
    const m = onlyMonth.match(/^(\d{4})-(\d{1,2})$/);
    if (!m) throw new Error(`无效 REPORT_MONTH: ${onlyMonth}（应为 YYYY-MM）`);
    const year = Number(m[1]);
    const month = Number(m[2]);
    console.log(`[seo-worker] month-only mode ${year}-${String(month).padStart(2, "0")}`);
    for (const site of sites) {
      await syncSiteMonth(
        base,
        secret,
        searchconsole,
        analyticsdata,
        site,
        defaults,
        year,
        month,
      );
      if (defaults.delayMs > 0) await sleep(defaults.delayMs);
    }
    console.log("[seo-worker] month-only done");
    return;
  }

  let gscOk = 0;
  let gscFail = 0;
  let gaOk = 0;
  let gaFail = 0;

  for (const site of sites) {
    const label = `${site.domain} (${site.id})`;
    const doGsc = Boolean(site.gsc?.enabled);
    const doGa = !gscOnly && Boolean(site.ga?.enabled);

    if (doGsc) {
      try {
        console.log(`[seo-worker] GSC ${label} → ${site.gsc.propertyUrl}`);
        const payload = await syncGscSite(searchconsole, site, defaults);
        await api(base, secret, "/api/gsc-worker/ingest", {
          method: "POST",
          body: payload,
        });
        console.log(
          `[seo-worker] GSC ok ${label} stored=${payload.keywords.length}/${payload.pages.length} total=${payload.summary?.keywordCount ?? "?"}/${payload.summary?.pageCount ?? "?"}`,
        );
        gscOk++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[seo-worker] GSC fail ${label}:`, msg);
        try {
          await api(base, secret, "/api/gsc-worker/ingest", {
            method: "POST",
            body: {
              siteId: site.id,
              propertyUrl: site.gsc?.propertyUrl || site.propertyUrl,
              periodDays: site.gsc?.periodDays || defaults.gscPeriodDays,
              syncedAt: new Date().toISOString(),
              error: msg,
            },
          });
        } catch (e2) {
          console.error(`[seo-worker] GSC ingest error report failed:`, e2);
        }
        gscFail++;
      }
    }

    if (doGa) {
      try {
        console.log(`[seo-worker] GA  ${label} → properties/${site.ga.propertyId}`);
        const payload = await syncGaSite(analyticsdata, site, defaults);
        await api(base, secret, "/api/ga-worker/ingest", {
          method: "POST",
          body: payload,
        });
        console.log(
          `[seo-worker] GA  ok ${label} sessions=${payload.summary.sessions} landing=${payload.landingPages.length}`,
        );
        gaOk++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[seo-worker] GA  fail ${label}:`, msg);
        try {
          await api(base, secret, "/api/ga-worker/ingest", {
            method: "POST",
            body: {
              siteId: site.id,
              propertyId: site.ga?.propertyId,
              periodDays: site.ga?.periodDays || defaults.gaPeriodDays,
              syncedAt: new Date().toISOString(),
              error: msg,
            },
          });
        } catch (e2) {
          console.error(`[seo-worker] GA ingest error report failed:`, e2);
        }
        gaFail++;
      }
    }

    if (!doGsc && !doGa) {
      console.log(`[seo-worker] skip ${label}（未开启 GSC/GA）`);
    }

    if (defaults.delayMs > 0) await sleep(defaults.delayMs);
  }

  console.log(
    `[seo-worker] rolling done gsc ok=${gscOk} fail=${gscFail} | ga ok=${gaOk} fail=${gaFail}`,
  );

  if (!gscOnly) {
    const monthList = monthsToSyncFromNow();
    console.log(
      `[seo-worker] calendar months: ${monthList.map((x) => `${x.year}-${String(x.month).padStart(2, "0")}`).join(", ")}`,
    );
    for (const ym of monthList) {
      for (const site of sites) {
        await syncSiteMonth(
          base,
          secret,
          searchconsole,
          analyticsdata,
          site,
          defaults,
          ym.year,
          ym.month,
        );
        if (defaults.delayMs > 0) await sleep(defaults.delayMs);
      }
    }
  }

  const tried = gscOk + gscFail + gaOk + gaFail;
  if (tried > 0 && gscOk + gaOk === 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("[seo-worker] fatal", e);
  process.exit(1);
});
