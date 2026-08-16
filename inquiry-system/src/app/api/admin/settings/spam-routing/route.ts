import { NextResponse } from "next/server";

/** 垃圾分阈值设置已下线；分流由 DeepSeek 判定 */
export async function GET() {
  return NextResponse.json(
    { ok: false, error: "垃圾分阈值设置已下线，分流由 DeepSeek 判定" },
    { status: 410 },
  );
}

export async function POST() {
  return NextResponse.json(
    { ok: false, error: "垃圾分阈值设置已下线，分流由 DeepSeek 判定" },
    { status: 410 },
  );
}
