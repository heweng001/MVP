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
  if (db.host) return db;
  return normalizeSmtp(envSmtp());
}

export function isSmtpReady(cfg: SmtpConfig) {
  if (!cfg.host.trim()) return false;
  if (/example\.com$/i.test(cfg.host)) return false;
  return true;
}

export async function getSmtpConfigForAdmin() {
  const settings = await readSettings();
  const db = normalizeSmtp(settings.smtp);
  const env = normalizeSmtp(envSmtp());
  const effective = db.host ? db : env;
  const source: "database" | "env" | "none" = db.host
    ? "database"
    : env.host
      ? "env"
      : "none";

  return {
    host: effective.host,
    port: effective.port,
    secure: effective.secure,
    user: effective.user,
    from: effective.from,
    hasPassword: Boolean(effective.pass),
    configured: isSmtpReady(effective),
    source,
    /** 表单里展示的是库内值；未保存过时用 env 预填便于迁移 */
    form: {
      host: db.host || env.host,
      port: db.port || env.port || 587,
      secure: db.host ? db.secure : env.secure,
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
