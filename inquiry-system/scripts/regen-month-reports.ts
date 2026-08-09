/**
 * 按自然月重新生成已开启 GSC/GA 站点的月报。
 * 用法：npx tsx scripts/regen-month-reports.ts 2026-07 [2026-08 ...]
 */
import { prisma } from "../src/lib/prisma";
import { upsertMonthlyReport } from "../src/lib/site-report";

async function main() {
  const months = process.argv.slice(2).filter((a) => /^\d{4}-\d{1,2}$/.test(a));
  if (!months.length) {
    console.error("用法: npx tsx scripts/regen-month-reports.ts YYYY-MM [...]");
    process.exit(1);
  }

  const sites = await prisma.site.findMany({
    where: { OR: [{ gscSyncEnabled: true }, { gaSyncEnabled: true }] },
    select: { id: true, domain: true },
  });

  for (const ym of months) {
    const [ys, ms] = ym.split("-");
    const year = Number(ys);
    const month = Number(ms);
    for (const s of sites) {
      try {
        const row = await upsertMonthlyReport(s.id, year, month, { preserveNotes: true });
        console.log(`ok ${s.domain} ${year}-${String(month).padStart(2, "0")} token=${row.viewToken.slice(0, 8)}…`);
      } catch (e) {
        console.error(
          `fail ${s.domain} ${year}-${String(month).padStart(2, "0")}:`,
          e instanceof Error ? e.message : e,
        );
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
