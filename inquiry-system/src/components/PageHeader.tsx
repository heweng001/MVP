"use client";

import type { ReactNode } from "react";

export function PageHeader({
  title,
  hint,
  actions,
}: {
  title: string;
  /** 标题右侧小图标悬停时显示 */
  hint?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div className="flex items-center gap-2 min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--ink)]">{title}</h1>
        {hint ? (
          <span className="relative group inline-flex shrink-0">
            <button
              type="button"
              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--panel)] text-[11px] font-semibold text-[var(--muted)] hover:border-[var(--brand)] hover:text-[var(--brand)]"
              aria-label="说明"
            >
              i
            </button>
            <span
              role="tooltip"
              className="pointer-events-none absolute left-0 top-full z-40 mt-2 w-72 max-w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-xs leading-relaxed text-[var(--ink)] shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-opacity"
            >
              {hint}
            </span>
          </span>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
