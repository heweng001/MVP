import { prisma } from "@/lib/prisma";
import { PromoList } from "@/components/PromoList";
import { PageHeader } from "@/components/PageHeader";

export default async function PromosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q || "").trim();

  const [promos, clients] = await Promise.all([
    prisma.clientPromo.findMany({
      where: q
        ? {
            client: { name: { contains: q } },
          }
        : undefined,
      orderBy: { updatedAt: "desc" },
      include: { client: { select: { id: true, name: true, tier: true } } },
    }),
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, promo: { select: { id: true } } },
    }),
  ]);

  const without = clients.filter((c) => !c.promo).map((c) => ({ id: c.id, name: c.name }));

  return (
    <div>
      <PageHeader
        title="信息核对"
        hint={
          <div className="space-y-1.5">
            <p>与客户一对一。可新增、查找、编辑；可发送 7 天有效编辑链接给客户。</p>
            <p>三个页签：关键词列表、公司产品要点、广告要点；各页「内部备注」仅后台可见。</p>
            <p>详情页可查看历次更新人与时间。</p>
          </div>
        }
      />
      <PromoList
        initialQ={q}
        items={promos.map((p) => ({
          id: p.id,
          lastSubmittedBy: p.lastSubmittedBy,
          lastSubmittedAt: p.lastSubmittedAt?.toISOString() ?? null,
          updatedAt: p.updatedAt.toISOString(),
          client: p.client,
        }))}
        clientsWithoutPromo={without}
      />
    </div>
  );
}
