/** 月报可隐藏板块（显隐，不删除底层数据） */
export const REPORT_SECTION_DEFS = [
  { key: "highlights", label: "本月要点" },
  { key: "searchFunnel", label: "搜索可见性漏斗" },
  { key: "trafficFunnel", label: "流量与询盘漏斗" },
  { key: "kpi", label: "核心指标" },
  { key: "topKeywords", label: "Top 关键词" },
  { key: "opportunityKeywords", label: "优化机会词" },
  { key: "topPages", label: "搜索 Top 页面" },
  { key: "topChannels", label: "流量渠道" },
  { key: "topCountries", label: "国家 / 地区流量" },
  { key: "topGaPages", label: "主要页面" },
  { key: "topLandings", label: "Top 落地页" },
  { key: "workDone", label: "本月已做工作" },
  { key: "nextPlan", label: "下月计划" },
] as const;

export type ReportSectionKey = (typeof REPORT_SECTION_DEFS)[number]["key"];

const SECTION_KEY_SET = new Set<string>(REPORT_SECTION_DEFS.map((d) => d.key));

export function parseHiddenSections(raw: string | null | undefined): ReportSectionKey[] {
  if (!raw || !String(raw).trim()) return [];
  try {
    const arr = JSON.parse(String(raw)) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => String(x))
      .filter((k): k is ReportSectionKey => SECTION_KEY_SET.has(k));
  } catch {
    return [];
  }
}

export function serializeHiddenSections(keys: string[]): string {
  const uniq = [...new Set(keys.map(String).filter((k) => SECTION_KEY_SET.has(k)))];
  return JSON.stringify(uniq);
}

/** 一行一条；空行忽略 */
export function parseHighlightsEdit(raw: string | null | undefined): string[] {
  if (!raw || !String(raw).trim()) return [];
  return String(raw)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function serializeHighlightsEdit(lines: string[]): string {
  return lines
    .map((l) => String(l).trim())
    .filter(Boolean)
    .join("\n");
}

/** 有人工/AI 定稿则用定稿，否则用自动 highlights */
export function resolveHighlights(
  autoHighlights: string[] | null | undefined,
  highlightsEdit: string | null | undefined,
): string[] {
  const edited = parseHighlightsEdit(highlightsEdit);
  if (edited.length > 0) return edited;
  return Array.isArray(autoHighlights) ? autoHighlights.filter(Boolean) : [];
}

export function isSectionHidden(
  hidden: ReportSectionKey[] | string[] | null | undefined,
  key: ReportSectionKey,
): boolean {
  if (!hidden?.length) return false;
  return hidden.includes(key);
}
