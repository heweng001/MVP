import type { ReactNode } from "react";
import type { SiteReportPayload } from "@/lib/site-report";
import { momLabel } from "@/lib/site-report";
import {
  isSectionHidden,
  parseHiddenSections,
  resolveHighlights,
  type ReportSectionKey,
} from "@/lib/report-editorial";
import { ReportFunnel, SearchVisibilityFunnels } from "./ReportFunnel";

function pct(rate: number | null | undefined) {
  if (rate == null || !Number.isFinite(rate)) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

/** GA 平均互动时长（秒）→ 可读文案 */
function formatDuration(sec: number | null | undefined) {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return "—";
  const s = Math.round(sec);
  if (s < 60) return `${s}秒`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r > 0 ? `${m}分${r}秒` : `${m}分`;
}

function Mom({
  curr,
  prev,
  invertBetter,
}: {
  curr: number;
  prev: number | null | undefined;
  invertBetter?: boolean;
}) {
  const m = momLabel(curr, prev, { invertBetter });
  const color =
    m.better == null
      ? "text-[var(--muted)]"
      : m.better
        ? "text-emerald-700"
        : "text-rose-700";
  return <span className={`text-xs ${color}`}>{m.text}</span>;
}

function KpiCard({
  label,
  value,
  mom,
  hint,
}: {
  label: string;
  value: string;
  mom?: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-white px-3 py-3 print:break-inside-avoid">
      <div className="text-[11px] text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-xl font-semibold tracking-tight">{value}</div>
      {mom ? <div className="mt-1">{mom}</div> : null}
      {hint ? <div className="mt-1 text-[10px] text-[var(--muted)]">{hint}</div> : null}
    </div>
  );
}

export function SiteMonthlyReportView({
  payload,
  workDone = "",
  nextPlan = "",
  highlightsEdit = "",
  hiddenSections: hiddenProp,
  banner,
}: {
  payload: SiteReportPayload;
  workDone?: string;
  nextPlan?: string;
  /** 人工/AI 定稿要点；空则用自动生成 */
  highlightsEdit?: string;
  /** 隐藏板块 key 列表，或 JSON 字符串 */
  hiddenSections?: ReportSectionKey[] | string[];
  /** 顶部提示，如「模版案例」 */
  banner?: string;
}) {
  const { kpi, prev } = payload;
  const hidden = Array.isArray(hiddenProp)
    ? (hiddenProp as ReportSectionKey[])
    : parseHiddenSections(typeof hiddenProp === "string" ? hiddenProp : "[]");
  const show = (key: ReportSectionKey) => !isSectionHidden(hidden, key);
  const highlights = resolveHighlights(payload.highlights, highlightsEdit);
  const showSearch = show("searchFunnel");
  const showTraffic = show("trafficFunnel");

  return (
    <article className="space-y-6 text-[var(--ink)] print:space-y-4">
      {banner ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 print:hidden">
          {banner}
        </div>
      ) : null}

      <header className="border-b border-[var(--line)] pb-4 print:break-inside-avoid">
        <p className="text-xs text-[var(--muted)] tracking-wide">网站月度运营报告</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {payload.clientName}
          <span className="text-[var(--muted)] font-normal"> · </span>
          {payload.domain}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {payload.periodLabel}
          {" · "}
          {payload.siteType}
          {" · 生成于 "}
          {payload.generatedAt.slice(0, 10)}
        </p>
      </header>

      {show("highlights") ? (
        <section className="space-y-2 print:break-inside-avoid">
          <h2 className="text-sm font-semibold">本月要点</h2>
          <ul className="list-disc pl-5 text-sm space-y-1 leading-relaxed">
            {highlights.length ? (
              highlights.map((h) => <li key={h}>{h}</li>)
            ) : (
              <li className="text-[var(--muted)] list-none -ml-5">（暂无要点）</li>
            )}
          </ul>
        </section>
      ) : null}

      {showSearch || showTraffic ? (
        <section
          className={`grid gap-4 ${showSearch && showTraffic ? "md:grid-cols-2" : ""}`}
        >
          {showSearch ? (
            <SearchVisibilityFunnels
              title={payload.searchFunnel.title}
              pageSteps={payload.searchFunnel.pageSteps}
              keywordSteps={payload.searchFunnel.keywordSteps}
            />
          ) : null}
          {showTraffic ? (
            <ReportFunnel
              title={payload.trafficFunnel.title}
              steps={payload.trafficFunnel.steps}
              showLegend
              footnote="每层上下两条为本月 / 上月。浏览量→会话→互动会话与询盘均为同一自然月口径。非无效 = 标记有效 + 未标记。"
            />
          ) : null}
        </section>
      ) : null}

      {show("kpi") ? (
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">核心指标</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <KpiCard
            label="搜索点击"
            value={kpi.gscClicks.toLocaleString()}
            mom={<Mom curr={kpi.gscClicks} prev={prev?.gscClicks} />}
          />
          <KpiCard
            label="搜索展示"
            value={kpi.gscImpressions.toLocaleString()}
            mom={<Mom curr={kpi.gscImpressions} prev={prev?.gscImpressions} />}
          />
          <KpiCard
            label="搜索 CTR"
            value={pct(kpi.gscCtr)}
            mom={
              <Mom
                curr={kpi.gscCtr}
                prev={prev?.gscCtr}
              />
            }
          />
          <KpiCard
            label="平均排名"
            value={kpi.gscAvgPosition != null ? kpi.gscAvgPosition.toFixed(1) : "—"}
            mom={
              kpi.gscAvgPosition != null && prev?.gscAvgPosition != null ? (
                <Mom curr={kpi.gscAvgPosition} prev={prev.gscAvgPosition} invertBetter />
              ) : (
                <span className="text-xs text-[var(--muted)]">—</span>
              )
            }
            hint="数字越小越好"
          />
          <KpiCard
            label="会话"
            value={kpi.gaSessions.toLocaleString()}
            mom={<Mom curr={kpi.gaSessions} prev={prev?.gaSessions} />}
          />
          <KpiCard
            label="用户"
            value={kpi.gaUsers.toLocaleString()}
            mom={<Mom curr={kpi.gaUsers} prev={prev?.gaUsers} />}
          />
          <KpiCard
            label="GA 转化"
            value={kpi.gaConversions.toLocaleString()}
            mom={<Mom curr={kpi.gaConversions} prev={prev?.gaConversions} />}
            hint="关键事件，≠询盘条数"
          />
          <KpiCard
            label="互动率"
            value={pct(kpi.gaEngagementRate)}
            mom={
              kpi.gaEngagementRate != null && prev?.gaEngagementRate != null ? (
                <Mom curr={kpi.gaEngagementRate} prev={prev.gaEngagementRate} />
              ) : (
                <span className="text-xs text-[var(--muted)]">—</span>
              )
            }
          />
          <KpiCard
            label="询盘提交"
            value={kpi.inquiry.total.toLocaleString()}
            mom={<Mom curr={kpi.inquiry.total} prev={prev?.inquiry.total} />}
            hint="自然月"
          />
          <KpiCard
            label="已转发"
            value={kpi.inquiry.forwarded.toLocaleString()}
            mom={<Mom curr={kpi.inquiry.forwarded} prev={prev?.inquiry.forwarded} />}
          />
          <KpiCard
            label="标记有效"
            value={kpi.inquiry.valid.toLocaleString()}
            mom={<Mom curr={kpi.inquiry.valid} prev={prev?.inquiry.valid} />}
          />
          <KpiCard
            label="有效占比"
            value={pct(kpi.inquiry.effectiveRate)}
            mom={
              <Mom
                curr={kpi.inquiry.effectiveRate}
                prev={prev?.inquiry.effectiveRate}
              />
            }
            hint="(有效+待标记)/已转发"
          />
        </div>
      </section>
      ) : null}

      {show("topKeywords") ? (
      <section className="space-y-2 print:break-inside-avoid">
        <h2 className="text-sm font-semibold">搜索表现 · Top 关键词</h2>
        <ReportTable
          empty="暂无关键词数据"
          headers={["关键词", "排名", "点击", "展示", "CTR"]}
          rows={payload.topKeywords.map((k) => [
            k.keyword,
            k.impressions > 0 ? k.position.toFixed(1) : "—",
            String(k.clicks),
            String(k.impressions),
            k.impressions > 0 ? pct(k.ctr) : "—",
          ])}
        />
      </section>
      ) : null}

      {show("opportunityKeywords") && payload.opportunityKeywords.length > 0 ? (
        <section className="space-y-2 print:break-inside-avoid">
          <h2 className="text-sm font-semibold">优化机会词</h2>
          <p className="text-xs text-[var(--muted)]">
            展示较高但 CTR 偏低，或排名约在 8～20，适合优先改标题/内容。
          </p>
          <ReportTable
            empty="—"
            headers={["关键词", "排名", "点击", "展示", "CTR"]}
            rows={payload.opportunityKeywords.map((k) => [
              k.keyword,
              k.position.toFixed(1),
              String(k.clicks),
              String(k.impressions),
              pct(k.ctr),
            ])}
          />
        </section>
      ) : null}

      {show("topPages") ? (
      <section className="space-y-2 print:break-inside-avoid">
        <h2 className="text-sm font-semibold">搜索表现 · Top 页面</h2>
        <ReportTable
          empty="暂无页面数据"
          headers={["页面", "排名", "点击", "展示"]}
          rows={payload.topPages.map((p) => [
            p.pageUrl,
            p.position.toFixed(1),
            String(p.clicks),
            String(p.impressions),
          ])}
        />
      </section>
      ) : null}

      {show("topChannels") ? (
      <section className="space-y-2 print:break-inside-avoid">
        <h2 className="text-sm font-semibold">流量渠道</h2>
        <ReportTable
          empty="暂无渠道数据"
          headers={["渠道", "会话", "互动会话", "转化", "互动率"]}
          rows={payload.topChannels.map((c) => [
            c.channelGroup,
            String(c.sessions),
            String(c.engagedSessions),
            String(c.conversions),
            pct(c.engagementRate),
          ])}
        />
      </section>
      ) : null}

      {show("topCountries") ? (
      <section className="space-y-2 print:break-inside-avoid">
        <h2 className="text-sm font-semibold">国家 / 地区流量</h2>
        <p className="text-xs text-[var(--muted)]">按会话数排序，来自 GA4 countryId。</p>
        <ReportTable
          empty="暂无国家数据（需重新同步自然月 GA）"
          headers={["国家/地区", "会话", "用户", "浏览量", "互动会话", "互动率"]}
          rows={(payload.topCountries || []).map((c) => [
            c.countryLabel || c.country || c.countryId || "—",
            String(c.sessions),
            String(c.users),
            String(c.pageViews),
            String(c.engagedSessions),
            pct(c.engagementRate),
          ])}
        />
      </section>
      ) : null}

      {show("topGaPages") ? (
      <section className="space-y-2 print:break-inside-avoid">
        <h2 className="text-sm font-semibold">主要页面</h2>
        <p className="text-xs text-[var(--muted)]">
          按浏览量排序；平均互动时长为 GA4 会话平均时长（秒）。
        </p>
        <ReportTable
          empty="暂无页面互动数据（需重新同步自然月 GA）"
          headers={["路径", "浏览量", "会话", "平均互动时长", "互动率", "跳出率"]}
          rows={(payload.topGaPages || []).map((p) => [
            p.pagePath,
            String(p.pageViews ?? 0),
            String(p.sessions),
            formatDuration(p.avgEngagementTimeSec),
            pct(p.engagementRate),
            pct(p.bounceRate),
          ])}
        />
      </section>
      ) : null}

      {show("topLandings") ? (
      <section className="space-y-2 print:break-inside-avoid">
        <h2 className="text-sm font-semibold">Top 落地页</h2>
        <p className="text-xs text-[var(--muted)]">按落地会话排序，含平均互动时长。</p>
        <ReportTable
          empty="暂无落地页数据"
          headers={["路径", "会话", "浏览量", "平均互动时长", "互动会话", "互动率"]}
          rows={payload.topLandings.map((p) => [
            p.pagePath,
            String(p.sessions),
            String(p.pageViews ?? 0),
            formatDuration(p.avgEngagementTimeSec),
            String(p.engagedSessions),
            pct(p.engagementRate),
          ])}
        />
      </section>
      ) : null}

      {show("workDone") || show("nextPlan") ? (
      <section
        className={`grid gap-4 print:break-inside-avoid ${
          show("workDone") && show("nextPlan") ? "md:grid-cols-2" : ""
        }`}
      >
        {show("workDone") ? (
        <div className="rounded-xl border border-[var(--line)] bg-white p-4">
          <h2 className="text-sm font-semibold">本月已做工作</h2>
          <pre className="mt-2 whitespace-pre-wrap text-sm leading-relaxed font-sans text-[var(--ink)]">
            {workDone.trim() || "（待补充）"}
          </pre>
        </div>
        ) : null}
        {show("nextPlan") ? (
        <div className="rounded-xl border border-[var(--line)] bg-white p-4">
          <h2 className="text-sm font-semibold">下月计划</h2>
          <pre className="mt-2 whitespace-pre-wrap text-sm leading-relaxed font-sans text-[var(--ink)]">
            {nextPlan.trim() || "（待补充）"}
          </pre>
        </div>
        ) : null}
      </section>
      ) : null}

      <footer className="text-[11px] text-[var(--muted)] leading-relaxed border-t border-[var(--line)] pt-3 space-y-1 print:break-inside-avoid">
        <p>
          口径说明：询盘、GSC、GA4 均为 {payload.periodLabel} 自然月（Asia/Shanghai
          {payload.meta.startDate && payload.meta.endDate
            ? `，数据窗 ${payload.meta.startDate}～${payload.meta.endDate}`
            : ""}
          ）。GSC/GA 常有 1～3 天延迟，月内报告为月初至「今天−延迟」的 MTD。
        </p>
        <p>
          GA「转化」为关键事件次数，与询盘库条数可能不一致；业务结果请以询盘为准。平均排名数字越小表示越好。
        </p>
        <p>
          自然月 SEO 快照
          {payload.meta.gscSyncedAt ? ` · 同步于 ${payload.meta.gscSyncedAt.slice(0, 10)}` : " · 尚未同步"}
          {"；"}
          GSC{payload.meta.gscEnabled ? "已开启" : "未开启"} / GA
          {payload.meta.gaEnabled ? "已开启" : "未开启"}。
        </p>
      </footer>
    </article>
  );
}

function ReportTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: string[][];
  empty: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[520px]">
          <thead className="text-left text-[var(--muted)] bg-black/[0.02]">
            <tr>
              {headers.map((h) => (
                <th key={h} className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={headers.length}
                  className="px-3 py-6 text-center text-[var(--muted)]"
                >
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={i} className="border-t border-[var(--line)]">
                  {r.map((cell, j) => (
                    <td
                      key={j}
                      className={`px-3 py-2 ${j === 0 ? "break-all max-w-md" : ""}`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
