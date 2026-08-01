import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CLIENT_TIERS } from "@/lib/labels";
import { parseDateInput } from "@/lib/labels";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tier = req.nextUrl.searchParams.get("tier") || "";
  const q = (req.nextUrl.searchParams.get("q") || "").trim();

  const clients = await prisma.client.findMany({
    where: {
      ...(tier ? { tier } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { contactName: { contains: q } },
              { phone: { contains: q } },
              { address: { contains: q } },
              { notes: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { sites: true } } },
  });
  return NextResponse.json({ clients });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "客户名称必填" }, { status: 400 });

  const tier = String(body.tier || "正常");
  if (!CLIENT_TIERS.includes(tier as (typeof CLIENT_TIERS)[number])) {
    return NextResponse.json({ error: "无效分层" }, { status: 400 });
  }

  const client = await prisma.client.create({
    data: {
      name,
      tier,
      contactName: String(body.contactName || ""),
      phone: String(body.phone || ""),
      address: String(body.address || ""),
      notes: String(body.notes || ""),
      lastVisitAt: parseDateInput(body.lastVisitAt),
      // serviceStart/End 由网站自动汇总，新建时为空
    },
  });
  return NextResponse.json({ client });
}
