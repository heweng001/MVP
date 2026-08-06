import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InquiryStatus } from "@/lib/constants";
import {
  sendInquiryById,
  sendInquiryFollowupById,
} from "@/lib/pipeline";
import { parseEmails } from "@/lib/email";
import { maybeSendFollowupAfterAdminValid } from "@/lib/mark";

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
    try {
      const updated = await sendInquiryById(id);
      return NextResponse.json({ ok: true, inquiry: updated });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : String(e) },
        { status: 400 },
      );
    }
  }

  if (action === "reject_review") {
    if (inquiry.status !== InquiryStatus.REVIEW) {
      return NextResponse.json({ error: "Not in review" }, { status: 400 });
    }
    const updated = await prisma.inquiry.update({
      where: { id },
      data: {
        status: InquiryStatus.REVIEW_SPAM,
        notes: `${inquiry.notes || ""}\n审核标为垃圾`.trim(),
      },
    });
    return NextResponse.json({ ok: true, inquiry: updated });
  }

  if (action === "resend") {
    const phase = body.phase === "followup" ? "followup" : "mark";
    const toParsed = body.toEmails !== undefined ? parseEmails(String(body.toEmails), "") : null;
    const ccParsed =
      body.ccEmails !== undefined ? parseEmails("", String(body.ccEmails || "")) : null;
    const opts = {
      to: toParsed?.to,
      cc: ccParsed ? ccParsed.cc : undefined,
      force: phase === "followup",
    };
    try {
      const updated =
        phase === "followup"
          ? await sendInquiryFollowupById(id, opts)
          : await sendInquiryById(id, opts);
      return NextResponse.json({ ok: true, inquiry: updated });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : String(e) },
        { status: 400 },
      );
    }
  }

  if (action === "set_status") {
    let status = String(body.status || "");
    if (status === InquiryStatus.AUTO_SPAM) {
      status = InquiryStatus.REVIEW_SPAM;
    }
    const allowed = Object.values(InquiryStatus);
    if (!allowed.includes(status as (typeof allowed)[number])) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    if (
      (status === InquiryStatus.REVIEW_SPAM || status === InquiryStatus.AUTO_SPAM) &&
      inquiry.sentAt
    ) {
      return NextResponse.json(
        { error: "已转发的询盘不可标为垃圾；如需否定请标为「无效」。" },
        { status: 400 },
      );
    }
    if (
      status === InquiryStatus.INVALID &&
      inquiry.status === InquiryStatus.VALID
    ) {
      return NextResponse.json(
        { error: "已标记为有效的询盘不可再改为无效。" },
        { status: 400 },
      );
    }
    const wasValid = inquiry.status === InquiryStatus.VALID;
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
    if (status === InquiryStatus.VALID && !wasValid) {
      await maybeSendFollowupAfterAdminValid(id);
    }
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
