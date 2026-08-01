import { NextRequest, NextResponse } from "next/server";
import { processMarkTimeouts, processReviewTimeouts } from "@/lib/pipeline";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") || req.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const review = await processReviewTimeouts();
  const mark = await processMarkTimeouts();
  return NextResponse.json({ ok: true, review, mark });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
