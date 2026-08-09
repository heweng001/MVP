import { prisma } from "@/lib/prisma";
import { PromoList } from "@/components/PromoList";
import { PageHeader } from "@/components/PageHeader";
import { promoEditUrl } from "@/lib/promo";

export default async function PromosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q || "").trim();

  const promos = await prisma.clientPromo.findMany({
    where: q
      ? {
          OR: [
            { id: { contains: q } },
            { site: { domain: { contains: q } } },
            { site: { client: { name: { contains: q } } } },
          ],
        }
      : undefined,
    orderBy: { updatedAt: "desc" },
    include: {
      site: {
        select: {
          id: true,
          domain: true,
          client: { select: { id: true, name: true } },
        },
      },
    },
  });

  const now = Date.now();

  return (
    <div>
      <PageHeader
        title="信息核对"
        hint={
          <div className="space-y-1.5">
            <p>可随意新建；系统自动生成 ID。可选关联一个网站（一站仅一条）。</p>
            <p>关键词另页编辑；产品/广告要点支持图文与表格。内部备注仅后台可见。</p>
            <p>列表可生成/复制 7 天有效客户编辑链接。</p>
          </div>
        }
      />
      <PromoList
        initialQ={q}
        items={promos.map((p) => {
          const linkValid =
            !!p.editToken &&
            !!p.editTokenExpires &&
            p.editTokenExpires.getTime() > now;
          return {
            id: p.id,
            lastSubmittedBy: p.lastSubmittedBy,
            lastSubmittedAt: p.lastSubmittedAt?.toISOString() ?? null,
            updatedAt: p.updatedAt.toISOString(),
            editUrl: linkValid && p.editToken ? promoEditUrl(p.editToken) : null,
            editTokenExpires: linkValid ? p.editTokenExpires!.toISOString() : null,
            site: p.site,
          };
        })}
      />
    </div>
  );
}
