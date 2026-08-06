import { localizeCountryCodes } from "./countries";
import { formatGeolocationZh } from "./places";
import {
  extractHiddenFields,
  parseWpFormFields,
  type WpFormFieldRow,
} from "./wp-fields";
import { MAIL_TIPS, mailContentGate } from "./mail-content-gate";
import { formatUserJourneyHtml } from "./user-journey";

export type MailFieldRow = {
  id: string;
  label: string;
  value: string;
  html?: boolean;
  hint?: boolean;
};

export type MailFileAttachment = {
  filename: string;
  url: string;
};

function parseRaw(rawPayload: string | null | undefined): Record<string, unknown> | null {
  if (!rawPayload) return null;
  try {
    const data = JSON.parse(rawPayload);
    if (data && typeof data === "object" && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function extractUrls(value: string): string[] {
  const matches = value.match(/https?:\/\/[^\s"'<>]+/gi) || [];
  return [...new Set(matches.map((u) => u.replace(/[),.;]+$/, "")))];
}

function filenameFromUrl(url: string, index: number) {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop() || "";
    const decoded = decodeURIComponent(last);
    if (decoded && /\.[a-z0-9]{2,8}$/i.test(decoded)) return decoded.slice(0, 180);
  } catch {
    /* ignore */
  }
  return `attachment-${index + 1}`;
}

function isFileField(f: WpFormFieldRow) {
  const t = f.type.toLowerCase();
  return t === "file" || t === "upload" || t === "file-upload" || t === "media";
}

function normFieldKey(label: string) {
  return label.toLowerCase().replace(/[{}\s_\-.:：()（）\[\]{}]/g, "");
}

function labelLooksLikeCompany(label: string) {
  const n = normFieldKey(label);
  return /company|organization|organisation|business|corp|firm|公司|企业|单位|机构/.test(n);
}

function labelLooksLikeName(label: string) {
  const n = normFieldKey(label);
  if (!n || labelLooksLikeCompany(label)) return false;
  return /^(name|fullname|fullname|yourname|contactname|firstname|lastname|姓名|名字|联系人)$|(^|[^a-z])name([^a-z]|$)|姓名|名字|联系人/.test(
    n,
  );
}

function labelLooksLikeMessage(label: string) {
  const n = normFieldKey(label);
  return /^(message|messages|comment|comments|enquiry|inquiry|content|留言|内容|正文|备注|询盘内容)$|留言|message|comment|enquiry|inquiry/.test(
    n,
  );
}

/** 页面链接类字段标签（规范化后，无空格下划线） */
function isPageUrlLabelKey(n: string) {
  if (!n) return false;
  if (/国家|geo|journey|地理|路径/.test(n)) return false;
  return /^(pageurl|inquiryurl|inquirypage|sourceurl|sourcepage|formurl|referrerurl|refererurl|提交页面|来源页|来源页面|页面链接|询盘页面|询盘链接|发询盘页面|买家发询盘页面)$|pageurl|inquiryurl|inquirypage|sourceurl|买家发询盘页面|询盘页面|发询盘页面|来源页|页面链接|询盘链接/.test(
    n,
  );
}

function isPageUrlField(f: WpFormFieldRow, pageUrl: string) {
  if (isPageUrlLabelKey(normFieldKey(f.label))) return true;
  if (pageUrl && f.value.trim() === pageUrl.trim()) return true;
  return false;
}

/**
 * 从 rawPayload 纠正 Name：优先 WPForms name 类型，其次姓名类标签；排除 Company
 * （兼容插件旧版把 Company 误写入 name 的数据）
 */
export function resolveInquiryName(
  rawPayload: string | null | undefined,
  storedName = "",
): string {
  const all = parseWpFormFields(rawPayload);
  for (const f of all) {
    if (f.type === "name" && f.value.trim()) return f.value.trim();
  }
  for (const f of all) {
    if (f.type !== "text" && f.type !== "") continue;
    if (!labelLooksLikeName(f.label)) continue;
    if (f.value.trim()) return f.value.trim();
  }
  return String(storedName || "").trim();
}

function classifyBuiltin(f: MailFieldRow): "geo" | "journey" | "page_url" | "other" {
  if (f.id === "smart-entry_geolocation" || f.id === "geo") return "geo";
  if (f.id === "smart-entry_user_journey" || f.id === "journey") return "journey";
  if (f.id === "smart-page_url" || f.id === "page_url") return "page_url";
  const n = f.label.toLowerCase().replace(/[{}\s_\-()/（）]/g, "");
  if (/entryuserjourney|userjourney|用户路径|用户旅程|买家浏览路径|浏览路径/.test(n)) {
    return "journey";
  }
  if (/entrygeolocation|geolocation|地理位置|买家的地理位置/.test(n)) return "geo";
  if (isPageUrlLabelKey(n)) return "page_url";
  return "other";
}

function pushGeoJourney(
  row: MailFieldRow,
  above: MailFieldRow[],
  below: MailFieldRow[],
) {
  const kind = classifyBuiltin(row);
  if (kind === "geo" || kind === "journey") below.push(row);
  else above.push(row);
}

function isEmailFieldRow(f: MailFieldRow, storedEmail: string) {
  const n = normFieldKey(f.label);
  if (/公司邮箱|enterpriseemail|companyemail/.test(n)) return false;
  if (f.id === "email" || f.id === "smart-email") return true;
  if (/^(email|e-mail|mail|邮箱|邮件|电子邮件|youremail|yourmail|buyeremail)$|邮箱|电子邮件/.test(n)) {
    return true;
  }
  const email = storedEmail.trim().toLowerCase();
  if (email && f.value.trim().toLowerCase() === email) return true;
  return false;
}

/** 到期站：留言类字段替换为续费提示 */
export function applyExpiredMessageGate(fields: MailFieldRow[], storedMessage: string): MailFieldRow[] {
  const msg = storedMessage.trim();
  let hit = false;
  const next = fields.map((f) => {
    if (classifyBuiltin(f) === "geo" || classifyBuiltin(f) === "journey") return f;
    const byLabel = labelLooksLikeMessage(f.label);
    const byValue = Boolean(msg && f.value.trim() === msg);
    if (!byLabel && !byValue) return f;
    hit = true;
    return {
      ...f,
      value: MAIL_TIPS.expiredMessage,
      html: false,
      hint: true,
    };
  });
  if (!hit && msg) {
    next.unshift({
      id: "message",
      label: "Message",
      value: MAIL_TIPS.expiredMessage,
      html: false,
      hint: true,
    });
  }
  return next;
}

/** 固定分区：仅 geo/journey 在下方，其余非空字段在上方 */
export function collectInquiryFieldParts(opts: {
  rawPayload: string | null | undefined;
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  pageUrl?: string;
}) {
  const pageUrl = (opts.pageUrl || "").trim();
  const root = parseRaw(opts.rawPayload);
  const all = parseWpFormFields(opts.rawPayload);
  const panel = extractHiddenFields(opts.rawPayload);

  const attachments: MailFileAttachment[] = [];
  const above: MailFieldRow[] = [];
  const belowRaw: MailFieldRow[] = [];
  const used = new Set<string>();

  let fileIndex = 0;
  for (const f of all) {
    if (!isFileField(f)) continue;
    used.add(f.id);
    for (const url of extractUrls(f.value)) {
      attachments.push({
        filename: filenameFromUrl(url, fileIndex++),
        url,
      });
    }
  }

  const geoRow = panel.find((p) => p.id === "smart-entry_geolocation");
  const journeyRow = panel.find((p) => p.id === "smart-entry_user_journey");
  if (geoRow?.value) {
    pushGeoJourney(
      { id: "geo", label: geoRow.label, value: geoRow.value, html: geoRow.html },
      above,
      belowRaw,
    );
    used.add("geo");
    used.add(geoRow.id);
  } else if (root?.entry_geolocation) {
    pushGeoJourney(
      {
        id: "geo",
        label: "买家的地理位置",
        value: formatGeolocationZh(String(root.entry_geolocation)),
      },
      above,
      belowRaw,
    );
    used.add("geo");
  }

  if (journeyRow?.value) {
    pushGeoJourney(
      {
        id: "journey",
        label: journeyRow.label,
        value: journeyRow.value,
        html: journeyRow.html,
      },
      above,
      belowRaw,
    );
    used.add("journey");
    used.add(journeyRow.id);
  } else if (root?.user_journey != null && root.user_journey !== "") {
    const journeyHtml = formatUserJourneyHtml(root.user_journey);
    if (journeyHtml) {
      pushGeoJourney(
        {
          id: "journey",
          label: "买家浏览路径",
          value: journeyHtml,
          html: true,
        },
        above,
        belowRaw,
      );
      used.add("journey");
    }
  }

  for (const f of all) {
    if (used.has(f.id)) continue;
    if (isFileField(f)) continue;
    if (/\{entry_(user_journey|geolocation)\}/i.test(f.value)) continue;
    if (!f.value.trim()) continue;

    const builtinProbe = classifyBuiltin({ id: f.id, label: f.label, value: f.value });
    if (builtinProbe === "geo" && used.has("geo")) continue;
    if (builtinProbe === "journey" && used.has("journey")) continue;

    if (isPageUrlField(f, pageUrl) || builtinProbe === "page_url") {
      if (used.has("page_url")) continue;
      pushGeoJourney(
        { id: "page_url", label: "inquiry url", value: f.value.trim() },
        above,
        belowRaw,
      );
      used.add("page_url");
      used.add(f.id);
      continue;
    }

    if (builtinProbe === "geo" || builtinProbe === "journey") {
      if (used.has(builtinProbe)) continue;
      pushGeoJourney(
        {
          id: builtinProbe,
          label: f.label,
          value: localizeCountryCodes(f.value),
          html: /<[a-z][\s\S]*>/i.test(f.value),
        },
        above,
        belowRaw,
      );
      used.add(builtinProbe);
      used.add(f.id);
      continue;
    }

    pushGeoJourney(
      {
        id: f.id,
        label: f.label,
        value: localizeCountryCodes(f.value),
        html: /<[a-z][\s\S]*>/i.test(f.value),
      },
      above,
      belowRaw,
    );
    used.add(f.id);
  }

  const pageFromPanel = panel.find((p) => p.id === "smart-page_url");
  if (!used.has("page_url")) {
    const pageValue = (pageFromPanel?.value || pageUrl).trim();
    if (pageValue) {
      pushGeoJourney(
        {
          id: "page_url",
          label: pageFromPanel?.label || "inquiry url",
          value: pageValue,
        },
        above,
        belowRaw,
      );
      used.add("page_url");
      if (pageFromPanel) used.add(pageFromPanel.id);
    }
  }

  for (const p of panel) {
    if (used.has(p.id)) continue;
    if (
      p.id === "smart-page_url" ||
      p.id === "smart-entry_geolocation" ||
      p.id === "smart-entry_user_journey"
    ) {
      continue;
    }
    if (!p.value.trim()) continue;
    pushGeoJourney(
      { id: p.id, label: p.label, value: p.value, html: p.html },
      above,
      belowRaw,
    );
    used.add(p.id);
  }

  if (above.length === 0 && belowRaw.length === 0) {
    const name = resolveInquiryName(opts.rawPayload, opts.name || "");
    if (name) above.push({ id: "name", label: "Name", value: name });
    if (opts.email?.trim()) above.push({ id: "email", label: "Email", value: opts.email.trim() });
    if (opts.phone?.trim()) {
      above.push({ id: "phone", label: "Phone/WhatsApp", value: opts.phone.trim() });
    }
    if (opts.message?.trim()) {
      above.push({ id: "message", label: "Message", value: opts.message.trim() });
    }
  }

  return { above, belowRaw, attachments };
}

function displayGeoJourneyTips(): MailFieldRow[] {
  return [
    {
      id: "geo",
      label: "买家的地理位置",
      value: MAIL_TIPS.displayGeo,
      html: false,
      hint: true,
    },
    {
      id: "journey",
      label: "买家浏览路径",
      value: MAIL_TIPS.displayJourney,
      html: false,
      hint: true,
    },
  ];
}

export type InquiryMailContent = {
  message: string;
  messageHint: boolean;
  extraAbove: MailFieldRow[];
  below: MailFieldRow[];
  /** 第一封：请勿回复提示 */
  doNotReplyHint: string;
  unlockHint: string;
  attachments: MailFileAttachment[];
  /** followup 时 replyTo 买家；mark 时不设 */
  replyToBuyer: boolean;
  includeMarkButtons: boolean;
};

function baseOpts(opts: {
  rawPayload: string | null | undefined;
  name: string;
  email: string;
  phone: string;
  message: string;
  pageUrl: string;
}) {
  return {
    rawPayload: opts.rawPayload,
    name: opts.name,
    email: opts.email,
    phone: opts.phone,
    message: opts.message,
    pageUrl: opts.pageUrl,
  };
}

/** 第一封：标记邮件（藏邮箱；下方仅 geo/journey） */
export function buildInquiryMailContent(opts: {
  site: { siteType: string; endDate: Date | string | null };
  rawPayload: string | null | undefined;
  name: string;
  email: string;
  phone: string;
  message: string;
  pageUrl: string;
}): InquiryMailContent {
  const gate = mailContentGate(opts.site);
  const parts = collectInquiryFieldParts(baseOpts(opts));
  const aboveNoEmail = parts.above.filter((f) => !isEmailFieldRow(f, opts.email));

  if (gate.expired) {
    return {
      message: MAIL_TIPS.expiredMessage,
      messageHint: true,
      extraAbove: applyExpiredMessageGate(aboveNoEmail, opts.message),
      below: parts.belowRaw,
      doNotReplyHint: MAIL_TIPS.doNotReplyFirstMail,
      unlockHint: "",
      attachments: parts.attachments,
      replyToBuyer: false,
      includeMarkButtons: true,
    };
  }

  if (gate.displayUpgrade) {
    return {
      message: opts.message,
      messageHint: false,
      extraAbove: aboveNoEmail,
      below: displayGeoJourneyTips(),
      doNotReplyHint: MAIL_TIPS.doNotReplyFirstMail,
      unlockHint: "",
      attachments: parts.attachments,
      replyToBuyer: false,
      includeMarkButtons: true,
    };
  }

  // SEO 服务期内：下方 geo/journey 真值
  return {
    message: opts.message,
    messageHint: false,
    extraAbove: aboveNoEmail,
    below: parts.belowRaw,
    doNotReplyHint: MAIL_TIPS.doNotReplyFirstMail,
    unlockHint: "",
    attachments: parts.attachments,
    replyToBuyer: false,
    includeMarkButtons: true,
  };
}

/** 第二封：可回复买家（含邮箱；无 geo/journey；无标记按钮） */
export function buildFollowupMailContent(opts: {
  site: { siteType: string; endDate: Date | string | null };
  rawPayload: string | null | undefined;
  name: string;
  email: string;
  phone: string;
  message: string;
  pageUrl: string;
}): InquiryMailContent {
  const parts = collectInquiryFieldParts(baseOpts(opts));
  return {
    message: opts.message,
    messageHint: false,
    extraAbove: parts.above,
    below: [],
    doNotReplyHint: "",
    unlockHint: "",
    attachments: parts.attachments,
    replyToBuyer: true,
    includeMarkButtons: false,
  };
}

/** 反馈页字段 */
export function buildFeedbackDetailFields(opts: {
  site: { siteType: string; endDate: Date | string | null };
  rawPayload: string | null | undefined;
  status: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  pageUrl: string;
}): { fields: MailFieldRow[]; messageTip: string; followupTip: string } {
  const gate = mailContentGate(opts.site);
  const parts = collectInquiryFieldParts(baseOpts(opts));
  const isValid = opts.status === "valid";

  if (gate.expired) {
    return {
      messageTip: MAIL_TIPS.expiredRenewFeedback,
      followupTip: "",
      fields: applyExpiredMessageGate([...parts.above, ...parts.belowRaw], opts.message),
    };
  }

  if (gate.displayUpgrade) {
    return {
      messageTip: "",
      followupTip: isValid ? MAIL_TIPS.followupSentFeedback : "",
      fields: [],
    };
  }

  // SEO 服务期内：反馈页不重复铺 geo（已在第一封）；有效后提示第二封
  return {
    messageTip: "",
    followupTip: isValid ? MAIL_TIPS.followupSentFeedback : "",
    fields: [],
  };
}
