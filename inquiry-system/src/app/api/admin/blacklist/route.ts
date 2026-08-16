import { NextResponse } from "next/server";

/** 黑名单 API 已下线 */
export async function GET() {
  return NextResponse.json({ ok: false, error: "黑名单功能已下线" }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({ ok: false, error: "黑名单功能已下线" }, { status: 410 });
}

export async function DELETE() {
  return NextResponse.json({ ok: false, error: "黑名单功能已下线" }, { status: 410 });
}
