import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { formatDateTime } from "@/lib/labels";
import { GscKeywordsTable, GscPagesTable } from "@/components/GscSortableTables";

type Ctx = { params: Promise<{ id: string }> };

export default async function SiteGscPage({ params }: Ctx) {
  const { id } = await params;
  const site = await prisma.site.findUnique({
    where: { id },
    include: {
      client: true,
      promo: { select: { id: true } },
      gscKeywords: { orderBy: [{ impressions: "desc" }, { clicks: "desc" }] },
      gscPages: { orderBy: [{ impressions: "desc" }, { clicks: "desc" }] },
    },
  });
  if (!site) notFound();

  const keywords = site.gscKeywords.map((k) => ({
    id: k.id,
    keyword: k.keyword,
    position: k.position,
    clicks: k.clicks,
    impressions: k.impressions,
    ctr: k.ctr,
  }));
  const pages = site.gscPages.map((p) => ({
    id: p.id,
    pageUrl: p.pageUrl,
    position: p.position,
    clicks: p.clicks,
    impressions: p.impressions,
  }));

  return (
    <div className="space-y-4 max-w-5xl">
      <PageHeader
        title={`GSC · ${site.domain}`}
        hint={`${site.client.name} · 近 ${site.gscPeriodDays || 28} 天（数据常延迟 2～3 天）`}
      />

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/admin/sites" className="text-[var(--brand)] hover:underline">
          ← 返回网站列表
        </Link>
        <Link
          href={`/admin/sites/${site.id}/ga`}
          className="text-[var(--brand)] hover:underline"
        >
          查看 GA4 数据
        </Link>
        <Link
          href={`/admin/sites/${site.id}/report`}
          className="text-[var(--brand)] hover:underline"
        >
          月度报表
        </Link>
        {site.promo ? (
          <Link
            href={`/admin/promos/${site.promo.id}/keywords`}
            className="text-[var(--brand)] hover:underline"
          >
            编辑目标关键词
          </Link>
        ) : null}
      </div>

      <div className="bg-[var(--panel)] border border-[var(--line)] rounded-lg p-4 text-sm grid sm:grid-cols-2 gap-3">
        <div>
          <div className="text-[var(--muted)]">同步</div>
          <div>
            {site.gscSyncEnabled ? "已开启" : "未开启"}
            {site.gscLastSyncAt
              ? ` · 上次 ${formatDateTime(site.gscLastSyncAt.toISOString())}`
              : " · 尚未同步"}
          </div>
        </div>
        <div>
          <div className="text-[var(--muted)]">GSC 属性</div>
          <div className="break-all">{site.gscPropertyUrl || "—（将按域名猜测 sc-domain:）"}</div>
        </div>
        <div>
          <div className="text-[var(--muted)]">平均排名 / 词条 / 页面</div>
          <div>
            {site.gscAvgPosition != null ? site.gscAvgPosition.toFixed(1) : "—"}
            {" · "}
            {site.gscKeywordCount} 词 · {site.gscPageCount} 页
          </div>
        </div>
        <div>
          <div className="text-[var(--muted)]">说明</div>
          <div className="text-[var(--muted)] text-xs leading-relaxed">
            「页面」为同期有展示的 URL 数，不是完整收录库。下表为点击 Top（默认最多约 500
            条），可点表头排序。排名为周期平均 position。
          </div>
        </div>
        {site.gscLastError ? (
          <div className="sm:col-span-2 text-[var(--danger)] text-xs whitespace-pre-wrap">
            上次错误：{site.gscLastError}
          </div>
        ) : null}
      </div>

      <section className="bg-[var(--panel)] border border-[var(--line)] rounded-lg overflow-hidden">
        <div className="px-3 py-2 text-sm font-medium border-b border-[var(--line)] bg-black/[0.02] flex flex-wrap items-baseline justify-between gap-2">
          <span>关键词（{keywords.length}）</span>
          <span className="text-xs font-normal text-[var(--muted)]">
            点击 Top · 默认最多约 500 条 · 点表头排序
          </span>
        </div>
        <div className="overflow-x-auto">
          <GscKeywordsTable rows={keywords} />
        </div>
      </section>

      <section className="bg-[var(--panel)] border border-[var(--line)] rounded-lg overflow-hidden">
        <div className="px-3 py-2 text-sm font-medium border-b border-[var(--line)] bg-black/[0.02] flex flex-wrap items-baseline justify-between gap-2">
          <span>有展示的页面（{pages.length}）</span>
          <span className="text-xs font-normal text-[var(--muted)]">
            点击 Top · 默认最多约 500 条 · 点表头排序
          </span>
        </div>
        <div className="overflow-x-auto">
          <GscPagesTable rows={pages} />
        </div>
      </section>
    </div>
  );
}
