import fs from "fs";

export function env(name, fallback = "") {
  return String(process.env[name] ?? fallback).trim();
}

export function requireEnv(name) {
  const v = env(name);
  if (!v) throw new Error(`缺少环境变量 ${name}`);
  return v;
}

export function loadServiceAccount() {
  const jsonInline = env("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (jsonInline) return JSON.parse(jsonInline);
  const path = env("GOOGLE_APPLICATION_CREDENTIALS");
  if (!path) {
    throw new Error("请配置 GOOGLE_APPLICATION_CREDENTIALS 或 GOOGLE_SERVICE_ACCOUNT_JSON");
  }
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

export function ymd(d) {
  return d.toISOString().slice(0, 10);
}

/** GSC 常延迟 2～3 天 */
export function gscDateRange(periodDays) {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 3);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (periodDays - 1));
  return { startDate: ymd(start), endDate: ymd(end) };
}

/** GA4 常延迟 1～2 天 */
export function gaDateRange(periodDays) {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 2);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (periodDays - 1));
  return { startDate: ymd(start), endDate: ymd(end) };
}

/** 上海时区的今天年月日 */
export function shanghaiYmdParts(d = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(d);
  const get = (t) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

export function prevCalendarMonth(year, month) {
  if (month <= 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

/**
 * 自然月日期范围（供月报与询盘同口径）。
 * end 不超过「今天 − delayDays」（UTC 日历近似，与滚动同步一致）。
 */
export function calendarMonthDateRange(year, month, endDelayDays = 2) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const endCap = new Date();
  endCap.setUTCDate(endCap.getUTCDate() - endDelayDays);
  const endCapStr = ymd(endCap);

  const endDate = endCapStr < startDate ? startDate : endCapStr < monthEnd ? endCapStr : monthEnd;
  return { startDate, endDate, year, month };
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function api(base, secret, path, { method = "GET", body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-seo-worker-secret": secret,
      "x-gsc-worker-secret": secret,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status} ${path}`);
  }
  return data;
}
