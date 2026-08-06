import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  decryptSecret,
  hasWpRemoteCreds,
  resolveWpAdminRedirect,
  resolveWpLoginUrl,
} from "@/lib/site-credentials";

type Ctx = { params: Promise<{ id: string }> };

/** 返回自动登录表单所需字段（仅会话管理员） */
export async function POST(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const site = await prisma.site.findUnique({ where: { id } });
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!hasWpRemoteCreds(site)) {
    return NextResponse.json(
      { error: "请先配置后台入口、用户名和密码" },
      { status: 400 },
    );
  }

  const password = decryptSecret(site.wpPasswordEnc);
  if (!password) {
    return NextResponse.json({ error: "密码解密失败，请重新保存密码" }, { status: 400 });
  }

  const loginUrl = resolveWpLoginUrl(site.wpAdminUrl, site.domain);
  const redirectTo = resolveWpAdminRedirect(site.wpAdminUrl, site.domain);
  if (!loginUrl) {
    return NextResponse.json({ error: "无法解析登录地址" }, { status: 400 });
  }

  return NextResponse.json({
    loginUrl,
    username: site.wpUsername,
    password,
    redirectTo,
  });
}
