export function HelpCallout({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
  /** @deprecated */
  guideHref?: string | null;
}) {
  return (
    <aside className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-sm shadow-sm">
      {title ? <div className="font-medium text-[var(--ink)] mb-1">{title}</div> : null}
      <div className="space-y-1.5 text-[13px] leading-relaxed text-[var(--muted)]">{children}</div>
    </aside>
  );
}
