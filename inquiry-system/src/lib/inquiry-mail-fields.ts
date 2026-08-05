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

function pushPartitioned(
  row: MailFieldRow,
  hideIds: Set<string>,
  above: MailFieldRow[],
  belowRaw: MailFieldRow[],
) {
  const builtin = classifyBuiltin(row);
  const hidden =
    hideIds.has(row.id) ||
    (builtin === "geo" && hideIds.has("geo")) ||
    (builtin === "journey" && hideIds.has("journey"));
  if (hidden) belowRaw.push(row);
  else above.push(row);
}

/** 到期站：留言类字段替换为续费提示，避免正文原文仍出现在字段列表 */
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

/** 从 rawPayload 拆出上方字段 / 配置隐藏字段真值 / 附件 URL（含全部 WPForms 字段） */
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
  const pageUrl = (opts.pageUrl || "").trim();

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
    pushPartitioned(
      { id: "geo", label: geoRow.label, value: geoRow.value, html: geoRow.html },
      hideIds,
      above,
      belowRaw,
    );
    used.add("geo");
    used.add(geoRow.id);
  } else if (root?.entry_geolocation) {
    pushPartitioned(
      {
        id: "geo",
        label: "买家的地理位置",
        value: formatGeolocationZh(String(root.entry_geolocation)),
      },
      hideIds,
      above,
      belowRaw,
    );
    used.add("geo");
  }

  if (journeyRow?.value) {
    pushPartitioned(
      {
        id: "journey",
        label: journeyRow.label,
        value: journeyRow.value,
        html: journeyRow.html,
      },
      hideIds,
      above,
      belowRaw,
    );
    used.add("journey");
    used.add(journeyRow.id);
  }

  // 全部 WPForms 字段（含 name/email/phone/message 等）
  for (const f of all) {
    if (used.has(f.id)) continue;
    if (isFileField(f)) continue;
    if (/\{entry_(user_journey|geolocation)\}/i.test(f.value)) continue;
    if (!f.value.trim()) continue;

    // 板块 geo/journey 已收录；跳过同义 Hidden/残留
    const builtinProbe = classifyBuiltin({ id: f.id, label: f.label, value: f.value });
    if (builtinProbe === "geo" && used.has("geo")) continue;
    if (builtinProbe === "journey" && used.has("journey")) continue;

    // 页面链接统一为 page_url，避免与 panel / pageUrl 重复
    if (isPageUrlField(f, pageUrl) || builtinProbe === "page_url") {
      if (used.has("page_url")) continue;
      pushPartitioned(
        {
          id: "page_url",
          label: "买家发询盘页面",
          value: f.value.trim(),
        },
        hideIds,
        above,
        belowRaw,
      );
      used.add("page_url");
      used.add(f.id);
      continue;
    }

    const row: MailFieldRow = {
      id: f.id,
      label: f.label,
      value: localizeCountryCodes(f.value),
      html: /<[a-z][\s\S]*>/i.test(f.value),
    };
    pushPartitioned(row, hideIds, above, belowRaw);
    used.add(f.id);
  }

  // panel：page_url（插件/来源页）及其它非 geo/journey
  const pageFromPanel = panel.find((p) => p.id === "smart-page_url");
  if (!used.has("page_url")) {
    const pageValue = (pageFromPanel?.value || pageUrl).trim();
    if (pageValue) {
      pushPartitioned(
        {
          id: "page_url",
          label: pageFromPanel?.label || "买家发询盘页面",
          value: pageValue,
        },
        hideIds,
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
    pushPartitioned(
      { id: p.id, label: p.label, value: p.value, html: p.html },
      hideIds,
      above,
      belowRaw,
    );
    used.add(p.id);
  }

  // 无 raw 字段时的兜底：用入库列拼出可见行
  if (above.length === 0 && belowRaw.filter((r) => r.id !== "geo" && r.id !== "journey").length === 0) {
    const fallbacks: MailFieldRow[] = [];
    const name = resolveInquiryName(opts.rawPayload, opts.name || "");
    if (name) fallbacks.push({ id: "name", label: "Name", value: name });
    if (opts.email?.trim()) fallbacks.push({ id: "email", label: "Email", value: opts.email.trim() });
    if (opts.phone?.trim()) {
      fallbacks.push({ id: "phone", label: "Phone/WhatsApp", value: opts.phone.trim() });
    }
    if (opts.message?.trim()) {
      fallbacks.push({ id: "message", label: "Message", value: opts.message.trim() });
    }
    for (const row of fallbacks) {
      if (used.has(row.id)) continue;
      pushPartitioned(row, hideIds, above, belowRaw);
      used.add(row.id);
    }
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
  /** @deprecated 邮件正文已改为全字段列表；保留供兼容 */
  message: string;
  messageHint: boolean;
  /** 分割线上方全部可见字段 */
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

  // 已到期：隐藏名单失效，全部进上方；留言类替换为续费提示
  if (gate.expired) {
    const merged = applyExpiredMessageGate(
      [...parts.above, ...parts.belowRaw],
      opts.message,
    );
    return {
      message: MAIL_TIPS.expiredMessage,
      messageHint: true,
      extraAbove: merged,
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

  // 到期：续费提示门控留言 + 其余字段真值（含原隐藏）
  if (gate.expired) {
    return {
      messageTip: MAIL_TIPS.expiredMessage,
      fields: applyExpiredMessageGate([...parts.above, ...parts.belowRaw], opts.message),
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

/** 从近期询盘推断可选字段（供后台勾选；含全部 WPForms 字段） */
export function discoverFieldOptionsFromPayloads(rawPayloads: string[]): {
  id: string;
  label: string;
  builtin?: boolean;
}[] {
  const map = new Map<string, string>();
  map.set("geo", "买家的地理位置（默认隐藏）");
  map.set("journey", "买家浏览路径（默认隐藏）");

  for (const raw of rawPayloads) {
    const panel = extractHiddenFields(raw);
    const knownPageUrl =
      panel.find((p) => p.id === "smart-page_url")?.value.trim() || "";

    for (const f of parseWpFormFields(raw)) {
      if (!f.id || isFileField(f)) continue;
      if (/\{entry_(user_journey|geolocation)\}/i.test(f.value)) continue;

      const builtin = classifyBuiltin({ id: f.id, label: f.label, value: f.value });
      if (builtin === "geo") continue;
      if (builtin === "journey") continue;
      if (builtin === "page_url" || isPageUrlField(f, knownPageUrl)) {
        if (!map.has("page_url")) map.set("page_url", "买家发询盘页面");
        continue;
      }
      if (!map.has(f.id)) map.set(f.id, f.label || f.id);
    }

    if (knownPageUrl) {
      if (!map.has("page_url")) map.set("page_url", "买家发询盘页面");
    }
  }

  return [...map.entries()].map(([id, label]) => ({
    id,
    label,
    builtin: id === "geo" || id === "journey",
  }));
}
