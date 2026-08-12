import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertSeoWorkerAuth, guessGscPropertyUrl } from "@/lib/seo-worker-auth";
import { flattenKeywordList } from "@/lib/promo";

export const runtime = "nodejs";

/**
 * 新加坡 seo-worker 拉取待同步站点（GSC 和/或 GA4）。
 * Header: x-seo-worker-secret（或 x-gsc-worker-secret / CRON）
 */
export async function GET(req: NextRequest) {
  const denied = assertSeoWorkerAuth(req);
  if (denied) {
    return NextResponse.json({ ok: false, error: denied }, { status: 401 });
  }

  const onlyEnabled = req.nextUrl.searchParams.get("all") !== "1";
  const sites = await prisma.site.findMany({
    where: {
      OR: [{ gscSyncEnabled: true }, { gaSyncEnabled: true }],
      ...(onlyEnabled ? { enabled: true } : {}),
    },
    select: {
      id: true,
      domain: true,
      gscPropertyUrl: true,
      gscPeriodDays: true,
      gscSyncEnabled: true,
      gscLastSyncAt: true,
      gaPropertyId: true,
      gaPeriodDays: true,
      gaSyncEnabled: true,
      gaLastSyncAt: true,
      promo: { select: { keywords: true } },
    },
    orderBy: { domain: "asc" },
  });

  return NextResponse.json({
    ok: true,
    sites: sites.map((s) => {
      const propertyUrl = (s.gscPropertyUrl || "").trim() || guessGscPropertyUrl(s.domain);
      const keywords = flattenKeywordList(s.promo?.keywords || "");
      return {
        id: s.id,
        domain: s.domain,
        gsc: {
          enabled: s.gscSyncEnabled,
          propertyUrl,
          periodDays: s.gscPeriodDays || 28,
          lastSyncAt: s.gscLastSyncAt?.toISOString() ?? null,
          targetKeywords: keywords,
        },
        ga: {
          enabled: s.gaSyncEnabled,
          propertyId: String(s.gaPropertyId || "").trim(),
          periodDays: s.gaPeriodDays || 28,
          lastSyncAt: s.gaLastSyncAt?.toISOString() ?? null,
        },
        // 兼容旧 gsc-worker 字段
        propertyUrl,
        periodDays: s.gscPeriodDays || 28,
        lastSyncAt: s.gscLastSyncAt?.toISOString() ?? null,
        targetKeywords: keywords,
      };
    }),
  });
}
