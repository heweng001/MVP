"use client";

import { useMemo } from "react";

export function KeywordsLineEditor({
  value,
  onChange,
  placeholder = "一行一个关键词",
  minHeight = 200,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const lines = useMemo(() => {
    if (!value) return 1;
    return value.split("\n").length;
  }, [value]);

  const lineLabels = useMemo(
    () => Array.from({ length: Math.max(lines, 1) }, (_, i) => String(i + 1)),
    [lines],
  );

  return (
    <div className="rounded-lg border border-[var(--line)] overflow-hidden bg-[#0f172a]">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 text-[11px] text-slate-400">
        <span>keywords</span>
        <span className="tabular-nums">{lines} 行</span>
      </div>
      <div className="flex font-mono text-[13px] leading-6">
        <div
          aria-hidden
          className="select-none shrink-0 text-right text-slate-500 bg-[#020617] px-2 py-2 border-r border-white/10 tabular-nums"
          style={{ minHeight }}
        >
          {lineLabels.map((n) => (
            <div key={n}>{n}</div>
          ))}
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          className="flex-1 resize-y bg-transparent text-slate-100 px-3 py-2 outline-none placeholder:text-slate-500 min-w-0"
          style={{ minHeight }}
        />
      </div>
    </div>
  );
}
