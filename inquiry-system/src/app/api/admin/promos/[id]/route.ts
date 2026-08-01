import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  editLinkExpiresAt,
  newEditToken,
  promoEditUrl,
  recordPromoHistory,
} from "@/lib/promo";
import { sendPromoEditLink } from "@/lib/email";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const item = await prisma.clientPromo.findUnique({
    where: { id },
    include: {
      client: true,
      histories: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    item: {
      ...item,
      editUrl:
        item.editToken && item.editTokenExpires && item.editTokenExpires > new Date()
          ? promoEditUrl(item.editToken)
          : null,
    },
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const data: Record<string, string> = {};
  if (body.keywords !== undefined) data.keywords = String(body.keywords);
  if (body.productPoints !== undefined) data.productPoints = String(body.productPoints);
  if (body.adPoints !== undefined) data.adPoints = String(body.adPoints);
  if (body.keywordsNote !== undefined) data.keywordsNote = String(body.keywordsNote);
  if (body.productPointsNote !== undefined) {
    data.productPointsNote = String(body.productPointsNote);
  }
  if (body.adPointsNote !== undefined) data.adPointsNote = String(body.adPointsNote);

  const submitter = String(body.submitterName || "管理员").trim() || "管理员";

  try {
    const item = await prisma.clientPromo.update({
      where: { id },
      data,
      include: {
        client: true,
        histories: { orderBy: { createdAt: "desc" }, take: 100 },
      },
    });
    if (body.asSubmit !== false) {
      await recordPromoHistory(id, submitter);
    }
    const fresh = await prisma.clientPromo.findUnique({
      where: { id },
      include: {
        client: true,
        histories: { orderBy: { createdAt: "desc" }, take: 100 },
      },
    });
    return NextResponse.json({ item: fresh || item });
  } catch {
    return NextResponse.json({ error: "保存失败" }, { status: 404 });
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "issue_link");

  const promo = await prisma.clientPromo.findUnique({
    where: { id },
    include: { client: true },
  });
  if (!promo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "issue_link" || action === "send_link") {
    const token = newEditToken();
    const expires = editLinkExpiresAt();
    const updated = await prisma.clientPromo.update({
      where: { id },
      data: { editToken: token, editTokenExpires: expires },
      include: { client: true },
    });
    const editUrl = promoEditUrl(token);

    if (action === "send_link") {
      const to = String(body.to || "").trim();
      try {
        await sendPromoEditLink({
          to,
          clientName: updated.client.name,
          editUrl,
          expiresAt: expires,
        });
      } catch (e) {
        return NextResponse.json(
          {
            error: e instanceof Error ? e.message : String(e),
            editUrl,
            expiresAt: expires.toISOString(),
          },
          { status: 400 },
        );
      }
    }

    return NextResponse.json({
      ok: true,
      editUrl,
      expiresAt: expires.toISOString(),
      item: updated,
    });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

