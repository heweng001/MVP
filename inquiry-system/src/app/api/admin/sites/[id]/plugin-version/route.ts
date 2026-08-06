import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchRemotePluginVersion } from "@/lib/wp-remote-plugin";
import { readPluginVersion } from "@/lib/plugin-meta";

type Ctx = { params: Promise<{ id: string }> };

/** 查询该站已安装的 Inquiry Bridge 版本 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const site = await prisma.site.findUnique({ where: { id } });
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let latestVersion = "";
  try {
    latestVersion = await readPluginVersion();
  } catch {
    latestVersion = "";
  }

  const remote = await fetchRemotePluginVersion(site);
  if (!remote.ok) {
    return NextResponse.json({
      ok: false,
      latestVersion,
      error: remote.error,
      root: remote.root || "",
    });
  }

  return NextResponse.json({
    ok: true,
    version: remote.version,
    latestVersion,
    root: remote.root,
  });
}
