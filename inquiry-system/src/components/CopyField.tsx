"use client";

import { useState } from "react";

export function CopyField({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div className="rounded-lg border border-[var(--line)] bg-black/[0.02] p-3">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs font-medium text-[var(--muted)]">{label}</span>
        <button
          type="button"
          onClick={copy}
          className="text-xs text-[var(--brand)] hover:underline shrink-0"
        >
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      <code className="block text-sm break-all font-mono">{value}</code>
      {hint ? <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed">{hint}</p> : null}
    </div>
  );
}
