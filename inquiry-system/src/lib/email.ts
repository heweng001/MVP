import { promises as dns } from "dns";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { appUrl } from "./constants";
import { getSmtpConfig, isSmtpReady, type SmtpConfig } from "./settings";
import type { MailFieldRow, MailFileAttachment } from "./inquiry-mail-fields";

async function resolveIpv4Host(hostname: string) {
  const { address } = await dns.lookup(hostname, { family: 4 });
  return address;
}

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
  extraFields?: MailFieldRow[];
  belowFields?: MailFieldRow[];
  messageHint?: boolean;
  /** 第一封请勿回复提示 */
  doNotReplyHint?: string;
  unlockHint?: string;
  fileAttachments?: MailFileAttachment[];
  /** 是否 Reply-To 买家邮箱；默认 false */
  replyToBuyer?: boolean;
  /** 是否包含有效/无效标记按钮；默认 true */
  includeMarkButtons?: boolean;
  /** 邮件主题后缀区分 */
  phase?: "mark" | "followup";
  /** DeepSeek 询盘质量一句摘要（仅第一封；空则不展示） */
  aiQualityHint?: string;
  /** DeepSeek 询盘正文中文译文（仅第一封；空则不展示） */
  aiMessageZh?: string;
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

function renderFieldRowsHtml(rows: MailFieldRow[]) {
  return rows
    .map((f) => {
      const body = f.hint
        ? hintHtml(f.value)
        : f.html
          ? sanitizeJourneyHtml(f.value)
          : nl2br(escapeHtml(f.value));
      // 上下布局：标签在上、内容在下（移动端更易读；邮件客户端用 table 更稳）
      return `<tr>
  <td style="padding:12px 0 2px;font-size:12px;line-height:1.4;color:#64748b;font-weight:600;">${escapeHtml(f.label)}</td>
</tr>
<tr>
  <td style="padding:0 0 12px;font-size:15px;line-height:1.55;color:#0f172a;word-break:break-word;border-bottom:1px solid #e2e8f0;">${body}</td>
</tr>`;
    })
    .join("");
}

function renderFieldRowsText(rows: MailFieldRow[]) {
  return rows.map((f) => `${f.label}：\n${f.html && !f.hint ? stripHtml(f.value) : f.value}`);
}

const MAX_ATTACH_BYTES = 8 * 1024 * 1024;
const MAX_ATTACH_COUNT = 8;

async function fetchAttachments(files: MailFileAttachment[]) {
  const out: { filename: string; content: Buffer }[] = [];
  const notes: string[] = [];
  for (const file of files.slice(0, MAX_ATTACH_COUNT)) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(file.url, { signal: ctrl.signal, redirect: "follow" });
      clearTimeout(timer);
      if (!res.ok) {
        notes.push(`${file.filename}（HTTP ${res.status}）`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_ATTACH_BYTES) {
        notes.push(`${file.filename}（超过 8MB）`);
        continue;
      }
      out.push({ filename: file.filename, content: buf });
    } catch (e) {
      notes.push(`${file.filename}（${e instanceof Error ? e.message : "下载失败"}）`);
    }
  }
  return { attachments: out, notes };
}

export async function sendInquiryEmail(payload: InquiryMailPayload) {
  const cfg = await getSmtpConfig();
  const transport = await transporterFrom(cfg);
  const markBase = `${appUrl()}/m/${payload.markToken}`;
  const validUrl = `${markBase}?a=valid`;
  const invalidUrl = `${markBase}?a=invalid`;
  const includeMark = payload.includeMarkButtons !== false;
  const phase = payload.phase || "mark";

  const extra = payload.extraFields || [];
  const below = payload.belowFields || [];
  const files = payload.fileAttachments || [];

  const extraRowsHtml = renderFieldRowsHtml(extra);
  const belowRowsHtml = below.length
    ? `
    <div style="margin-top:20px;">
      <table role="presentation" style="border-collapse:collapse;width:100%;max-width:640px;">
        ${renderFieldRowsHtml(below)}
      </table>
    </div>`
    : "";

  const doNotReplyHtml = payload.doNotReplyHint
    ? `<div style="margin:12px 0 16px;">${hintHtml(payload.doNotReplyHint)}</div>`
    : "";

  const aiHint = (payload.aiQualityHint || "").trim();
  const aiZh = (payload.aiMessageZh || "").trim();
  const aiParts: string[] = [];
  if (aiHint) {
    aiParts.push(
      `<p style="margin:0 0 6px;font-size:13px;color:#334155;"><strong>AI 参考（DeepSeek）</strong>：${escapeHtml(aiHint)}</p>`,
    );
  }
  if (aiZh) {
    aiParts.push(
      `<p style="margin:${aiHint ? "10px" : "0"} 0 4px;font-size:12px;color:#64748b;"><strong>中文译文（DeepSeek）</strong></p>`,
      `<p style="margin:0;font-size:13px;color:#334155;white-space:pre-wrap;line-height:1.55;">${escapeHtml(aiZh)}</p>`,
    );
  }
  if (aiHint || aiZh) {
    aiParts.push(
      `<p style="margin:10px 0 0;color:#94a3b8;font-size:12px;line-height:1.5;">以上由 DeepSeek 自动生成，仅供参考；请以贵司业务判断为准${includeMark ? "，并使用下方按钮标记有效/无效" : ""}。</p>`,
    );
  }
  const aiBlockHtml = aiParts.length
    ? `
    <div style="margin-top:16px;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;">
      ${aiParts.join("\n      ")}
    </div>`
    : "";

  const markBlockHtml = includeMark
    ? `
    <div style="margin-top:16px;">
      <p style="margin:0 0 10px;"><strong>请配合标记本封询盘，有利于我们提升询盘质量</strong></p>
      <table role="presentation" style="border-collapse:collapse;width:100%;max-width:640px;">
        <tr>
          <td style="padding:0 0 8px;">
            <a href="${validUrl}" style="display:block;width:100%;box-sizing:border-box;text-align:center;background:#0f766e;color:#fff;text-decoration:none;padding:12px 16px;border-radius:6px;font-size:15px;">标为有效</a>
          </td>
        </tr>
        <tr>
          <td style="padding:0;">
            <a href="${invalidUrl}" style="display:block;width:100%;box-sizing:border-box;text-align:center;background:#b45309;color:#fff;text-decoration:none;padding:12px 16px;border-radius:6px;font-size:15px;">标为无效</a>
          </td>
        </tr>
      </table>
      <p style="color:#888;font-size:12px;margin:10px 0 0;">点击按钮将立即完成标记。发信超过 72 小时后不可再标无效，请及时标记</p>
    </div>`
    : "";

  const separatorHtml =
    below.length || includeMark
      ? `<div style="margin:20px 0 16px;border:none;border-top:2px dashed #94a3b8;"></div>`
      : "";

  const { attachments, notes: attachNotes } = files.length
    ? await fetchAttachments(files)
    : { attachments: [], notes: [] as string[] };

  const attachNoteHtml = attachNotes.length
    ? `<p style="margin-top:12px;color:#b45309;font-size:12px;">部分附件未能加入邮件：${escapeHtml(attachNotes.join("；"))}</p>`
    : "";

  const fieldsTableHtml = extra.length
    ? `<table role="presentation" style="border-collapse:collapse;width:100%;max-width:640px;">${extraRowsHtml}</table>`
    : `<p style="color:#888;">（本封询盘暂无可见字段）</p>`;

  const html = `
  <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#222;max-width:640px;margin:0 auto;">
    ${doNotReplyHtml}
    ${fieldsTableHtml}
    ${attachNoteHtml}
    ${separatorHtml}
    ${aiBlockHtml}
    ${markBlockHtml}
    ${belowRowsHtml}
  </div>`;

  const textParts = [
    ...(payload.doNotReplyHint ? [payload.doNotReplyHint, ""] : []),
    ...renderFieldRowsText(extra),
    ...(attachNotes.length ? ["", `部分附件未能加入邮件：${attachNotes.join("；")}`] : []),
  ];
  if (aiHint || aiZh) {
    textParts.push("");
    if (aiHint) textParts.push(`AI 参考（DeepSeek）：${aiHint}`);
    if (aiZh) {
      textParts.push("中文译文（DeepSeek）：");
      textParts.push(aiZh);
    }
    textParts.push(
      `以上由 DeepSeek 自动生成，仅供参考；请以贵司业务判断为准${includeMark ? "，并使用下方按钮标记有效/无效" : ""}。`,
    );
  }
  if (includeMark) {
    textParts.push(
      "",
      "请配合标记本封询盘，有利于我们提升询盘质量",
      `标为有效：${validUrl}`,
      `标为无效：${invalidUrl}`,
      "",
      "点击按钮将立即完成标记。发信超过 72 小时后不可再标无效，请及时标记",
    );
  }
  if (below.length) {
    textParts.push("", ...renderFieldRowsText(below));
  }
  const text = textParts.join("\n");

  if (!transport) {
    console.warn("[email] SMTP not configured; skipping send");
    console.info("[email] valid:", validUrl, "invalid:", invalidUrl);
    return { ok: true as const, skipped: true };
  }

  if (!payload.to.length) {
    throw new Error("No recipient configured for this form");
  }

  const fromAddr = cfg.from || cfg.user || "noreply@example.com";
  const subject =
    phase === "followup"
      ? `Inquiry from ${payload.siteName} - ${payload.name || payload.email || "新询盘"}`
      : `[询盘提醒] ${payload.siteName} - ${payload.name || payload.email || "新询盘"}`;
  await transport.sendMail({
    from: fromAddr,
    to: payload.to.join(", "),
    cc: payload.cc?.length ? payload.cc.join(", ") : undefined,
    replyTo: payload.replyToBuyer ? payload.email || undefined : undefined,
    subject,
    text,
    html,
    attachments: attachments.length ? attachments : undefined,
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
  /** 邮件主题/正文中的展示名（标题或网站域名） */
  subjectLabel: string;
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
  const label = opts.subjectLabel.trim() || "信息核对";
  const exp = opts.expiresAt.toLocaleString("zh-CN", { hour12: false });
  const subject = `【信息核对】请填写/更新「${label}」的核对内容`;
  const text = [
    `您好，请通过以下链接填写或更新「${label}」的信息核对：`,
    opts.editUrl,
    "",
    `链接有效期至：${exp}（7 天内）。提交时请填写您的姓名。`,
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#222;">
      <p>您好，请通过以下链接填写或更新「<strong>${escapeHtml(label)}</strong>」的信息核对：</p>
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
  return String(s)
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

function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function sanitizeJourneyHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "");
}
