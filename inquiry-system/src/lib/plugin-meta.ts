import { promises as fs } from "fs";
import path from "path";
import { resolvePluginDir } from "./pluginZip";

/** 从 inquiry-bridge.php 头注释读取 Version */
export async function readPluginVersion(): Promise<string> {
  const dir = await resolvePluginDir();
  if (!dir) throw new Error("找不到 wp-inquiry-bridge 插件目录");
  const main = await fs.readFile(path.join(dir, "inquiry-bridge.php"), "utf8");
  const m = main.match(/^\s*\*\s*Version:\s*([0-9][^\r\n]*)/m);
  if (!m) throw new Error("无法解析插件 Version");
  return m[1].trim();
}

export function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/i, "").split(".").map((x) => parseInt(x, 10) || 0);
  const pb = b.replace(/^v/i, "").split(".").map((x) => parseInt(x, 10) || 0);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}
