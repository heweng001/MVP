import { prisma } from "@/lib/prisma";
import { HelpCallout } from "@/components/HelpCallout";
import { ClientList } from "@/components/ClientList";

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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">客户列表</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          管理客户档案；一个客户可对应多个网站。
        </p>
      </div>
      <HelpCallout title="字段说明">
        <p>
          <strong>服务开始 / 服务结束</strong>
          由下属网站自动计算（所有网站中最早开始、最晚结束），请在「网站列表」维护各站日期。
        </p>
        <p>
          <strong>客户分层</strong>：重点 / 正常 / 维护。创建客户后，再到网站列表添加域名，点「配置对接」按清单接入。
        </p>
      </HelpCallout>
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
