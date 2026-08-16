import { randomBytes } from "crypto";
import { prisma } from "./prisma";
import { InquiryStatus } from "./constants";
import { parseEmails, sendInquiryEmail } from "./email";
import {
  buildFollowupMailContent,
  buildInquiryMailContent,
  redactBuyerEmails,
  resolveInquiryName,
} from "./inquiry-mail-fields";
import { mailContentGate } from "./mail-content-gate";
import { ensureInquiryAiForMail, runInquiryAiAnalysis } from "./inquiry-ai";

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
  entry_user_journey?: string;
  user_journey?: unknown;
  entry_geolocation?: string;
  location?: unknown;
};

function token() {
  return randomBytes(24).toString("hex");
}

export async function resolveRecipients(siteId: string, formId: string) {
  const cfg = await prisma.formMailConfig.findUnique({
    where: { siteId_formId: { siteId, formId } },
  });
  if (cfg && cfg.enabled) return parseEmails(cfg.toEmails, cfg.ccEmails);

  const any = await prisma.formMailConfig.findFirst({
    where: { siteId, enabled: true },
    orderBy: { createdAt: "asc" },
  });
  if (any) return parseEmails(any.toEmails, any.ccEmails);
  return { to: [] as string[], cc: [] as string[] };
}

export type SendInquiryOpts = {
  degraded?: boolean;
  autoSentReview?: boolean;
  /** 补发时自定义收件人 */
  to?: string[];
  cc?: string[];
  /** 审核通过等场景：设为 pending；普通补发不改状态 */
  setPending?: boolean;
  /** 强制重发第二封（忽略 followupSentAt） */
  force?: boolean;
};

async function buildSendPayload(
  inquiry: {
    markToken: string;
    name: string;
    email: string;
    phone: string;
    message: string;
    pageUrl: string;
    formId: string;
    entryId: string;
    rawPayload: string;
    aiSummaryZh?: string;
    aiMessageZh?: string;
    site: { domain: string; siteType: string; endDate: Date | string | null };
  },
  phase: "mark" | "followup",
  recipients: { to: string[]; cc: string[] },
) {
  const displayName = resolveInquiryName(inquiry.rawPayload, inquiry.name);
  const content =
    phase === "followup"
      ? buildFollowupMailContent({
          site: inquiry.site,
          rawPayload: inquiry.rawPayload,
          name: displayName,
          email: inquiry.email,
          phone: inquiry.phone,
          message: inquiry.message,
          pageUrl: inquiry.pageUrl,
        })
      : buildInquiryMailContent({
          site: inquiry.site,
          rawPayload: inquiry.rawPayload,
          name: displayName,
          email: inquiry.email,
          phone: inquiry.phone,
          message: inquiry.message,
          pageUrl: inquiry.pageUrl,
        });

  return {
    to: recipients.to,
    cc: recipients.cc,
    siteName: inquiry.site.domain,
    siteDomain: inquiry.site.domain,
    markToken: inquiry.markToken,
    name: displayName,
    email: inquiry.email,
    phone: inquiry.phone,
    message: content.message,
    messageHint: content.messageHint,
    doNotReplyHint: content.doNotReplyHint,
    unlockHint: content.unlockHint,
    pageUrl: inquiry.pageUrl,
    formId: inquiry.formId,
    entryId: inquiry.entryId,
    extraFields: content.extraAbove,
    belowFields: content.below,
    fileAttachments: content.attachments,
    replyToBuyer: content.replyToBuyer,
    includeMarkButtons: content.includeMarkButtons,
    phase,
    /** 仅第一封提醒邮件带 AI 摘要与中文译文；第二封不附；第一封脱敏邮箱 */
    aiQualityHint:
      phase === "mark"
        ? redactBuyerEmails((inquiry.aiSummaryZh || "").trim(), inquiry.email)
        : "",
    aiMessageZh:
      phase === "mark"
        ? redactBuyerEmails((inquiry.aiMessageZh || "").trim(), inquiry.email)
        : "",
  };
}

/** 第一封：标记邮件 */
export async function sendInquiryById(inquiryId: string, opts?: SendInquiryOpts) {
  await ensureInquiryAiForMail(inquiryId);

  const inquiry = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    include: { site: true },
  });
  if (!inquiry) throw new Error("Inquiry not found");

  const defaults = await resolveRecipients(inquiry.siteId, inquiry.formId);
  const recipients = {
    to: opts?.to?.length ? opts.to : defaults.to,
    cc: opts?.cc !== undefined ? opts.cc : defaults.cc,
  };

  const payload = await buildSendPayload(inquiry, "mark", recipients);
  const sent = await sendInquiryEmail(payload);
  if (sent.skipped) {
    throw new Error("SMTP 未配置，无法发信（请在后台「发件设置」填写）");
  }

  const data: {
    sentAt: Date;
    degraded?: boolean;
    autoSentReview?: boolean;
    status?: string;
  } = {
    sentAt: new Date(),
    degraded: opts?.degraded ?? inquiry.degraded,
    autoSentReview: opts?.autoSentReview ?? inquiry.autoSentReview,
  };
  if (opts?.setPending || inquiry.status === InquiryStatus.REVIEW) {
    data.status = InquiryStatus.PENDING;
  }

  return prisma.inquiry.update({
    where: { id: inquiryId },
    data,
  });
}

/** 第二封：可回复买家（服务期内；幂等除非 force） */
export async function sendInquiryFollowupById(inquiryId: string, opts?: SendInquiryOpts) {
  const inquiry = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    include: { site: true },
  });
  if (!inquiry) throw new Error("Inquiry not found");

  const gate = mailContentGate(inquiry.site);
  if (gate.expired) {
    throw new Error("网站已到期，不发送含买家邮箱的第二封邮件");
  }
  if (inquiry.followupSentAt && !opts?.force) {
    return inquiry;
  }

  const defaults = await resolveRecipients(inquiry.siteId, inquiry.formId);
  const recipients = {
    to: opts?.to?.length ? opts.to : defaults.to,
    cc: opts?.cc !== undefined ? opts.cc : defaults.cc,
  };

  const payload = await buildSendPayload(inquiry, "followup", recipients);
  const sent = await sendInquiryEmail(payload);
  if (sent.skipped) {
    throw new Error("SMTP 未配置，无法发信（请在后台「发件设置」填写）");
  }

  return prisma.inquiry.update({
    where: { id: inquiryId },
    data: { followupSentAt: new Date() },
  });
}

async function enrichInquiryPanelData(
  inquiryId: string,
  rawPayload: string | null,
  body: IngestBody,
) {
  const geo = String(body.entry_geolocation ?? "").trim();
  const journey = String(body.entry_user_journey ?? "").trim();
  const hasLocation = body.location != null && body.location !== "";
  const hasJourneyRaw = body.user_journey != null && body.user_journey !== "";
  if (!geo && !journey && !hasLocation && !hasJourneyRaw) {
    return null;
  }

  let payload: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(rawPayload || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      payload = parsed as Record<string, unknown>;
    }
  } catch {
    payload = {};
  }

  let changed = false;
  if (geo) {
    payload.entry_geolocation = geo;
    changed = true;
  }
  if (journey) {
    payload.entry_user_journey = journey;
    changed = true;
  }
  if (hasLocation) {
    payload.location = body.location;
    changed = true;
  }
  if (hasJourneyRaw) {
    payload.user_journey = body.user_journey;
    changed = true;
  }
  if (!changed) return null;

  return prisma.inquiry.update({
    where: { id: inquiryId },
    data: { rawPayload: JSON.stringify(payload) },
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
    const enriched = await enrichInquiryPanelData(existing.id, existing.rawPayload, body);
    return { inquiry: enriched ?? existing, duplicated: true };
  }

  const name = resolveInquiryName(
    JSON.stringify({ fields: body.fields ?? {} }),
    String(body.name ?? ""),
  );
  const email = String(body.email ?? "");
  const phone = String(body.phone ?? "");
  const subject = "";
  const message = String(body.message ?? "");
  const pageUrl = String(body.page_url ?? "");

  // 先入库为 pending；DeepSeek 判定后再分流（失败则放行发信）
  const inquiry = await prisma.inquiry.create({
    data: {
      siteId: site.id,
      formId,
      entryId,
      status: InquiryStatus.PENDING,
      name,
      email,
      phone,
      subject,
      message,
      pageUrl,
      rawPayload: JSON.stringify({
        fields: body.fields ?? {},
        entry_user_journey: body.entry_user_journey || "",
        entry_geolocation: body.entry_geolocation || "",
        location: body.location ?? null,
        user_journey: body.user_journey ?? null,
      }),
      spamScore: 0,
      spamHits: "[]",
      markToken: token(),
      reviewEnteredAt: null,
      degraded: false,
      submittedAt: new Date(),
    },
    include: { site: true },
  });

  const ai = await runInquiryAiAnalysis(inquiry.id, { timeoutMs: 12000 });
  const isAiSpam = ai?.isSpam === true;

  if (isAiSpam) {
    await prisma.inquiry.update({
      where: { id: inquiry.id },
      data: {
        status: InquiryStatus.AUTO_SPAM,
        spamHits: JSON.stringify(ai?.reasons?.length ? ai.reasons : ["DeepSeek 判定为垃圾"]),
      },
    });
  } else {
    // ham 或 AI 失败：直发（失败放行）
    const degraded = !ai;
    if (degraded) {
      await prisma.inquiry.update({
        where: { id: inquiry.id },
        data: {
          degraded: true,
          notes: "DeepSeek 判定失败，已降级放行发信",
        },
      });
    }
    try {
      await sendInquiryById(inquiry.id, { degraded });
    } catch (e) {
      console.error("[ingest] send failed, keep pending without sentAt", e);
      await prisma.inquiry.update({
        where: { id: inquiry.id },
        data: { degraded: true, notes: `发信失败: ${String(e)}` },
      });
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

/**
 * 兼容旧 cron：处理存量「待审核」——用 DeepSeek 重判后分流（不再无条件批量放行）。
 * 顺带把历史 timeout_unmarked 归一为 pending。
 */
export async function processReviewDailyFlush() {
  const legacy = await prisma.inquiry.updateMany({
    where: { status: InquiryStatus.TIMEOUT_UNMARKED },
    data: { status: InquiryStatus.PENDING },
  });

  const due = await prisma.inquiry.findMany({
    where: { status: InquiryStatus.REVIEW },
    orderBy: { reviewEnteredAt: "asc" },
  });
  let sent = 0;
  let spam = 0;
  const errors: string[] = [];
  for (const item of due) {
    try {
      const ai = await runInquiryAiAnalysis(item.id, { force: true, timeoutMs: 12000 });
      if (ai?.isSpam) {
        await prisma.inquiry.update({
          where: { id: item.id },
          data: {
            status: InquiryStatus.AUTO_SPAM,
            spamHits: JSON.stringify(ai.reasons?.length ? ai.reasons : ["DeepSeek 判定为垃圾"]),
          },
        });
        spam++;
        continue;
      }
      await sendInquiryById(item.id, { autoSentReview: true, setPending: true });
      sent++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[cron] legacy review migrate failed", item.id, e);
      errors.push(`${item.id}: ${msg}`);
    }
  }
  return {
    legacyTimeoutUnmarkedFixed: legacy.count,
    processed: due.length,
    sent,
    spam,
    errors,
  };
}
