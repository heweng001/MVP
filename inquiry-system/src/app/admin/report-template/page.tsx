import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { SiteMonthlyReportView } from "@/components/SiteMonthlyReportView";
import { DEMO_NEXT_PLAN, DEMO_WORK_DONE, getDemoReportPayload } from "@/lib/report-demo";

export default function ReportTemplatePage() {
  const payload = getDemoReportPayload();

  return (
    <div className="space-y-4 max-w-5xl">
      <PageHeader
        title="月度报表 · 模版案例"
        hint="虚构数据，用于对照版式与口径；真实站点请在网站「月度报表」生成后，用客户预览链接导出 PDF。"
      />

      <div className="flex flex-wrap gap-3 text-sm print:hidden">
        <Link href="/admin/sites" className="text-[var(--brand)] hover:underline">
          ← 返回网站列表
        </Link>
      </div>

      <SiteMonthlyReportView
        payload={payload}
        workDone={DEMO_WORK_DONE}
        nextPlan={DEMO_NEXT_PLAN}
        banner="此为模版案例（示例科技 / demo.example.com），数据均为虚构，仅供版式与内容结构参考。"
      />
    </div>
  );
}
