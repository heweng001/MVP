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
  /** 反馈页：到期站不发第二封 */
  expiredRenewFeedback:
    "网站服务已到期。标记结果已记录，但不会发送含买家邮箱的第二封邮件；续费后即可恢复，请及时联系贸牛续费。",
  displayGeo:
    "升级成SEO型网站，即可查看询盘来源的国家和城市。",
  displayJourney:
    "升级成SEO型网站，即可查看该买家发送询盘前浏览了网站的页面情况（含具体页面信息及对应页面的停留时间）。",
  doNotReplyFirstMail:
    "请勿回复本邮件，如确认询盘有效，请点击下方「标为有效」按钮，系统将发送一封新邮件，需在新邮件中即可回复买家。",
  followupSentFeedback:
    "已标记为有效。含买家邮箱的新邮件正在发送，请稍后在邮箱中打开新邮件并回复买家。",
  markValidToGetFollowup:
    "标记为「有效」后，系统将发送含买家邮箱的新邮件，请在新邮件中回复买家。",
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
