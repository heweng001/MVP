import { resolveWpSiteRoot } from "./site-credentials";

export type RemotePluginVersionResult =
  | { ok: true; version: string; root: string }
  | { ok: false; error: string; root?: string };

/** 查询远程站点 Inquiry Bridge 插件版本 */
export async function fetchRemotePluginVersion(site: {
  wpAdminUrl?: string | null;
  domain: string;
  siteKey: string;
}): Promise<RemotePluginVersionResult> {
  const root = resolveWpSiteRoot(site.wpAdminUrl || "", site.domain);
  if (!root) {
    return { ok: false, error: "无法解析站点地址" };
  }
  if (!String(site.siteKey || "").trim()) {
    return { ok: false, error: "缺少 site_key", root };
  }

  const url = `${root}/wp-json/inquiry-bridge/v1/version`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        "X-Inquiry-Site-Key": site.siteKey,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch (e) {
    return {
      ok: false,
      root,
      error: `无法连接：${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!res.ok) {
    const msg =
      (typeof data.message === "string" && data.message) ||
      (typeof data.error === "string" && data.error) ||
      `HTTP ${res.status}`;
    return { ok: false, root, error: msg };
  }

  const version = String(data.version || "").trim();
  if (!version) {
    return { ok: false, root, error: "远程未返回版本号" };
  }
  return { ok: true, version, root };
}
