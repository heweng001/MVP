import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await prisma.blacklistEntry.findMany({
    orderBy: { createdAt: "desc" },
    include: { site: true },
    take: 200,
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const type = String(body.type || "email");
  const value = String(body.value || "").trim().toLowerCase();
  if (!value) return NextResponse.json({ error: "value required" }, { status: 400 });
  const item = await prisma.blacklistEntry.create({
    data: {
      type,
      value,
      reason: String(body.reason || ""),
      siteId: body.siteId ? String(body.siteId) : null,
    },
  });
  return NextResponse.json({ item });
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.blacklistEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
