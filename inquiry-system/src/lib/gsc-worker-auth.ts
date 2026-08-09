import { NextRequest } from "next/server";

/** 新加坡 worker 调用阿里云 API 时使用的密钥（优先 GSC_WORKER_SECRET，否则回退 CRON_SECRET） */
export function gscWorkerSecret() {
  return (
    process.env.GSC_WORKER_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    ""
  );
}

export function assertGscWorkerAuth(req: NextRequest): string | null {
  const expected = gscWorkerSecret();
  if (!expected) return "服务器未配置 GSC_WORKER_SECRET / CRON_SECRET";
  const got =
    req.headers.get("x-gsc-worker-secret") ||
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
