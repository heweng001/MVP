export const CLIENT_TIERS = ["重点", "正常", "维护"] as const;
export type ClientTier = (typeof CLIENT_TIERS)[number];

export const SITE_TYPES = ["SEO型", "展示型"] as const;
export type SiteType = (typeof SITE_TYPES)[number];

export function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) {
    return d.slice(0, 10);
  }
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

/** Parse YYYY-MM-DD as local calendar date (stored noon UTC-ish via Date) */
export function parseDateInput(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const s = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toDateInputValue(d: Date | string | null | undefined) {
  if (!d) return "";
  return formatDate(d) === "—" ? "" : formatDate(d);
}
