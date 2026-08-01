import { prisma } from "@/lib/prisma";
import { ClientList } from "@/components/ClientList";
import { PageHeader } from "@/components/PageHeader";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const tier = sp.tier || "";
  const q = (sp.q || "").trim();

  const clients = await prisma.client.findMany({
    where: {
      ...(tier ? { tier } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { contactName: { contains: q } },
              { phone: { contains: q } },
              { address: { contains: q } },
              { notes: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { sites: true } },
      promo: {
        select: { id: true, lastSubmittedBy: true, lastSubmittedAt: true },
      },
    },
  });

  return (
    <div>
      <PageHeader
        title="客户列表"
        hint={
          <div className="space-y-1.5">
            <p>管理客户档案；一个客户可对应多个网站。</p>
            <p>
              <strong>服务开始/结束</strong>
              ：由下属网站日期自动汇总（最早开始、最晚结束）。
            </p>
            <p>
              <strong>客户分层</strong>：重点 / 正常 / 维护。创建后到网站列表添加域名并「配置对接」。
            </p>
          </div>
        }
      />
      <ClientList
        initialTier={tier}
        initialQ={q}
        initialClients={clients.map((c) => ({
          id: c.id,
          name: c.name,
          tier: c.tier,
          contactName: c.contactName,
          phone: c.phone,
          address: c.address,
          notes: c.notes,
          serviceStart: c.serviceStart?.toISOString() ?? null,
          serviceEnd: c.serviceEnd?.toISOString() ?? null,
          lastVisitAt: c.lastVisitAt?.toISOString() ?? null,
          _count: c._count,
          promo: c.promo
            ? {
                id: c.promo.id,
                lastSubmittedBy: c.promo.lastSubmittedBy,
                lastSubmittedAt: c.promo.lastSubmittedAt?.toISOString() ?? null,
              }
            : null,
        }))}
      />
    </div>
  );
}
