export function HelpCallout({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
  /** @deprecated 接入说明页已移除，保留参数以免旧调用报错 */
  guideHref?: string | null;
}) {
  return (
    <aside className="rounded-xl border border-teal-200 bg-teal-50/80 px-4 py-3 text-sm text-[var(--brand-ink)]">
      {title ? <div className="font-medium mb-1.5">{title}</div> : null}
      <div className="space-y-1.5 text-[13px] leading-relaxed text-[#134e4a]">{children}</div>
    </aside>
  );
}
