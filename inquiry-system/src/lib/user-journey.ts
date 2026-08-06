/** 将插件入库的 user_journey 结构化数据格式化为可展示 HTML（对齐 WPForms 邮件表格风格） */

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

/**
 * 生成与 WPForms `{entry_user_journey}` 相近的表格 HTML。
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
    const when = pickStr(step, [
      "date",
      "datetime",
      "timestamp",
      "time",
      "when",
      "created",
      "date_created",
      "visited_at",
    ]);
    const duration = pickStr(step, [
      "duration",
      "timeOnPage",
      "time_on_page",
      "time_spent",
      "spend",
    ]);
    if (!title && !url) continue;
    const label = title || url;
    const pageHtml = url
      ? `<a href="${esc(url)}">${esc(label)}</a>`
      : esc(label);
    rows.push(
      `<tr>` +
        `<td style="padding:6px 8px;border:1px solid #e2e8f0;vertical-align:top;">${pageHtml}</td>` +
        `<td style="padding:6px 8px;border:1px solid #e2e8f0;vertical-align:top;white-space:nowrap;">${esc(when || "—")}</td>` +
        `<td style="padding:6px 8px;border:1px solid #e2e8f0;vertical-align:top;white-space:nowrap;">${esc(duration || "—")}</td>` +
        `</tr>`,
    );
  }

  if (!rows.length) return "";

  return (
    `<table style="border-collapse:collapse;width:100%;font-size:13px;">` +
    `<thead><tr style="background:#f8fafc;text-align:left;color:#666;">` +
    `<th style="padding:6px 8px;border:1px solid #e2e8f0;">Page</th>` +
    `<th style="padding:6px 8px;border:1px solid #e2e8f0;">Date</th>` +
    `<th style="padding:6px 8px;border:1px solid #e2e8f0;">Duration</th>` +
    `</tr></thead><tbody>${rows.join("")}</tbody></table>`
  );
}
