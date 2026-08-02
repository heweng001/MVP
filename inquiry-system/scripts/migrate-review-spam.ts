import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const r = await prisma.inquiry.updateMany({
    where: { status: "auto_spam", notes: { contains: "审核驳回" } },
    data: { status: "review_spam" },
  });
  console.log("migrated", r.count);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
