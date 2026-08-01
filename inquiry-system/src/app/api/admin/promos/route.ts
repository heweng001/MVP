import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** 列表：已有主推信息的客户 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.clientPromo.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      client: { select: { id: true, name: true, tier: true } },
    },
  });
  return NextResponse.json({ items });
}

/** 为客户创建空主推信息（一对一） */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const clientId = String(body.clientId || "").trim();
  if (!clientId) {
    return NextResponse.json({ error: "请选择客户" }, { status: 400 });
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) {
    return NextResponse.json({ error: "客户不存在" }, { status: 404 });
  }

  const existing = await prisma.clientPromo.findUnique({ where: { clientId } });
  if (existing) {
    return NextResponse.json({ item: existing, created: false });
  }

  const item = await prisma.clientPromo.create({
    data: { clientId },
  });
  return NextResponse.json({ item, created: true });
}
