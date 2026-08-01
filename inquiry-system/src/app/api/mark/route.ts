import { NextRequest, NextResponse } from "next/server";
import { applyMark, type MarkAction } from "@/lib/mark";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const token = String(body.token || "");
  const action = String(body.action || "") as MarkAction;
  if (!token || (action !== "valid" && action !== "invalid")) {
    return NextResponse.json({ ok: false, error: "参数错误" }, { status: 400 });
  }
  const result = await applyMark(token, action);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, status: result.inquiry.status });
}
