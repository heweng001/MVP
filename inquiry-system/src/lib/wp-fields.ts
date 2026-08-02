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

type SmartKind = "page_url" | "entry_geolocation" | "entry_user_journey" | "combined" | "other";

function classifyHidden(f: WpFormFieldRow): SmartKind {
  const n = normLabel(f.label);
  if (/entryuserjourney|userjourney|用户路径|用户旅程/.test(n)) return "entry_user_journey";
  if (/entrygeolocation|geolocation|地理位置|geo/.test(n)) return "entry_geolocation";
  if (/^pageurl$|来源页|页面链接|pageurl/.test(n) && !/国家|geo|journey/.test(n)) return "page_url";
  if (/询盘链接|链接.*国家|国家.*链接|pageurl.*geo|geo.*page/.test(n)) return "combined";
  // 值形态：URL + 城市国家 + 坐标
  if (/https?:\/\/\S+\s+.+/i.test(f.value) && /[A-Z]{2}\b/.test(f.value)) return "combined";
  if (/^https?:\/\/\S+$/i.test(f.value.trim())) return "page_url";
  return "other";
}

/**
 * 邮件/详情用：保证 page_url、entry_geolocation、entry_user_journey 分别展示；
 * entry_geolocation 转为中文国家/城市详情。
 */
export function extractHiddenFields(rawPayload: string | null | undefined): WpFormFieldRow[] {
  const hiddens = parseWpFormFields(rawPayload).filter((f) => f.type === "hidden");
  let pageUrl = "";
  let geoText = "";
  let journey = "";
  let journeyHtml = false;
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
    } else if (kind === "entry_user_journey") {
      const raw = f.value.replace(/\{entry_user_journey\}/gi, "").trim();
      if (raw) {
        journey = raw;
        journeyHtml = /<[a-z][\s\S]*>/i.test(raw);
      }
      used.add(f.id);
    } else if (kind === "combined") {
      const parsed = parseGeoSmartBlob(f.value);
      if (parsed.pageUrl) pageUrl = pageUrl || parsed.pageUrl;
      const withoutUrl = f.value
        .replace(/\{entry_user_journey\}/gi, "")
        .replace(parsed.pageUrl, "")
        .trim();
      geoText = geoText || withoutUrl;
      if (parsed.journeyRaw) {
        journey = journey || parsed.journeyRaw;
        journeyHtml = /<[a-z][\s\S]*>/i.test(parsed.journeyRaw);
      }
      used.add(f.id);
    }
  }

  // 未分类的其余 hidden
  for (const f of hiddens) {
    if (used.has(f.id)) continue;
    others.push({
      ...f,
      value: localizeCountryCodes(f.value.replace(/\{entry_user_journey\}/gi, "").trim()),
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
  const journeyClean = journey.replace(/\{entry_user_journey\}/gi, "").trim();
  if (journeyClean) {
    out.push({
      id: "smart-entry_user_journey",
      label: "entry_user_journey（用户路径）",
      value: journeyClean,
      type: "hidden",
      html: journeyHtml,
    });
  } else if (hiddens.some((f) => /entry_user_journey|user_journey|用户路径|\{entry_user_journey\}/i.test(f.label + f.value))) {
    out.push({
      id: "smart-entry_user_journey",
      label: "entry_user_journey（用户路径）",
      value: "（未解析到路径内容：表单 Hidden 中的 {entry_user_journey} 可能尚未被 WPForms 展开）",
      type: "hidden",
    });
  }

  out.push(...others.filter((f) => f.value));
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
