import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertSeoWorkerAuth } from "@/lib/seo-worker-auth";

export const runtime = "nodejs";

/**
 * 新加坡 worker 回写「自然月」GSC/GA（与询盘月报同口径）。
 * 可分两次 POST（先 gsc 后 ga），字段合并进同一快照。
 */
export async function POST(req: NextRequest) {
  const denied = assertSeoWorkerAuth(req);
  if (denied) {
    return NextResponse.json({ ok: false, error: denied }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const siteId = String(body.siteId || "").trim();
  const year = Number(body.year);
  const month = Number(body.month);
  if (!siteId) {
    return NextResponse.json({ ok: false, error: "siteId required" }, { status: 400 });
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ ok: false, error: "invalid year" }, { status: 400 });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ ok: false, error: "invalid month" }, { status: 400 });
  }

  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true } });
  if (!site) {
    return NextResponse.json({ ok: false, error: "site not found" }, { status: 404 });
  }

  const startDate = String(body.startDate || "").slice(0, 10);
  const endDate = String(body.endDate || "").slice(0, 10);
  const syncedAt = body.syncedAt ? new Date(String(body.syncedAt)) : new Date();
  const syncTime = Number.isNaN(syncedAt.getTime()) ? new Date() : syncedAt;

  const existing = await prisma.siteMonthSeoSnapshot.findUnique({
    where: { siteId_year_month: { siteId, year, month } },
  });

  const data: {
    startDate?: string;
    endDate?: string;
    gscJson?: string;
    gaJson?: string;
    gscError?: string;
    gaError?: string;
    syncedAt: Date;
  } = { syncedAt: syncTime };

  if (startDate) data.startDate = startDate;
  if (endDate) data.endDate = endDate;

  if (body.gsc != null) {
    if (body.gsc.error) {
      data.gscError = String(body.gsc.error).slice(0, 2000);
    } else {
      data.gscJson = JSON.stringify(body.gsc);
      data.gscError = "";
    }
  }
  if (body.ga != null) {
    if (body.ga.error) {
      data.gaError = String(body.ga.error).slice(0, 2000);
    } else {
      data.gaJson = JSON.stringify(body.ga);
      data.gaError = "";
    }
  }

  const row = existing
    ? await prisma.siteMonthSeoSnapshot.update({
        where: { id: existing.id },
        data: {
          ...data,
          startDate: data.startDate ?? existing.startDate,
          endDate: data.endDate ?? existing.endDate,
        },
      })
    : await prisma.siteMonthSeoSnapshot.create({
        data: {
          siteId,
          year,
          month,
          startDate: data.startDate || "",
          endDate: data.endDate || "",
          gscJson: data.gscJson || "",
          gaJson: data.gaJson || "",
          gscError: data.gscError || "",
          gaError: data.gaError || "",
          syncedAt: syncTime,
        },
      });

  return NextResponse.json({
    ok: true,
    id: row.id,
    siteId,
    year,
    month,
    hasGsc: Boolean(row.gscJson),
    hasGa: Boolean(row.gaJson),
  });
}
