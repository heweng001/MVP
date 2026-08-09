import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

function credKey() {
  const secret = process.env.AUTH_SECRET || "dev-insecure-auth-secret";
  return scryptSync(secret, "inquiry-wp-cred-v1", 32);
}

/** AES-256-GCM；空串原样返回 */
export function encryptSecret(plain: string): string {
  const text = String(plain || "");
  if (!text) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", credKey(), iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptSecret(blob: string): string {
  const raw = String(blob || "");
  if (!raw) return "";
  try {
    const buf = Buffer.from(raw, "base64url");
    if (buf.length < 28) return "";
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", credKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

export function hasWpRemoteCreds(site: {
  wpAdminUrl?: string | null;
  wpUsername?: string | null;
  wpPasswordEnc?: string | null;
}) {
  return Boolean(
    String(site.wpAdminUrl || "").trim() &&
      String(site.wpUsername || "").trim() &&
      String(site.wpPasswordEnc || "").trim(),
  );
}

function ensureHttpUrl(raw: string): string {
  const t = String(raw || "").trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

/** 规范化为站点根（保留子目录安装路径；去掉 wp-admin / wp-login.php） */
function toSiteBase(raw: string, stripCustomLoginPath = false): string {
  const url = ensureHttpUrl(raw);
  if (!url) return "";
  try {
    const u = new URL(url);
    let path = u.pathname.replace(/\/+$/, "") || "";
    const hadWpAdmin = /\/wp-admin(\/.*)?$/i.test(path);
    const hadWpLogin = /\/wp-login\.php/i.test(path);
    path = path.replace(/\/wp-admin(\/.*)?$/i, "");
    path = path.replace(/\/wp-login\.php.*$/i, "");
    // 自定义登录入口（如 /maoniu）不是站点安装目录，REST 根应回到域名
    if (stripCustomLoginPath && !hadWpAdmin && !hadWpLogin && path && path !== "/") {
      path = "";
    }
    const base = `${u.origin}${path && path !== "/" ? path : ""}`;
    return base.replace(/\/+$/, "");
  } catch {
    return "";
  }
}

/**
 * 解析站点根 URL（用于 wp-json / 进后台后的 redirect）。
 * 优先用网站域名，避免把自定义登录路径（/maoniu）误当成安装目录。
 */
export function resolveWpSiteRoot(adminUrl: string, domain: string): string {
  const fromDomain = toSiteBase(domain, false);
  if (fromDomain) return fromDomain;
  return toSiteBase(adminUrl, true);
}

/**
 * 登录提交地址：
 * - 已含 wp-login.php → 原样
 * - 以 /wp-admin 结尾 → 同级推导 wp-login.php
 * - 仅域名/根路径 → {root}/wp-login.php
 * - 其它自定义路径（如 /maoniu）→ 原样作为登录入口，不再追加 wp-login.php
 */
export function resolveWpLoginUrl(adminUrl: string, domain: string): string {
  const raw = String(adminUrl || "").trim();
  if (!raw) {
    const root = resolveWpSiteRoot("", domain);
    return root ? `${root}/wp-login.php` : "";
  }

  const url = ensureHttpUrl(raw);
  try {
    const u = new URL(url);
    const path = (u.pathname.replace(/\/+$/, "") || "/") + (u.search || "");
    const pathOnly = u.pathname.replace(/\/+$/, "") || "/";

    if (/wp-login\.php/i.test(pathOnly)) {
      return `${u.origin}${pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`}${u.search}`;
    }

    if (/\/wp-admin$/i.test(pathOnly) || pathOnly.toLowerCase() === "/wp-admin") {
      const rootPath = pathOnly.replace(/\/wp-admin$/i, "");
      return `${u.origin}${rootPath}/wp-login.php`;
    }

    if (pathOnly === "/" || pathOnly === "") {
      return `${u.origin}/wp-login.php`;
    }

    // 自定义后台/登录入口（如 https://totinfoaidc.com/maoniu）
    return `${u.origin}${pathOnly}${u.search}`;
  } catch {
    const root = resolveWpSiteRoot(adminUrl, domain);
    return root ? `${root}/wp-login.php` : "";
  }
}

export function resolveWpAdminRedirect(adminUrl: string, domain: string): string {
  const root = resolveWpSiteRoot(adminUrl, domain);
  if (!root) return "";
  return `${root}/wp-admin/`;
}
