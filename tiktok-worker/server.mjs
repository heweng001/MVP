/**
 * 新加坡 TikTok 抓取 Worker
 * 供阿里云 FormManager（erp.maoniux.com）调用：本机出网访问 TikTok，返回 HTML。
 *
 * POST /fetch
 * Header: x-tiktok-worker-secret
 * Body: { "url": "https://www.tiktok.com/@user..." } 或 { "username": "user" }
 * Resp: { ok: true, html, url } | { ok: false, error }
 */
import { execFile } from "child_process";
import { promisify } from "util";
import express from "express";
import { createServer } from "http";

const execFileAsync = promisify(execFile);

const PORT = Number(process.env.PORT || 8788) || 8788;
const HOST = String(process.env.HOST || "0.0.0.0").trim() || "0.0.0.0";
const SECRET = String(process.env.TIKTOK_WORKER_SECRET || "").trim();
const FETCH_TIMEOUT_SEC = Math.min(
  60,
  Math.max(5, Number(process.env.FETCH_TIMEOUT_SEC || 15) || 15),
);
const ALLOWED_IPS = String(process.env.ALLOWED_IPS || "")
  .split(/[,;\s]+/)
  .map((x) => x.trim())
  .filter(Boolean);

const TIKTOK_HOSTS = new Set(["www.tiktok.com", "tiktok.com", "m.tiktok.com"]);

function isAllowedTikTokUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === "https:" && TIKTOK_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

function buildTikTokProfileUrls(username) {
  const clean = String(username || "")
    .trim()
    .replace(/^@+/, "");
  if (!clean) return [];
  const encoded = encodeURIComponent(clean);
  return [
    `https://www.tiktok.com/@${encoded}?shop_region=US&lang=en`,
    `https://www.tiktok.com/api/user/detail/?uniqueId=${encoded}`,
  ];
}

function clientIp(req) {
  const xf = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return xf || req.socket?.remoteAddress || "";
}

function assertAuth(req, res) {
  if (!SECRET) {
    res.status(500).json({ ok: false, error: "服务器未配置 TIKTOK_WORKER_SECRET" });
    return false;
  }
  const got = String(req.headers["x-tiktok-worker-secret"] || "").trim();
  if (!got || got !== SECRET) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return false;
  }
  if (ALLOWED_IPS.length) {
    const ip = clientIp(req).replace(/^::ffff:/, "");
    const ok = ALLOWED_IPS.some((allow) => ip === allow || ip.endsWith(allow));
    if (!ok) {
      res.status(403).json({ ok: false, error: `IP not allowed: ${ip}` });
      return false;
    }
  }
  return true;
}

async function fetchUrlViaCurl(targetUrl) {
  const args = [
    "-sS",
    "-L",
    "--max-time",
    String(FETCH_TIMEOUT_SEC),
    "-A",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "-H",
    "Accept-Language: en-US,en;q=0.9",
    "-H",
    "Accept: text/html,application/json;q=0.9,*/*;q=0.8",
    targetUrl,
  ];
  const { stdout } = await execFileAsync("curl", args, {
    maxBuffer: 20 * 1024 * 1024,
  });
  if (!stdout || stdout.length < 80) {
    throw new Error("TikTok 返回内容为空");
  }
  return stdout;
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "tiktok-worker" });
});

app.post("/fetch", async (req, res) => {
  if (!assertAuth(req, res)) return;

  const username = String(req.body?.username || "")
    .trim()
    .replace(/^@+/, "");
  let url = String(req.body?.url || "").trim();

  const candidates = [];
  if (url) {
    if (!isAllowedTikTokUrl(url)) {
      return res.status(400).json({ ok: false, error: "非法 TikTok 地址" });
    }
    candidates.push(url);
  } else if (username) {
    candidates.push(...buildTikTokProfileUrls(username));
  } else {
    return res.status(400).json({ ok: false, error: "需要 url 或 username" });
  }

  const errors = [];
  for (const target of candidates) {
    try {
      const html = await fetchUrlViaCurl(target);
      return res.json({
        ok: true,
        url: target,
        html,
        bytes: html.length,
      });
    } catch (e) {
      errors.push(`${target}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return res.status(502).json({
    ok: false,
    error: errors.join(" | ") || "无法访问 TikTok",
  });
});

if (!SECRET) {
  console.warn("[tiktok-worker] 警告：未设置 TIKTOK_WORKER_SECRET，接口将拒绝所有请求");
}

const server = createServer(app);
server.listen(PORT, HOST, () => {
  console.log(`[tiktok-worker] listening http://${HOST}:${PORT}`);
});
