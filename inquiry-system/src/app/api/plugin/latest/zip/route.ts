import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildPluginZip, pluginZipEtag } from "@/lib/pluginZip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 插件自更新下载 zip（需 site_key） */
export async function GET(req: NextRequest) {
  const key =
    req.headers.get("x-inquiry-site-key") ||
    req.nextUrl.searchParams.get("site_key") ||
    "";
  const siteKey = String(key).trim();
  if (!siteKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const site = await prisma.site.findUnique({ where: { siteKey } });
  if (!site || !site.enabled) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { buffer } = await buildPluginZip();
    const etag = pluginZipEtag(buffer);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="wp-inquiry-bridge.zip"',
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, max-age=0, must-revalidate",
        ETag: `"${etag}"`,
      },
    });
  } catch (e) {
    console.error("[plugin/latest/zip]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "打包失败" },
      { status: 500 },
    );
  }
}
