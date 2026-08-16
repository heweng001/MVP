"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import type { SiteMonthStat } from "@/lib/stats";

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function MomDelta({ current, previous }: { current: number; previous: number }) {
  const delta = current - previous;
  if (delta === 0) {
    return <span className="text-[10px] text-[var(--muted)] tabular-nums">0</span>;
  }
  if (delta > 0) {
    return <span className="text-[10px] text-emerald-600 tabular-nums font-medium">+{delta}</span>;
  }
  return <span className="text-[10px] text-[var(--danger)] tabular-nums font-medium">{delta}</span>;
}

function StatLink({
  href,
  value,
  previous,
}: {
  href: string;
  value: number;
  previous: number;
}) {
  return (
    <div className="inline-flex items-baseline gap-1">
      <Link
        href={href}
        className="text-[var(--brand)] font-medium tabular-nums hover:underline underline-offset-2"
        onClick={(e) => e.stopPropagation()}
      >
        {value}
      </Link>
      <MomDelta current={value} previous={previous} />
    </div>
  );
}

function RateHint() {
  return (
    <span className="relative group inline-flex align-middle ml-1">
      <button
        type="button"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[var(--line)] bg-white text-[10px] font-semibold text-[var(--muted)] hover:border-[var(--brand)] hover:text-[var(--brand)]"
        aria-label="有效占比计算说明"
        onClick={(e) => e.stopPropagation()}
      >
        i
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-40 mt-2 w-64 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-xs leading-relaxed text-[var(--ink)] shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-opacity"
      >
        有效占比 = (标记有效 + 待标记) ÷ 已转发 × 100%。
        <br />
        列表「拦截」= DeepSeek 自动垃圾 + 历史审核垃圾。按询盘提交时间归属月份。
      </span>
    </span>
  );
}

function inquiryHref(year: number, month: number, siteId: string, tab: string) {
  const params = new URLSearchParams();
  params.set("tab", tab);
  params.set("year", String(year));
  params.set("month", String(month));
  if (siteId) params.set("siteId", siteId);
  return `/admin/inquiries?${params.toString()}`;
}

type SortKey =
  | "domain"
  | "clientName"
  | "total"
  | "intercepted"
  | "forwarded"
  | "invalid"
  | "pending"
  | "valid"
  | "effectiveRate";

type SortDir = "asc" | "desc";

type Row = SiteMonthStat & { domain: string; clientName: string };

function SortTh({
  label,
  col,
  sortKey,
  sortDir,
  onSort,
  className = "",
  extra,
}: {
  label: string;
  col: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
  extra?: ReactNode;
}) {
  const active = sortKey === col;
  return (
    <th className={`px-4 py-2.5 font-medium ${className}`}>
      <button
        type="button"
        onClick={() => onSort(col)}
        className={`inline-flex items-center gap-0.5 hover:text-[var(--ink)] ${
          active ? "text-[var(--brand)]" : ""
        }`}
      >
        {label}
        <span className="text-[10px] tabular-nums w-3 text-center">
          {active ? (sortDir === "desc" ? "↓" : "↑") : "↕"}
        </span>
      </button>
      {extra}
    </th>
  );
}

export function StatsSiteTable({
  year,
  month,
  stats,
  prevBySite,
}: {
  year: number;
  month: number;
  stats: Row[];
  prevBySite: Record<string, SiteMonthStat>;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function onSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "domain" || key === "clientName" ? "asc" : "desc");
  }

  const rows = useMemo(() => {
    const list = [...stats];
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      if (sortKey === "domain" || sortKey === "clientName") {
        return a[sortKey].localeCompare(b[sortKey], "zh") * dir;
      }
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === bv) return a.domain.localeCompare(b.domain, "zh");
      return (av < bv ? -1 : 1) * dir;
    });
    return list;
  }, [stats, sortKey, sortDir]);

  return (
    <div className="bg-[var(--panel)] border border-[var(--line)] rounded-lg overflow-hidden shadow-sm flex-1 min-h-0 flex flex-col">
      <div className="px-4 py-3 border-b border-[var(--line)] text-[13px] font-medium shrink-0">
        {year}年{month}月 · 按站点
        <span className="ml-2 text-[11px] font-normal text-[var(--muted)]">
          含全部网站；默认按提交降序，点击表头可排序；数值可跳转列表
        </span>
      </div>
      {/* 约 20 行可视高度：表头 + 20×行高 */}
      <div className="overflow-auto" style={{ height: "calc(2.5rem + 20 * 2.25rem)" }}>
        <table className="admin-table w-full text-sm min-w-[900px]">
          <thead className="bg-slate-50 text-left text-[var(--muted)] sticky top-0 z-10">
            <tr>
              <SortTh label="站点" col="domain" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortTh
                label="客户"
                col="clientName"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
              />
              <SortTh label="提交" col="total" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortTh
                label="拦截"
                col="intercepted"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
              />
              <SortTh
                label="已转发"
                col="forwarded"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
              />
              <SortTh
                label="无效"
                col="invalid"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
              />
              <SortTh
                label="待标记"
                col="pending"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
              />
              <SortTh label="有效" col="valid" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortTh
                label="有效占比"
                col="effectiveRate"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                className="whitespace-nowrap"
                extra={<RateHint />}
              />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-[var(--muted)]">
                  暂无网站
                </td>
              </tr>
            ) : (
              rows.map((s) => {
                const prev = prevBySite[s.siteId];
                const p = {
                  total: prev?.total ?? 0,
                  intercepted: prev?.intercepted ?? 0,
                  forwarded: prev?.forwarded ?? 0,
                  invalid: prev?.invalid ?? 0,
                  pending: prev?.pending ?? 0,
                  valid: prev?.valid ?? 0,
                };
                return (
                  <tr key={s.siteId} className="admin-tr h-9">
                    <td className="px-4 py-2">{s.domain}</td>
                    <td className="px-4 py-2">{s.clientName || "—"}</td>
                    <td className="px-4 py-2">
                      <StatLink
                        href={inquiryHref(year, month, s.siteId, "all")}
                        value={s.total}
                        previous={p.total}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <StatLink
                        href={inquiryHref(year, month, s.siteId, "spam")}
                        value={s.intercepted}
                        previous={p.intercepted}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <StatLink
                        href={inquiryHref(year, month, s.siteId, "forwarded")}
                        value={s.forwarded}
                        previous={p.forwarded}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <StatLink
                        href={inquiryHref(year, month, s.siteId, "invalid")}
                        value={s.invalid}
                        previous={p.invalid}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <StatLink
                        href={inquiryHref(year, month, s.siteId, "pending")}
                        value={s.pending}
                        previous={p.pending}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <StatLink
                        href={inquiryHref(year, month, s.siteId, "valid")}
                        value={s.valid}
                        previous={p.valid}
                      />
                    </td>
                    <td className="px-4 py-2 font-medium tabular-nums">
                      {s.forwarded ? pct(s.effectiveRate) : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
