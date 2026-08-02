import { localizeCountryCodes } from "./countries";
import { formatGeolocationZh, parseGeoSmartBlob } from "./places";

export type WpFormFieldRow = {
  id: string;
  label: string;
  value: string;
  type: string;
  /** 邮件中允许按 HTML 渲染（如 User Journey 表格） */
  html?: boolean;
};

function fieldLabel(f: Record<string, unknown>, fallbackId: string) {
  const name = String(f.name ?? f.label ?? "").trim();
  return name || `字段 ${fallbackId}`;
}

function fieldValue(f: Record<string, unknown>) {
  const v = f.value;
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return String(v).trim();
  }
  if (Array.isArray(v)) {
    return v
      .map((x) => (typeof x === "object" && x && "value" in x ? String((x as { value: unknown }).value) : String(x)))
      .filter(Boolean)
      .join(", ")
      .trim();
  }
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return "";
    }
  }
  return String(v).trim();
}

function parseRaw(rawPayload: string | null | undefined): unknown {
  if (!rawPayload) return null;
  try {
    return JSON.parse(rawPayload);
  } catch {
    return null;
  }
}

/** 解析 WPForms 入库的 fields / rawPayload */
export function parseWpFormFields(rawPayload: string | null | undefined): WpFormFieldRow[] {
  let data = parseRaw(rawPayload);
  if (!data) return [];
  if (data && typeof data === "object" && !Array.isArray(data) && "fields" in data) {
    data = (data as { fields: unknown }).fields;
  }

  const entries: { id: string; field: Record<string, unknown> }[] = [];
  if (Array.isArray(data)) {
    data.forEach((item, i) => {
      if (item && typeof item === "object") {
        const f = item as Record<string, unknown>;
        const id = String(f.id ?? i);
        entries.push({ id, field: f });
      }
    });
  } else if (data && typeof data === "object") {
    for (const [key, item] of Object.entries(data as Record<string, unknown>)) {
      if (item && typeof item === "object") {
        const f = item as Record<string, unknown>;
        const id = String(f.id ?? key);
        entries.push({ id, field: f });
      }
    }
  }

  return entries
    .map(({ id, field }) => ({
      id,
      label: fieldLabel(field, id),
      value: fieldValue(field),
      type: String(field.type ?? "").toLowerCase(),
    }))
    .filter((f) => f.value !== "");
}

function normLabel(s: string) {
  return s.toLowerCase().replace(/[{}\s_\-]/g, "");
}

type SmartKind = "page_url" | "entry_geolocation" | "combined" | "other";

function classifyHidden(f: WpFormFieldRow): SmartKind {
  const n = normLabel(f.label);
  if (/entrygeolocation|geolocation|地理位置|geo/.test(n)) return "entry_geolocation";
  if (/^pageurl$|来源页|页面链接|pageurl/.test(n) && !/国家|geo|journey/.test(n)) return "page_url";
  if (/询盘链接|链接.*国家|国家.*链接|pageurl.*geo|geo.*page/.test(n)) return "combined";
  if (/https?:\/\/\S+\s+.+/i.test(f.value) && /[A-Z]{2}\b/.test(f.value)) return "combined";
  if (/^https?:\/\/\S+$/i.test(f.value.trim())) return "page_url";
  return "other";
}

/**
 * 邮件/详情：
 * - page_url / entry_geolocation 来自 Hidden
 * - entry_user_journey 来自插件抓取的 WPForms User Journey 板块（rawPayload.entry_user_journey）
 */
export function extractHiddenFields(rawPayload: string | null | undefined): WpFormFieldRow[] {
  const root = parseRaw(rawPayload);
  const journeyFromMeta =
    root && typeof root === "object" && !Array.isArray(root)
      ? String((root as Record<string, unknown>).entry_user_journey || "").trim()
      : "";

  const hiddens = parseWpFormFields(rawPayload).filter((f) => f.type === "hidden");
  let pageUrl = "";
  let geoText = "";
  const others: WpFormFieldRow[] = [];
  const used = new Set<string>();

  for (const f of hiddens) {
    const kind = classifyHidden(f);
    if (kind === "page_url") {
      pageUrl = f.value;
      used.add(f.id);
    } else if (kind === "entry_geolocation") {
      geoText = f.value;
      used.add(f.id);
    } else if (kind === "combined") {
      const parsed = parseGeoSmartBlob(f.value);
      if (parsed.pageUrl) pageUrl = pageUrl || parsed.pageUrl;
      const withoutUrl = f.value
        .replace(/\{entry_user_journey\}/gi, "")
        .replace(parsed.pageUrl, "")
        .trim();
      geoText = geoText || withoutUrl;
      used.add(f.id);
    }
  }

  for (const f of hiddens) {
    if (used.has(f.id)) continue;
    const cleaned = f.value.replace(/\{entry_user_journey\}/gi, "").trim();
    if (!cleaned) continue;
    others.push({
      ...f,
      value: localizeCountryCodes(cleaned),
    });
  }

  const out: WpFormFieldRow[] = [];
  if (pageUrl) {
    out.push({ id: "smart-page_url", label: "page_url（页面链接）", value: pageUrl, type: "hidden" });
  }
  if (geoText) {
    out.push({
      id: "smart-entry_geolocation",
      label: "entry_geolocation（地理位置）",
      value: formatGeolocationZh(geoText),
      type: "hidden",
    });
  }
  if (journeyFromMeta) {
    out.push({
      id: "smart-entry_user_journey",
      label: "entry_user_journey（用户路径）",
      value: journeyFromMeta,
      type: "hidden",
      html: /<[a-z][\s\S]*>/i.test(journeyFromMeta),
    });
  }

  out.push(...others);
  return out;
}

export function formatMarkRemaining(ms: number) {
  if (ms <= 0) return "已到期";
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `约 ${m} 分钟`;
  if (m === 0) return `约 ${h} 小时`;
  return `约 ${h} 小时 ${m} 分钟`;
}

/** 用于「请在 xx 小时 xx 分钟内」类文案（不加「约」） */
export function formatMarkRemainingPlain(ms: number) {
  if (ms <= 0) return "0 分钟";
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m} 分钟`;
  if (m === 0) return `${h} 小时`;
  return `${h} 小时 ${m} 分钟`;
}
