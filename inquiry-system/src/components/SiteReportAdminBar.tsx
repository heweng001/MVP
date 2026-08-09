"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  REPORT_SECTION_DEFS,
  type ReportSectionKey,
} from "@/lib/report-editorial";
import { CopyField } from "./CopyField";

export function SiteReportAdminBar({
  siteId,
  year,
  month,
  publicUrl,
  workDone: initialWork,
  nextPlan: initialPlan,
  highlightsEdit: initialHighlightsEdit,
  autoHighlights = [],
  hiddenSections: initialHidden = [],
  hasReport,
}: {
  siteId: string;
  year: number;
  month: number;
  publicUrl: string;
  workDone: string;
  nextPlan: string;
  highlightsEdit: string;
  autoHighlights?: string[];
  hiddenSections?: ReportSectionKey[];
  hasReport: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [workDone, setWorkDone] = useState(initialWork);
  const [nextPlan, setNextPlan] = useState(initialPlan);
  const defaultHighlightsText = useMemo(() => {
    if (initialHighlightsEdit.trim()) return initialHighlightsEdit;
    return autoHighlights.join("\n");
  }, [initialHighlightsEdit, autoHighlights]);
  const [highlightsEdit, setHighlightsEdit] = useState(defaultHighlightsText);
  const [hidden, setHidden] = useState<Set<ReportSectionKey>>(
    () => new Set(initialHidden),
  );

  function toggleSection(key: ReportSectionKey) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function generate(rotateToken = false) {
    setBusy(true);
    setErr("");
    setMsg("");
    const res = await fetch(`/api/admin/sites/${siteId}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month, rotateToken }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(data.error || "生成失败");
      return;
    }
    setMsg(rotateToken ? "已刷新分享链接" : "报告已生成/刷新（文案与板块设置已保留）");
    router.refresh();
  }

  async function saveNotes(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setMsg("");
    const res = await fetch(`/api/admin/sites/${siteId}/report`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year,
        month,
        workDone,
        nextPlan,
        highlightsEdit,
        hiddenSections: [...hidden],
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(data.error || "保存失败");
      return;
    }
    setMsg("已保存文案与板块设置");
    router.refresh();
  }

  async function runAiDraft(apply: boolean) {
    setAiBusy(true);
    setErr("");
    setMsg("");
    const res = await fetch(`/api/admin/sites/${siteId}/report/ai-draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month, apply }),
    });
    const data = await res.json().catch(() => ({}));
    setAiBusy(false);
    if (!res.ok) {
      setErr(data.error || "AI 生成失败");
      return;
    }
    if (typeof data.highlightsEdit === "string") {
      setHighlightsEdit(data.highlightsEdit);
    } else if (Array.isArray(data.highlights)) {
      setHighlightsEdit(data.highlights.join("\n"));
    }
    if (typeof data.nextPlan === "string") {
      setNextPlan(data.nextPlan);
    }
    setMsg(
      apply
        ? "AI 草稿已生成并保存，请核对后如需再改可点「保存文案」"
        : "AI 草稿已填入下方，请核对后点「保存文案与板块」",
    );
    if (apply) router.refresh();
  }

  function restoreAutoHighlights() {
    setHighlightsEdit(autoHighlights.join("\n"));
    setMsg("已恢复为自动要点草稿（需保存后对客户生效；清空并保存则始终跟自动稿）");
  }

  return (
    <div className="space-y-3 print:hidden rounded-xl border border-[var(--line)] bg-white p-4">
      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-sm">
          <span className="text-xs text-[var(--muted)]">年份</span>
          <input
            type="number"
            className="mt-1 block w-24 border border-[var(--line)] rounded-lg px-2 py-1.5"
            defaultValue={year}
            onBlur={(e) => {
              const y = Number(e.target.value);
              if (y >= 2000 && y <= 2100 && y !== year) {
                router.push(`/admin/sites/${siteId}/report?year=${y}&month=${month}`);
              }
            }}
          />
        </label>
        <label className="text-sm">
          <span className="text-xs text-[var(--muted)]">月份</span>
          <select
            className="mt-1 block w-24 border border-[var(--line)] rounded-lg px-2 py-1.5"
            value={month}
            onChange={(e) => {
              router.push(
                `/admin/sites/${siteId}/report?year=${year}&month=${e.target.value}`,
              );
            }}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}月
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={busy || aiBusy}
          onClick={() => generate(false)}
          className="bg-[var(--brand)] text-white rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {busy ? "处理中…" : hasReport ? "刷新数据快照" : "生成报告"}
        </button>
        {hasReport ? (
          <>
            <button
              type="button"
              disabled={busy || aiBusy}
              onClick={() => generate(true)}
              className="border border-[var(--line)] rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
            >
              更换分享链接
            </button>
            <button
              type="button"
              disabled={busy || aiBusy}
              onClick={() => runAiDraft(false)}
              className="border border-[var(--line)] rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {aiBusy ? "AI 撰写中…" : "AI 生成要点与计划"}
            </button>
            {publicUrl ? (
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-[var(--line)] rounded-lg px-3 py-1.5 text-sm inline-flex items-center"
              >
                预览 / 导出 PDF
              </a>
            ) : null}
          </>
        ) : null}
      </div>

      {hasReport && publicUrl ? (
        <CopyField
          label="客户只读链接（预览与导出 PDF 请打开此页）"
          value={publicUrl}
          hint="与客户看到的是同一页面；在预览页使用浏览器「打印 → 另存为 PDF」。更换链接后旧链接失效。"
        />
      ) : null}

      {hasReport ? (
        <form onSubmit={saveNotes} className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-sm block md:col-span-2">
              <span className="text-xs text-[var(--muted)] flex flex-wrap items-center gap-2">
                本月要点（一行一条；保存后覆盖自动稿，刷新数据不会冲掉）
                <button
                  type="button"
                  className="text-[var(--brand)] underline"
                  onClick={restoreAutoHighlights}
                >
                  填入自动稿
                </button>
              </span>
              <textarea
                value={highlightsEdit}
                onChange={(e) => setHighlightsEdit(e.target.value)}
                rows={5}
                className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-sm block">
              <span className="text-xs text-[var(--muted)]">本月已做工作</span>
              <textarea
                value={workDone}
                onChange={(e) => setWorkDone(e.target.value)}
                rows={5}
                className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-sm block">
              <span className="text-xs text-[var(--muted)]">下月计划（可由 AI 预填）</span>
              <textarea
                value={nextPlan}
                onChange={(e) => setNextPlan(e.target.value)}
                rows={5}
                className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5 text-sm"
              />
            </label>
          </div>

          <fieldset className="rounded-lg border border-[var(--line)] p-3">
            <legend className="text-xs text-[var(--muted)] px-1">
              对客户隐藏的板块（勾选=不显示）
            </legend>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-1">
              {REPORT_SECTION_DEFS.map((s) => (
                <label key={s.key} className="text-xs flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hidden.has(s.key)}
                    onChange={() => toggleSection(s.key)}
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy || aiBusy}
              className="bg-[var(--brand)] text-white rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
            >
              保存文案与板块
            </button>
            <button
              type="button"
              disabled={busy || aiBusy}
              onClick={() => runAiDraft(true)}
              className="border border-[var(--line)] rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
            >
              AI 生成并保存
            </button>
          </div>
        </form>
      ) : (
        <p className="text-xs text-[var(--muted)]">
          先确保新加坡 worker 已同步该自然月 GSC/GA（日常 sync 会写当月 MTD；历史月用{" "}
          <code className="bg-black/5 px-1 rounded">npm run sync:month -- YYYY-MM</code>
          ），再点「生成报告」。询盘与 SEO 均为同一自然月。
        </p>
      )}

      {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}
      {err ? <p className="text-sm text-[var(--danger)] whitespace-pre-wrap">{err}</p> : null}
    </div>
  );
}
