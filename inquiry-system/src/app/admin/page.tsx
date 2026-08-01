import { prisma } from "@/lib/prisma";
import { siteMonthStats } from "@/lib/stats";
import { STATUS_LABELS } from "@/lib/constants";
import { HelpCallout } from "@/components/HelpCallout";
import Link from "next/link";

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp.year || now.getFullYear());
  const month = Number(sp.month || now.getMonth() + 1);

  const stats = await siteMonthStats(undefined, year, month);
  const sites = await prisma.site.findMany({
    include: { client: true },
  });
  const siteMap = new Map(sites.map((s) => [s.id, s]));

  const reviewCount = await prisma.inquiry.count({ where: { status: "review" } });
  const pendingCount = await prisma.inquiry.count({ where: { status: "pending" } });

  const totals = stats.reduce(
    (acc, s) => {
      acc.total += s.total;
      acc.forwarded += s.forwarded;
      acc.effective += s.effective;
      acc.autoSpam += s.autoSpam;
      acc.valid += s.valid;
      acc.timeoutUnmarked += s.timeoutUnmarked;
      acc.invalid += s.invalid;
      return acc;
    },
    {
      total: 0,
      forwarded: 0,
      effective: 0,
      autoSpam: 0,
      valid: 0,
      timeoutUnmarked: 0,
      invalid: 0,
    },
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">统计概览</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            有效占比 = (客户标有效 + 超时未标记) / 已转发数 · 时区 Asia/Shanghai
          </p>
        </div>
        <form className="flex gap-2 items-center text-sm">
          <input
            name="year"
            type="number"
            defaultValue={year}
            className="w-24 border border-[var(--line)] rounded-lg px-2 py-1.5 bg-white"
          />
          <input
            name="month"
            type="number"
            min={1}
            max={12}
            defaultValue={month}
            className="w-20 border border-[var(--line)] rounded-lg px-2 py-1.5 bg-white"
          />
          <button className="bg-[var(--brand)] text-white rounded-lg px-3 py-1.5">查询</button>
        </form>
      </div>

      {sites.length === 0 ? (
        <HelpCallout title="还没有接入任何站点">
          <p>
            请先创建{" "}
            <Link href="/admin/clients" className="underline">
              客户列表
            </Link>{" "}
            和{" "}
            <Link href="/admin/sites" className="underline">
              网站列表
            </Link>
            ，再在网站右侧「配置表单」拿到 site_key，按{" "}
            <Link href="/admin/guide" className="underline">
              接入说明
            </Link>{" "}
            配置 WordPress 插件。
          </p>
        </HelpCallout>
      ) : (
        <HelpCallout title="指标说明" guideHref={null}>
          <p>
            <strong>已转发</strong>：已成功发给客户的询盘。
            <strong className="ml-2">有效合计</strong>：客户点「有效」+「超时未标记」（发信后 72
            小时未点）。
            <strong className="ml-2">自动拦截</strong>：明显垃圾，未发给客户。
          </p>
        </HelpCallout>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "本月提交", value: totals.total },
          { label: "已转发", value: totals.forwarded },
          {
            label: "有效合计",
            value: totals.effective,
            sub: totals.forwarded ? pct(totals.effective / totals.forwarded) : "—",
          },
          { label: "自动拦截", value: totals.autoSpam },
          { label: "客户标有效", value: totals.valid },
          { label: "超时未标记", value: totals.timeoutUnmarked },
          { label: "客户标无效", value: totals.invalid },
          {
            label: "当前待判定 / 待标记",
            value: `${reviewCount}/${pendingCount}`,
          },
        ].map((c) => (
          <div key={c.label} className="bg-white border border-[var(--line)] rounded-xl p-4">
            <div className="text-xs text-[var(--muted)]">{c.label}</div>
            <div className="text-2xl font-semibold mt-1">{c.value}</div>
            {"sub" in c && c.sub ? (
              <div className="text-xs text-[var(--brand)] mt-1">有效占比 {c.sub}</div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="bg-white border border-[var(--line)] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--line)] font-medium">
          {year}年{month}月 · 按站点
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/[0.02] text-left text-[var(--muted)]">
              <tr>
                <th className="px-4 py-2">站点</th>
                <th className="px-4 py-2">客户</th>
                <th className="px-4 py-2">提交</th>
                <th className="px-4 py-2">拦截</th>
                <th className="px-4 py-2">已转发</th>
                <th className="px-4 py-2">有效</th>
                <th className="px-4 py-2">超时未标</th>
                <th className="px-4 py-2">无效</th>
                <th className="px-4 py-2">有效占比</th>
              </tr>
            </thead>
            <tbody>
              {stats.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-[var(--muted)]">
                    本月暂无数据
                  </td>
                </tr>
              ) : (
                stats.map((s) => {
                  const site = siteMap.get(s.siteId);
                  return (
                    <tr key={s.siteId} className="border-t border-[var(--line)]">
                      <td className="px-4 py-2">{site?.domain || s.siteId}</td>
                      <td className="px-4 py-2">{site?.client.name || "—"}</td>
                      <td className="px-4 py-2">{s.total}</td>
                      <td className="px-4 py-2">{s.autoSpam}</td>
                      <td className="px-4 py-2">{s.forwarded}</td>
                      <td className="px-4 py-2">{s.valid}</td>
                      <td className="px-4 py-2">{s.timeoutUnmarked}</td>
                      <td className="px-4 py-2">{s.invalid}</td>
                      <td className="px-4 py-2 font-medium">
                        {s.forwarded ? pct(s.effectiveRate) : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
