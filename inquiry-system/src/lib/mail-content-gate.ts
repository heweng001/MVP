import { SITE_TYPES } from "./labels";
import { isPastServiceEnd } from "./list-tabs";

export type MailContentGate = {
  expired: boolean;
  /** 未到期的展示型 */
  displayUpgrade: boolean;
  /** SEO 未到期 */
  isSeoActive: boolean;
};

export const MAIL_TIPS = {
  expiredMessage:
    "网站已经到期，请及时联系贸牛续费，以显示完整询盘内容。",
  expiredRenewFeedback:
    "网站已经到期，请及时联系贸牛续费。标记结果已记录，但不会再发送含买家邮箱的第二封邮件。",
  displayGeo:
    "升级成SEO型网站，即可查看询盘来源的国家和城市。",
  displayJourney:
    "升级成SEO型网站，即可查看该买家发送询盘前浏览了网站的页面情况（含具体页面信息及对应页面的停留时间）。",
  doNotReplyFirstMail:
    "请勿直接回复本邮件：回复后买家收不到。如确认询盘有效，请点击下方「标为有效」；系统将立刻另发一封含买家邮箱的邮件，请在那一封中点击「回复」联系买家。",
  followupSentFeedback:
    "系统已向您发送含买家邮箱的第二封邮件。请勿回复第一封标记邮件；请打开新邮件，点击「回复」即可联系买家。",
  markValidToGetFollowup:
    "标记为「有效」后，系统将立刻发送含买家邮箱的第二封邮件，请在那一封中回复买家。",
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
    isSeoActive: !expired && isSeo,
  };
}
