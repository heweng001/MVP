import { SITE_TYPES } from "./labels";
import { isPastServiceEnd } from "./list-tabs";

export type MailContentGate = {
  expired: boolean;
  /** 未到期的展示型：隐藏地理/旅程并提示升级 SEO */
  displayUpgrade: boolean;
};

export const MAIL_TIPS = {
  expiredMessage:
    "网站已经到期，请及时联系贸牛续费，以显示完整询盘内容。",
  expiredGeo:
    "网站已经到期，请及时联系贸牛续费，即可查看询盘来源的国家和城市。",
  expiredJourney:
    "网站已经到期，请及时联系贸牛续费，即可查看该买家发送询盘前浏览了网站的页面情况（含具体页面信息及对应页面的停留时间）。",
  displayGeo:
    "升级成SEO型网站，即可查看询盘来源的国家和城市。",
  displayJourney:
    "升级成SEO型网站，即可查看该买家发送询盘前浏览了网站的页面情况（含具体页面信息及对应页面的停留时间）。",
} as const;

export function mailContentGate(site: {
  siteType: string;
  endDate: Date | string | null;
}): MailContentGate {
  const expired = isPastServiceEnd(site.endDate);
  const isSeo = site.siteType === SITE_TYPES[0];
  return {
    expired,
    displayUpgrade: !expired && !isSeo,
  };
}

export type GatedHiddenField = {
  label: string;
  value: string;
  html?: boolean;
  /** 被门控替换/注入的提示文案 */
  hint?: boolean;
};

export function applyMailContentGate(opts: {
  message: string;
  hiddenFields: GatedHiddenField[];
  gate: MailContentGate;
}): { message: string; hiddenFields: GatedHiddenField[]; messageHint: boolean } {
  const { gate } = opts;
  let message = opts.message;
  let messageHint = false;

  if (gate.expired) {
    message = MAIL_TIPS.expiredMessage;
    messageHint = true;
  }

  if (!gate.expired && !gate.displayUpgrade) {
    return { message, hiddenFields: opts.hiddenFields, messageHint };
  }

  const geoTip = gate.expired ? MAIL_TIPS.expiredGeo : MAIL_TIPS.displayGeo;
  const journeyTip = gate.expired ? MAIL_TIPS.expiredJourney : MAIL_TIPS.displayJourney;

  const next: GatedHiddenField[] = [];
  let hasGeo = false;
  let hasJourney = false;

  for (const f of opts.hiddenFields) {
    const kind = classifyMailHidden(f.label);
    if (kind === "geo") {
      hasGeo = true;
      next.push({ ...f, value: geoTip, html: false, hint: true });
      continue;
    }
    if (kind === "journey") {
      hasJourney = true;
      next.push({ ...f, value: journeyTip, html: false, hint: true });
      continue;
    }
    next.push(f);
  }

  if (!hasGeo) {
    next.push({
      label: "entry_geolocation（地理位置）",
      value: geoTip,
      html: false,
      hint: true,
    });
  }
  if (!hasJourney) {
    next.push({
      label: "entry_user_journey（用户路径）",
      value: journeyTip,
      html: false,
      hint: true,
    });
  }

  return { message, hiddenFields: next, messageHint };
}

function classifyMailHidden(label: string): "geo" | "journey" | "other" {
  const n = label.toLowerCase().replace(/[{}\s_\-()/（）]/g, "");
  if (/entryuserjourney|userjourney|用户路径|用户旅程/.test(n)) return "journey";
  if (/entrygeolocation|geolocation|地理位置/.test(n)) return "geo";
  return "other";
}
