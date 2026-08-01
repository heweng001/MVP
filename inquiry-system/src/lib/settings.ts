import { prisma } from "./prisma";

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

type AppSettingsValue = {
  smtp?: Partial<SmtpConfig>;
};

const DEFAULT_SMTP: SmtpConfig = {
  host: "",
  port: 587,
  secure: false,
  user: "",
  pass: "",
  from: "",
};

function envSmtp(): SmtpConfig {
  return {
    host: (process.env.SMTP_HOST || "").trim(),
    port: Number(process.env.SMTP_PORT || 587) || 587,
    secure: process.env.SMTP_SECURE === "true",
    user: (process.env.SMTP_USER || "").trim(),
    pass: process.env.SMTP_PASS || "",
    from: (process.env.SMTP_FROM || "").trim(),
  };
}

function normalizeSmtp(raw?: Partial<SmtpConfig> | null): SmtpConfig {
  return {
    host: String(raw?.host || "").trim(),
    port: Number(raw?.port || 587) || 587,
    secure: Boolean(raw?.secure),
    user: String(raw?.user || "").trim(),
    pass: String(raw?.pass || ""),
    from: String(raw?.from || "").trim(),
  };
}

/** 拒绝把多行 .env 粘进主机字段 / 引号未闭合污染后的值 */
export function validateSmtpHost(host: string): string | null {
  const h = host.trim();
  if (!h) return "请填写 SMTP 主机";
  if (/[\r\n]/.test(h) || /\s/.test(h)) return "SMTP 主机不能含空格或换行，只填主机名，如 smtp.example.com";
  if (/=/.test(h) || /SMTP_/i.test(h)) return "SMTP 主机格式不正确，请只填写主机名（不要粘贴整段环境变量）";
  if (!/^[A-Za-z0-9.-]+$/.test(h)) return "SMTP 主机只能包含字母、数字、点、连字符";
  return null;
}

async function readSettings(): Promise<AppSettingsValue> {
  const row = await prisma.appSetting.findUnique({ where: { id: "default" } });
  if (!row?.value) return {};
  try {
    return JSON.parse(row.value) as AppSettingsValue;
  } catch {
    return {};
  }
}

async function writeSettings(next: AppSettingsValue) {
  await prisma.appSetting.upsert({
    where: { id: "default" },
    create: { id: "default", value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) },
  });
}

/** DB 有 host 时优先用库内配置，否则回退 .env */
export async function getSmtpConfig(): Promise<SmtpConfig> {
  const settings = await readSettings();
  const db = normalizeSmtp(settings.smtp);
  if (db.host && !validateSmtpHost(db.host)) return db;
  const env = normalizeSmtp(envSmtp());
  if (env.host && !validateSmtpHost(env.host)) return env;
  return { ...DEFAULT_SMTP };
}

export function isSmtpReady(cfg: SmtpConfig) {
  if (!cfg.host.trim()) return false;
  if (validateSmtpHost(cfg.host)) return false;
  if (/example\.com$/i.test(cfg.host)) return false;
  return true;
}

function sanitizeHostForForm(host: string) {
  if (!host) return "";
  return validateSmtpHost(host) ? "" : host;
}

export async function getSmtpConfigForAdmin() {
  const settings = await readSettings();
  const db = normalizeSmtp(settings.smtp);
  const env = normalizeSmtp(envSmtp());
  const dbHostOk = Boolean(db.host) && !validateSmtpHost(db.host);
  const envHostOk = Boolean(env.host) && !validateSmtpHost(env.host);
  const effective = dbHostOk ? db : envHostOk ? env : { ...DEFAULT_SMTP, ...db, host: "" };
  const source: "database" | "env" | "none" = dbHostOk
    ? "database"
    : envHostOk
      ? "env"
      : "none";

  return {
    host: effective.host,
    port: effective.port,
    secure: effective.secure,
    user: effective.user,
    from: effective.from,
    hasPassword: Boolean(effective.pass),
    configured: isSmtpReady(effective) && source !== "none",
    source,
    /** 表单里展示的是库内值；未保存过时用 env 预填便于迁移 */
    form: {
      host: sanitizeHostForForm(db.host) || sanitizeHostForForm(env.host),
      port: db.port || env.port || 587,
      secure: dbHostOk ? db.secure : env.secure,
      user: db.user || env.user,
      from: db.from || env.from,
    },
  };
}

export async function saveSmtpConfig(input: {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  from: string;
  pass?: string;
  clearPassword?: boolean;
}) {
  const settings = await readSettings();
  const prev = normalizeSmtp(settings.smtp);
  let pass = prev.pass;
  if (input.clearPassword) pass = "";
  else if (typeof input.pass === "string" && input.pass.length > 0) pass = input.pass;

  const smtp = normalizeSmtp({
    host: input.host,
    port: input.port,
    secure: input.secure,
    user: input.user,
    from: input.from,
    pass,
  });

  await writeSettings({ ...settings, smtp });
  return smtp;
}
