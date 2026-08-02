export type SpamInput = {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  pageUrl: string;
  productKeywords: string;
  spamExtraWords: string;
  blacklisted: boolean;
};

export type SpamResult = {
  score: number;
  hits: string[];
};

const SEO_WORDS = [
  "guest post",
  "guest posting",
  "backlink",
  "link building",
  "link exchange",
  "increase your ranking",
  "google ranking",
  "first page of google",
  "organic traffic",
  "seo service",
  "seo package",
  "domain authority",
  "digital marketing agency",
  "content placement",
];

const WEBMASTER_PHRASES = [
  "dear webmaster",
  "dear site owner",
  "dear owner of",
  "found your website",
  "visited your website",
  "offer collaboration",
];

const GREETING_PHRASES = ["dear sir/madam", "dear sir or madam"];

const TRADE_PROTECT = [
  "quotation",
  "quote",
  "moq",
  "oem",
  "odm",
  "sample",
  "lead time",
  "fob",
  "cif",
  "hs code",
  "inquiry for",
  "looking for supplier",
  "pcs",
  "tons",
  "containers",
  "20gp",
  "40hq",
];

const DISPOSABLE_DOMAINS = [
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "yopmail.com",
  "trashmail.com",
  "sharklasers.com",
];

function textOf(input: SpamInput) {
  return [input.name, input.email, input.phone, input.subject, input.message]
    .join("\n")
    .toLowerCase();
}

function countLinks(text: string) {
  const m = text.match(/https?:\/\//gi);
  return m ? m.length : 0;
}

function looksRandomLocal(local: string) {
  if (local.length < 10) return false;
  if (!/^[a-z0-9._+-]+$/i.test(local)) return false;
  const vowels = (local.match(/[aeiou]/gi) || []).length;
  return vowels / local.length < 0.15;
}

export function scoreSpam(input: SpamInput): SpamResult {
  let score = 0;
  const hits: string[] = [];
  const text = textOf(input);
  const keywords = input.productKeywords
    .split(/[,，\n]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const extra = input.spamExtraWords
    .split(/[,，\n]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const hasProduct = keywords.some((k) => text.includes(k));
  const hasTrade = TRADE_PROTECT.some((k) => text.includes(k));

  if (input.blacklisted) {
    score += 100;
    hits.push("命中黑名单 (+100)");
  }

  const email = input.email.trim().toLowerCase();
  const domain = email.includes("@") ? email.split("@")[1] : "";
  if (domain && DISPOSABLE_DOMAINS.includes(domain)) {
    score += 60;
    hits.push(`一次性邮箱域名 ${domain} (+60)`);
  }

  if (/https?:\/\//i.test(input.name) || /www\./i.test(input.name)) {
    score += 50;
    hits.push("姓名字段疑似 URL (+50)");
  }

  const seoHit = SEO_WORDS.filter((w) => text.includes(w));
  if (seoHit.length && !hasProduct) {
    const add = Math.min(70, 40 + seoHit.length * 10);
    score += add;
    hits.push(`SEO/外链推销词: ${seoHit.slice(0, 3).join(", ")} (+${add})`);
  }

  for (const w of extra) {
    if (w && text.includes(w) && !hasProduct) {
      score += 25;
      hits.push(`站点扩展垃圾词: ${w} (+25)`);
    }
  }

  const links = countLinks(text);
  if (links >= 3) {
    score += 40;
    hits.push(`外链数量 ${links} (+40)`);
  }

  for (const p of WEBMASTER_PHRASES) {
    if (text.includes(p)) {
      score += 25;
      hits.push(`站长群发套话: ${p} (+25)`);
      break;
    }
  }

  for (const p of GREETING_PHRASES) {
    if (text.includes(p)) {
      score += 15;
      hits.push(`套话称呼: ${p} (+15)`);
      break;
    }
  }

  if (!hasProduct && (text.includes("seo") || text.includes("ranking") || text.includes("traffic"))) {
    score += 30;
    hits.push("无产品词但含 SEO/流量营销词 (+30)");
  }

  const local = email.split("@")[0] || "";
  if (looksRandomLocal(local)) {
    score += 20;
    hits.push("邮箱本地部分疑似随机串 (+20)");
  }

  const phone = input.phone.replace(/\D/g, "");
  if (phone && (/^0+$/.test(phone) || /^123456/.test(phone) || phone.length < 6)) {
    score += 15;
    hits.push("电话明显异常 (+15)");
  }

  if (hasTrade || hasProduct) {
    const reduce = hasTrade && hasProduct ? 40 : 25;
    score = Math.max(0, score - reduce);
    hits.push(`外贸/产品相关保护 (-${reduce})`);
  }

  return { score: Math.min(100, score), hits };
}

/** 进入人工审核的最低分：≥ 该分且未达自动垃圾阈值 → review；低于则直发 */
export function reviewBandLow(_threshold?: number) {
  return Number(process.env.REVIEW_SCORE_MIN || 20);
}
