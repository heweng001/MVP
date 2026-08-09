import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  dedupeKeywords,
  editLinkExpiresAt,
  newEditToken,
  promoDisplayLabel,
  promoEditUrl,
  recordPromoHistory,
} from "@/lib/promo";

type Ctx = { params: Promise<{ id: string }> };

const siteInclude = {
  site: {
    select: {
      id: true,
      domain: true,
      client: { select: { id: true, name: true } },
    },
  },
  histories: { orderBy: { createdAt: "desc" as const }, take: 100 },
};

export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const item = await prisma.clientPromo.findUnique({
    where: { id },
    include: siteInclude,
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    item: {
      ...item,
      displayLabel: promoDisplayLabel(item),
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

  const data: Record<string, string | null> = {};
  let keywordDedupe: ReturnType<typeof dedupeKeywords> | null = null;
  if (body.keywords !== undefined) {
    keywordDedupe = dedupeKeywords(String(body.keywords));
    data.keywords = keywordDedupe.text;
  }
  if (body.productPoints !== undefined) data.productPoints = String(body.productPoints);
  if (body.adPoints !== undefined) data.adPoints = String(body.adPoints);
  if (body.keywordsNote !== undefined) data.keywordsNote = String(body.keywordsNote);
  if (body.productPointsNote !== undefined) {
    data.productPointsNote = String(body.productPointsNote);
  }
  if (body.adPointsNote !== undefined) data.adPointsNote = String(body.adPointsNote);

  if (body.siteId !== undefined) {
    const siteId = String(body.siteId || "").trim() || null;
    if (siteId) {
      const site = await prisma.site.findUnique({ where: { id: siteId } });
      if (!site) return NextResponse.json({ error: "网站不存在" }, { status: 404 });
      const taken = await prisma.clientPromo.findFirst({
        where: { siteId, NOT: { id } },
      });
      if (taken) {
        return NextResponse.json({ error: "该网站已有信息核对，一站仅允许一条" }, { status: 409 });
      }
    }
    data.siteId = siteId;
  }

  const submitter = String(body.submitterName || "管理员").trim() || "管理员";

  try {
    await prisma.clientPromo.update({
      where: { id },
      data,
    });
    if (body.asSubmit !== false) {
      await recordPromoHistory(id, submitter);
    }
    const fresh = await prisma.clientPromo.findUnique({
      where: { id },
      include: siteInclude,
    });
    return NextResponse.json({
      item: fresh
        ? { ...fresh, displayLabel: promoDisplayLabel(fresh) }
        : null,
      keywordDedupe: keywordDedupe
        ? {
            before: keywordDedupe.before,
            after: keywordDedupe.after,
            removed: keywordDedupe.removed,
          }
        : null,
    });
  } catch {
    return NextResponse.json({ error: "保存失败" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    await prisma.clientPromo.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "删除失败" }, { status: 404 });
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "issue_link");

  const promo = await prisma.clientPromo.findUnique({ where: { id } });
  if (!promo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "issue_link") {
    const token = newEditToken();
    const expires = editLinkExpiresAt();
    await prisma.clientPromo.update({
      where: { id },
      data: { editToken: token, editTokenExpires: expires },
    });
    const editUrl = promoEditUrl(token);
    return NextResponse.json({
      ok: true,
      editUrl,
      expiresAt: expires.toISOString(),
    });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
