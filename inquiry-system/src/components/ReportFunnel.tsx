import type { ReportFunnelStep } from "@/lib/site-report";
import { momLabel } from "@/lib/site-report";

function formatValue(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString();
}

function DualBars({
  curr,
  prev,
  baseline,
}: {
  curr: number | null;
  prev: number | null | undefined;
  baseline: number;
}) {
  const currW =
    curr == null ? 0 : Math.max(curr > 0 ? 8 : 0, Math.round((curr / baseline) * 100));
  const prevW =
    prev == null || !Number.isFinite(prev)
      ? 0
      : Math.max(prev > 0 ? 8 : 0, Math.round((prev / baseline) * 100));

  return (
    <div className="space-y-1">
      <div className="h-2 rounded-full bg-black/[0.04] overflow-hidden">
        <div
          className={`h-full rounded-full bg-slate-700 ${curr == null ? "opacity-30" : ""}`}
          style={{ width: `${curr == null ? 12 : currW}%` }}
          title="本月"
        />
      </div>
      <div className="h-2 rounded-full bg-black/[0.04] overflow-hidden">
        {prev != null && Number.isFinite(prev) ? (
          <div
            className="h-full rounded-full bg-slate-300"
            style={{ width: `${prevW}%` }}
            title="上月"
          />
        ) : (
          <div className="h-full w-3 rounded-full bg-slate-200/80" title="无上月数据" />
        )}
      </div>
    </div>
  );
}

export function ReportFunnel({
  title,
  steps,
  footnote,
  compact,
  showLegend,
}: {
  title: string;
  steps: ReportFunnelStep[];
  footnote?: string;
  /** 嵌套在分组卡片内时去掉外框 */
  compact?: boolean;
  showLegend?: boolean;
}) {
  const baseline = Math.max(
    1,
    ...steps.flatMap((s) => [
      s.value != null && Number.isFinite(s.value) ? s.value : 0,
      s.prevValue != null && Number.isFinite(s.prevValue) ? s.prevValue : 0,
    ]),
  );

  const body = (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className={`font-semibold ${compact ? "text-xs text-[var(--muted)]" : "text-sm"}`}>
          {title}
        </h2>
        {showLegend ? (
          <div className="flex items-center gap-3 text-[10px] text-[var(--muted)] shrink-0">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-1.5 w-3 rounded-sm bg-slate-700" />
              本月
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-1.5 w-3 rounded-sm bg-slate-300" />
              上月
            </span>
          </div>
        ) : null}
      </div>
      <div className="space-y-2.5">
        {steps.map((step, i) => {
          const prevLayer = i > 0 ? steps[i - 1].value : null;
          const rate =
            prevLayer != null &&
            prevLayer > 0 &&
            step.value != null &&
            Number.isFinite(step.value)
              ? `${((step.value / prevLayer) * 100).toFixed(0)}%`
              : null;
          const mom =
            step.value != null ? momLabel(step.value, step.prevValue, undefined) : null;
          const momColor =
            !mom || mom.better == null
              ? "text-[var(--muted)]"
              : mom.better
                ? "text-emerald-700"
                : "text-rose-700";

          return (
            <div key={step.key} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span>
                  <span className="text-[var(--muted)] mr-1.5 text-xs">{i + 1}.</span>
                  {step.label}
                </span>
                <span className="tabular-nums shrink-0 text-right text-xs sm:text-sm">
                  <span className="font-semibold text-sm">本月 {formatValue(step.value)}</span>
                  <span className="mx-1.5 text-[var(--muted)]">·</span>
                  <span className="text-[var(--muted)]">上月 {formatValue(step.prevValue)}</span>
                  {mom ? (
                    <span className={`ml-2 font-medium ${momColor}`}>{mom.text}</span>
                  ) : null}
                  {rate ? (
                    <span className="ml-2 text-[var(--muted)]">← {rate}</span>
                  ) : null}
                </span>
              </div>
              <DualBars curr={step.value} prev={step.prevValue} baseline={baseline} />
              {step.hint ? (
                <p className="text-[10px] text-[var(--muted)] leading-snug">{step.hint}</p>
              ) : null}
            </div>
          );
        })}
      </div>
      {footnote ? (
        <p className="text-[10px] text-[var(--muted)] leading-relaxed border-t border-[var(--line)] pt-2">
          {footnote}
        </p>
      ) : null}
    </>
  );

  if (compact) {
    return <div className="space-y-2">{body}</div>;
  }

  return (
    <section className="rounded-xl border border-[var(--line)] bg-white p-4 space-y-3 print:break-inside-avoid">
      {body}
    </section>
  );
}

/** 搜索可见性：上页面漏斗 + 下关键词漏斗 */
export function SearchVisibilityFunnels({
  title,
  pageSteps,
  keywordSteps,
}: {
  title: string;
  pageSteps: ReportFunnelStep[];
  keywordSteps: ReportFunnelStep[];
}) {
  return (
    <section className="rounded-xl border border-[var(--line)] bg-white p-4 space-y-4 print:break-inside-avoid">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <div className="flex items-center gap-3 text-[10px] text-[var(--muted)] shrink-0">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-1.5 w-3 rounded-sm bg-slate-700" />
            本月
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-1.5 w-3 rounded-sm bg-slate-300" />
            上月
          </span>
        </div>
      </div>
      <ReportFunnel title="页面覆盖" steps={pageSteps} compact />
      <div className="border-t border-[var(--line)]" />
      <ReportFunnel title="关键词排名" steps={keywordSteps} compact />
      <p className="text-[10px] text-[var(--muted)] leading-relaxed border-t border-[var(--line)] pt-2">
        每层上下两条分别为本月 / 上月，宽度按本段内本月与上月最大值对齐。箭头旁为相对上一层占比（本月）。可见页/词为该自然月
        GSC 有展示数据，不是完整索引库。
      </p>
    </section>
  );
}
