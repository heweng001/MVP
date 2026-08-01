import { prisma } from "@/lib/prisma";
import { HelpCallout } from "@/components/HelpCallout";
import { PromoList } from "@/components/PromoList";

export default async function PromosPage() {
  const [promos, clients] = await Promise.all([
    prisma.clientPromo.findMany({
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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">信息核对</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          与客户一对一。可增删改查；可发送 7 天有效编辑链接给客户自行填写（内部备注客户不可见）。
        </p>
      </div>
      <HelpCallout title="说明">
        <p>
          三个页签：关键词列表、公司产品要点、广告要点；每个页签另有「内部备注」仅后台可见。详情页可查看历次更新人与时间。
        </p>
      </HelpCallout>
      <PromoList
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
