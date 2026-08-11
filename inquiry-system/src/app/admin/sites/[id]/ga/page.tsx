import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { formatDateTime } from "@/lib/labels";
import { GaChannelsTable, GaLandingPagesTable } from "@/components/GaSortableTables";

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

  const channels = site.gaChannels.map((c) => ({
    id: c.id,
    channelGroup: c.channelGroup,
    sessions: c.sessions,
    engagedSessions: c.engagedSessions,
    conversions: c.conversions,
    engagementRate: c.engagementRate,
  }));
  const landings = site.gaLandingPages.map((p) => ({
    id: p.id,
    pagePath: p.pagePath,
    sessions: p.sessions,
    engagedSessions: p.engagedSessions,
    conversions: p.conversions,
    engagementRate: p.engagementRate,
  }));

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
            转化为 GA4「关键事件」次数，与询盘库条数可能不一致。落地页为会话 Top（默认最多约 100
            条），可点表头排序。自然搜索关键词请看 GSC。
          </div>
        </div>
        {site.gaLastError ? (
          <div className="sm:col-span-2 text-[var(--danger)] text-xs whitespace-pre-wrap">
            上次错误：{site.gaLastError}
          </div>
        ) : null}
      </div>

      <section className="bg-[var(--panel)] border border-[var(--line)] rounded-lg overflow-hidden">
        <div className="px-3 py-2 text-sm font-medium border-b border-[var(--line)] bg-black/[0.02] flex flex-wrap items-baseline justify-between gap-2">
          <span>渠道（{channels.length}）</span>
          <span className="text-xs font-normal text-[var(--muted)]">点表头排序</span>
        </div>
        <div className="overflow-x-auto">
          <GaChannelsTable rows={channels} />
        </div>
      </section>

      <section className="bg-[var(--panel)] border border-[var(--line)] rounded-lg overflow-hidden">
        <div className="px-3 py-2 text-sm font-medium border-b border-[var(--line)] bg-black/[0.02] flex flex-wrap items-baseline justify-between gap-2">
          <span>落地页（{landings.length}）</span>
          <span className="text-xs font-normal text-[var(--muted)]">
            会话 Top · 默认最多约 100 条 · 点表头排序
          </span>
        </div>
        <div className="overflow-x-auto">
          <GaLandingPagesTable rows={landings} />
        </div>
      </section>
    </div>
  );
}
