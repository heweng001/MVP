import type { SiteReportPayload } from "./site-report";
import { momLabel } from "./site-report";

function pct(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return null;
  return `${(n * 100).toFixed(1)}%`;
}

function momText(curr: number, prev: number | null | undefined, invertBetter?: boolean) {
  const m = momLabel(curr, prev, { invertBetter });
  if (prev == null) return "无上月";
  return `${m.text}（上月 ${typeof prev === "number" && prev < 10 && prev % 1 ? prev.toFixed(1) : prev}）`;
}

/** 压缩 payload，供模型分析（控制 token） */
export function buildReportAiBrief(payload: SiteReportPayload) {
  const { kpi, prev } = payload;
  const kwSteps = payload.searchFunnel?.keywordSteps || [];
  const pageSteps = payload.searchFunnel?.pageSteps || [];
  return {
    client: payload.clientName,
    domain: payload.domain,
    siteType: payload.siteType,
    period: payload.periodLabel,
    dataWindow: `${payload.meta.startDate || "?"}～${payload.meta.endDate || "?"}`,
    notes: [
      "有展示页/词来自 GSC Search Analytics，不等于完整收录/索引库",
      "GA 转化为关键事件次数，业务结果以询盘为准",
      "平均排名数字越小越好",
    ],
    kpi: {
      gscClicks: kpi.gscClicks,
      gscClicksMom: momText(kpi.gscClicks, prev?.gscClicks),
      gscImpressions: kpi.gscImpressions,
      gscImpressionsMom: momText(kpi.gscImpressions, prev?.gscImpressions),
      gscCtr: pct(kpi.gscCtr),
      gscAvgPosition: kpi.gscAvgPosition,
      gscAvgPositionMom:
        kpi.gscAvgPosition != null
          ? momText(kpi.gscAvgPosition, prev?.gscAvgPosition, true)
          : null,
      gaSessions: kpi.gaSessions,
      gaSessionsMom: momText(kpi.gaSessions, prev?.gaSessions),
      gaUsers: kpi.gaUsers,
      gaConversions: kpi.gaConversions,
      inquiryTotal: kpi.inquiry.total,
      inquiryTotalMom: momText(kpi.inquiry.total, prev?.inquiry.total),
      inquiryForwarded: kpi.inquiry.forwarded,
      inquiryValid: kpi.inquiry.valid,
      inquiryEffectiveRate: pct(kpi.inquiry.effectiveRate),
    },
    pageFunnel: pageSteps.map((s) => ({
      label: s.label,
      value: s.value,
      prev: s.prevValue ?? null,
    })),
    keywordFunnel: kwSteps.map((s) => ({
      label: s.label,
      value: s.value,
      prev: s.prevValue ?? null,
    })),
    topKeywords: (payload.topKeywords || []).slice(0, 8).map((k) => ({
      keyword: k.keyword,
      position: k.position,
      clicks: k.clicks,
      impressions: k.impressions,
      ctr: pct(k.ctr),
    })),
    opportunityKeywords: (payload.opportunityKeywords || []).slice(0, 6).map((k) => ({
      keyword: k.keyword,
      position: k.position,
      clicks: k.clicks,
      impressions: k.impressions,
      ctr: pct(k.ctr),
    })),
    topPages: (payload.topPages || []).slice(0, 5).map((p) => ({
      url: p.pageUrl,
      position: p.position,
      clicks: p.clicks,
      impressions: p.impressions,
    })),
    topChannels: (payload.topChannels || []).slice(0, 6).map((c) => ({
      channel: c.channelGroup,
      sessions: c.sessions,
      conversions: c.conversions,
    })),
    topCountries: (payload.topCountries || []).slice(0, 6).map((c) => ({
      country: c.countryLabel || c.country || c.countryId,
      sessions: c.sessions,
    })),
    autoHighlights: payload.highlights || [],
  };
}

export type ReportAiDraft = {
  highlights: string[];
  nextPlan: string;
};

const SYSTEM_PROMPT = `你是 B2B 外贸/工厂网站的 SEO 与运营顾问，为客户撰写月度报告文案。
必须遵守：
1. 只根据用户提供的 JSON 数据下结论，禁止编造未出现的排名、收录量、外链、广告花费。
2. 「有展示页/词」≠ 完整收录；不要写成「已收录 XXX 页」。
3. GA「转化」≠ 询盘条数；业务结果以询盘字段为准。
4. 平均排名：数字变小才是变好。
5. 语气专业简洁，少空话套话，面向客户可读。
6. 本月要点 4～6 条，每条一句话，先写事实数字再写判断。
7. 下月计划 3～5 条可执行动作，尽量点名数据里出现过的关键词或页面类型；不要写无法验证的承诺。
8. 若无上月环比，不要假装有环比。
只输出一个 JSON 对象，不要 Markdown，格式：
{"highlights":["..."],"nextPlan":"..."}
nextPlan 用换行分隔多条（可用 1. 2. 前缀）。`;

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("模型未返回合法 JSON");
  }
}

function normalizeDraft(raw: unknown): ReportAiDraft {
  if (!raw || typeof raw !== "object") throw new Error("模型返回格式无效");
  const o = raw as Record<string, unknown>;
  let highlights: string[] = [];
  if (Array.isArray(o.highlights)) {
    highlights = o.highlights.map((x) => String(x).trim()).filter(Boolean);
  } else if (typeof o.highlights === "string") {
    highlights = o.highlights
      .split(/\r?\n/)
      .map((l) => l.replace(/^[-*•\d.、)\s]+/, "").trim())
      .filter(Boolean);
  }
  let nextPlan = "";
  if (typeof o.nextPlan === "string") {
    nextPlan = o.nextPlan.trim();
  } else if (Array.isArray(o.nextPlan)) {
    nextPlan = o.nextPlan
      .map((x, i) => {
        const t = String(x).trim();
        if (!t) return "";
        return /^\d+[.)、]/.test(t) ? t : `${i + 1}. ${t}`;
      })
      .filter(Boolean)
      .join("\n");
  }
  if (highlights.length < 2) throw new Error("要点条数过少，请重试");
  if (!nextPlan) throw new Error("下月计划为空，请重试");
  return { highlights: highlights.slice(0, 8), nextPlan };
}

export async function generateReportAiDraft(
  payload: SiteReportPayload,
): Promise<ReportAiDraft> {
  const apiKey = (process.env.DEEPSEEK_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("未配置 DEEPSEEK_API_KEY，请在服务器 .env 中设置后重启");
  }
  const base = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com")
    .trim()
    .replace(/\/$/, "");
  const model = (process.env.DEEPSEEK_MODEL || "deepseek-chat").trim();
  const brief = buildReportAiBrief(payload);

  const res = await fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `请根据以下月报数据撰写本月要点与下月计划。\n${JSON.stringify(brief)}`,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    choices?: { message?: { content?: string } }[];
  };
  if (!res.ok) {
    throw new Error(data.error?.message || `DeepSeek HTTP ${res.status}`);
  }
  const content = data.choices?.[0]?.message?.content || "";
  if (!content.trim()) throw new Error("模型返回空内容");
  return normalizeDraft(extractJsonObject(content));
}
