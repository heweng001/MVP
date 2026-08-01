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
      data: { status: InquiryStatus.AUTO_SPAM, notes: inquiry.notes + "\n审核驳回" },
    });
    return NextResponse.json({ ok: true, inquiry: updated });
  }

  if (action === "resend") {
    const updated = await sendInquiryById(id);
    return NextResponse.json({ ok: true, inquiry: updated });
  }

  if (action === "set_status") {
    const status = String(body.status || "");
    const allowed = Object.values(InquiryStatus);
    if (!allowed.includes(status as (typeof allowed)[number])) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
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
