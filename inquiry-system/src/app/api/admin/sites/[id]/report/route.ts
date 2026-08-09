import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/constants";
import { getReport, parseReportPayload, upsertMonthlyReport } from "@/lib/site-report";

type Ctx = { params: Promise<{ id: string }> };

function parseYm(body: { year?: unknown; month?: unknown }) {
  const year = Number(body.year);
  const month = Number(body.month);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { error: "无效年份" as const };
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { error: "无效月份" as const };
  }
  return { year, month };
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const year = Number(req.nextUrl.searchParams.get("year"));
  const month = Number(req.nextUrl.searchParams.get("month"));
  const ym = parseYm({ year, month });
  if ("error" in ym) return NextResponse.json({ error: ym.error }, { status: 400 });

  const report = await getReport(id, ym.year, ym.month);
  if (!report) return NextResponse.json({ report: null });
  return NextResponse.json({
    report: {
      id: report.id,
      year: report.year,
      month: report.month,
      viewToken: report.viewToken,
      publicUrl: `${appUrl()}/r/${report.viewToken}`,
      workDone: report.workDone,
      nextPlan: report.nextPlan,
      generatedAt: report.generatedAt.toISOString(),
      payload: parseReportPayload(report.payload),
    },
  });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const site = await prisma.site.findUnique({ where: { id }, select: { id: true } });
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const ym = parseYm(body);
  if ("error" in ym) return NextResponse.json({ error: ym.error }, { status: 400 });

  try {
    const report = await upsertMonthlyReport(id, ym.year, ym.month, {
      rotateToken: Boolean(body.rotateToken),
      preserveNotes: true,
    });
    return NextResponse.json({
      ok: true,
      report: {
        id: report.id,
        year: report.year,
        month: report.month,
        viewToken: report.viewToken,
        publicUrl: `${appUrl()}/r/${report.viewToken}`,
        workDone: report.workDone,
        nextPlan: report.nextPlan,
        generatedAt: report.generatedAt.toISOString(),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "生成失败" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const ym = parseYm(body);
  if ("error" in ym) return NextResponse.json({ error: ym.error }, { status: 400 });

  const existing = await getReport(id, ym.year, ym.month);
  if (!existing) {
    return NextResponse.json({ error: "请先生成报告" }, { status: 404 });
  }

  const report = await prisma.siteMonthlyReport.update({
    where: { id: existing.id },
    data: {
      workDone: body.workDone !== undefined ? String(body.workDone) : undefined,
      nextPlan: body.nextPlan !== undefined ? String(body.nextPlan) : undefined,
    },
  });

  return NextResponse.json({
    ok: true,
    report: {
      id: report.id,
      workDone: report.workDone,
      nextPlan: report.nextPlan,
    },
  });
}
