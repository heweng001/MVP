import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InquiryStatus } from "@/lib/constants";
import { sendInquiryById } from "@/lib/pipeline";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json();
  const action = String(body.action || "");

  const inquiry = await prisma.inquiry.findUnique({ where: { id } });
  if (!inquiry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "approve_review") {
    if (inquiry.status !== InquiryStatus.REVIEW) {
      return NextResponse.json({ error: "Not in review" }, { status: 400 });
    }
    const updated = await sendInquiryById(id);
    return NextResponse.json({ ok: true, inquiry: updated });
  }

  if (action === "reject_review") {
    if (inquiry.status !== InquiryStatus.REVIEW) {
      return NextResponse.json({ error: "Not in review" }, { status: 400 });
    }
    const updated = await prisma.inquiry.update({
      where: { id },
      data: { status: InquiryStatus.REVIEW_SPAM, notes: inquiry.notes + "\n审核驳回" },
    });
    return NextResponse.json({ ok: true, inquiry: updated });
  }

  if (action === "resend") {
    const updated = await sendInquiryById(id);
    return NextResponse.json({ ok: true, inquiry: updated });
  }

  if (action === "set_status") {
    let status = String(body.status || "");
    // 管理员手动标垃圾 → 审核垃圾（与系统自动垃圾区分）
    if (status === InquiryStatus.AUTO_SPAM) {
      status = InquiryStatus.REVIEW_SPAM;
    }
    const allowed = Object.values(InquiryStatus);
    if (!allowed.includes(status as (typeof allowed)[number])) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    // 已转发不可回撤为垃圾（避免把已发客户的询盘改回未发送垃圾）
    if (
      (status === InquiryStatus.REVIEW_SPAM || status === InquiryStatus.AUTO_SPAM) &&
      inquiry.sentAt
    ) {
      return NextResponse.json(
        { error: "已转发的询盘不可标为垃圾；如需否定请标为「无效」。" },
        { status: 400 },
      );
    }
    const updated = await prisma.inquiry.update({
      where: { id },
      data: {
        status,
        markedAt:
          status === InquiryStatus.VALID || status === InquiryStatus.INVALID
            ? new Date()
            : inquiry.markedAt,
      },
    });
    return NextResponse.json({ ok: true, inquiry: updated });
  }

  if (action === "note") {
    const updated = await prisma.inquiry.update({
      where: { id },
      data: { notes: String(body.notes || "") },
    });
    return NextResponse.json({ ok: true, inquiry: updated });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
