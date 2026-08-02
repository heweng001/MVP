import { localizeCountryCodes } from "./countries";

export type WpFormFieldRow = {
  id: string;
  label: string;
  value: string;
  type: string;
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

/**
 * 全部 WPForms Hidden Field（逐字段）。
 * 值中的国家简称（如 CN）会转为中文全称。
 */
export function extractHiddenFields(rawPayload: string | null | undefined): WpFormFieldRow[] {
  return parseWpFormFields(rawPayload)
    .filter((f) => f.type === "hidden")
    .map((f) => ({ ...f, value: localizeCountryCodes(f.value) }));
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
