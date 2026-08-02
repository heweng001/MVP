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
  message: string;
  pageUrl: string;
  formId: string;
  entryId: string;
  /** WPForms Hidden；可含 page_url / entry_geolocation / entry_user_journey */
  hiddenFields?: { label: string; value: string; html?: boolean; hint?: boolean }[];
  /** 询盘正文被门控为提示文案（如网站到期） */
  messageHint?: boolean;
  /** SEO 未到期：引导标记有效后查看详细信息 */
  unlockHint?: string;
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
    .map((f) => {
      const body = f.hint
        ? hintHtml(f.value)
        : f.html
          ? sanitizeJourneyHtml(f.value)
          : nl2br(escapeHtml(f.value));
      return `<tr><td style="padding:6px 8px;color:#666;width:150px;vertical-align:top;border:1px solid #e2e8f0;">${escapeHtml(f.label)}</td><td style="padding:6px 8px;vertical-align:top;border:1px solid #e2e8f0;">${body}</td></tr>`;
    })
    .join("");
  const hiddenBlockHtml = hidden.length
    ? `
    <div style="margin-top:12px;">
      <p style="margin:0 0 8px;"><strong>隐藏字段 / Hidden fields</strong></p>
      <table style="border-collapse:collapse;width:100%;max-width:640px;font-size:13px;">
        ${hiddenRowsHtml}
      </table>
    </div>`
    : "";
  const hiddenRowsText = hidden.length
    ? ["", "隐藏字段 / Hidden fields：", ...hidden.map((f) => `${f.label}：\n${f.html && !f.hint ? stripHtml(f.value) : f.value}`)].join(
        "\n",
      )
    : "";

  const messageHtml = payload.messageHint
    ? hintHtml(payload.message)
    : nl2br(escapeHtml(payload.message));

  const belowPartsHtml = [
    hiddenBlockHtml,
    payload.unlockHint
      ? `<div style="margin-top:14px;">${hintHtml(payload.unlockHint)}</div>`
      : "",
    `<div style="margin-top:16px;">
      <p><strong>请协助标记本封询盘（用于月度有效询盘统计）：</strong></p>
      <p>
        <a href="${validUrl}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:10px 16px;margin-right:10px;border-radius:4px;">有效询盘</a>
        <a href="${invalidUrl}" style="display:inline-block;background:#b45309;color:#fff;text-decoration:none;padding:10px 16px;border-radius:4px;">无效</a>
      </p>
      <p style="color:#888;font-size:12px;">点击按钮将立即完成标记。已标记为有效不可再改为无效；发信超过 72 小时后不可再标无效，仍可标有效；无效询盘可改为有效。</p>
    </div>`,
  ]
    .filter(Boolean)
    .join("");

  const replyNoticeHtml = `
    <p style="margin:18px 0 8px;padding:10px 12px;background:#fff7ed;border:1px solid #fdba74;border-radius:6px;color:#9a3412;font-size:13px;line-height:1.5;">
      <strong>回复前提示：</strong>若需回复询盘人，请务必先删除下方分割线及分割线以下的全部内容后再发送，避免对方看到内部标记与隐藏信息。
    </p>
    <div style="margin:12px 0 16px;border:none;border-top:2px dashed #94a3b8;padding-top:4px;color:#64748b;font-size:12px;text-align:center;">
      ——— 请删除本分割线及以下全部内容 / Delete this line and everything below before replying ———
    </div>`;

  const html = `
  <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#222;">
    <p>您有一封来自网站 <strong>${escapeHtml(payload.siteName)}</strong>（${escapeHtml(payload.siteDomain)}）的询盘。</p>
    <table style="border-collapse:collapse;width:100%;max-width:640px;">
      <tr><td style="padding:6px 0;color:#666;width:110px;">Name</td><td>${escapeHtml(payload.name)}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">Email</td><td>${escapeHtml(payload.email)}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">Phone/WhatsApp</td><td>${escapeHtml(payload.phone)}</td></tr>
      <tr><td style="padding:6px 0;color:#666;vertical-align:top;">Message</td><td>${messageHtml}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">Page URL</td><td>${escapeHtml(payload.pageUrl)}</td></tr>
    </table>
    ${replyNoticeHtml}
    ${belowPartsHtml}
  </div>`;

  const text = [
    `网站：${payload.siteName} (${payload.siteDomain})`,
    `Name：${payload.name}`,
    `Email：${payload.email}`,
    `Phone/WhatsApp：${payload.phone}`,
    `Message：${payload.message}`,
    `Page URL：${payload.pageUrl}`,
    "",
    "回复前提示：若需回复询盘人，请务必先删除下方分割线及分割线以下的全部内容后再发送，避免对方看到内部标记与隐藏信息。",
    "——— 请删除本分割线及以下全部内容 / Delete this line and everything below before replying ———",
    ...(hiddenRowsText ? [hiddenRowsText] : []),
    ...(payload.unlockHint ? ["", payload.unlockHint] : []),
    "",
    "请协助标记本封询盘（点击链接即完成标记）：",
    `有效询盘：${validUrl}`,
    `无效：${invalidUrl}`,
    "",
    "已标记为有效不可再改为无效；发信超过 72 小时后不可再标无效，仍可标有效；无效询盘可改为有效。",
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
    subject: `[询盘] ${payload.siteName} - ${payload.name || payload.email || "新询盘"}`,
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

function hintHtml(s: string) {
  return `<span style="display:inline-block;padding:8px 10px;background:#fff7ed;border:1px solid #fdba74;border-radius:4px;color:#9a3412;font-size:13px;line-height:1.5;">${escapeHtml(s)}</span>`;
}

/** 仅保留旅程表格常用标签 */
function sanitizeJourneyHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "");
}

function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}
