import Link from "next/link";

export function HelpCallout({
  title,
  children,
  guideHref = "/admin/guide",
}: {
  title?: string;
  children: React.ReactNode;
  guideHref?: string | null;
}) {
  return (
    <aside className="rounded-xl border border-teal-200 bg-teal-50/80 px-4 py-3 text-sm text-[var(--brand-ink)]">
      {title ? <div className="font-medium mb-1.5">{title}</div> : null}
      <div className="space-y-1.5 text-[13px] leading-relaxed text-[#134e4a]">{children}</div>
      {guideHref ? (
        <div className="mt-2">
          <Link href={guideHref} className="text-[var(--brand)] underline underline-offset-2">
            查看完整接入说明 →
          </Link>
        </div>
      ) : null}
    </aside>
  );
}
