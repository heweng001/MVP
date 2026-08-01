import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { buildPluginZip, pluginZipEtag } from "@/lib/pluginZip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    console.error("[plugin/download]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "打包失败" },
      { status: 500 },
    );
  }
}
