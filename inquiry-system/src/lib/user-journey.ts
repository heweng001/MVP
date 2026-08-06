/** 将插件入库的 user_journey 结构化数据格式化为可展示 HTML */

function pickStr(row: Record<string, unknown>, keys: string[]) {
  for (const k of keys) {
    if (row[k] != null && String(row[k]).trim() !== "") {
      return String(row[k]).trim();
    }
  }
  return "";
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

function extractSteps(raw: unknown): Record<string, unknown>[] {
  if (raw == null || raw === "") return [];
  let data: unknown = raw;
  if (typeof data === "string") {
    const trim = data.trim();
    if (!trim) return [];
    if (/<(table|tr|td|div)\b/i.test(trim)) return []; // already HTML — caller handles
    try {
      data = JSON.parse(trim);
    } catch {
      return [];
    }
  }
  if (Array.isArray(data)) {
    return data.map(asRecord).filter((x): x is Record<string, unknown> => Boolean(x));
  }
  const obj = asRecord(data);
  if (!obj) return [];
  for (const key of ["steps", "pages", "journey", "items", "data"]) {
    if (Array.isArray(obj[key])) {
      return (obj[key] as unknown[])
        .map(asRecord)
        .filter((x): x is Record<string, unknown> => Boolean(x));
    }
  }
  if (obj.url || obj.title || obj.pageUrl || obj.page_url || obj.path) {
    return [obj];
  }
  return [];
}

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 完整 URL → 路径（含 query），如 /product-category/.../ */
export function urlPathSuffix(url: string): string {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (raw.startsWith("/") && !/^https?:\/\//i.test(raw)) {
    return raw;
  }
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return `${u.pathname || "/"}${u.search || ""}${u.hash || ""}` || "/";
  } catch {
    const m = raw.match(/^https?:\/\/[^/]+(\/.*)?$/i);
    return m?.[1] || "";
  }
}

/** 转为北京时间 yyyy-MM-dd HH:mm:ss；无法解析则原样返回 */
export function toBeijingDateTime(raw: string): string {
  const t = String(raw || "").trim();
  if (!t) return "—";

  let ms: number | null = null;
  if (/^\d{10}$/.test(t)) {
    ms = parseInt(t, 10) * 1000;
  } else if (/^\d{13}$/.test(t)) {
    ms = parseInt(t, 10);
  } else if (/^\d+(\.\d+)?$/.test(t)) {
    const n = Number(t);
    ms = n > 1e12 ? n : n > 1e9 ? n * 1000 : null;
  } else {
    const normalized = t.includes("T") ? t : t.replace(" ", "T");
    const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized);
    // 无时区的 MySQL/UTC 串按 UTC 解析，再转北京时间（对齐 WPForms 站点时区展示）
    const parsed = Date.parse(hasTz ? normalized : `${normalized}Z`);
    if (!Number.isNaN(parsed)) ms = parsed;
  }

  if (ms == null || Number.isNaN(ms)) return t;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ms));

  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

/** 停留时长规范为秒数字符串 */
export function formatDurationSeconds(raw: string): string {
  const t = String(raw || "").trim();
  if (!t) return "—";

  if (/^\d+(\.\d+)?s$/i.test(t)) {
    return String(Math.round(parseFloat(t)));
  }
  if (/^\d+(\.\d+)?\s*(sec|secs|second|seconds)$/i.test(t)) {
    return String(Math.round(parseFloat(t)));
  }
  if (/^\d+(\.\d+)?\s*(ms|msec|milliseconds)$/i.test(t)) {
    return String(Math.round(parseFloat(t) / 1000));
  }
  // HH:MM:SS or MM:SS
  const clock = t.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (clock) {
    if (clock[3] != null) {
      return String(
        parseInt(clock[1], 10) * 3600 + parseInt(clock[2], 10) * 60 + parseInt(clock[3], 10),
      );
    }
    return String(parseInt(clock[1], 10) * 60 + parseInt(clock[2], 10));
  }
  if (/^\d+(\.\d+)?$/.test(t)) {
    const n = Number(t);
    // 过大更像毫秒
    if (n >= 10000) return String(Math.round(n / 1000));
    return String(Math.round(n));
  }
  return t;
}

function pageCellHtml(title: string, url: string): string {
  const path = url ? urlPathSuffix(url) : "";
  let body: string;
  if (title && path) {
    body =
      `${esc(title)}` +
      `<div style="color:#64748b;font-size:12px;margin-top:2px;word-break:break-all;">${esc(path)}</div>`;
  } else if (title) {
    body = esc(title);
  } else if (path) {
    body = esc(path);
  } else {
    body = esc(url);
  }
  if (url) {
    return `<a href="${esc(url)}" style="color:inherit;text-decoration:none;">${body}</a>`;
  }
  return body;
}

/**
 * 生成浏览路径表格 HTML（北京时间 / 中文表头 / 路径后缀）。
 * 若已是 HTML 字符串则原样返回；无法解析则返回空串。
 */
export function formatUserJourneyHtml(raw: unknown): string {
  if (raw == null || raw === "") return "";
  if (typeof raw === "string") {
    const trim = raw.trim();
    if (!trim || trim.includes("{entry_user_journey}")) return "";
    if (/<(table|tr)\b/i.test(trim)) return trim;
  }

  const steps = extractSteps(raw);
  if (!steps.length) return "";

  const rows: string[] = [];
  for (const step of steps) {
    const title = pickStr(step, ["title", "pageTitle", "page_title", "name", "page", "post_title"]);
    const url = pickStr(step, ["url", "pageUrl", "page_url", "href", "path", "permalink"]);
    const whenRaw = pickStr(step, [
      "date",
      "datetime",
      "timestamp",
      "time",
      "when",
      "created",
      "date_created",
      "visited_at",
    ]);
    const durationRaw = pickStr(step, [
      "duration",
      "timeOnPage",
      "time_on_page",
      "time_spent",
      "spend",
    ]);
    if (!title && !url) continue;

    const when = whenRaw ? toBeijingDateTime(whenRaw) : "—";
    const duration = formatDurationSeconds(durationRaw);

    rows.push(
      `<tr>` +
        `<td style="padding:6px 8px;border:1px solid #e2e8f0;vertical-align:top;">${pageCellHtml(title, url)}</td>` +
        `<td style="padding:6px 8px;border:1px solid #e2e8f0;vertical-align:top;white-space:nowrap;">${esc(when)}</td>` +
        `<td style="padding:6px 8px;border:1px solid #e2e8f0;vertical-align:top;white-space:nowrap;">${esc(duration)}</td>` +
        `</tr>`,
    );
  }

  if (!rows.length) return "";

  return (
    `<table style="border-collapse:collapse;width:100%;font-size:13px;">` +
    `<thead><tr style="background:#f8fafc;text-align:left;color:#666;">` +
    `<th style="padding:6px 8px;border:1px solid #e2e8f0;">页面</th>` +
    `<th style="padding:6px 8px;border:1px solid #e2e8f0;">北京时间</th>` +
    `<th style="padding:6px 8px;border:1px solid #e2e8f0;">停留秒数</th>` +
    `</tr></thead><tbody>${rows.join("")}</tbody></table>`
  );
}
