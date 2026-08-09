import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertGscWorkerAuth, guessGscPropertyUrl } from "@/lib/gsc-worker-auth";
import { dedupeKeywords } from "@/lib/promo";

export const runtime = "nodejs";

/**
 * 新加坡 worker 拉取待同步站点清单。
 * Header: x-gsc-worker-secret
 */
export async function GET(req: NextRequest) {
  const denied = assertGscWorkerAuth(req);
  if (denied) {
    return NextResponse.json({ ok: false, error: denied }, { status: 401 });
  }

  const onlyEnabled = req.nextUrl.searchParams.get("all") !== "1";
  const sites = await prisma.site.findMany({
    where: onlyEnabled
      ? { enabled: true, gscSyncEnabled: true }
      : { gscSyncEnabled: true },
    select: {
      id: true,
      domain: true,
      gscPropertyUrl: true,
      gscPeriodDays: true,
      gscLastSyncAt: true,
      promo: { select: { keywords: true } },
    },
    orderBy: { domain: "asc" },
  });

  return NextResponse.json({
    ok: true,
    sites: sites.map((s) => {
      const propertyUrl = (s.gscPropertyUrl || "").trim() || guessGscPropertyUrl(s.domain);
      const keywords = dedupeKeywords(s.promo?.keywords || "").text
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);
      return {
        id: s.id,
        domain: s.domain,
        propertyUrl,
        periodDays: s.gscPeriodDays || 28,
        lastSyncAt: s.gscLastSyncAt?.toISOString() ?? null,
        targetKeywords: keywords,
      };
    }),
  });
}
