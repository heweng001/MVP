import { promises as dns } from "dns";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { appUrl } from "./constants";
import { getSmtpConfig, isSmtpReady, type SmtpConfig } from "./settings";

async function resolveIpv4Host(hostname: string) {
  // nodemailer 会在 A/AAAA 间随机选址；机器有 IPv6 网卡但无路由时会 ENETUNREACH
  const { address } = await dns.lookup(hostname, { family: 4 });
  return address;
}

/** 避免 587+SSL / 465+明文 这类组合触发 wrong version number */
function normalizeTlsMode(cfg: SmtpConfig) {
  const port = cfg.port || 587;
  if (port === 465) {
    return { port, secure: true, requireTLS: false };
  }
  if (port === 587 || port === 25) {
    return { port, secure: false, requireTLS: true };
  }
  return { port, secure: cfg.secure, requireTLS: !cfg.secure };
}

async function transporterFrom(cfg: SmtpConfig) {
  if (!isSmtpReady(cfg)) return null;
  let host = cfg.host;
  try {
    host = await resolveIpv4Host(cfg.host);
  } catch (e) {
    console.error("[email] IPv4 DNS lookup failed for", cfg.host, e);
    throw new Error(`无法解析 SMTP 主机的 IPv4 地址：${cfg.host}`);
  }
  const mode = normalizeTlsMode(cfg);
  const options = {
    host,
    port: mode.port,
    secure: mode.secure,
    // 用 IP 连接时保留原主机名给 TLS/SNI
    servername: cfg.host,
    requireTLS: mode.requireTLS,
    tls: { servername: cfg.host },
    auth: cfg.user
      ? {
          user: cfg.user,
          pass: cfg.pass || "",
        }
      : undefined,
  } as SMTPTransport.Options;
  return nodemailer.createTransport(options);
}

export type InquiryMailPayload = {
  to: string[];
  cc?: string[];
  siteName: string;
  siteDomain: string;
  markToken: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  pageUrl: string;
  formId: string;
  entryId: string;
  /** WPForms Hidden Field（逐字段；国家简称已转中文） */
  hiddenFields?: { label: string; value: string }[];
};

function parseList(s: string) {
  return s
    .split(/[,;，；\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function parseEmails(toEmails: string, ccEmails = "") {
  return {
    to: parseList(toEmails),
    cc: parseList(ccEmails),
  };
}

export async function sendInquiryEmail(payload: InquiryMailPayload) {
  const cfg = await getSmtpConfig();
  const transport = await transporterFrom(cfg);
  const markBase = `${appUrl()}/m/${payload.markToken}`;
  const validUrl = `${markBase}?a=valid`;
  const invalidUrl = `${markBase}?a=invalid`;

  const hidden = payload.hiddenFields || [];
  const hiddenRowsHtml = hidden
    .map(
      (f) =>
        `<tr><td style="padding:6px 8px;color:#666;width:120px;vertical-align:top;border:1px solid #e2e8f0;">${escapeHtml(f.label)}</td><td style="padding:6px 8px;vertical-align:top;border:1px solid #e2e8f0;">${nl2br(escapeHtml(f.value))}</td></tr>`,
    )
    .join("");
  const hiddenBlockHtml = hidden.length
    ? `
    <div style="margin-top:16px;">
      <p style="margin:0 0 8px;"><strong>隐藏字段（WPForms Hidden）</strong></p>
      <table style="border-collapse:collapse;width:100%;max-width:640px;font-size:13px;">
        ${hiddenRowsHtml}
      </table>
    </div>`
    : "";
  const hiddenRowsText = hidden.length
    ? ["", "隐藏字段（WPForms Hidden）：", ...hidden.map((f) => `${f.label}：${f.value}`)].join("\n")
    : "";

  const html = `
  <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#222;">
    <p>您有一封来自网站 <strong>${escapeHtml(payload.siteName)}</strong>（${escapeHtml(payload.siteDomain)}）的询盘。</p>
    <table style="border-collapse:collapse;width:100%;max-width:640px;">
      <tr><td style="padding:6px 0;color:#666;width:90px;">姓名</td><td>${escapeHtml(payload.name)}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">邮箱</td><td>${escapeHtml(payload.email)}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">电话</td><td>${escapeHtml(payload.phone)}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">主题</td><td>${escapeHtml(payload.subject)}</td></tr>
      <tr><td style="padding:6px 0;color:#666;vertical-align:top;">内容</td><td>${nl2br(escapeHtml(payload.message))}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">来源页</td><td>${escapeHtml(payload.pageUrl)}</td></tr>
    </table>
    ${hiddenBlockHtml}
    <hr style="border:none;border-top:1px solid #ddd;margin:20px 0;" />
    <p><strong>请协助标记本封询盘（用于月度有效询盘统计）：</strong></p>
    <p>
      <a href="${validUrl}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:10px 16px;margin-right:10px;border-radius:4px;">有效询盘</a>
      <a href="${invalidUrl}" style="display:inline-block;background:#b45309;color:#fff;text-decoration:none;padding:10px 16px;border-radius:4px;">垃圾/无效</a>
    </p>
    <p style="color:#888;font-size:12px;">点击按钮将立即完成标记；发信后 72 小时内可返回页面修改。</p>
  </div>`;

  const text = [
    `网站：${payload.siteName} (${payload.siteDomain})`,
    `姓名：${payload.name}`,
    `邮箱：${payload.email}`,
    `电话：${payload.phone}`,
    `主题：${payload.subject}`,
    `内容：${payload.message}`,
    `来源：${payload.pageUrl}`,
    ...(hiddenRowsText ? [hiddenRowsText] : []),
    "",
    "请协助标记本封询盘（点击链接即完成标记）：",
    `有效询盘：${validUrl}`,
    `垃圾/无效：${invalidUrl}`,
  ].join("\n");

  if (!transport) {
    console.warn("[email] SMTP not configured; skipping send");
    console.info("[email] valid:", validUrl, "invalid:", invalidUrl);
    return { ok: true as const, skipped: true };
  }

  if (!payload.to.length) {
    throw new Error("No recipient configured for this form");
  }

  await transport.sendMail({
    from: cfg.from || cfg.user || "noreply@example.com",
    to: payload.to.join(", "),
    cc: payload.cc?.length ? payload.cc.join(", ") : undefined,
    replyTo: payload.email || undefined,
    subject: `[询盘] ${payload.siteName} - ${payload.subject || payload.name || payload.email || "新询盘"}`,
    text,
    html,
  });

  return { ok: true as const, skipped: false };
}

export async function sendTestEmail(to: string) {
  const cfg = await getSmtpConfig();
  const transport = await transporterFrom(cfg);
  if (!transport) {
    throw new Error("请先保存有效的 SMTP 主机等配置");
  }
  const dest = to.trim();
  if (!dest || !dest.includes("@")) {
    throw new Error("请填写有效的测试收件邮箱");
  }
  await transport.sendMail({
    from: cfg.from || cfg.user || "noreply@example.com",
    to: dest,
    subject: "【询盘系统】发件测试",
    text: "这是一封测试邮件。若能收到，说明发件邮箱配置正确。",
    html: "<p>这是一封测试邮件。若能收到，说明发件邮箱配置正确。</p>",
  });
  return { ok: true as const };
}

export async function sendPromoEditLink(opts: {
  to: string;
  clientName: string;
  editUrl: string;
  expiresAt: Date;
}) {
  const cfg = await getSmtpConfig();
  const transport = await transporterFrom(cfg);
  if (!transport) {
    throw new Error("请先在「发件设置」配置 SMTP");
  }
  const dest = opts.to.trim();
  if (!dest || !dest.includes("@")) {
    throw new Error("请填写有效的收件邮箱");
  }
  const exp = opts.expiresAt.toLocaleString("zh-CN", { hour12: false });
  const subject = `【信息核对】请填写/更新「${opts.clientName}」的核对内容`;
  const text = [
    `您好，请通过以下链接填写或更新「${opts.clientName}」的信息核对：`,
    opts.editUrl,
    "",
    `链接有效期至：${exp}（7 天内）。提交时请填写您的姓名。`,
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#222;">
      <p>您好，请通过以下链接填写或更新「<strong>${escapeHtml(opts.clientName)}</strong>」的信息核对：</p>
      <p><a href="${escapeHtml(opts.editUrl)}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:10px 16px;border-radius:4px;">打开编辑页</a></p>
      <p style="color:#666;font-size:12px;">或复制链接：${escapeHtml(opts.editUrl)}</p>
      <p style="color:#888;font-size:12px;">链接有效期至 ${escapeHtml(exp)}（7 天内）。提交时请填写您的姓名。</p>
    </div>`;
  await transport.sendMail({
    from: cfg.from || cfg.user || "noreply@example.com",
    to: dest,
    subject,
    text,
    html,
  });
  return { ok: true as const };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nl2br(s: string) {
  return s.replace(/\n/g, "<br/>");
}
