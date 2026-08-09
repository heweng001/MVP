import { NextRequest } from "next/server";

/**
 * 新加坡 seo-worker（GSC + GA）调用阿里云 API 的密钥。
 * 优先 SEO_WORKER_SECRET，其次 GSC/GA 专用，最后 CRON_SECRET。
 */
export function seoWorkerSecret() {
  return (
    process.env.SEO_WORKER_SECRET?.trim() ||
    process.env.GSC_WORKER_SECRET?.trim() ||
    process.env.GA_WORKER_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    ""
  );
}

export function assertSeoWorkerAuth(req: NextRequest): string | null {
  const expected = seoWorkerSecret();
  if (!expected) {
    return "服务器未配置 SEO_WORKER_SECRET / GSC_WORKER_SECRET / CRON_SECRET";
  }
  const got =
    req.headers.get("x-seo-worker-secret") ||
    req.headers.get("x-gsc-worker-secret") ||
    req.headers.get("x-ga-worker-secret") ||
    req.headers.get("x-cron-secret") ||
    req.nextUrl.searchParams.get("secret") ||
    "";
  if (!got || got !== expected) return "Unauthorized";
  return null;
}

/** 从域名猜测 GSC 域名属性 */
export function guessGscPropertyUrl(domain: string) {
  const d = String(domain || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./i, "")
    .toLowerCase();
  if (!d) return "";
  return `sc-domain:${d}`;
}
