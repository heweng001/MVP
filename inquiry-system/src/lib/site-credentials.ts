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

/** 解析站点根 URL（用于 wp-json） */
export function resolveWpSiteRoot(adminUrl: string, domain: string): string {
  let raw = String(adminUrl || "").trim();
  if (!raw) {
    raw = String(domain || "").trim();
  }
  if (!raw) return "";
  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }
  try {
    const u = new URL(raw);
    let path = u.pathname.replace(/\/+$/, "");
    path = path.replace(/\/wp-admin(\/.*)?$/i, "");
    path = path.replace(/\/wp-login\.php$/i, "");
    path = path.replace(/\/wp-login\.php.*$/i, "");
    const base = `${u.origin}${path === "/" ? "" : path}`;
    return base.replace(/\/+$/, "");
  } catch {
    return "";
  }
}

export function resolveWpLoginUrl(adminUrl: string, domain: string): string {
  const root = resolveWpSiteRoot(adminUrl, domain);
  if (!root) return "";
  const raw = String(adminUrl || "").trim();
  if (/wp-login\.php/i.test(raw)) {
    try {
      const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
      return u.toString();
    } catch {
      // fall through
    }
  }
  return `${root}/wp-login.php`;
}

export function resolveWpAdminRedirect(adminUrl: string, domain: string): string {
  const root = resolveWpSiteRoot(adminUrl, domain);
  if (!root) return "";
  return `${root}/wp-admin/`;
}
