import { randomBytes } from "crypto";
import { prisma } from "./prisma";
import { appUrl } from "./constants";

export const PROMO_EDIT_DAYS = 7;

/** 对外文案：信息核对 */
export const PROMO_LABEL = "信息核对";

export const PROMO_TABS = [
  {
    key: "keywords" as const,
    label: "关键词列表",
    noteKey: "keywordsNote" as const,
  },
  {
    key: "productPoints" as const,
    label: "公司产品要点",
    noteKey: "productPointsNote" as const,
  },
  {
    key: "adPoints" as const,
    label: "广告要点",
    noteKey: "adPointsNote" as const,
  },
];

export type PromoTabKey = (typeof PROMO_TABS)[number]["key"];
export type PromoNoteKey = (typeof PROMO_TABS)[number]["noteKey"];

export function newEditToken() {
  return randomBytes(24).toString("hex");
}

export function editLinkExpiresAt(from = new Date()) {
  return new Date(from.getTime() + PROMO_EDIT_DAYS * 24 * 60 * 60 * 1000);
}

export function promoEditUrl(token: string) {
  return `${appUrl()}/p/${token}`;
}

export function promoKeywordsEditUrl(token: string) {
  return `${appUrl()}/p/${token}/keywords`;
}

export function promoDisplayLabel(promo: {
  id: string;
  site?: { domain: string } | null;
}) {
  const domain = String(promo.site?.domain || "").trim();
  if (domain) return domain;
  return `信息核对 ${promo.id.slice(0, 8)}`;
}

/** 信息核对关键词分类（类名自定义；仅整理用） */
export type KeywordCategory = {
  name: string;
  items: string[];
};

export const DEFAULT_KEYWORD_CATEGORIES: KeywordCategory[] = [
  { name: "核心", items: [] },
  { name: "长尾", items: [] },
  { name: "其他", items: [] },
];

function looksLikeCategoriesJson(raw: string): boolean {
  const t = String(raw || "").trim();
  if (!t.startsWith("[")) return false;
  try {
    const v = JSON.parse(t) as unknown;
    if (!Array.isArray(v)) return false;
    if (v.length === 0) return true;
    const first = v[0];
    return (
      first != null &&
      typeof first === "object" &&
      !Array.isArray(first) &&
      ("name" in first || "items" in first || "keywords" in first)
    );
  } catch {
    return false;
  }
}

function normalizeCategory(raw: unknown, index: number): KeywordCategory {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { name: `分类${index + 1}`, items: [] };
  }
  const o = raw as Record<string, unknown>;
  const name = String(o.name ?? o.title ?? `分类${index + 1}`).trim() || `分类${index + 1}`;
  const list = Array.isArray(o.items)
    ? o.items
    : Array.isArray(o.keywords)
      ? o.keywords
      : [];
  const items = list.map((x) => String(x).trim()).filter(Boolean);
  return { name, items };
}

/** 解析存储值：JSON 分类 或 旧版一行一词纯文本 */
export function parseKeywordCategories(raw: string): KeywordCategory[] {
  const s = String(raw || "");
  if (!s.trim()) return [];
  if (looksLikeCategoriesJson(s)) {
    try {
      const arr = JSON.parse(s.trim()) as unknown[];
      if (!Array.isArray(arr)) return [];
      return arr.map((x, i) => normalizeCategory(x, i));
    } catch {
      /* fall through */
    }
  }
  const items = s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!items.length) return [];
  return [{ name: "未分类", items }];
}

/** 编辑器空态：给默认三类模板（不强制写入库，除非用户提交） */
export function categoriesForEditor(raw: string): KeywordCategory[] {
  const parsed = parseKeywordCategories(raw);
  if (parsed.length) return parsed.map((c) => ({ name: c.name, items: [...c.items] }));
  return DEFAULT_KEYWORD_CATEGORIES.map((c) => ({ name: c.name, items: [] }));
}

export function serializeKeywordCategories(cats: KeywordCategory[]): string {
  const cleaned = cats
    .map((c) => ({
      name: String(c.name || "").trim() || "未命名",
      items: (c.items || []).map((x) => String(x).trim()).filter(Boolean),
    }))
    .filter((c) => c.name || c.items.length);
  if (!cleaned.length) return "";
  // 全空类且无词 → 空串
  if (cleaned.every((c) => c.items.length === 0)) {
    // 若用户只建了空类名，仍保存结构便于下次编辑
    const named = cleaned.filter((c) => c.name && c.name !== "未命名");
    if (!named.length && cleaned.length <= 3) return "";
  }
  return JSON.stringify(cleaned);
}

/** GSC / 计数用：展平成词列表（全局顺序：类顺序 × 类内顺序） */
export function flattenKeywordList(raw: string): string[] {
  return parseKeywordCategories(raw).flatMap((c) => c.items);
}

/**
 * 跨类全局去重（大小写不敏感，保留首次出现所在类中的原文）。
 * 返回可入库的序列化文本（有分类则 JSON，否则空）。
 */
export function dedupeKeywordCategories(cats: KeywordCategory[]): {
  categories: KeywordCategory[];
  text: string;
  before: number;
  after: number;
  removed: number;
} {
  const before = cats.reduce((n, c) => n + (c.items?.length || 0), 0);
  const seen = new Set<string>();
  const categories: KeywordCategory[] = [];
  for (const c of cats) {
    const name = String(c.name || "").trim() || "未命名";
    const items: string[] = [];
    for (const line of c.items || []) {
      const t = String(line).trim();
      if (!t) continue;
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(t);
    }
    categories.push({ name, items });
  }
  // 去掉完全空且名为默认模板的尾部无关类？保留用户类结构
  const text = serializeKeywordCategories(categories);
  const after = flattenKeywordList(text).length;
  return { categories, text, before, after, removed: Math.max(0, before - after) };
}

/** 关键词条数（非空词；兼容旧纯文本与分类 JSON） */
export function countKeywordLines(raw: string) {
  return flattenKeywordList(raw).length;
}

/**
 * 关键词去重并规范化入库。
 * - 分类 JSON / 旧纯文本均可；
 * - 有分类结构时写回 JSON；旧纯文本无类时仍写回一行一词（避免无谓迁移）。
 */
export function dedupeKeywords(raw: string): {
  text: string;
  before: number;
  after: number;
  removed: number;
} {
  const s = String(raw || "");
  if (looksLikeCategoriesJson(s) || s.trim().startsWith("[")) {
    const cats = parseKeywordCategories(s);
    const r = dedupeKeywordCategories(cats);
    return { text: r.text, before: r.before, after: r.after, removed: r.removed };
  }
  const lines = s.split("\n");
  const nonEmpty = lines.map((l) => l.trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of nonEmpty) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return {
    text: out.join("\n"),
    before: nonEmpty.length,
    after: out.length,
    removed: nonEmpty.length - out.length,
  };
}

/** API 保存分类：接受 categories 数组或 keywords 字符串 */
export function normalizeKeywordsInput(body: {
  keywords?: unknown;
  categories?: unknown;
}): ReturnType<typeof dedupeKeywords> {
  if (Array.isArray(body.categories)) {
    const cats = (body.categories as unknown[]).map((x, i) => normalizeCategory(x, i));
    const r = dedupeKeywordCategories(cats);
    return { text: r.text, before: r.before, after: r.after, removed: r.removed };
  }
  if (body.keywords !== undefined) {
    return dedupeKeywords(String(body.keywords));
  }
  return { text: "", before: 0, after: 0, removed: 0 };
}

export async function getPromoByEditToken(token: string) {
  if (!token?.trim()) return null;
  return prisma.clientPromo.findUnique({
    where: { editToken: token.trim() },
    include: {
      site: { include: { client: { select: { id: true, name: true } } } },
    },
  });
}

export function isEditTokenValid(expires: Date | null | undefined) {
  if (!expires) return false;
  return expires.getTime() > Date.now();
}

export async function recordPromoHistory(promoId: string, submittedBy: string) {
  const name = submittedBy.trim() || "未知";
  await prisma.clientPromoHistory.create({
    data: { promoId, submittedBy: name },
  });
  await prisma.clientPromo.update({
    where: { id: promoId },
    data: {
      lastSubmittedBy: name,
      lastSubmittedAt: new Date(),
    },
  });
}
