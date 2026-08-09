import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { formatDateTime } from "@/lib/labels";

type Ctx = { params: Promise<{ id: string }> };

function pct(rate: number | null | undefined) {
  if (rate == null || !Number.isFinite(rate)) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

export default async function SiteGaPage({ params }: Ctx) {
  const { id } = await params;
  const site = await prisma.site.findUnique({
    where: { id },
    include: {
      client: true,
      gaLandingPages: { orderBy: [{ sessions: "desc" }, { conversions: "desc" }] },
      gaChannels: { orderBy: [{ sessions: "desc" }, { conversions: "desc" }] },
    },
  });
  if (!site) notFound();

  return (
    <div className="space-y-4 max-w-5xl">
      <PageHeader
        title={`GA4 · ${site.domain}`}
        hint={`${site.client.name} · 近 ${site.gaPeriodDays || 28} 天（数据常延迟 1～2 天）`}
      />

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/admin/sites" className="text-[var(--brand)] hover:underline">
          ← 返回网站列表
        </Link>
        <Link
          href={`/admin/sites/${site.id}/gsc`}
          className="text-[var(--brand)] hover:underline"
        >
          查看 GSC 数据
        </Link>
        <Link
          href={`/admin/sites/${site.id}/report`}
          className="text-[var(--brand)] hover:underline"
        >
          月度报表
        </Link>
      </div>

      <div className="bg-[var(--panel)] border border-[var(--line)] rounded-lg p-4 text-sm grid sm:grid-cols-2 gap-3">
        <div>
          <div className="text-[var(--muted)]">同步</div>
          <div>
            {site.gaSyncEnabled ? "已开启" : "未开启"}
            {site.gaLastSyncAt
              ? ` · 上次 ${formatDateTime(site.gaLastSyncAt.toISOString())}`
              : " · 尚未同步"}
          </div>
        </div>
        <div>
          <div className="text-[var(--muted)]">GA4 Property ID</div>
          <div className="break-all">{site.gaPropertyId || "—"}</div>
        </div>
        <div>
          <div className="text-[var(--muted)]">浏览量 / 会话 / 用户</div>
          <div>
            {site.gaPageViews.toLocaleString()} · {site.gaSessions.toLocaleString()} ·{" "}
            {site.gaUsers.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-[var(--muted)]">互动会话 / 互动率 / 转化</div>
          <div>
            {site.gaEngagedSessions.toLocaleString()} · {pct(site.gaEngagementRate)} ·{" "}
            {site.gaConversions.toLocaleString()}
          </div>
        </div>
        <div className="sm:col-span-2">
          <div className="text-[var(--muted)]">说明</div>
          <div className="text-[var(--muted)] text-xs leading-relaxed">
            转化为 GA4「关键事件」次数，与询盘库条数可能不一致。自然搜索关键词请看 GSC，不在此页。
          </div>
        </div>
        {site.gaLastError ? (
          <div className="sm:col-span-2 text-[var(--danger)] text-xs whitespace-pre-wrap">
            上次错误：{site.gaLastError}
          </div>
        ) : null}
      </div>

      <section className="bg-[var(--panel)] border border-[var(--line)] rounded-lg overflow-hidden">
        <div className="px-3 py-2 text-sm font-medium border-b border-[var(--line)] bg-black/[0.02]">
          渠道（{site.gaChannels.length}）
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="text-left text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">渠道组</th>
                <th className="px-3 py-2">会话</th>
                <th className="px-3 py-2">互动会话</th>
                <th className="px-3 py-2">转化</th>
                <th className="px-3 py-2">互动率</th>
              </tr>
            </thead>
            <tbody>
              {site.gaChannels.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-[var(--muted)]">
                    暂无数据。请开启同步并运行新加坡 seo-worker。
                  </td>
                </tr>
              ) : (
                site.gaChannels.map((c) => (
                  <tr key={c.id} className="border-t border-[var(--line)]">
                    <td className="px-3 py-2">{c.channelGroup}</td>
                    <td className="px-3 py-2">{c.sessions.toLocaleString()}</td>
                    <td className="px-3 py-2">{c.engagedSessions.toLocaleString()}</td>
                    <td className="px-3 py-2">{c.conversions.toLocaleString()}</td>
                    <td className="px-3 py-2">{pct(c.engagementRate)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-[var(--panel)] border border-[var(--line)] rounded-lg overflow-hidden">
        <div className="px-3 py-2 text-sm font-medium border-b border-[var(--line)] bg-black/[0.02]">
          落地页（{site.gaLandingPages.length}）
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="text-left text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">路径</th>
                <th className="px-3 py-2">会话</th>
                <th className="px-3 py-2">互动会话</th>
                <th className="px-3 py-2">转化</th>
                <th className="px-3 py-2">互动率</th>
              </tr>
            </thead>
            <tbody>
              {site.gaLandingPages.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-[var(--muted)]">
                    暂无落地页数据
                  </td>
                </tr>
              ) : (
                site.gaLandingPages.map((p) => (
                  <tr key={p.id} className="border-t border-[var(--line)]">
                    <td className="px-3 py-2 break-all font-mono text-xs">{p.pagePath}</td>
                    <td className="px-3 py-2">{p.sessions.toLocaleString()}</td>
                    <td className="px-3 py-2">{p.engagedSessions.toLocaleString()}</td>
                    <td className="px-3 py-2">{p.conversions.toLocaleString()}</td>
                    <td className="px-3 py-2">{pct(p.engagementRate)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
