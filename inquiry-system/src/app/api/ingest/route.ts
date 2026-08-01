import { NextRequest, NextResponse } from "next/server";
import { ingestInquiry } from "@/lib/pipeline";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await ingestInquiry(body);
    return NextResponse.json({
      ok: true,
      duplicated: result.duplicated,
      id: result.inquiry.id,
      status: result.inquiry.status,
      spam_score: result.inquiry.spamScore,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ingest failed";
    // Fail-open guidance for WP plugin: still 200 with ok:false so WP can fallback send
    const status = msg.includes("site_key") || msg.includes("required") ? 400 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
