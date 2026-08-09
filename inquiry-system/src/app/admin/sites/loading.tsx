export default function SitesLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-7 w-28 rounded-md bg-black/[0.06]" />
      <div className="flex flex-wrap gap-2">
        <div className="h-9 w-24 rounded-lg bg-black/[0.06]" />
        <div className="h-9 w-24 rounded-lg bg-black/[0.06]" />
        <div className="h-9 w-24 rounded-lg bg-black/[0.06]" />
        <div className="h-9 w-20 rounded-lg bg-black/[0.06] ml-auto" />
      </div>
      <div className="rounded-xl border border-[var(--line)] bg-white overflow-hidden">
        <div className="h-10 border-b border-[var(--line)] bg-black/[0.03]" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-12 border-b border-[var(--line)] last:border-0 px-4 flex items-center gap-3"
          >
            <div className="h-3 w-16 rounded bg-black/[0.06]" />
            <div className="h-3 flex-1 max-w-[12rem] rounded bg-black/[0.06]" />
            <div className="h-3 w-24 rounded bg-black/[0.06] ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
