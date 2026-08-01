import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SITE_TYPES, parseDateInput } from "@/lib/labels";
import { syncClientServiceDates } from "@/lib/client-service-dates";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = req.nextUrl.searchParams.get("clientId") || "";
  const siteType = req.nextUrl.searchParams.get("siteType") || "";
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  const enabled = req.nextUrl.searchParams.get("enabled");

  const sites = await prisma.site.findMany({
    where: {
      ...(clientId ? { clientId } : {}),
      ...(siteType ? { siteType } : {}),
      ...(enabled === "1" ? { enabled: true } : enabled === "0" ? { enabled: false } : {}),
      ...(q
        ? {
            OR: [
              { domain: { contains: q } },
              { client: { name: { contains: q } } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      client: true,
      forms: true,
      _count: { select: { inquiries: true, forms: true } },
    },
  });
  return NextResponse.json({ sites });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();

  const clientId = String(body.clientId || "");
  const domain = String(body.domain || "").trim();
  if (!clientId || !domain) {
    return NextResponse.json({ error: "客户与域名必填" }, { status: 400 });
  }

  const siteType = String(body.siteType || "展示型");
  if (!SITE_TYPES.includes(siteType as (typeof SITE_TYPES)[number])) {
    return NextResponse.json({ error: "无效站点类型" }, { status: 400 });
  }

  const site = await prisma.site.create({
    data: {
      clientId,
      domain,
      siteType,
      startDate: parseDateInput(body.startDate),
      endDate: parseDateInput(body.endDate),
      siteKey: String(body.siteKey || randomBytes(16).toString("hex")),
      productKeywords: String(body.productKeywords || ""),
      spamExtraWords: String(body.spamExtraWords || ""),
      enabled: body.enabled !== false,
    },
  });

  await syncClientServiceDates(clientId);
  return NextResponse.json({ site });
}
