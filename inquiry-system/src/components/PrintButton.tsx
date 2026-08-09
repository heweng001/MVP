"use client";

export function PrintButton({ label = "打印 / PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="border border-[var(--line)] rounded-lg px-3 py-1.5 text-sm print:hidden"
    >
      {label}
    </button>
  );
}
