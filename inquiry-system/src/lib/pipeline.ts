import { randomBytes } from "crypto";
import { prisma } from "./prisma";
import { InquiryStatus, spamThreshold } from "./constants";
import { scoreSpam, reviewBandLow } from "./spam";
import { parseEmails, sendInquiryEmail } from "./email";

export type IngestBody = {
  site_key: string;
  form_id: string | number;
  entry_id: string | number;
  name?: string;
  email?: string;
  phone?: string;
  subject?: string;
  message?: string;
  page_url?: string;
  fields?: Record<string, unknown>;
};

function token() {
  return randomBytes(24).toString("hex");
}

async function isBlacklisted(siteId: string, email: string, message: string) {
  const domain = email.includes("@") ? email.split("@")[1].toLowerCase() : "";
  const entries = await prisma.blacklistEntry.findMany({
    where: {
      OR: [{ siteId: null }, { siteId }],
    },
  });
  const lowerMsg = message.toLowerCase();
  for (const e of entries) {
    const v = e.value.toLowerCase();
    if (e.type === "email" && email.toLowerCase() === v) return true;
    if (e.type === "domain" && domain && domain === v) return true;
    if (e.type === "url" && lowerMsg.includes(v)) return true;
  }
  return false;
}

async function resolveRecipients(siteId: string, formId: string) {
  const cfg = await prisma.formMailConfig.findUnique({
    where: { siteId_formId: { siteId, formId } },
  });
  if (cfg && cfg.enabled) return parseEmails(cfg.toEmails, cfg.ccEmails);

  // fallback: any enabled form config for site, or empty
  const any = await prisma.formMailConfig.findFirst({
    where: { siteId, enabled: true },
    orderBy: { createdAt: "asc" },
  });
  if (any) return parseEmails(any.toEmails, any.ccEmails);
  return { to: [] as string[], cc: [] as string[] };
}

export async function sendInquiryById(inquiryId: string, opts?: { degraded?: boolean; autoSentReview?: boolean }) {
  const inquiry = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    include: { site: true },
  });
  if (!inquiry) throw new Error("Inquiry not found");

  const recipients = await resolveRecipients(inquiry.siteId, inquiry.formId);
  const sent = await sendInquiryEmail({
    to: recipients.to,
    cc: recipients.cc,
    siteName: inquiry.site.domain,
    siteDomain: inquiry.site.domain,
    markToken: inquiry.markToken,
    name: inquiry.name,
    email: inquiry.email,
    phone: inquiry.phone,
    subject: inquiry.subject,
    message: inquiry.message,
    pageUrl: inquiry.pageUrl,
    formId: inquiry.formId,
    entryId: inquiry.entryId,
  });
  if (sent.skipped) {
    throw new Error("SMTP 未配置，无法发信（请在后台「发件设置」填写）");
  }

  return prisma.inquiry.update({
    where: { id: inquiryId },
    data: {
      status: InquiryStatus.PENDING,
      sentAt: new Date(),
      degraded: opts?.degraded ?? inquiry.degraded,
      autoSentReview: opts?.autoSentReview ?? inquiry.autoSentReview,
    },
  });
}

export async function ingestInquiry(body: IngestBody) {
  const siteKey = body.site_key?.trim();
  if (!siteKey) throw new Error("site_key required");

  const site = await prisma.site.findUnique({ where: { siteKey } });
  if (!site || !site.enabled) throw new Error("Invalid or disabled site_key");

  const formId = String(body.form_id ?? "");
  const entryId = String(body.entry_id ?? "");
  if (!formId || !entryId) throw new Error("form_id and entry_id required");

  const existing = await prisma.inquiry.findUnique({
    where: {
      siteId_formId_entryId: { siteId: site.id, formId, entryId },
    },
  });
  if (existing) {
    return { inquiry: existing, duplicated: true };
  }

  const name = String(body.name ?? "");
  const email = String(body.email ?? "");
  const phone = String(body.phone ?? "");
  const subject = String(body.subject ?? "");
  const message = String(body.message ?? "");
  const pageUrl = String(body.page_url ?? "");

  let spam;
  let degraded = false;
  try {
    const blacklisted = await isBlacklisted(site.id, email, message);
    spam = scoreSpam({
      name,
      email,
      phone,
      subject,
      message,
      pageUrl,
      productKeywords: site.productKeywords,
      spamExtraWords: site.spamExtraWords,
      blacklisted,
    });
  } catch (e) {
    console.error("[ingest] spam scoring failed, degrade", e);
    spam = { score: 0, hits: ["评分失败，已降级放行"] };
    degraded = true;
  }

  const threshold = spamThreshold();
  const midLow = reviewBandLow(threshold);

  let status: string = InquiryStatus.PENDING;
  let reviewEnteredAt: Date | null = null;

  if (!degraded && spam.score >= threshold) {
    status = InquiryStatus.AUTO_SPAM;
  } else if (!degraded && spam.score >= midLow) {
    status = InquiryStatus.REVIEW;
    reviewEnteredAt = new Date();
  } else {
    status = InquiryStatus.PENDING;
  }

  const inquiry = await prisma.inquiry.create({
    data: {
      siteId: site.id,
      formId,
      entryId,
      status,
      name,
      email,
      phone,
      subject,
      message,
      pageUrl,
      rawPayload: JSON.stringify(body.fields ?? body),
      spamScore: spam.score,
      spamHits: JSON.stringify(spam.hits),
      markToken: token(),
      reviewEnteredAt,
      degraded,
      submittedAt: new Date(),
    },
    include: { site: true },
  });

  if (status === InquiryStatus.PENDING) {
    try {
      await sendInquiryById(inquiry.id, { degraded });
    } catch (e) {
      console.error("[ingest] send failed, keep pending without sentAt", e);
      // Try degrade: still mark as needing attention
      await prisma.inquiry.update({
        where: { id: inquiry.id },
        data: { degraded: true, notes: `发信失败: ${String(e)}` },
      });
      // Retry once is enough for MVP; cron won't resend pending without sentAt - add note
      try {
        await sendInquiryById(inquiry.id, { degraded: true });
      } catch (e2) {
        console.error("[ingest] retry send failed", e2);
      }
    }
  }

  const fresh = await prisma.inquiry.findUniqueOrThrow({ where: { id: inquiry.id } });
  return { inquiry: fresh, duplicated: false };
}

export async function processReviewTimeouts() {
  const hours = Number(process.env.REVIEW_HOURS || 6);
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  const due = await prisma.inquiry.findMany({
    where: {
      status: InquiryStatus.REVIEW,
      reviewEnteredAt: { lte: cutoff },
    },
  });
  let sent = 0;
  for (const item of due) {
    try {
      await sendInquiryById(item.id, { autoSentReview: true });
      sent++;
    } catch (e) {
      console.error("[cron] review timeout send failed", item.id, e);
    }
  }
  return { processed: due.length, sent };
}

export async function processMarkTimeouts() {
  const hours = Number(process.env.MARK_HOURS || 72);
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  const result = await prisma.inquiry.updateMany({
    where: {
      status: InquiryStatus.PENDING,
      sentAt: { lte: cutoff, not: null },
    },
    data: { status: InquiryStatus.TIMEOUT_UNMARKED },
  });
  return { updated: result.count };
}
