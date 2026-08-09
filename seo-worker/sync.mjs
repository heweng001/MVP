/**
 * 新加坡 SEO Worker（GSC + GA4 合并）
 * 1) 从阿里云拉取待同步站点
 * 2) 先后同步 Search Console 与 Analytics
 * 3) 分别 POST 回阿里云入库
 *
 * 用法：
 *   set -a && . ./.env && set +a
 *   npm run sync
 */
import { google } from "googleapis";
import {
  api,
  env,
  loadServiceAccount,
  requireEnv,
  sleep,
} from "./lib/common.mjs";
import { syncGscSite } from "./lib/gsc.mjs";
import { syncGaSite } from "./lib/ga.mjs";

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
    topQueries: Number(env("GSC_TOP_QUERIES", "50")) || 50,
    topPages: Number(env("GSC_TOP_PAGES", "100")) || 100,
    topLanding: Number(env("GA_TOP_LANDING", "100")) || 100,
    topChannels: Number(env("GA_TOP_CHANNELS", "20")) || 20,
    delayMs: Number(env("SEO_SITE_DELAY_MS", env("GSC_SITE_DELAY_MS", "800"))) || 800,
  };

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
  const sites = Array.isArray(list.sites) ? list.sites : [];
  console.log(`[seo-worker] sites=${sites.length} base=${base}`);

  let gscOk = 0;
  let gscFail = 0;
  let gaOk = 0;
  let gaFail = 0;

  for (const site of sites) {
    const label = `${site.domain} (${site.id})`;
    const doGsc = Boolean(site.gsc?.enabled);
    const doGa = Boolean(site.ga?.enabled);

    if (doGsc) {
      try {
        console.log(`[seo-worker] GSC ${label} → ${site.gsc.propertyUrl}`);
        const payload = await syncGscSite(searchconsole, site, defaults);
        await api(base, secret, "/api/gsc-worker/ingest", {
          method: "POST",
          body: payload,
        });
        console.log(
          `[seo-worker] GSC ok ${label} keywords=${payload.keywords.length} pages=${payload.pages.length}`,
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
    `[seo-worker] done gsc ok=${gscOk} fail=${gscFail} | ga ok=${gaOk} fail=${gaFail}`,
  );
  const tried = gscOk + gscFail + gaOk + gaFail;
  if (tried > 0 && gscOk + gaOk === 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("[seo-worker] fatal", e);
  process.exit(1);
});
