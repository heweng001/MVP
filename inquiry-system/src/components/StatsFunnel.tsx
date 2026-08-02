import Link from "next/link";
import type { SiteMonthStat } from "@/lib/stats";
import { funnelLayers } from "@/lib/stats";

function pct(n: number) {
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function layerHref(key: string, year: number, month: number) {
  if (key === "submitted" || key === "after_auto") {
    return `/admin/inquiries?tab=all&year=${year}&month=${month}`;
  }
  if (key === "after_review" || key === "unmarked_plus_valid") {
    return `/admin/inquiries?tab=forwarded&year=${year}&month=${month}`;
  }
  return `/admin/inquiries?tab=valid&year=${year}&month=${month}`;
}

export function StatsFunnel({
  current,
  year,
  month,
}: {
  current: SiteMonthStat;
  year: number;
  month: number;
}) {
  const layers = funnelLayers(current);
  const max = Math.max(layers[0]?.value || 1, 1);
  const overallRate = current.total > 0 ? current.valid / current.total : null;

  return (
    <div className="bg-[var(--panel)] border border-[var(--line)] rounded-lg px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2.5">
        <div className="flex items-baseline gap-2 min-w-0">
          <div className="text-[13px] font-medium shrink-0">本月转化漏斗</div>
          <p className="text-[11px] text-[var(--muted)] truncate">
            {year}年{month}月 · 逐层 = 上一步 − 本步剔除
          </p>
        </div>
        <div className="text-[11px] text-[var(--muted)] shrink-0">
          总转化率{" "}
          <span className="text-[var(--brand)] font-medium tabular-nums">
            {overallRate == null ? "—" : pct(overallRate)}
          </span>
          <span className="ml-1 text-[10px]">(标记有效 / 本月提交)</span>
        </div>
      </div>

      <div className="space-y-1">
        {layers.map((layer, idx) => {
          const prev = idx === 0 ? null : layers[idx - 1];
          const widthPct = Math.max(8, Math.round((layer.value / max) * 100));
          const stepRate = prev && prev.value > 0 ? layer.value / prev.value : null;

          return (
            <Link
              key={layer.key}
              href={layerHref(layer.key, year, month)}
              title={layer.hint}
              className="grid grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:grid-cols-[9rem_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3 rounded-md px-1 py-0.5 hover:bg-black/[0.02]"
            >
              <div className="min-w-0">
                <div className="text-[12px] text-[var(--ink)] truncate leading-tight">{layer.label}</div>
                {layer.removedLabel ? (
                  <div className="text-[10px] text-[var(--muted)] tabular-nums leading-tight">
                    −{layer.removedLabel} {layer.removed}
                    {stepRate != null ? ` · ${pct(stepRate)}` : ""}
                  </div>
                ) : layer.key === "unmarked_plus_valid" ? (
                  <div className="text-[10px] text-[var(--muted)] leading-tight">
                    待标记+有效
                  </div>
                ) : stepRate != null ? (
                  <div className="text-[10px] text-[var(--muted)] tabular-nums leading-tight">
                    转化 {pct(stepRate)}
                  </div>
                ) : (
                  <div className="text-[10px] text-[var(--muted)] leading-tight">起点</div>
                )}
              </div>

              <div className="h-5 sm:h-6 flex items-center">
                <div
                  className="h-full rounded-sm bg-gradient-to-r from-teal-600/85 to-teal-400/70 group-hover:from-teal-700"
                  style={{ width: `${widthPct}%`, minWidth: layer.value > 0 ? "4px" : 0 }}
                />
              </div>

              <div className="text-right tabular-nums whitespace-nowrap pl-1">
                <span className="text-sm font-semibold text-[var(--brand-ink)]">{layer.value}</span>
                <span className="ml-1.5 text-[10px] text-[var(--muted)]">{pct(layer.value / max)}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
