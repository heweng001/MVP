import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PromoKeywordsAdminEditor } from "@/components/promo/PromoKeywordsEditor";

type Ctx = { params: Promise<{ id: string }> };

export default async function PromoKeywordsAdminPage({ params }: Ctx) {
  const { id } = await params;
  const item = await prisma.clientPromo.findUnique({
    where: { id },
    include: {
      site: { select: { domain: true } },
    },
  });
  if (!item) notFound();

  return (
    <PromoKeywordsAdminEditor
      promoId={item.id}
      siteDomain={item.site?.domain ?? null}
      initialKeywords={item.keywords}
      initialNote={item.keywordsNote}
    />
  );
}
