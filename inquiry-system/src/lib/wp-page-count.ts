import { resolveWpSiteRoot } from "./site-credentials";

async function wpCollectionTotal(root: string, collection: "posts" | "pages") {
  const url = `${root}/wp-json/wp/v2/${collection}?per_page=1&status=publish`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`${collection} HTTP ${res.status}`);
  }
  const total = Number(res.headers.get("X-WP-Total") || 0);
  return Number.isFinite(total) ? Math.max(0, total) : 0;
}

/** 通过公开 WP REST 统计已发布文章+页面数；失败返回 null */
export async function countWpPublicPages(site: {
  domain: string;
  wpAdminUrl?: string | null;
}): Promise<{ total: number; posts: number; pages: number; root: string } | null> {
  const root = resolveWpSiteRoot(site.wpAdminUrl || "", site.domain);
  if (!root) return null;
  try {
    const [posts, pages] = await Promise.all([
      wpCollectionTotal(root, "posts"),
      wpCollectionTotal(root, "pages"),
    ]);
    return { total: posts + pages, posts, pages, root };
  } catch {
    return null;
  }
}
