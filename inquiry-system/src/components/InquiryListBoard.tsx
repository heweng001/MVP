"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { InquiryStatus, STATUS_HINTS, STATUS_LABELS } from "@/lib/constants";
import { InquiryActions } from "@/components/InquiryActions";
import { PageHeader } from "@/components/PageHeader";

export type InquiryListItem = {
  id: string;
  status: string;
  name: string;
  email: string;
  message: string;
  markReason: string;
  spamScore: number;
  submittedAt: string;
  domain: string;
  clientName: string;
};

export type InquiryTab = {
  key: string;
  label: string;
  status: string;
  hint: string;
  count: number;
};

export function InquiryListBoard({
  tab,
  tabs,
  items,
  showStatusColumn,
  filterQuery,
  siteId,
  year,
  month,
  sites,
}: {
  tab: string;
  tabs: InquiryTab[];
  items: InquiryListItem[];
  showStatusColumn: boolean;
  filterQuery: string;
  siteId: string;
  year?: number;
  month?: number;
  sites: { id: string; domain: string }[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const ids = useMemo(() => items.map((i) => i.id), [items]);
  const allChecked = ids.length > 0 && ids.every((id) => selected.has(id));

  function toggleAll() {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(ids));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function hrefFor(nextTab: string) {
    const params = new URLSearchParams();
    params.set("tab", nextTab);
    if (siteId) params.set("siteId", siteId);
    if (filterQuery) params.set("q", filterQuery);
    if (year != null) params.set("year", String(year));
    if (month != null) params.set("month", String(month));
    return `/admin/inquiries?${params.toString()}`;
  }

  async function batch(action: "resend" | "valid" | "invalid" | "auto_spam") {
    const list = Array.from(selected);
    if (!list.length) {
      setMsg("请先勾选询盘");
      return;
    }
    const labels = {
      resend: "补发",
      valid: "标为有效",
      invalid: "标为无效",
      auto_spam: "标为垃圾",
    } as const;
    if (!confirm(`确认对选中的 ${list.length} 条执行「${labels[action]}」？`)) return;

    setBusy(true);
    setMsg("");
    const res = await fetch("/api/admin/inquiries/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ids: list }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error || "批量操作失败");
      return;
    }
    setSelected(new Set());
    setMsg(`完成：成功 ${data.success} 条${data.failed ? `，失败 ${data.failed} 条` : ""}`);
    router.refresh();
  }

  const colSpan = (showStatusColumn ? 8 : 7) + 1;

  return (
    <div className="space-y-3">
      <PageHeader
        title="询盘列表"
        hint="正文过长时鼠标悬停可查看全文。当前页最多 200 条；可多选后批量操作。"
        actions={
          <form className="flex flex-wrap gap-1.5 items-center text-xs">
            <input type="hidden" name="tab" value={tab} />
            {year != null ? <input type="hidden" name="year" value={year} /> : null}
            {month != null ? <input type="hidden" name="month" value={month} /> : null}
            <select
              name="siteId"
              defaultValue={siteId}
              className="border border-[var(--line)] rounded-md px-1.5 py-1 bg-white"
            >
              <option value="">全部网站</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.domain}
                </option>
              ))}
            </select>
            <input
              name="q"
              defaultValue={filterQuery}
              placeholder="搜索姓名/邮箱/电话/正文"
              className="border border-[var(--line)] rounded-md px-1.5 py-1 min-w-[160px] bg-white"
            />
            <button className="bg-[var(--brand)] text-white rounded-md px-2.5 py-1">筛选</button>
            {year != null && month != null ? (
              <span className="text-[var(--muted)]">
                已限定 {year}-{String(month).padStart(2, "0")}
              </span>
            ) : null}
          </form>
        }
      />

      <div className="flex flex-wrap gap-1 border-b border-[var(--line)]">
        {tabs.map((t) => {
          const active = t.key === tab;
          const tip = t.hint || STATUS_HINTS[t.key] || "";
          return (
            <span key={t.key} className="relative group/tab">
              <Link
                href={hrefFor(t.key)}
                className={`inline-block px-2.5 py-1.5 text-xs rounded-t-md border border-b-0 -mb-px ${
                  active
                    ? "bg-white border-[var(--line)] text-[var(--brand)] font-medium"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                {t.label}
                <span className="ml-1 tabular-nums">{t.count}</span>
              </Link>
              {tip ? (
                <span
                  role="tooltip"
                  className="pointer-events-none absolute left-0 top-full z-40 mt-1.5 w-64 max-w-[min(16rem,calc(100vw-2rem))] rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-2 text-[11px] leading-relaxed text-[var(--ink)] shadow-lg opacity-0 invisible group-hover/tab:opacity-100 group-hover/tab:visible transition-opacity"
                >
                  {tip}
                </span>
              ) : null}
            </span>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs bg-white border border-[var(--line)] rounded-lg px-2.5 py-2">
        <span className="text-[var(--muted)]">已选 {selected.size} 条</span>
        <button
          type="button"
          disabled={busy || selected.size === 0}
          onClick={() => batch("resend")}
          className="border border-[var(--line)] rounded px-2 py-0.5 disabled:opacity-40"
        >
          批量补发
        </button>
        <button
          type="button"
          disabled={busy || selected.size === 0}
          onClick={() => batch("valid")}
          className="bg-[var(--brand)] text-white rounded px-2 py-0.5 disabled:opacity-40"
        >
          批量有效
        </button>
        <button
          type="button"
          disabled={busy || selected.size === 0}
          onClick={() => batch("invalid")}
          className="bg-[var(--warn)] text-white rounded px-2 py-0.5 disabled:opacity-40"
        >
          批量无效
        </button>
        <button
          type="button"
          disabled={busy || selected.size === 0}
          onClick={() => batch("auto_spam")}
          className="bg-[var(--danger)] text-white rounded px-2 py-0.5 disabled:opacity-40"
        >
          批量垃圾
        </button>
        {msg ? <span className="text-[var(--muted)] ml-1">{msg}</span> : null}
      </div>

      <div className="bg-white border border-[var(--line)] rounded-lg overflow-x-auto">
        <table className="w-full text-xs min-w-[1000px]">
          <thead className="bg-slate-50 text-left text-[var(--muted)]">
            <tr>
              <th className="px-2 py-1.5 w-8">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  title="全选当前页"
                />
              </th>
              <th className="px-2 py-1.5 font-medium whitespace-nowrap">时间</th>
              <th className="px-2 py-1.5 font-medium whitespace-nowrap">网站</th>
              <th className="px-2 py-1.5 font-medium whitespace-nowrap">联系人</th>
              <th className="px-2 py-1.5 font-medium whitespace-nowrap">分</th>
              {showStatusColumn ? (
                <th className="px-2 py-1.5 font-medium whitespace-nowrap">状态</th>
              ) : null}
              <th className="px-2 py-1.5 font-medium min-w-[220px]">正文</th>
              <th className="px-2 py-1.5 font-medium min-w-[140px]">客户反馈</th>
              <th className="px-2 py-1.5 font-medium text-right whitespace-nowrap">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-2 py-8 text-center text-[var(--muted)]">
                  暂无询盘
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const body = item.message || "";
                const checked = selected.has(item.id);
                return (
                  <tr
                    key={item.id}
                    className={`border-t border-[var(--line)] align-top hover:bg-black/[0.015] ${
                      checked ? "bg-teal-50/40" : ""
                    }`}
                  >
                    <td className="px-2 py-1">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(item.id)}
                      />
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap text-[11px] text-[var(--muted)]">
                      {item.submittedAt}
                    </td>
                    <td className="px-2 py-1 max-w-[120px]">
                      <div className="truncate" title={item.domain}>
                        {item.domain}
                      </div>
                      <div
                        className="truncate text-[10px] text-[var(--muted)]"
                        title={item.clientName}
                      >
                        {item.clientName}
                      </div>
                    </td>
                    <td className="px-2 py-1 max-w-[130px]">
                      <div className="truncate" title={item.name || undefined}>
                        {item.name || "—"}
                      </div>
                      <div
                        className="truncate text-[10px] text-[var(--muted)]"
                        title={item.email}
                      >
                        {item.email || "—"}
                      </div>
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">{item.spamScore}</td>
                    {showStatusColumn ? (
                      <td className="px-2 py-1 whitespace-nowrap">
                        <span
                          className="relative group/status cursor-default border-b border-dotted border-[var(--muted)]/50"
                          tabIndex={0}
                        >
                          {STATUS_LABELS[item.status] || item.status}
                          {STATUS_HINTS[item.status] ? (
                            <span
                              role="tooltip"
                              className="pointer-events-none absolute left-0 top-full z-40 mt-1.5 w-56 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-2 text-[11px] leading-relaxed text-[var(--ink)] shadow-lg opacity-0 invisible group-hover/status:opacity-100 group-hover/status:visible group-focus-within/status:opacity-100 group-focus-within/status:visible transition-opacity"
                            >
                              {STATUS_HINTS[item.status]}
                            </span>
                          ) : null}
                        </span>
                      </td>
                    ) : null}
                    <td className="px-2 py-1 max-w-[360px]">
                      <div
                        className="line-clamp-2 leading-snug text-[11px] cursor-default"
                        title={body || "(无正文)"}
                      >
                        {body || <span className="text-[var(--muted)]">(无正文)</span>}
                      </div>
                    </td>
                    <td className="px-2 py-1 max-w-[200px]">
                      {item.markReason ? (
                        <div
                          className="line-clamp-2 leading-snug text-[11px] text-[var(--ink)] cursor-default"
                          title={item.markReason}
                        >
                          {item.markReason}
                        </div>
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right">
                      <div className="inline-flex flex-col items-end gap-1">
                        {item.status === InquiryStatus.REVIEW ? (
                          <InquiryActions id={item.id} mode="review" compact />
                        ) : null}
                        <Link
                          className="text-[11px] text-[var(--brand)]"
                          href={`/admin/inquiries/${item.id}`}
                        >
                          详情
                        </Link>
                      </div>
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
