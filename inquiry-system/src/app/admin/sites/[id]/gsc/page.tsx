import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { formatDateTime } from "@/lib/labels";

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
            「页面」为同期有展示的 URL 数，不是完整收录库。排名为周期平均 position。
          </div>
        </div>
        {site.gscLastError ? (
          <div className="sm:col-span-2 text-[var(--danger)] text-xs whitespace-pre-wrap">
            上次错误：{site.gscLastError}
          </div>
        ) : null}
      </div>

      <section className="bg-[var(--panel)] border border-[var(--line)] rounded-lg overflow-hidden">
        <div className="px-3 py-2 text-sm font-medium border-b border-[var(--line)] bg-black/[0.02]">
          关键词（{site.gscKeywords.length}）
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="text-left text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">关键词</th>
                <th className="px-3 py-2">平均排名</th>
                <th className="px-3 py-2">点击</th>
                <th className="px-3 py-2">展示</th>
                <th className="px-3 py-2">CTR</th>
              </tr>
            </thead>
            <tbody>
              {site.gscKeywords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-[var(--muted)]">
                    暂无数据。请在新加坡 worker 同步，或先在信息核对中维护目标关键词。
                  </td>
                </tr>
              ) : (
                site.gscKeywords.map((k) => (
                  <tr key={k.id} className="border-t border-[var(--line)]">
                    <td className="px-3 py-2">{k.keyword}</td>
                    <td className="px-3 py-2">
                      {k.impressions > 0 ? k.position.toFixed(1) : "—"}
                    </td>
                    <td className="px-3 py-2">{k.clicks}</td>
                    <td className="px-3 py-2">{k.impressions}</td>
                    <td className="px-3 py-2">
                      {k.impressions > 0 ? `${(k.ctr * 100).toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-[var(--panel)] border border-[var(--line)] rounded-lg overflow-hidden">
        <div className="px-3 py-2 text-sm font-medium border-b border-[var(--line)] bg-black/[0.02]">
          有展示的页面（{site.gscPages.length}）
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="text-left text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">页面</th>
                <th className="px-3 py-2">平均排名</th>
                <th className="px-3 py-2">点击</th>
                <th className="px-3 py-2">展示</th>
              </tr>
            </thead>
            <tbody>
              {site.gscPages.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-[var(--muted)]">
                    暂无页面数据
                  </td>
                </tr>
              ) : (
                site.gscPages.map((p) => (
                  <tr key={p.id} className="border-t border-[var(--line)]">
                    <td className="px-3 py-2 break-all">
                      <a
                        href={p.pageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--brand)] hover:underline"
                      >
                        {p.pageUrl}
                      </a>
                    </td>
                    <td className="px-3 py-2">{p.position.toFixed(1)}</td>
                    <td className="px-3 py-2">{p.clicks}</td>
                    <td className="px-3 py-2">{p.impressions}</td>
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
