import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") || "").trim();

  const items = await prisma.clientPromo.findMany({
    where: q
      ? {
          OR: [
            { id: { contains: q } },
            { site: { domain: { contains: q } } },
            { site: { client: { name: { contains: q } } } },
          ],
        }
      : undefined,
    orderBy: { updatedAt: "desc" },
    include: {
      site: {
        select: {
          id: true,
          domain: true,
          client: { select: { id: true, name: true } },
        },
      },
    },
  });
  return NextResponse.json({ items });
}

/** 随意创建空信息核对；可选关联网站（一站一条） */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const siteIdRaw = body.siteId !== undefined ? String(body.siteId || "").trim() : "";
  const siteId = siteIdRaw || null;

  if (siteId) {
    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (!site) return NextResponse.json({ error: "网站不存在" }, { status: 404 });
    const existing = await prisma.clientPromo.findUnique({ where: { siteId } });
    if (existing) {
      return NextResponse.json(
        { error: "该网站已有信息核对，一站仅允许一条", item: existing },
        { status: 409 },
      );
    }
  }

  const item = await prisma.clientPromo.create({
    data: { siteId },
    include: {
      site: {
        select: {
          id: true,
          domain: true,
          client: { select: { id: true, name: true } },
        },
      },
    },
  });
  return NextResponse.json({ item, created: true });
}
