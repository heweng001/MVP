import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/constants";
import { readPluginVersion } from "@/lib/plugin-meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function siteFromKey(req: NextRequest) {
  const key =
    req.headers.get("x-inquiry-site-key") ||
    req.nextUrl.searchParams.get("site_key") ||
    "";
  const siteKey = String(key).trim();
  if (!siteKey) return null;
  return prisma.site.findUnique({ where: { siteKey } });
}

/** 插件/远程拉取：最新版本与下载地址（需 site_key） */
export async function GET(req: NextRequest) {
  const site = await siteFromKey(req);
  if (!site || !site.enabled) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const version = await readPluginVersion();
    const base = appUrl();
    return NextResponse.json({
      ok: true,
      version,
      slug: "wp-inquiry-bridge/inquiry-bridge.php",
      download_url: `${base}/api/plugin/latest/zip?site_key=${encodeURIComponent(site.siteKey)}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "读取版本失败" },
      { status: 500 },
    );
  }
}
