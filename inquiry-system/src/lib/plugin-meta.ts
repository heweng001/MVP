import { promises as fs } from "fs";
import path from "path";
import { resolvePluginDir } from "./pluginZip";

export { compareSemver } from "./semver";

/** 从 inquiry-bridge.php 头注释读取 Version */
export async function readPluginVersion(): Promise<string> {
  const dir = await resolvePluginDir();
  if (!dir) throw new Error("找不到 wp-inquiry-bridge 插件目录");
  const main = await fs.readFile(path.join(dir, "inquiry-bridge.php"), "utf8");
  const m = main.match(/^\s*\*\s*Version:\s*([0-9][^\r\n]*)/m);
  if (!m) throw new Error("无法解析插件 Version");
  return m[1].trim();
}
