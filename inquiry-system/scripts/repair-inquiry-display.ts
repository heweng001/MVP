/**
 * 修复列表展示相关存量数据：
 * 1. 从 rawPayload 回填空的 message（WPForms Message 常为 text 类型）
 * 2. 已补发的自动/审核垃圾改为 pending
 *
 *   npx tsx scripts/repair-inquiry-display.ts
 *   npx tsx scripts/repair-inquiry-display.ts --ai
 */
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.production", override: false });

import { PrismaClient } from "@prisma/client";
import { InquiryStatus } from "../src/lib/constants";
import { resolveInquiryMessage } from "../src/lib/inquiry-mail-fields";
import { isDeepSeekConfigured, runInquiryAiAnalysis } from "../src/lib/inquiry-ai";

const prisma = new PrismaClient();
const withAi = process.argv.includes("--ai");

async function main() {
  const emptyRows = await prisma.inquiry.findMany({
    where: { message: "" },
    select: { id: true, email: true, rawPayload: true, message: true, aiMessageZh: true },
  });

  let filled = 0;
  const aiIds: string[] = [];
  for (const row of emptyRows) {
    const message = resolveInquiryMessage(row.rawPayload, row.message);
    if (!message) continue;
    await prisma.inquiry.update({
      where: { id: row.id },
      data: { message },
    });
    filled++;
    if ((row.aiMessageZh || "").trim() === "（无正文）") aiIds.push(row.id);
  }

  const promoted = await prisma.inquiry.updateMany({
    where: {
      status: { in: [InquiryStatus.AUTO_SPAM, InquiryStatus.REVIEW_SPAM] },
      sentAt: { not: null },
    },
    data: { status: InquiryStatus.PENDING },
  });

  console.log(`filled_message=${filled} of_empty=${emptyRows.length} promoted_resent_spam=${promoted.count}`);

  if (!withAi || aiIds.length === 0) {
    if (aiIds.length) console.log(`skip_ai n=${aiIds.length} (pass --ai to re-analyze)`);
    return;
  }
  if (!isDeepSeekConfigured()) {
    console.log("skip_ai: DEEPSEEK_API_KEY missing");
    return;
  }

  let ok = 0;
  let fail = 0;
  for (let i = 0; i < aiIds.length; i++) {
    const id = aiIds[i];
    process.stdout.write(`[ai ${i + 1}/${aiIds.length}] ${id} `);
    const result = await runInquiryAiAnalysis(id, { timeoutMs: 20000, force: true });
    if (result) {
      ok++;
      console.log(`ok label=${result.isSpam ? "spam" : "ham"} conf=${result.confidence}`);
    } else {
      fail++;
      console.log("fail");
    }
  }
  console.log(`ai_done ok=${ok} fail=${fail}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
