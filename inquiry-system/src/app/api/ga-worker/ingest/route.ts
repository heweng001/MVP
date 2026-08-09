import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertSeoWorkerAuth } from "@/lib/seo-worker-auth";

export const runtime = "nodejs";

type LandingRow = {
  pagePath?: string;
  page?: string;
  sessions?: number;
  engagedSessions?: number;
  conversions?: number;
  engagementRate?: number;
};

type ChannelRow = {
  channelGroup?: string;
  channel?: string;
  sessions?: number;
  engagedSessions?: number;
  conversions?: number;
  engagementRate?: number;
};

/**
 * 新加坡 seo-worker 回写单站 GA4 同步结果。
 * Header: x-seo-worker-secret
 */
export async function POST(req: NextRequest) {
  const denied = assertSeoWorkerAuth(req);
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
  const periodDays = Math.min(90, Math.max(1, Number(body.periodDays) || site.gaPeriodDays || 28));
  const syncedAt = body.syncedAt ? new Date(String(body.syncedAt)) : new Date();
  const syncTime = Number.isNaN(syncedAt.getTime()) ? new Date() : syncedAt;

  if (errorMsg) {
    await prisma.site.update({
      where: { id: siteId },
      data: {
        gaLastSyncAt: syncTime,
        gaLastError: errorMsg,
        gaPeriodDays: periodDays,
      },
    });
    return NextResponse.json({ ok: true, siteId, saved: "error" });
  }

  const landingPages = Array.isArray(body.landingPages)
    ? (body.landingPages as LandingRow[])
    : [];
  const channels = Array.isArray(body.channels) ? (body.channels as ChannelRow[]) : [];
  const summary = body.summary && typeof body.summary === "object" ? body.summary : {};

  const landNorm = landingPages
    .map((r) => ({
      pagePath: String(r.pagePath || r.page || "").trim().slice(0, 2000),
      sessions: Math.max(0, Math.round(Number(r.sessions) || 0)),
      engagedSessions: Math.max(0, Math.round(Number(r.engagedSessions) || 0)),
      conversions: Math.max(0, Math.round(Number(r.conversions) || 0)),
      engagementRate: Number(r.engagementRate) || 0,
    }))
    .filter((r) => r.pagePath);

  const chNorm = channels
    .map((r) => ({
      channelGroup: String(r.channelGroup || r.channel || "").trim().slice(0, 200),
      sessions: Math.max(0, Math.round(Number(r.sessions) || 0)),
      engagedSessions: Math.max(0, Math.round(Number(r.engagedSessions) || 0)),
      conversions: Math.max(0, Math.round(Number(r.conversions) || 0)),
      engagementRate: Number(r.engagementRate) || 0,
    }))
    .filter((r) => r.channelGroup);

  const sessions = Math.max(
    0,
    Math.round(Number((summary as { sessions?: number }).sessions) || 0),
  );
  const users = Math.max(
    0,
    Math.round(Number((summary as { users?: number }).users) || 0),
  );
  const conversions = Math.max(
    0,
    Math.round(Number((summary as { conversions?: number }).conversions) || 0),
  );
  const engRaw = Number((summary as { engagementRate?: number }).engagementRate);
  const engagementRate = Number.isFinite(engRaw) ? engRaw : null;

  await prisma.$transaction(async (tx) => {
    await tx.siteGaLandingPage.deleteMany({ where: { siteId } });
    await tx.siteGaChannel.deleteMany({ where: { siteId } });

    if (landNorm.length) {
      await tx.siteGaLandingPage.createMany({
        data: landNorm.map((r) => ({
          siteId,
          pagePath: r.pagePath,
          sessions: r.sessions,
          engagedSessions: r.engagedSessions,
          conversions: r.conversions,
          engagementRate: r.engagementRate,
          periodDays,
          syncedAt: syncTime,
        })),
      });
    }

    if (chNorm.length) {
      await tx.siteGaChannel.createMany({
        data: chNorm.map((r) => ({
          siteId,
          channelGroup: r.channelGroup,
          sessions: r.sessions,
          engagedSessions: r.engagedSessions,
          conversions: r.conversions,
          engagementRate: r.engagementRate,
          periodDays,
          syncedAt: syncTime,
        })),
      });
    }

    await tx.site.update({
      where: { id: siteId },
      data: {
        gaLastSyncAt: syncTime,
        gaLastError: "",
        gaPeriodDays: periodDays,
        gaSessions: sessions,
        gaUsers: users,
        gaConversions: conversions,
        gaEngagementRate: engagementRate,
        gaPropertyId:
          body.propertyId !== undefined
            ? String(body.propertyId || "").trim()
            : undefined,
      },
    });
  });

  return NextResponse.json({
    ok: true,
    siteId,
    landingPages: landNorm.length,
    channels: chNorm.length,
  });
}
