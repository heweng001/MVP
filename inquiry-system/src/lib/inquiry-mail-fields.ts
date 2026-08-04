import { localizeCountryCodes } from "./countries";
import { formatGeolocationZh } from "./places";
import {
  extractHiddenFields,
  parseWpFormFields,
  type WpFormFieldRow,
} from "./wp-fields";
import { parseMailHiddenFields } from "./mail-hidden-config";
import {
  MAIL_TIPS,
  mailContentGate,
  type MailContentGate,
} from "./mail-content-gate";

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

function isStandardMapped(
  f: WpFormFieldRow,
  basics: { name: string; email: string; phone: string; message: string; pageUrl: string },
) {
  const t = f.type.toLowerCase();
  if (t === "name" || t === "email" || t === "phone") return true;
  const v = f.value.trim();
  if (!v) return true;
  if (basics.name && v === basics.name.trim()) return true;
  if (basics.email && v.toLowerCase() === basics.email.trim().toLowerCase()) return true;
  if (basics.phone && v === basics.phone.trim()) return true;
  if (basics.message && v === basics.message.trim()) return true;
  if (basics.pageUrl && v === basics.pageUrl.trim()) return true;
  const n = f.label.toLowerCase().replace(/[{}\s_\-]/g, "");
  if (/^pageurl$|来源页|页面链接|买家发询盘页面/.test(n)) return true;
  return false;
}

function classifyBuiltin(f: MailFieldRow): "geo" | "journey" | "other" {
  if (f.id === "smart-entry_geolocation" || f.id === "geo") return "geo";
  if (f.id === "smart-entry_user_journey" || f.id === "journey") return "journey";
  const n = f.label.toLowerCase().replace(/[{}\s_\-()/（）]/g, "");
  if (/entryuserjourney|userjourney|用户路径|用户旅程|买家浏览路径|浏览路径/.test(n)) {
    return "journey";
  }
  if (/entrygeolocation|geolocation|地理位置|买家的地理位置/.test(n)) return "geo";
  return "other";
}

/** 从 rawPayload 拆出上方字段 / 配置隐藏字段真值 / 附件 URL */
export function collectInquiryFieldParts(opts: {
  rawPayload: string | null | undefined;
  mailHiddenFieldsRaw?: string | null;
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  pageUrl?: string;
}) {
  const hideIds = new Set(parseMailHiddenFields(opts.mailHiddenFieldsRaw));
  const basics = {
    name: opts.name || "",
    email: opts.email || "",
    phone: opts.phone || "",
    message: opts.message || "",
    pageUrl: opts.pageUrl || "",
  };

  const root = parseRaw(opts.rawPayload);
  const all = parseWpFormFields(opts.rawPayload);
  const panel = extractHiddenFields(opts.rawPayload);

  const attachments: MailFileAttachment[] = [];
  const above: MailFieldRow[] = [];
  const belowRaw: MailFieldRow[] = [];
  const used = new Set<string>();

  // 附件
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

  // 内置 geo / journey（来自板块 meta）
  const geoRow = panel.find((p) => p.id === "smart-entry_geolocation");
  const journeyRow = panel.find((p) => p.id === "smart-entry_user_journey");
  if (geoRow?.value) {
    const row: MailFieldRow = {
      id: "geo",
      label: geoRow.label,
      value: geoRow.value,
      html: geoRow.html,
    };
    if (hideIds.has("geo")) belowRaw.push(row);
    else above.push(row);
    used.add("geo");
    used.add(geoRow.id);
  } else if (root?.entry_geolocation) {
    const row: MailFieldRow = {
      id: "geo",
      label: "买家的地理位置",
      value: formatGeolocationZh(String(root.entry_geolocation)),
    };
    if (hideIds.has("geo")) belowRaw.push(row);
    else above.push(row);
    used.add("geo");
  }

  if (journeyRow?.value) {
    const row: MailFieldRow = {
      id: "journey",
      label: journeyRow.label,
      value: journeyRow.value,
      html: journeyRow.html,
    };
    if (hideIds.has("journey")) belowRaw.push(row);
    else above.push(row);
    used.add("journey");
    used.add(journeyRow.id);
  }

  for (const f of all) {
    if (used.has(f.id)) continue;
    if (isFileField(f)) continue;
    if (isStandardMapped(f, basics)) continue;
    // 跳过未解析智能标签
    if (/\{entry_(user_journey|geolocation)\}/i.test(f.value)) continue;
    if (!f.value.trim()) continue;

    const row: MailFieldRow = {
      id: f.id,
      label: f.label,
      value: localizeCountryCodes(f.value),
      html: /<[a-z][\s\S]*>/i.test(f.value),
    };

    const builtin = classifyBuiltin(row);
    const hidden =
      hideIds.has(f.id) ||
      (builtin === "geo" && hideIds.has("geo")) ||
      (builtin === "journey" && hideIds.has("journey"));

    if (hidden) belowRaw.push(row);
    else above.push(row);
    used.add(f.id);
  }

  // panel 里其它 hidden（非 geo/journey/page_url）
  for (const p of panel) {
    if (used.has(p.id)) continue;
    if (p.id === "smart-page_url" || p.id === "smart-entry_geolocation" || p.id === "smart-entry_user_journey") {
      continue;
    }
    if (!p.value.trim()) continue;
    const row: MailFieldRow = {
      id: p.id,
      label: p.label,
      value: p.value,
      html: p.html,
    };
    if (hideIds.has(p.id)) belowRaw.push(row);
    else above.push(row);
  }

  return { above, belowRaw, attachments, hideIds: [...hideIds] };
}

function tipForHiddenField(row: MailFieldRow, gate: MailContentGate): MailFieldRow {
  const kind = classifyBuiltin(row);
  if (kind === "geo") {
    return {
      ...row,
      value: gate.displayUpgrade ? MAIL_TIPS.displayGeo : MAIL_TIPS.seoUnlock,
      html: false,
      hint: true,
    };
  }
  if (kind === "journey") {
    return {
      ...row,
      value: gate.displayUpgrade ? MAIL_TIPS.displayJourney : MAIL_TIPS.seoUnlock,
      html: false,
      hint: true,
    };
  }
  return {
    ...row,
    value: gate.displayUpgrade
      ? "升级成SEO型网站后，可查看该字段详情。"
      : MAIL_TIPS.seoUnlock,
    html: false,
    hint: true,
  };
}

export type InquiryMailContent = {
  message: string;
  messageHint: boolean;
  /** 分割线上方（除标准 Name/Email/... 外的附加字段） */
  extraAbove: MailFieldRow[];
  /** 分割线下方展示用（可能是提示） */
  below: MailFieldRow[];
  unlockHint: string;
  attachments: MailFileAttachment[];
};

/** 按站点门控规则生成邮件字段分区 */
export function buildInquiryMailContent(opts: {
  site: { siteType: string; endDate: Date | string | null; mailHiddenFields?: string | null };
  rawPayload: string | null | undefined;
  name: string;
  email: string;
  phone: string;
  message: string;
  pageUrl: string;
}): InquiryMailContent {
  const gate = mailContentGate(opts.site);
  const parts = collectInquiryFieldParts({
    rawPayload: opts.rawPayload,
    mailHiddenFieldsRaw: opts.site.mailHiddenFields,
    name: opts.name,
    email: opts.email,
    phone: opts.phone,
    message: opts.message,
    pageUrl: opts.pageUrl,
  });

  // 已到期：只门控正文；隐藏名单失效，全部明文（进上方）
  if (gate.expired) {
    return {
      message: MAIL_TIPS.expiredMessage,
      messageHint: true,
      extraAbove: [...parts.above, ...parts.belowRaw],
      below: [],
      unlockHint: "",
      attachments: parts.attachments,
    };
  }

  // 展示型未到期：隐藏字段仅提示，永不解锁真值
  if (gate.displayUpgrade) {
    return {
      message: opts.message,
      messageHint: false,
      extraAbove: parts.above,
      below: parts.belowRaw.map((r) => tipForHiddenField(r, gate)),
      unlockHint: "",
      attachments: parts.attachments,
    };
  }

  // SEO 未到期：下方不放真值，统一引导提示
  if (gate.seoUnlock) {
    return {
      message: opts.message,
      messageHint: false,
      extraAbove: parts.above,
      below: [],
      unlockHint: parts.belowRaw.length ? MAIL_TIPS.seoUnlock : "",
      attachments: parts.attachments,
    };
  }

  return {
    message: opts.message,
    messageHint: false,
    extraAbove: parts.above,
    below: parts.belowRaw,
    unlockHint: "",
    attachments: parts.attachments,
  };
}

/** 反馈页应展示的字段（含到期站正文提示） */
export function buildFeedbackDetailFields(opts: {
  site: { siteType: string; endDate: Date | string | null; mailHiddenFields?: string | null };
  rawPayload: string | null | undefined;
  status: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  pageUrl: string;
}): { fields: MailFieldRow[]; messageTip: string } {
  const gate = mailContentGate(opts.site);
  const parts = collectInquiryFieldParts({
    rawPayload: opts.rawPayload,
    mailHiddenFieldsRaw: opts.site.mailHiddenFields,
    name: opts.name,
    email: opts.email,
    phone: opts.phone,
    message: opts.message,
    pageUrl: opts.pageUrl,
  });

  // 到期：正文提示 + 其余字段真值（含原隐藏）
  if (gate.expired) {
    return {
      messageTip: MAIL_TIPS.expiredMessage,
      fields: [...parts.above, ...parts.belowRaw],
    };
  }

  // 展示型：不给隐藏真值
  if (gate.displayUpgrade) {
    return { messageTip: "", fields: [] };
  }

  // SEO：仅有效后展示隐藏真值
  if (gate.seoUnlock && opts.status === "valid") {
    return { messageTip: "", fields: parts.belowRaw };
  }

  return { messageTip: "", fields: [] };
}

/** 从近期询盘推断可选字段（供后台勾选） */
export function discoverFieldOptionsFromPayloads(rawPayloads: string[]): {
  id: string;
  label: string;
  builtin?: boolean;
}[] {
  const map = new Map<string, string>();
  map.set("geo", "买家的地理位置（默认隐藏）");
  map.set("journey", "买家浏览路径（默认隐藏）");

  for (const raw of rawPayloads) {
    for (const f of parseWpFormFields(raw)) {
      if (!f.id || isFileField(f)) continue;
      if (f.type === "name" || f.type === "email" || f.type === "phone") continue;
      if (!map.has(f.id)) map.set(f.id, f.label || f.id);
    }
  }

  return [...map.entries()].map(([id, label]) => ({
    id,
    label,
    builtin: id === "geo" || id === "journey",
  }));
}
