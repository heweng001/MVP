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
