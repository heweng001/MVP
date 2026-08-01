import { prisma } from "@/lib/prisma";
import { BlacklistForm } from "@/components/BlacklistForm";
import { PageHeader } from "@/components/PageHeader";

export default async function BlacklistPage() {
  const sites = await prisma.site.findMany({ orderBy: { domain: "asc" } });
  const items = await prisma.blacklistEntry.findMany({
    orderBy: { createdAt: "desc" },
    include: { site: true },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="黑名单"
        hint={
          <div className="space-y-1.5">
            <p>手动维护。命中后垃圾分直接拉高，通常会被自动拦截。</p>
            <p>
              <strong>邮箱</strong>：完整地址；<strong>邮箱域名</strong>
              ：如 spam-seo.com（勿拉黑 gmail.com）；
              <strong>正文 URL</strong>：正文里出现的推广域名。
            </p>
            <p>客户点「无效」不会自动加入此处，需你确认后再添加。</p>
          </div>
        }
      />
      <BlacklistForm sites={sites.map((s) => ({ id: s.id, name: s.domain }))} />
      <div className="bg-white border border-[var(--line)] rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-[var(--muted)]">
            <tr>
              <th className="px-4 py-2.5 font-medium">类型</th>
              <th className="px-4 py-2.5 font-medium">值</th>
              <th className="px-4 py-2.5 font-medium">范围</th>
              <th className="px-4 py-2.5 font-medium">原因</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-t border-[var(--line)]">
                <td className="px-4 py-2">{i.type}</td>
                <td className="px-4 py-2">{i.value}</td>
                <td className="px-4 py-2">{i.site?.domain || "全局"}</td>
                <td className="px-4 py-2 text-[var(--muted)]">{i.reason || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
