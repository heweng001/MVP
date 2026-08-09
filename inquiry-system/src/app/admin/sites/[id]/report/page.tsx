import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { SiteMonthlyReportView } from "@/components/SiteMonthlyReportView";
import { SiteReportAdminBar } from "@/components/SiteReportAdminBar";
import { appUrl } from "@/lib/constants";
import { parseHiddenSections } from "@/lib/report-editorial";
import { getReport, parseReportPayload } from "@/lib/site-report";

type Ctx = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string; month?: string }>;
};

export default async function SiteReportPage({ params, searchParams }: Ctx) {
  const { id } = await params;
  const sp = await searchParams;
  const site = await prisma.site.findUnique({
    where: { id },
    include: { client: true },
  });
  if (!site) notFound();

  const now = new Date();
  const year = Number(sp.year) || now.getFullYear();
  const month = Number(sp.month) || now.getMonth() + 1;
  const y = Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : now.getFullYear();
  const m =
    Number.isInteger(month) && month >= 1 && month <= 12 ? month : now.getMonth() + 1;

  const report = await getReport(id, y, m);
  const payload = report ? parseReportPayload(report.payload) : null;

  return (
    <div className="space-y-4 max-w-5xl">
      <PageHeader
        title={`月度报表 · ${site.domain}`}
        hint={`${site.client.name} · 询盘与 GSC/GA 均为所选自然月；导出 PDF 请用「预览」打开客户页`}
      />

      <div className="flex flex-wrap gap-3 text-sm print:hidden">
        <Link href="/admin/sites" className="text-[var(--brand)] hover:underline">
          ← 返回网站列表
        </Link>
        <Link
          href={`/admin/sites/${site.id}/gsc`}
          className="text-[var(--brand)] hover:underline"
        >
          GSC 数据
        </Link>
        <Link
          href={`/admin/sites/${site.id}/ga`}
          className="text-[var(--brand)] hover:underline"
        >
          GA4 数据
        </Link>
        <Link href="/admin/report-template" className="text-[var(--brand)] hover:underline">
          查看模版案例
        </Link>
      </div>

      <SiteReportAdminBar
        siteId={site.id}
        year={y}
        month={m}
        publicUrl={report ? `${appUrl()}/r/${report.viewToken}` : ""}
        workDone={report?.workDone || ""}
        nextPlan={report?.nextPlan || ""}
        highlightsEdit={report?.highlightsEdit || ""}
        autoHighlights={payload?.highlights || []}
        hiddenSections={parseHiddenSections(report?.hiddenSections)}
        hasReport={Boolean(report && payload)}
      />

      {payload ? (
        <SiteMonthlyReportView
          payload={payload}
          workDone={report?.workDone || ""}
          nextPlan={report?.nextPlan || ""}
          highlightsEdit={report?.highlightsEdit || ""}
          hiddenSections={parseHiddenSections(report?.hiddenSections)}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--line)] bg-white px-4 py-10 text-center text-sm text-[var(--muted)]">
          尚未生成 {y}年{m}月 报告。可先打开「模版案例」查看版式，再点上方「生成报告」。
        </div>
      )}
    </div>
  );
}
