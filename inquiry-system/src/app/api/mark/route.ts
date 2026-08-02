import { NextRequest, NextResponse } from "next/server";
import { applyMark, saveMarkReason, type MarkAction } from "@/lib/mark";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const token = String(body.token || "");
  const actionRaw = String(body.action || "");
  const reason = body.reason !== undefined ? String(body.reason) : undefined;

  if (!token) {
    return NextResponse.json({ ok: false, error: "参数错误" }, { status: 400 });
  }

  // 仅保存反馈原因
  if (actionRaw === "reason" || (!actionRaw && reason !== undefined)) {
    const result = await saveMarkReason(token, reason ?? "");
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      status: result.inquiry.status,
      markReason: result.inquiry.markReason,
    });
  }

  const action = actionRaw as MarkAction;
  if (action !== "valid" && action !== "invalid") {
    return NextResponse.json({ ok: false, error: "参数错误" }, { status: 400 });
  }

  const result = await applyMark(token, action, reason);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    status: result.inquiry.status,
    markReason: result.inquiry.markReason,
  });
}
