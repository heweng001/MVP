import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/labels";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: { _count: { select: { sites: true } } },
  });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ client });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json();

  const client = await prisma.client.update({
    where: { id },
    data: {
      name: body.name !== undefined ? String(body.name).trim() : undefined,
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
