import { PrismaClient } from "@prisma/client";
import { ingestInquiry } from "../src/lib/pipeline";

async function main() {
  const prisma = new PrismaClient();
  let client = await prisma.client.findFirst();
  if (!client) {
    client = await prisma.client.create({ data: { name: "Demo Client" } });
  }
  let site = await prisma.site.findFirst({ where: { clientId: client.id } });
  if (!site) {
    site = await prisma.site.create({
      data: {
        clientId: client.id,
        domain: "demo.example.com",
        siteType: "展示型",
        siteKey: "demo-site-key",
        productKeywords: "valve,pump",
      },
    });
  }
  await prisma.formMailConfig.upsert({
    where: { siteId_formId: { siteId: site.id, formId: "1" } },
    create: {
      siteId: site.id,
      formId: "1",
      toEmails: "client@example.com",
      label: "Contact",
    },
    update: { toEmails: "client@example.com" },
  });

  const stamp = Date.now();
  const low = await ingestInquiry({
    site_key: site.siteKey,
    form_id: "1",
    entry_id: `e-low-${stamp}`,
    name: "John",
    email: "john@acme.com",
    message: "Need quotation for valve MOQ 500 pcs FOB",
    page_url: "https://demo.example.com/contact",
  });
  const spam = await ingestInquiry({
    site_key: site.siteKey,
    form_id: "1",
    entry_id: `e-spam-${stamp}`,
    name: "http://spam.com",
    email: "a@mailinator.com",
    message:
      "Dear Webmaster, guest post and backlink SEO service to increase your ranking https://a.com https://b.com https://c.com",
    page_url: "https://demo.example.com/contact",
  });

  console.log("LOW", low.inquiry.status, low.inquiry.spamScore, "sentAt", !!low.inquiry.sentAt);
  console.log("SPAM", spam.inquiry.status, spam.inquiry.spamScore);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
