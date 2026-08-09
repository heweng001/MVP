"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { CopyField } from "./CopyField";

export function SiteReportAdminBar({
  siteId,
  year,
  month,
  publicUrl,
  workDone: initialWork,
  nextPlan: initialPlan,
  hasReport,
}: {
  siteId: string;
  year: number;
  month: number;
  publicUrl: string;
  workDone: string;
  nextPlan: string;
  hasReport: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [workDone, setWorkDone] = useState(initialWork);
  const [nextPlan, setNextPlan] = useState(initialPlan);

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
    setMsg(rotateToken ? "已刷新分享链接" : "报告已生成/刷新");
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
      body: JSON.stringify({ year, month, workDone, nextPlan }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(data.error || "保存失败");
      return;
    }
    setMsg("已保存工作与计划");
    router.refresh();
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
          disabled={busy}
          onClick={() => generate(false)}
          className="bg-[var(--brand)] text-white rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {busy ? "处理中…" : hasReport ? "刷新数据快照" : "生成报告"}
        </button>
        {hasReport ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => generate(true)}
              className="border border-[var(--line)] rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
            >
              更换分享链接
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
        <form onSubmit={saveNotes} className="grid md:grid-cols-2 gap-3">
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
            <span className="text-xs text-[var(--muted)]">下月计划</span>
            <textarea
              value={nextPlan}
              onChange={(e) => setNextPlan(e.target.value)}
              rows={5}
              className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5 text-sm"
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={busy}
              className="bg-[var(--brand)] text-white rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
            >
              保存文案
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
