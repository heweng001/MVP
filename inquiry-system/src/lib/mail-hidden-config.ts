/** 邮件/反馈页「隐藏字段」配置（按网站） */

export const BUILTIN_MAIL_HIDDEN = ["geo", "journey"] as const;
export type BuiltinMailHidden = (typeof BUILTIN_MAIL_HIDDEN)[number];

export const DEFAULT_MAIL_HIDDEN_FIELDS: string[] = [...BUILTIN_MAIL_HIDDEN];

export function parseMailHiddenFields(raw: string | null | undefined): string[] {
  const text = String(raw || "").trim();
  if (!text) return [...DEFAULT_MAIL_HIDDEN_FIELDS];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      const ids = parsed.map((x) => String(x).trim()).filter(Boolean);
      return normalizeMailHiddenFields(ids);
    }
  } catch {
    // fall through: comma-separated
  }
  const ids = text
    .split(/[,，\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);
  return normalizeMailHiddenFields(ids);
}

export function normalizeMailHiddenFields(ids: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const key = id.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  // 保证默认内置项始终存在
  for (const b of BUILTIN_MAIL_HIDDEN) {
    if (!seen.has(b)) {
      out.unshift(b);
      seen.add(b);
    }
  }
  return out;
}

export function serializeMailHiddenFields(ids: string[]): string {
  return JSON.stringify(normalizeMailHiddenFields(ids));
}

export function isBuiltinMailHidden(id: string): id is BuiltinMailHidden {
  return id === "geo" || id === "journey";
}
