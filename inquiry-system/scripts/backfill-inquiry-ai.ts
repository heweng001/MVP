/**
 * 批量为存量询盘跑 DeepSeek 旁路判定（不改路由）。
 *
 *   npx tsx scripts/backfill-inquiry-ai.ts
 *   npx tsx scripts/backfill-inquiry-ai.ts --force
 *   npx tsx scripts/backfill-inquiry-ai.ts --limit=50
 */
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.production", override: false });

import { PrismaClient } from "@prisma/client";
import { isDeepSeekConfigured, runInquiryAiAnalysis } from "../src/lib/inquiry-ai";

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const force = args.includes("--force");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Math.max(1, Number(limitArg.split("=")[1]) || 0) : 0;

async function main() {
  if (!isDeepSeekConfigured()) {
    throw new Error("DEEPSEEK_API_KEY 未配置");
  }

  const where = force
    ? {}
    : {
        OR: [
          { aiSpamLabel: "" },
          { aiMessageZh: "" },
          { aiError: { not: "" } },
        ],
      };

  const rows = await prisma.inquiry.findMany({
    where,
    orderBy: { submittedAt: "desc" },
    select: { id: true },
    ...(limit ? { take: limit } : {}),
  });

  console.log(`to_analyze=${rows.length} force=${force}`);
  let ok = 0;
  let fail = 0;
  for (let i = 0; i < rows.length; i++) {
    const id = rows[i].id;
    process.stdout.write(`[${i + 1}/${rows.length}] ${id} `);
    const result = await runInquiryAiAnalysis(id, {
      timeoutMs: 20000,
      force: true,
    });
    if (result) {
      ok++;
      console.log(`ok label=${result.isSpam ? "spam" : "ham"} conf=${result.confidence}`);
    } else {
      fail++;
      console.log("fail");
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log(`done ok=${ok} fail=${fail}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
