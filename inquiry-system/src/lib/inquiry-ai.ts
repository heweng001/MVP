import { prisma } from "./prisma";

export type InquiryAiLabel = "spam" | "ham";

export type InquiryAiResult = {
  isSpam: boolean;
  confidence: number;
  reasons: string[];
  summaryZh: string;
};

const SYSTEM_PROMPT = `你是 B2B 外贸网站询盘质检助手。根据询盘内容判断是否更像垃圾/推销（而非真实采购询价）。
必须遵守：
1. 外贸询价特征（询价、MOQ、OEM/ODM、样品、FOB/CIF、规格数量等）优先判为正常（is_spam=false）。
2. SEO/外链/guest post/站长合作/泛泛营销推销优先判为垃圾（is_spam=true）。
3. confidence 为你对本次 is_spam 结论的把握（0～1），不是「有多垃圾」。
4. reasons 写 1～3 条简短中文依据，面向运营可读。
5. 只根据提供的字段判断，不要编造未出现的事实。
只输出一个 JSON 对象，不要 Markdown：
{"is_spam":true或false,"confidence":0.0到1.0,"reasons":["..."]}`;

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

export function buildAiSummaryZh(
  isSpam: boolean,
  confidencePct: number,
  reasons: string[],
): string {
  const pct = Math.min(100, Math.max(0, Math.round(confidencePct)));
  const head = isSpam
    ? pct >= 70
      ? `疑似垃圾询盘（把握约 ${pct}%）`
      : `倾向垃圾但把握不高（约 ${pct}%），建议人工留意`
    : pct >= 70
      ? `偏正常询盘（把握约 ${pct}%）`
      : `倾向正常但把握不高（约 ${pct}%），建议人工留意`;
  const first = reasons[0]?.trim();
  const reasonPart = first ? `。主要依据：${first.replace(/[。．.]+$/, "")}` : "";
  return `${head}${reasonPart}。`;
}

function normalizeAiResult(raw: unknown): InquiryAiResult {
  if (!raw || typeof raw !== "object") throw new Error("模型返回格式无效");
  const o = raw as Record<string, unknown>;
  const isSpam = Boolean(o.is_spam);
  let confidence = Number(o.confidence);
  if (!Number.isFinite(confidence)) confidence = 0.5;
  if (confidence > 1) confidence = confidence / 100;
  confidence = Math.min(1, Math.max(0, confidence));
  const confidencePct = Math.round(confidence * 100);
  const reasons = Array.isArray(o.reasons)
    ? o.reasons
        .map((x) => String(x).trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];
  return {
    isSpam,
    confidence: confidencePct,
    reasons,
    summaryZh: buildAiSummaryZh(isSpam, confidencePct, reasons),
  };
}

export function isDeepSeekConfigured() {
  return Boolean((process.env.DEEPSEEK_API_KEY || "").trim());
}

export function aiLabelDisplay(label: string) {
  if (label === "spam") return "疑似垃圾";
  if (label === "ham") return "偏正常";
  return "—";
}

export function parseAiReasons(json: string): string[] {
  try {
    const v = JSON.parse(json || "[]");
    return Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

type AnalyzeInput = {
  name: string;
  email: string;
  phone: string;
  message: string;
  pageUrl?: string;
  domain?: string;
  productKeywords?: string;
};

async function callDeepSeekClassify(input: AnalyzeInput): Promise<InquiryAiResult> {
  const apiKey = (process.env.DEEPSEEK_API_KEY || "").trim();
  if (!apiKey) throw new Error("未配置 DEEPSEEK_API_KEY");

  const base = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com")
    .trim()
    .replace(/\/$/, "");
  const model = (process.env.DEEPSEEK_MODEL || "deepseek-chat").trim();

  const emailMasked = input.email.includes("@")
    ? `${input.email.split("@")[0]?.slice(0, 2) || ""}***@${input.email.split("@")[1]}`
    : "";

  const userPayload = {
    domain: input.domain || "",
    productKeywords: input.productKeywords || "",
    name: input.name || "",
    email_masked: emailMasked,
    phone_len: (input.phone || "").replace(/\D/g, "").length,
    message: (input.message || "").slice(0, 4000),
    pageUrl: (input.pageUrl || "").slice(0, 500),
  };

  const res = await fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `请分析以下询盘：\n${JSON.stringify(userPayload)}`,
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
  return normalizeAiResult(extractJsonObject(content));
}

const DEFAULT_TIMEOUT_MS = 4000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`DeepSeek 分析超时（${ms}ms）`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** 对已入库询盘跑 DeepSeek 旁路分析并写回；失败只记 aiError，不抛到路由 */
export async function runInquiryAiAnalysis(
  inquiryId: string,
  opts?: { timeoutMs?: number; force?: boolean },
): Promise<InquiryAiResult | null> {
  if (!isDeepSeekConfigured()) return null;

  const inquiry = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    include: { site: { select: { domain: true, productKeywords: true } } },
  });
  if (!inquiry) return null;
  if (!opts?.force && inquiry.aiAnalyzedAt && !inquiry.aiError) {
    return {
      isSpam: inquiry.aiSpamLabel === "spam",
      confidence: inquiry.aiConfidence ?? 0,
      reasons: parseAiReasons(inquiry.aiReasonsJson),
      summaryZh: inquiry.aiSummaryZh,
    };
  }

  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  try {
    const result = await withTimeout(
      callDeepSeekClassify({
        name: inquiry.name,
        email: inquiry.email,
        phone: inquiry.phone,
        message: inquiry.message,
        pageUrl: inquiry.pageUrl,
        domain: inquiry.site.domain,
        productKeywords: inquiry.site.productKeywords,
      }),
      timeoutMs,
    );
    await prisma.inquiry.update({
      where: { id: inquiryId },
      data: {
        aiSpamLabel: result.isSpam ? "spam" : "ham",
        aiConfidence: result.confidence,
        aiReasonsJson: JSON.stringify(result.reasons),
        aiSummaryZh: result.summaryZh,
        aiAnalyzedAt: new Date(),
        aiError: "",
      },
    });
    return result;
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    console.error("[inquiry-ai]", inquiryId, msg);
    await prisma.inquiry.update({
      where: { id: inquiryId },
      data: {
        aiError: msg,
        aiAnalyzedAt: new Date(),
      },
    });
    return null;
  }
}

/** 发第一封提醒前：若尚未成功分析则再试一次（短超时） */
export async function ensureInquiryAiForMail(inquiryId: string) {
  const row = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    select: { aiSummaryZh: true, aiAnalyzedAt: true, aiError: true },
  });
  if (!row) return;
  if (row.aiSummaryZh?.trim()) return;
  if (!isDeepSeekConfigured()) return;
  await runInquiryAiAnalysis(inquiryId, { timeoutMs: DEFAULT_TIMEOUT_MS, force: true });
}
