import { prisma } from "@/lib/prisma";
import { SiteList } from "@/components/SiteList";
import { appUrl } from "@/lib/constants";

export default async function SitesPage({
  searchParams,
}: {
  searchParams: Promise<{
    clientId?: string;
    siteType?: string;
    q?: string;
    enabled?: string;
  }>;
}) {
  const sp = await searchParams;
  const clientId = sp.clientId || "";
  const siteType = sp.siteType || "";
  const q = (sp.q || "").trim();
  const enabled = sp.enabled || "";

  const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });
  const sites = await prisma.site.findMany({
    where: {
      ...(clientId ? { clientId } : {}),
      ...(siteType ? { siteType } : {}),
      ...(enabled === "1" ? { enabled: true } : enabled === "0" ? { enabled: false } : {}),
      ...(q
        ? {
            OR: [{ domain: { contains: q } }, { client: { name: { contains: q } } }],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      client: true,
      forms: true,
      _count: { select: { forms: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">网站列表</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          管理客户下属网站；右侧「配置表单」进行 site_key 与收件配置。
        </p>
      </div>
      <SiteList
        ingestUrl={`${appUrl()}/api/ingest`}
        filters={{ clientId, siteType, q, enabled }}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        initialSites={sites.map((s) => ({
          id: s.id,
          domain: s.domain,
          siteType: s.siteType,
          startDate: s.startDate?.toISOString() ?? null,
          endDate: s.endDate?.toISOString() ?? null,
          siteKey: s.siteKey,
          productKeywords: s.productKeywords,
          spamExtraWords: s.spamExtraWords,
          enabled: s.enabled,
          clientId: s.clientId,
          clientName: s.client.name,
          forms: s.forms.map((f) => ({
            id: f.id,
            formId: f.formId,
            label: f.label,
            toEmails: f.toEmails,
            ccEmails: f.ccEmails,
            enabled: f.enabled,
          })),
          formCount: s._count.forms,
        }))}
      />
    </div>
  );
}
