import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SITE_TYPES, parseDateInput } from "@/lib/labels";
import { syncClientServiceDates } from "@/lib/client-service-dates";
import { encryptSecret, hasWpRemoteCreds } from "@/lib/site-credentials";

type Ctx = { params: Promise<{ id: string }> };

function publicSite(site: {
  wpPasswordEnc: string;
  [key: string]: unknown;
}) {
  const { wpPasswordEnc: _enc, ...rest } = site;
  return {
    ...rest,
    hasWpCredentials: hasWpRemoteCreds(site),
    hasWpPassword: Boolean(String(site.wpPasswordEnc || "").trim()),
  };
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const site = await prisma.site.findUnique({
    where: { id },
    include: { client: true, forms: true },
  });
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    site: publicSite(site),
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json();

  if (body.siteType !== undefined && !SITE_TYPES.includes(body.siteType)) {
    return NextResponse.json({ error: "无效站点类型" }, { status: 400 });
  }

  const existing = await prisma.site.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const site = await prisma.site.update({
    where: { id },
    data: {
      clientId: body.clientId !== undefined ? String(body.clientId) : undefined,
      domain: body.domain !== undefined ? String(body.domain).trim() : undefined,
      siteType: body.siteType !== undefined ? String(body.siteType) : undefined,
      startDate: body.startDate !== undefined ? parseDateInput(body.startDate) : undefined,
      endDate: body.endDate !== undefined ? parseDateInput(body.endDate) : undefined,
      productKeywords:
        body.productKeywords !== undefined ? String(body.productKeywords) : undefined,
      spamExtraWords:
        body.spamExtraWords !== undefined ? String(body.spamExtraWords) : undefined,
      wpAdminUrl:
        body.wpAdminUrl !== undefined ? String(body.wpAdminUrl).trim() : undefined,
      wpUsername:
        body.wpUsername !== undefined ? String(body.wpUsername).trim() : undefined,
      wpPasswordEnc:
        body.wpPassword !== undefined && String(body.wpPassword) !== ""
          ? encryptSecret(String(body.wpPassword))
          : body.clearWpPassword === true
            ? ""
            : undefined,
      enabled: body.enabled !== undefined ? Boolean(body.enabled) : undefined,
    },
  });

  await syncClientServiceDates(site.clientId);
  if (existing.clientId !== site.clientId) {
    await syncClientServiceDates(existing.clientId);
  }

  return NextResponse.json({
    site: publicSite(site),
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const existing = await prisma.site.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.site.delete({ where: { id } });
  await syncClientServiceDates(existing.clientId);
  return NextResponse.json({ ok: true });
}
