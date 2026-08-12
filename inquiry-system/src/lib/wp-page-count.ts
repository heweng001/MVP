import { resolveWpSiteRoot } from "./site-credentials";

/** 非面向访客的内容类型（媒体、区块、模板等），不计入「网站页面数」 */
const EXCLUDED_REST_BASES = new Set([
  "media",
  "blocks",
  "templates",
  "template-parts",
  "navigation",
  "font-families",
  "font-faces",
  "global-styles",
  "menu-items",
  "menus",
  "types",
  "statuses",
  "taxonomies",
  "users",
  "comments",
  "settings",
  "themes",
  "plugins",
  "sidebars",
  "widget-types",
  "widgets",
  "search",
]);

const EXCLUDED_TYPE_SLUGS = new Set([
  "attachment",
  "wp_block",
  "wp_template",
  "wp_template_part",
  "wp_navigation",
  "wp_font_family",
  "wp_font_face",
  "wp_global_styles",
  "nav_menu_item",
  "revision",
  "oembed_cache",
  "user_request",
  "custom_css",
  "customize_changeset",
  "wp_pattern",
]);

type WpTypeInfo = {
  slug: string;
  restBase: string;
};

async function fetchJson(url: string) {
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return { res, json: await res.json() };
}

async function wpCollectionTotal(root: string, restBase: string) {
  const base = restBase.replace(/^\/+|\/+$/g, "");
  if (!base) return 0;
  const url = `${root}/wp-json/wp/v2/${base}?per_page=1&status=publish`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  // 部分 CPT 未开放 REST 或禁用 status 过滤 → 跳过，不拖垮整体
  if (!res.ok) return 0;
  const total = Number(res.headers.get("X-WP-Total") || 0);
  return Number.isFinite(total) ? Math.max(0, total) : 0;
}

/**
 * 从 /wp/v2/types 发现可公开浏览的内容类型（含 product 等 CPT）。
 * 失败时回退为 posts + pages。
 */
async function discoverPublicContentTypes(root: string): Promise<WpTypeInfo[]> {
  try {
    const { json } = await fetchJson(`${root}/wp-json/wp/v2/types`);
    if (!json || typeof json !== "object" || Array.isArray(json)) {
      throw new Error("types payload invalid");
    }
    const out: WpTypeInfo[] = [];
    for (const [slug, raw] of Object.entries(json as Record<string, unknown>)) {
      if (EXCLUDED_TYPE_SLUGS.has(slug)) continue;
      const info = raw as {
        rest_base?: string;
        slug?: string;
        viewable?: boolean;
      };
      const restBase = String(info.rest_base || "").trim();
      if (!restBase || EXCLUDED_REST_BASES.has(restBase)) continue;
      // 有 viewable 字段时只保留可前台查看的类型
      if (info.viewable === false) continue;
      out.push({ slug: String(info.slug || slug), restBase });
    }
    if (out.length > 0) return out;
  } catch {
    // fall through
  }
  return [
    { slug: "post", restBase: "posts" },
    { slug: "page", restBase: "pages" },
  ];
}

export type WpPageCountResult = {
  total: number;
  posts: number;
  pages: number;
  /** 各 rest_base → 已发布条数 */
  byType: Record<string, number>;
  root: string;
};

/** 通过公开 WP REST 统计已发布公开内容（文章/页面/产品等 CPT）；失败返回 null */
export async function countWpPublicPages(site: {
  domain: string;
  wpAdminUrl?: string | null;
}): Promise<WpPageCountResult | null> {
  const root = resolveWpSiteRoot(site.wpAdminUrl || "", site.domain);
  if (!root) return null;
  try {
    const types = await discoverPublicContentTypes(root);
    const counts = await Promise.all(
      types.map(async (t) => ({
        restBase: t.restBase,
        slug: t.slug,
        total: await wpCollectionTotal(root, t.restBase),
      })),
    );
    const byType: Record<string, number> = {};
    let total = 0;
    for (const c of counts) {
      byType[c.restBase] = c.total;
      total += c.total;
    }
    return {
      total,
      posts: byType.posts ?? 0,
      pages: byType.pages ?? 0,
      byType,
      root,
    };
  } catch {
    return null;
  }
}
