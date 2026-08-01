import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CLIENT_TIERS, parseDateInput } from "@/lib/labels";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json();

  if (body.tier !== undefined && !CLIENT_TIERS.includes(body.tier)) {
    return NextResponse.json({ error: "无效分层" }, { status: 400 });
  }

  const client = await prisma.client.update({
    where: { id },
    data: {
      name: body.name !== undefined ? String(body.name).trim() : undefined,
      tier: body.tier !== undefined ? String(body.tier) : undefined,
      contactName: body.contactName !== undefined ? String(body.contactName) : undefined,
      phone: body.phone !== undefined ? String(body.phone) : undefined,
      address: body.address !== undefined ? String(body.address) : undefined,
      notes: body.notes !== undefined ? String(body.notes) : undefined,
      lastVisitAt:
        body.lastVisitAt !== undefined ? parseDateInput(body.lastVisitAt) : undefined,
    },
  });
  return NextResponse.json({ client });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  await prisma.client.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
