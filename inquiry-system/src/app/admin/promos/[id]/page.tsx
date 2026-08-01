import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PromoEditor } from "@/components/PromoEditor";
import { promoEditUrl } from "@/lib/promo";

type Ctx = { params: Promise<{ id: string }> };

export default async function PromoDetailPage({ params }: Ctx) {
  const { id } = await params;
  const item = await prisma.clientPromo.findUnique({
    where: { id },
    include: {
      client: true,
      histories: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
  if (!item) notFound();

  const linkValid =
    !!item.editToken &&
    !!item.editTokenExpires &&
    item.editTokenExpires.getTime() > Date.now();

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/promos" className="text-sm text-[var(--brand)] hover:underline">
          ← 信息核对列表
        </Link>
        <h1 className="text-2xl font-semibold mt-2">信息核对详情</h1>
      </div>
      <PromoEditor
        defaultEmail=""
        initial={{
          id: item.id,
          keywords: item.keywords,
          productPoints: item.productPoints,
          adPoints: item.adPoints,
          keywordsNote: item.keywordsNote,
          productPointsNote: item.productPointsNote,
          adPointsNote: item.adPointsNote,
          lastSubmittedBy: item.lastSubmittedBy,
          lastSubmittedAt: item.lastSubmittedAt?.toISOString() ?? null,
          editTokenExpires: linkValid ? item.editTokenExpires!.toISOString() : null,
          editUrl: linkValid && item.editToken ? promoEditUrl(item.editToken) : null,
          client: { id: item.client.id, name: item.client.name },
          histories: item.histories.map((h) => ({
            id: h.id,
            submittedBy: h.submittedBy,
            createdAt: h.createdAt.toISOString(),
          })),
        }}
      />
    </div>
  );
}
