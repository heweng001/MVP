import type { ReportFunnelStep } from "@/lib/site-report";

export function ReportFunnel({
  title,
  steps,
  footnote,
}: {
  title: string;
  steps: ReportFunnelStep[];
  footnote?: string;
}) {
  const max = Math.max(1, ...steps.map((s) => s.value));

  return (
    <section className="rounded-xl border border-[var(--line)] bg-white p-4 space-y-3 print:break-inside-avoid">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="space-y-2">
        {steps.map((step, i) => {
          const widthPct = Math.max(12, Math.round((step.value / max) * 100));
          const prev = i > 0 ? steps[i - 1].value : null;
          const rate =
            prev != null && prev > 0 ? `${((step.value / prev) * 100).toFixed(0)}%` : null;
          return (
            <div key={step.key} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span>
                  <span className="text-[var(--muted)] mr-1.5 text-xs">{i + 1}.</span>
                  {step.label}
                </span>
                <span className="font-semibold tabular-nums shrink-0">
                  {step.value.toLocaleString()}
                  {rate ? (
                    <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                      ← {rate}
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-black/[0.04] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--brand)]/80"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
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
    </section>
  );
}
