import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { generateReportAiDraft } from "@/lib/report-ai";
import { serializeHighlightsEdit } from "@/lib/report-editorial";
import { getReport, parseReportPayload } from "@/lib/site-report";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const year = Number(body.year);
  const month = Number(body.month);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "无效年份" }, { status: 400 });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "无效月份" }, { status: 400 });
  }

  const report = await getReport(id, year, month);
  if (!report) {
    return NextResponse.json({ error: "请先生成报告数据快照" }, { status: 404 });
  }
  const payload = parseReportPayload(report.payload);
  if (!payload) {
    return NextResponse.json({ error: "报告数据无法解析" }, { status: 500 });
  }

  try {
    const draft = await generateReportAiDraft(payload);
    const apply = body.apply === true;
    if (apply) {
      const updated = await prisma.siteMonthlyReport.update({
        where: { id: report.id },
        data: {
          highlightsEdit: serializeHighlightsEdit(draft.highlights),
          nextPlan: draft.nextPlan,
        },
      });
      return NextResponse.json({
        ok: true,
        applied: true,
        highlights: draft.highlights,
        highlightsEdit: updated.highlightsEdit,
        nextPlan: updated.nextPlan,
      });
    }
    return NextResponse.json({
      ok: true,
      applied: false,
      highlights: draft.highlights,
      highlightsEdit: serializeHighlightsEdit(draft.highlights),
      nextPlan: draft.nextPlan,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI 生成失败" },
      { status: 500 },
    );
  }
}
