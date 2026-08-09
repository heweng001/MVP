import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const snaps = await p.siteMonthSeoSnapshot.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }],
    take: 2,
  });
  for (const s of snaps) {
    const g = s.gscJson ? JSON.parse(s.gscJson) : {};
    console.log(
      "snap",
      `${s.year}-${String(s.month).padStart(2, "0")}`,
      JSON.stringify(g.summary),
    );
  }
  const reps = await p.siteMonthlyReport.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }],
    take: 2,
  });
  for (const r of reps) {
    const pay = JSON.parse(r.payload);
    console.log(
      "report",
      `${r.year}-${String(r.month).padStart(2, "0")}`,
      JSON.stringify(pay.searchFunnel?.keywordSteps),
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await p.$disconnect();
  });
