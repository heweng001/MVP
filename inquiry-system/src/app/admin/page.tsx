import { prisma } from "@/lib/prisma";
import {
  emptySiteStat,
  prevMonth,
  siteMonthStats,
  sumSiteStats,
} from "@/lib/stats";
import { PageHeader } from "@/components/PageHeader";
import { StatsFunnel } from "@/components/StatsFunnel";
import { StatsSiteTable } from "@/components/StatsSiteTable";
import Link from "next/link";

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp.year || now.getFullYear());
  const month = Number(sp.month || now.getMonth() + 1);
  const prev = prevMonth(year, month);

  const [statsRaw, prevStats, sites] = await Promise.all([
    siteMonthStats(undefined, year, month),
    siteMonthStats(undefined, prev.year, prev.month),
    prisma.site.findMany({ include: { client: true }, orderBy: { domain: "asc" } }),
  ]);

  const bySite = new Map(statsRaw.map((s) => [s.siteId, s]));
  const prevBySite: Record<string, (typeof prevStats)[number]> = Object.fromEntries(
    prevStats.map((s) => [s.siteId, s]),
  );

  // 全部网站都进列表（无询盘的补零）
  const stats = sites.map((site) => {
    const s = bySite.get(site.id) || emptySiteStat(site.id);
    return {
      ...s,
      siteId: site.id,
      domain: site.domain,
      clientName: site.client.name,
    };
  });

  // 漏斗只用真实有数据的合计即可（补零站点不影响）
  const totals = sumSiteStats(stats);

  return (
    <div className="space-y-4 flex flex-col min-h-[calc(100vh-8rem)]">
      <PageHeader
        title="统计概览"
        hint={
          <div className="space-y-1.5">
            <p>
              有效占比 = (标记有效 + 待标记) / 已转发 × 100%
            </p>
            <p>
              「拦截」= 自动垃圾 + 审核垃圾。漏斗含「未标记无效」层（待标记+有效）；列表含全部网站，默认按提交降序。
            </p>
          </div>
        }
        actions={
          <form className="flex gap-2 items-center text-sm">
            <input
              name="year"
              type="number"
              defaultValue={year}
              className="w-24 border border-[var(--line)] rounded-md px-2 py-1.5 bg-white"
            />
            <input
              name="month"
              type="number"
              min={1}
              max={12}
              defaultValue={month}
              className="w-20 border border-[var(--line)] rounded-md px-2 py-1.5 bg-white"
            />
            <button className="bg-[var(--brand)] text-white rounded-md px-3 py-1.5 text-[13px]">
              查询
            </button>
          </form>
        }
      />

      {sites.length === 0 ? (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--muted)]">
          还没有接入任何站点。请先创建{" "}
          <Link href="/admin/clients" className="text-[var(--brand)] underline underline-offset-2">
            客户
          </Link>{" "}
          和{" "}
          <Link href="/admin/sites" className="text-[var(--brand)] underline underline-offset-2">
            网站列表
          </Link>
          ，再点网站右侧「询盘配置」完成对接。
        </div>
      ) : null}

      <StatsFunnel current={totals} year={year} month={month} />

      <StatsSiteTable year={year} month={month} stats={stats} prevBySite={prevBySite} />
    </div>
  );
}
