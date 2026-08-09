import { prisma } from "@/lib/prisma";
import { ClientList } from "@/components/ClientList";
import { PageHeader } from "@/components/PageHeader";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q || "").trim();

  const clients = await prisma.client.findMany({
    where: {
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
    orderBy: [{ lastVisitAt: "desc" }, { name: "asc" }],
  });

  const rows = clients.map((c) => ({
    id: c.id,
    name: c.name,
    contactName: c.contactName,
    phone: c.phone,
    address: c.address,
    notes: c.notes,
    lastVisitAt: c.lastVisitAt?.toISOString() ?? null,
  }));

  return (
    <div>
      <PageHeader
        title="客户"
        hint="管理客户档案（名称、联系方式、上门与备注）。网站与服务期请在「网站列表」中维护。"
      />
      <ClientList initialQ={q} initialClients={rows} />
    </div>
  );
}
