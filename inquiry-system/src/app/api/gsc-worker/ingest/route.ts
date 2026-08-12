import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertGscWorkerAuth } from "@/lib/gsc-worker-auth";

export const runtime = "nodejs";

type KwRow = {
  keyword?: string;
  position?: number;
  clicks?: number;
  impressions?: number;
  ctr?: number;
};

type PageRow = {
  pageUrl?: string;
  page?: string;
  position?: number;
  clicks?: number;
  impressions?: number;
  ctr?: number;
};

/**
 * 新加坡 worker 回写单站 GSC 同步结果。
 * Header: x-gsc-worker-secret
 */
export async function POST(req: NextRequest) {
  const denied = assertGscWorkerAuth(req);
  if (denied) {
    return NextResponse.json({ ok: false, error: denied }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const siteId = String(body.siteId || "").trim();
  if (!siteId) {
    return NextResponse.json({ ok: false, error: "siteId required" }, { status: 400 });
  }

  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) {
    return NextResponse.json({ ok: false, error: "site not found" }, { status: 404 });
  }

  const errorMsg = body.error != null ? String(body.error).slice(0, 2000) : "";
  const periodDays = Math.min(90, Math.max(1, Number(body.periodDays) || site.gscPeriodDays || 28));
  const syncedAt = body.syncedAt ? new Date(String(body.syncedAt)) : new Date();
  const syncTime = Number.isNaN(syncedAt.getTime()) ? new Date() : syncedAt;

  if (errorMsg) {
    await prisma.site.update({
      where: { id: siteId },
      data: {
        gscLastSyncAt: syncTime,
        gscLastError: errorMsg,
        gscPeriodDays: periodDays,
      },
    });
    return NextResponse.json({ ok: true, siteId, saved: "error" });
  }

  const keywords = Array.isArray(body.keywords) ? (body.keywords as KwRow[]) : [];
  const pages = Array.isArray(body.pages) ? (body.pages as PageRow[]) : [];

  const kwNorm = keywords
    .map((r) => ({
      keyword: String(r.keyword || "").trim().slice(0, 500),
      position: Number(r.position) || 0,
      clicks: Math.max(0, Math.round(Number(r.clicks) || 0)),
      impressions: Math.max(0, Math.round(Number(r.impressions) || 0)),
      ctr: Number(r.ctr) || 0,
    }))
    .filter((r) => r.keyword);

  const pageNorm = pages
    .map((r) => ({
      pageUrl: String(r.pageUrl || r.page || "").trim().slice(0, 2000),
      position: Number(r.position) || 0,
      clicks: Math.max(0, Math.round(Number(r.clicks) || 0)),
      impressions: Math.max(0, Math.round(Number(r.impressions) || 0)),
      ctr: Number(r.ctr) || 0,
    }))
    .filter((r) => r.pageUrl);

  const summary = body.summary && typeof body.summary === "object" ? body.summary : {};
  const avgFromSummary = Number((summary as { avgPosition?: number }).avgPosition);
  const avgPosition =
    Number.isFinite(avgFromSummary) && avgFromSummary > 0
      ? avgFromSummary
      : kwNorm.length
        ? kwNorm.reduce((s, r) => s + r.position, 0) / kwNorm.length
        : null;

  // 站点列表 KPI：优先用 worker 全量 summary（有展示词/页），勿用详情 Top 截断条数
  const kwCountRaw = Number((summary as { keywordCount?: number }).keywordCount);
  const pageCountRaw = Number((summary as { pageCount?: number }).pageCount);
  const gscKeywordCount =
    Number.isFinite(kwCountRaw) && kwCountRaw >= 0 ? Math.round(kwCountRaw) : kwNorm.length;
  const gscPageCount =
    Number.isFinite(pageCountRaw) && pageCountRaw >= 0
      ? Math.round(pageCountRaw)
      : pageNorm.length;

  await prisma.$transaction(async (tx) => {
    await tx.siteGscKeyword.deleteMany({ where: { siteId } });
    await tx.siteGscPage.deleteMany({ where: { siteId } });

    if (kwNorm.length) {
      await tx.siteGscKeyword.createMany({
        data: kwNorm.map((r) => ({
          siteId,
          keyword: r.keyword,
          position: r.position,
          clicks: r.clicks,
          impressions: r.impressions,
          ctr: r.ctr,
          periodDays,
          syncedAt: syncTime,
        })),
      });
    }

    if (pageNorm.length) {
      await tx.siteGscPage.createMany({
        data: pageNorm.map((r) => ({
          siteId,
          pageUrl: r.pageUrl,
          position: r.position,
          clicks: r.clicks,
          impressions: r.impressions,
          ctr: r.ctr,
          periodDays,
          syncedAt: syncTime,
        })),
      });
    }

    await tx.site.update({
      where: { id: siteId },
      data: {
        gscLastSyncAt: syncTime,
        gscLastError: "",
        gscPeriodDays: periodDays,
        gscKeywordCount,
        gscPageCount,
        gscAvgPosition: avgPosition,
        gscPropertyUrl:
          body.propertyUrl !== undefined
            ? String(body.propertyUrl || "").trim()
            : undefined,
      },
    });
  });

  return NextResponse.json({
    ok: true,
    siteId,
    keywords: kwNorm.length,
    pages: pageNorm.length,
    keywordCount: gscKeywordCount,
    pageCount: gscPageCount,
  });
}
