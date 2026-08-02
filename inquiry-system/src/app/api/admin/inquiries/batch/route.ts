import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InquiryStatus } from "@/lib/constants";
import { sendInquiryById } from "@/lib/pipeline";

const BATCH_ACTIONS = ["resend", "valid", "invalid", "auto_spam"] as const;
type BatchAction = (typeof BATCH_ACTIONS)[number];

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const action = String(body.action || "") as BatchAction;
  const ids = Array.isArray(body.ids)
    ? body.ids.map((x: unknown) => String(x)).filter(Boolean)
    : [];

  if (!BATCH_ACTIONS.includes(action)) {
    return NextResponse.json({ error: "无效操作" }, { status: 400 });
  }
  if (ids.length === 0) {
    return NextResponse.json({ error: "请先选择询盘" }, { status: 400 });
  }
  if (ids.length > 100) {
    return NextResponse.json({ error: "单次最多 100 条" }, { status: 400 });
  }

  let ok = 0;
  let fail = 0;
  const errors: string[] = [];

  for (const id of ids) {
    try {
      if (action === "resend") {
        await sendInquiryById(id);
        ok++;
        continue;
      }

      if (action === "auto_spam") {
        const row = await prisma.inquiry.findUnique({ where: { id } });
        if (!row) throw new Error("不存在");
        if (row.sentAt) throw new Error("已转发不可标垃圾");
        await prisma.inquiry.update({
          where: { id },
          data: { status: InquiryStatus.REVIEW_SPAM },
        });
        ok++;
        continue;
      }

      const status =
        action === "valid" ? InquiryStatus.VALID : InquiryStatus.INVALID;

      await prisma.inquiry.update({
        where: { id },
        data: {
          status,
          markedAt: new Date(),
        },
      });
      ok++;
    } catch (e) {
      fail++;
      errors.push(`${id}: ${e instanceof Error ? e.message : "失败"}`);
    }
  }

  return NextResponse.json({
    ok: true,
    success: ok,
    failed: fail,
    errors: errors.slice(0, 5),
  });
}
