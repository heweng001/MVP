"use client";

import { useMemo, useState, type ReactNode } from "react";

export type SortDir = "asc" | "desc";

type Column<T> = {
  key: string;
  label: string;
  /** 可排序时提供取值；省略则不可点 */
  sortValue?: (row: T) => number | string;
  align?: "left" | "right";
  className?: string;
  render: (row: T) => ReactNode;
};

export function SortableMetricTable<T extends { id: string }>({
  rows,
  columns,
  defaultSortKey,
  defaultSortDir = "desc",
  emptyColSpan,
  emptyText,
}: {
  rows: T[];
  columns: Column<T>[];
  defaultSortKey: string;
  defaultSortDir?: SortDir;
  emptyColSpan: number;
  emptyText: string;
}) {
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultSortDir);

  const sortable = useMemo(() => {
    const m = new Map<string, (row: T) => number | string>();
    for (const c of columns) {
      if (c.sortValue) m.set(c.key, c.sortValue);
    }
    return m;
  }, [columns]);

  const sorted = useMemo(() => {
    const get = sortable.get(sortKey);
    if (!get) return rows;
    const list = [...rows];
    list.sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv), "zh-CN");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [rows, sortKey, sortDir, sortable]);

  function onHeaderClick(key: string) {
    if (!sortable.has(key)) return;
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return (
    <table className="w-full text-sm min-w-[640px]">
      <thead className="text-left text-[var(--muted)]">
        <tr>
          {columns.map((c) => {
            const canSort = sortable.has(c.key);
            const active = sortKey === c.key;
            const mark = active ? (sortDir === "asc" ? " ↑" : " ↓") : "";
            return (
              <th
                key={c.key}
                className={`px-3 py-2 ${c.align === "right" ? "text-right" : ""} ${c.className || ""}`}
              >
                {canSort ? (
                  <button
                    type="button"
                    className={`hover:text-[var(--ink)] ${active ? "text-[var(--ink)]" : ""}`}
                    onClick={() => onHeaderClick(c.key)}
                    title="点击切换升降序"
                  >
                    {c.label}
                    {mark}
                  </button>
                ) : (
                  c.label
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sorted.length === 0 ? (
          <tr>
            <td colSpan={emptyColSpan} className="px-3 py-8 text-center text-[var(--muted)]">
              {emptyText}
            </td>
          </tr>
        ) : (
          sorted.map((row) => (
            <tr key={row.id} className="border-t border-[var(--line)]">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-3 py-2 ${c.align === "right" ? "text-right" : ""} ${c.className || ""}`}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
