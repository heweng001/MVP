import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PromoEditor } from "@/components/PromoEditor";
import { PageHeader } from "@/components/PageHeader";

type Ctx = { params: Promise<{ id: string }> };

export default async function PromoDetailPage({ params }: Ctx) {
  const { id } = await params;
  const item = await prisma.clientPromo.findUnique({
    where: { id },
    include: {
      site: {
        select: {
          id: true,
          domain: true,
          client: { select: { id: true, name: true } },
        },
      },
      histories: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
  if (!item) notFound();

  const takenSiteIds = (
    await prisma.clientPromo.findMany({
      where: { siteId: { not: null }, NOT: { id: item.id } },
      select: { siteId: true },
    })
  )
    .map((p) => p.siteId)
    .filter((x): x is string => Boolean(x));

  const taken = new Set(takenSiteIds);
  const allSites = await prisma.site.findMany({
    orderBy: { domain: "asc" },
    include: { client: { select: { name: true } } },
  });
  const siteOptions = allSites
    .filter((s) => s.id === item.siteId || !taken.has(s.id))
    .map((s) => ({
      id: s.id,
      domain: s.domain,
      clientName: s.client.name,
    }));

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/admin/promos"
          className="text-[13px] text-[var(--brand)] hover:underline underline-offset-2"
        >
          ← 信息核对列表
        </Link>
        <div className="mt-2 -mb-2">
          <PageHeader
            title="信息核对详情"
            hint="可关联一个网站；产品/广告要点支持图文与表格。客户编辑链接请在列表页生成/复制。"
          />
        </div>
      </div>
      <PromoEditor
        siteOptions={siteOptions}
        initial={{
          id: item.id,
          siteId: item.siteId,
          keywords: item.keywords,
          productPoints: item.productPoints,
          adPoints: item.adPoints,
          keywordsNote: item.keywordsNote,
          productPointsNote: item.productPointsNote,
          adPointsNote: item.adPointsNote,
          lastSubmittedBy: item.lastSubmittedBy,
          lastSubmittedAt: item.lastSubmittedAt?.toISOString() ?? null,
          site: item.site,
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
