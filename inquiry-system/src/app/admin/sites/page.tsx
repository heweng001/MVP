import { prisma } from "@/lib/prisma";
import { SiteList } from "@/components/SiteList";
import { PageHeader } from "@/components/PageHeader";
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
    <div>
      <PageHeader
        title="网站列表"
        hint={
          <div className="space-y-1.5">
            <p>管理客户下属网站；右侧「配置对接」按步骤安装插件并完成收件配置。</p>
            <p>
              保存网站<strong>开始/结束日期</strong>
              后，客户服务周期自动取所有站中最早开始、最晚结束。
            </p>
            <p>
              <strong>对接状态</strong>
              ：开启接收插件推送；关闭后拒收并降级走 WPForms 原生邮件。
            </p>
          </div>
        }
      />
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
