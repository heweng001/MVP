import { countryCodeToZh, localizeCountryCodes } from "./countries";

export type WpFormFieldRow = {
  id: string;
  label: string;
  value: string;
  type: string;
};

export type UserJourneyStep = {
  title: string;
  url: string;
  when: string;
  duration: string;
  referrer: string;
};

export type GeoInfo = {
  pageUrl: string;
  city: string;
  region: string;
  country: string;
  postal: string;
  lat: string;
  lng: string;
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

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function pickStr(obj: Record<string, unknown>, keys: string[]) {
  for (const k of keys) {
    const v = obj[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
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

function looksLikeGeoHidden(f: WpFormFieldRow) {
  const blob = `${f.label} ${f.value}`.toLowerCase();
  if (/国家|地理|位置|定位|location|geo|country|city|ip/.test(blob)) return true;
  if (/https?:\/\/.+\s+.+,?\s*[A-Z]{2}\b/.test(f.value)) return true;
  if (/^[A-Za-z .'-]+,\s*[A-Za-z .'-]+,\s*[A-Z]{2}\b/.test(f.value.trim())) return true;
  return false;
}

/**
 * 解析形如：
 * https://site/contact/  Xiamen, Fujian, CN
 * 24.4793, 118.0673
 */
export function parseGeoBlob(text: string): GeoInfo | null {
  const raw = text.replace(/\r\n/g, "\n").trim();
  if (!raw) return null;

  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  let pageUrl = "";
  let placeLine = "";
  let lat = "";
  let lng = "";

  for (const line of lines) {
    const coord = line.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (coord) {
      lat = coord[1];
      lng = coord[2];
      continue;
    }
    const urlMatch = line.match(/^(https?:\/\/\S+)\s+(.*)$/);
    if (urlMatch) {
      pageUrl = urlMatch[1];
      placeLine = urlMatch[2].trim();
      continue;
    }
    if (!placeLine) placeLine = line;
  }

  if (!placeLine && !pageUrl && !lat) return null;

  const parts = placeLine
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  let city = "";
  let region = "";
  let country = "";

  if (parts.length >= 1) {
    const last = parts[parts.length - 1];
    if (/^[A-Za-z]{2}$/.test(last)) {
      country = countryCodeToZh(last.toUpperCase());
      if (parts.length === 2) {
        city = parts[0];
      } else if (parts.length >= 3) {
        city = parts[0];
        region = parts.slice(1, -1).join(", ");
      }
    } else if (parts.length === 1) {
      city = parts[0];
    } else if (parts.length === 2) {
      city = parts[0];
      country = localizeCountryCodes(parts[1]);
    } else {
      city = parts[0];
      region = parts.slice(1, -1).join(", ");
      country = localizeCountryCodes(parts[parts.length - 1]);
    }
  }

  if (!city && !region && !country && !pageUrl && !lat) return null;

  return { pageUrl, city, region, country, postal: "", lat, lng };
}

function geoFromLocationMeta(loc: Record<string, unknown>): GeoInfo {
  const city = pickStr(loc, ["city", "cityName", "town"]);
  const region = pickStr(loc, ["region", "state", "province", "regionName"]);
  const postal = pickStr(loc, ["postal", "zip", "zipcode", "postcode"]);
  let country = pickStr(loc, ["country", "country_name", "countryName"]);
  const code = pickStr(loc, ["country_code", "countryCode", "iso_code"]);
  if (code && /^[A-Za-z]{2}$/.test(code)) {
    country = countryCodeToZh(code.toUpperCase());
  } else if (country.length === 2 && /^[A-Za-z]{2}$/.test(country)) {
    country = countryCodeToZh(country.toUpperCase());
  } else {
    country = localizeCountryCodes(country);
  }
  const lat = pickStr(loc, ["latitude", "lat"]);
  const lng = pickStr(loc, ["longitude", "lng", "lon"]);
  return { pageUrl: "", city, region, country, postal, lat, lng };
}

function mergeGeo(a: GeoInfo, b: GeoInfo): GeoInfo {
  return {
    pageUrl: a.pageUrl || b.pageUrl,
    city: a.city || b.city,
    region: a.region || b.region,
    country: a.country || b.country,
    postal: a.postal || b.postal,
    lat: a.lat || b.lat,
    lng: a.lng || b.lng,
  };
}

export function formatGeoInfo(g: GeoInfo): string {
  const lines: string[] = [];
  if (g.country) lines.push(`国家：${g.country}`);
  if (g.region) lines.push(`地区：${g.region}`);
  if (g.city) lines.push(`城市：${g.city}`);
  if (g.postal) lines.push(`邮编：${g.postal}`);
  if (g.lat && g.lng) lines.push(`坐标：${g.lat}, ${g.lng}`);
  if (g.pageUrl) lines.push(`询盘页：${g.pageUrl}`);
  return lines.join("\n");
}

/** 综合 location meta + 地理类 Hidden 字段 */
export function extractGeoInfo(rawPayload: string | null | undefined): GeoInfo | null {
  const empty: GeoInfo = {
    pageUrl: "",
    city: "",
    region: "",
    country: "",
    postal: "",
    lat: "",
    lng: "",
  };
  let geo: GeoInfo = { ...empty };

  const data = parseRaw(rawPayload);
  if (data && typeof data === "object") {
    const loc = asRecord(
      (data as Record<string, unknown>).location || (data as Record<string, unknown>).geolocation,
    );
    if (loc) geo = mergeGeo(geo, geoFromLocationMeta(loc));
  }

  for (const f of parseWpFormFields(rawPayload)) {
    if (f.type !== "hidden") continue;
    if (!looksLikeGeoHidden(f)) continue;
    const parsed = parseGeoBlob(f.value);
    if (parsed) geo = mergeGeo(geo, parsed);
  }

  if (!geo.city && !geo.region && !geo.country && !geo.lat && !geo.pageUrl) return null;
  return geo;
}

/** 非地理类 Hidden；地理类改由 extractGeoInfo 展示 */
export function extractHiddenFields(rawPayload: string | null | undefined): WpFormFieldRow[] {
  return parseWpFormFields(rawPayload)
    .filter((f) => f.type === "hidden")
    .filter((f) => !looksLikeGeoHidden(f) || !parseGeoBlob(f.value))
    .map((f) => ({ ...f, value: localizeCountryCodes(f.value) }));
}

/** 规范化 User Journey 步骤列表 */
export function extractUserJourney(rawPayload: string | null | undefined): UserJourneyStep[] {
  const data = parseRaw(rawPayload);
  if (!data || typeof data !== "object") return [];
  const root = data as Record<string, unknown>;
  let raw = root.user_journey ?? root.userJourney ?? root.journey ?? null;
  if (!raw) return [];
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(asRecord(raw)?.steps)
      ? (asRecord(raw)!.steps as unknown[])
      : [];
  return list
    .map((item) => {
      const o = asRecord(item);
      if (!o) return null;
      const title = pickStr(o, ["title", "pageTitle", "page_title", "name"]);
      const url = pickStr(o, ["url", "pageUrl", "page_url", "href"]);
      const when = pickStr(o, ["date", "datetime", "timestamp", "time", "when", "created"]);
      const duration = pickStr(o, ["duration", "timeOnPage", "time_on_page"]);
      const referrer = pickStr(o, ["referrer", "referer", "ref"]);
      if (!title && !url) return null;
      return { title: title || url, url, when, duration, referrer };
    })
    .filter((x): x is UserJourneyStep => !!x);
}

export function extractLocationSummary(rawPayload: string | null | undefined): string {
  const g = extractGeoInfo(rawPayload);
  return g ? formatGeoInfo(g) : "";
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
