import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getPromoByEditToken,
  isEditTokenValid,
  normalizeKeywordsInput,
  promoDisplayLabel,
  recordPromoHistory,
} from "@/lib/promo";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params;
  const promo = await getPromoByEditToken(token);
  if (!promo) {
    return NextResponse.json({ error: "链接无效" }, { status: 404 });
  }
  const valid = isEditTokenValid(promo.editTokenExpires);
  if (!valid) {
    return NextResponse.json({ error: "链接已过期" }, { status: 410 });
  }
  return NextResponse.json({
    displayLabel: promoDisplayLabel(promo),
    expiresAt: promo.editTokenExpires?.toISOString() ?? null,
    keywords: promo.keywords,
    productPoints: promo.productPoints,
    adPoints: promo.adPoints,
  });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params;
  const promo = await getPromoByEditToken(token);
  if (!promo) {
    return NextResponse.json({ error: "链接无效" }, { status: 404 });
  }
  if (!isEditTokenValid(promo.editTokenExpires)) {
    return NextResponse.json({ error: "链接已过期" }, { status: 410 });
  }

  const body = await req.json().catch(() => ({}));
  const submitterName = String(body.submitterName || "").trim();
  if (!submitterName) {
    return NextResponse.json({ error: "请填写姓名" }, { status: 400 });
  }

  if (body.onlyKeywords) {
    if (body.keywords === undefined && body.categories === undefined) {
      return NextResponse.json({ error: "缺少关键词内容" }, { status: 400 });
    }
    const deduped = normalizeKeywordsInput(body);
    await prisma.clientPromo.update({
      where: { id: promo.id },
      data: { keywords: deduped.text },
    });
    await recordPromoHistory(promo.id, submitterName);
    return NextResponse.json({
      ok: true,
      keywordDedupe: {
        before: deduped.before,
        after: deduped.after,
        removed: deduped.removed,
      },
    });
  }

  const keywords =
    body.keywords !== undefined || body.categories !== undefined
      ? normalizeKeywordsInput(body).text
      : promo.keywords;

  await prisma.clientPromo.update({
    where: { id: promo.id },
    data: {
      keywords,
      productPoints:
        body.productPoints !== undefined
          ? String(body.productPoints)
          : promo.productPoints,
      adPoints:
        body.adPoints !== undefined ? String(body.adPoints) : promo.adPoints,
    },
  });
  await recordPromoHistory(promo.id, submitterName);
  return NextResponse.json({ ok: true });
}
