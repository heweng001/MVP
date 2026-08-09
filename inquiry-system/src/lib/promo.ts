import { randomBytes } from "crypto";
import DOMPurify from "isomorphic-dompurify";
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

/** 关键词行数（含空行，与行号编辑器一致） */
export function countKeywordLines(raw: string) {
  const s = String(raw || "");
  if (!s) return 0;
  return s.split("\n").length;
}

/**
 * 关键词去重：去掉空行；按去首尾空白后大小写不敏感去重，保留首次出现的原文（已 trim）。
 */
export function dedupeKeywords(raw: string): {
  text: string;
  before: number;
  after: number;
  removed: number;
} {
  const lines = String(raw || "").split("\n");
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

/** 纯文本历史 → 简单 HTML，便于富文本编辑器加载 */
export function ensureRichHtml(raw: string): string {
  const s = String(raw || "");
  if (!s.trim()) return "";
  if (/<[a-z][\s\S]*>/i.test(s)) return s;
  return s
    .split(/\n{2,}/)
    .map((block) => {
      const escaped = block
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");
      return `<p>${escaped}</p>`;
    })
    .join("");
}

/** 保存前清洗 HTML（允许表格与外链图片） */
export function sanitizePromoHtml(raw: string): string {
  return DOMPurify.sanitize(String(raw || ""), {
    USE_PROFILES: { html: true },
    ADD_TAGS: ["table", "thead", "tbody", "tr", "th", "td", "colgroup", "col"],
    ADD_ATTR: ["colspan", "rowspan", "style", "target", "rel"],
  });
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
