import nodemailer from "nodemailer";
import { appUrl } from "./constants";

function smtpConfigured() {
  const host = (process.env.SMTP_HOST || "").trim();
  if (!host) return false;
  if (/example\.com$/i.test(host)) return false;
  return true;
}

function transporter() {
  if (!smtpConfigured()) return null;
  const host = process.env.SMTP_HOST as string;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS || "",
          }
        : undefined,
  });
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
  const transport = transporter();
  const markBase = `${appUrl()}/m/${payload.markToken}`;
  const validUrl = `${markBase}?a=valid`;
  const invalidUrl = `${markBase}?a=invalid`;

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
    <hr style="border:none;border-top:1px solid #ddd;margin:20px 0;" />
    <p><strong>请协助标记本封询盘（用于月度有效询盘统计）：</strong></p>
    <p>
      <a href="${validUrl}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:10px 16px;margin-right:10px;border-radius:4px;">有效询盘</a>
      <a href="${invalidUrl}" style="display:inline-block;background:#b45309;color:#fff;text-decoration:none;padding:10px 16px;border-radius:4px;">垃圾/无效</a>
    </p>
    <p style="color:#888;font-size:12px;">发信后 72 小时内可修改标记结果。</p>
  </div>`;

  const text = [
    `网站：${payload.siteName} (${payload.siteDomain})`,
    `姓名：${payload.name}`,
    `邮箱：${payload.email}`,
    `电话：${payload.phone}`,
    `主题：${payload.subject}`,
    `内容：${payload.message}`,
    `来源：${payload.pageUrl}`,
    "",
    "请协助标记本封询盘：",
    `有效询盘：${validUrl}`,
    `垃圾/无效：${invalidUrl}`,
  ].join("\n");

  if (!transport) {
    console.warn("[email] SMTP not configured; skipping send (dev mode)");
    console.info("[email] valid:", validUrl, "invalid:", invalidUrl);
    return { ok: true as const, skipped: true };
  }

  if (!payload.to.length) {
    throw new Error("No recipient configured for this form");
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM || "noreply@example.com",
    to: payload.to.join(", "),
    cc: payload.cc?.length ? payload.cc.join(", ") : undefined,
    replyTo: payload.email || undefined,
    subject: `[询盘] ${payload.siteName} - ${payload.subject || payload.name || payload.email || "新询盘"}`,
    text,
    html,
  });

  return { ok: true as const, skipped: false };
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
