import { notFound } from "next/navigation";
import { SiteMonthlyReportView } from "@/components/SiteMonthlyReportView";
import { PrintButton } from "@/components/PrintButton";
import { getReportByToken, parseReportPayload } from "@/lib/site-report";

type Ctx = { params: Promise<{ token: string }> };

export default async function PublicReportPage({ params }: Ctx) {
  const { token } = await params;
  const report = await getReportByToken(token);
  if (!report) notFound();
  const payload = parseReportPayload(report.payload);
  if (!payload) notFound();

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="max-w-5xl mx-auto px-4 py-6 md:py-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div>
            <p className="text-xs text-[var(--muted)]">贸牛 · 网站月度报告</p>
            <p className="text-sm font-medium">
              {payload.clientName} · {payload.domain}
            </p>
            <p className="text-[11px] text-[var(--muted)] mt-1">
              导出：点击右侧按钮 → 目标打印机选「另存为 PDF」
            </p>
          </div>
          <PrintButton label="导出 PDF" />
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4 md:p-6 shadow-sm">
          <SiteMonthlyReportView
            payload={payload}
            workDone={report.workDone}
            nextPlan={report.nextPlan}
          />
        </div>
      </div>
    </div>
  );
}
