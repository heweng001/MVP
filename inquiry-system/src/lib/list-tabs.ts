import { SITE_TYPES } from "./labels";

export const CLIENT_LIST_TABS = [
  {
    key: "seo",
    label: "SEO型客户",
    hint: "服务未到期，且下属网站含 SEO 型（若同时有展示型，仍归入本页签）。",
  },
  {
    key: "display",
    label: "展示型客户",
    hint: "服务未到期，且下属网站均为展示型（或不含 SEO 型）。",
  },
  {
    key: "expired",
    label: "到期客户",
    hint: "客户服务结束日期早于今天（由下属网站最晚结束日汇总）。",
  },
] as const;

export const SITE_LIST_TABS = [
  {
    key: "seo",
    label: "SEO型",
    hint: "站点类型为 SEO 型，且服务结束日期为空或尚未到期。",
  },
  {
    key: "display",
    label: "展示型",
    hint: "站点类型为展示型，且服务结束日期为空或尚未到期。",
  },
  {
    key: "expired",
    label: "到期",
    hint: "网站服务结束日期早于今天。",
  },
] as const;

export type ClientListTab = (typeof CLIENT_LIST_TABS)[number]["key"];
export type SiteListTab = (typeof SITE_LIST_TABS)[number]["key"];

export const SITE_SORT_FIELDS = ["startDate", "endDate", "formCount"] as const;
export type SiteSortField = (typeof SITE_SORT_FIELDS)[number];
export type SortDir = "asc" | "desc";

export const CLIENT_SORT_FIELDS = ["serviceStart", "serviceEnd", "lastVisitAt"] as const;
export type ClientSortField = (typeof CLIENT_SORT_FIELDS)[number];

/** 结束日的日历天早于今天 → 已到期（结束日当天仍算在期内） */
export function isPastServiceEnd(end: Date | string | null | undefined, now = new Date()) {
  if (end == null || end === "") return false;
  const d = typeof end === "string" ? new Date(end) : end;
  if (Number.isNaN(d.getTime())) return false;
  const endDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return endDay < today;
}

export function clientListTabFrom(
  client: {
    serviceEnd: Date | string | null;
    sites: { siteType: string }[];
  },
  now = new Date(),
): ClientListTab {
  if (isPastServiceEnd(client.serviceEnd, now)) return "expired";
  if (client.sites.some((s) => s.siteType === SITE_TYPES[0])) return "seo";
  return "display";
}

export function siteListTabFrom(
  site: { siteType: string; endDate: Date | string | null },
  now = new Date(),
): SiteListTab {
  if (isPastServiceEnd(site.endDate, now)) return "expired";
  if (site.siteType === SITE_TYPES[0]) return "seo";
  return "display";
}

export function parseClientListTab(tab: string | undefined): ClientListTab {
  if (tab && CLIENT_LIST_TABS.some((t) => t.key === tab)) return tab as ClientListTab;
  return "seo";
}

export function parseSiteListTab(tab: string | undefined): SiteListTab {
  if (tab && SITE_LIST_TABS.some((t) => t.key === tab)) return tab as SiteListTab;
  return "seo";
}

/** 默认按结束日期升序 */
export function parseSiteSort(
  sort: string | undefined,
  order: string | undefined,
): { sort: SiteSortField; order: SortDir } {
  const field = SITE_SORT_FIELDS.includes(sort as SiteSortField)
    ? (sort as SiteSortField)
    : "endDate";
  const dir: SortDir = order === "asc" || order === "desc" ? order : "asc";
  return { sort: field, order: dir };
}

/** 默认按服务结束升序 */
export function parseClientSort(
  sort: string | undefined,
  order: string | undefined,
): { sort: ClientSortField; order: SortDir } {
  const field = CLIENT_SORT_FIELDS.includes(sort as ClientSortField)
    ? (sort as ClientSortField)
    : "serviceEnd";
  const dir: SortDir = order === "asc" || order === "desc" ? order : "asc";
  return { sort: field, order: dir };
}
