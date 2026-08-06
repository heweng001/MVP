import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/constants";
import { readPluginVersion } from "@/lib/plugin-meta";
import { resolveWpSiteRoot } from "@/lib/site-credentials";

type Ctx = { params: Promise<{ id: string }> };

/** 触发远程站点插件自更新（校验 site_key，从中心拉取最新 zip） */
export async function POST(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const site = await prisma.site.findUnique({ where: { id } });
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const root = resolveWpSiteRoot(site.wpAdminUrl, site.domain);
  if (!root) {
    return NextResponse.json({ error: "无法解析站点地址" }, { status: 400 });
  }

  let latestVersion = "";
  try {
    latestVersion = await readPluginVersion();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "读取中心插件版本失败" },
      { status: 500 },
    );
  }

  const updateUrl = `${root}/wp-json/inquiry-bridge/v1/self-update`;
  const downloadUrl = `${appUrl()}/api/plugin/latest/zip?site_key=${encodeURIComponent(site.siteKey)}`;

  let res: Response;
  try {
    res = await fetch(updateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Inquiry-Site-Key": site.siteKey,
      },
      body: JSON.stringify({
        download_url: downloadUrl,
        expected_version: latestVersion,
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: `无法连接站点 ${updateUrl}：${e instanceof Error ? e.message : String(e)}。请确认站点可访问且已安装含自更新接口的插件（≥1.0.13）。`,
      },
      { status: 502 },
    );
  }

  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text.slice(0, 500) };
  }

  if (!res.ok) {
    const msg =
      (typeof data.message === "string" && data.message) ||
      (typeof data.error === "string" && data.error) ||
      `远程更新失败（HTTP ${res.status}）`;
    return NextResponse.json({ error: msg, remote: data }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    latestVersion,
    remote: data,
  });
}
