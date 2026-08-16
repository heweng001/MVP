import { NextRequest, NextResponse } from "next/server";
import { processReviewDailyFlush } from "@/lib/pipeline";
import { autoSnapshotPreviousMonth } from "@/lib/site-report";

export const runtime = "nodejs";

/**
 * 阿里云 cron 入口（按 task 拆分，避免混在高频任务里）：
 * - task=review（默认）：迁移存量「待审核」——DeepSeek 重判后分流（新询盘已无审核队列）
 * - task=monthly-report：每月 1 号自动生成上月月报（无则创建）
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") || req.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const task = (req.nextUrl.searchParams.get("task") || "review").trim();

  if (task === "review") {
    const review = await processReviewDailyFlush();
    return NextResponse.json({ ok: true, task, review });
  }

  if (task === "monthly-report") {
    const monthlyReport = await autoSnapshotPreviousMonth();
    return NextResponse.json({ ok: true, task, monthlyReport });
  }

  return NextResponse.json(
    { ok: false, error: "Unknown task. Use task=review|monthly-report" },
    { status: 400 },
  );
}

export async function GET(req: NextRequest) {
  return POST(req);
}
