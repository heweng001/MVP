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
    include: { client: true },
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
          ← 主推信息列表
        </Link>
        <h1 className="text-2xl font-semibold mt-2">编辑主推信息</h1>
      </div>
      <PromoEditor
        defaultEmail=""
        initial={{
          id: item.id,
          keywords: item.keywords,
          productPoints: item.productPoints,
          adPoints: item.adPoints,
          lastSubmittedBy: item.lastSubmittedBy,
          lastSubmittedAt: item.lastSubmittedAt?.toISOString() ?? null,
          editTokenExpires: linkValid ? item.editTokenExpires!.toISOString() : null,
          editUrl: linkValid && item.editToken ? promoEditUrl(item.editToken) : null,
          client: { id: item.client.id, name: item.client.name },
        }}
      />
    </div>
  );
}
