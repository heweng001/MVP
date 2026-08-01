import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getPromoByEditToken,
  isEditTokenValid,
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
  // 不返回内部备注字段
  return NextResponse.json({
    valid,
    expired: !valid,
    clientName: promo.client.name,
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
    return NextResponse.json(
      { error: "编辑链接已过期（超过 7 天），请联系管理员重新发送" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const submitterName = String(body.submitterName || "").trim();
  if (!submitterName) {
    return NextResponse.json({ error: "请填写您的姓名后再提交" }, { status: 400 });
  }

  // 客户仅可更新可见字段，忽略任何 note 字段
  await prisma.clientPromo.update({
    where: { id: promo.id },
    data: {
      keywords: body.keywords !== undefined ? String(body.keywords) : promo.keywords,
      productPoints:
        body.productPoints !== undefined ? String(body.productPoints) : promo.productPoints,
      adPoints: body.adPoints !== undefined ? String(body.adPoints) : promo.adPoints,
    },
  });
  await recordPromoHistory(promo.id, submitterName);

  return NextResponse.json({
    ok: true,
    lastSubmittedBy: submitterName,
    lastSubmittedAt: new Date().toISOString(),
  });
}
