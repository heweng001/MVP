"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CategorizedKeywordsEditor } from "@/components/promo/CategorizedKeywordsEditor";
import {
  categoriesForEditor,
  dedupeKeywordCategories,
  type KeywordCategory,
} from "@/lib/promo";

function dedupeTip(removed: number, after: number) {
  if (removed > 0) {
    return `已提交。已去重：移除 ${removed} 个重复关键词，现共 ${after} 词`;
  }
  return `已提交（${after} 词，无重复）`;
}

function useCategoryState(initialKeywords: string) {
  const [categories, setCategories] = useState<KeywordCategory[]>(() =>
    categoriesForEditor(initialKeywords),
  );
  const total = useMemo(
    () => categories.reduce((n, c) => n + c.items.map((x) => x.trim()).filter(Boolean).length, 0),
    [categories],
  );
  return { categories, setCategories, total };
}

/** 后台：关键词另页编辑（支持分类） */
export function PromoKeywordsAdminEditor({
  promoId,
  siteDomain,
  initialKeywords,
  initialNote,
}: {
  promoId: string;
  siteDomain: string | null;
  initialKeywords: string;
  initialNote: string;
}) {
  const router = useRouter();
  const detailHref = `/admin/promos/${promoId}`;
  const { categories, setCategories, total } = useCategoryState(initialKeywords);
  const [note, setNote] = useState(initialNote);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setBusy(true);
    setErr("");
    const local = dedupeKeywordCategories(categories);
    setCategories(
      local.categories.length
        ? local.categories
        : categoriesForEditor(""),
    );
    const res = await fetch(`/api/admin/promos/${promoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categories: local.categories,
        keywordsNote: note,
        submitterName: "管理员",
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(data.error || "提交失败");
      return;
    }
    window.alert(dedupeTip(local.removed, local.after));
    router.push(detailHref);
    router.refresh();
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <Link
          href={detailHref}
          className="text-[13px] text-[var(--brand)] hover:underline underline-offset-2"
        >
          ← 返回信息核对详情
        </Link>
        <h1 className="text-xl font-semibold mt-2">关键词列表</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          {siteDomain ? `${siteDomain} · ` : ""}
          按类整理；提交时跨类去重 · 当前 {total} 词
          {initialKeywords && !initialKeywords.trim().startsWith("[") ? (
            <span className="ml-1">（已从旧版纯文本迁入「未分类」）</span>
          ) : null}
        </p>
      </div>

      <CategorizedKeywordsEditor
        categories={categories}
        onChange={setCategories}
        minHeightPerCategory={180}
      />

      <label className="block text-sm space-y-1">
        <span className="text-xs text-[var(--warn)]">内部备注（仅后台可见）</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full border border-[var(--warn)]/40 bg-[var(--warn)]/5 rounded-lg px-3 py-2 text-sm min-h-[80px]"
          placeholder="内部备注…"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="bg-[var(--brand)] text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50"
        >
          {busy ? "提交中…" : "提交"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => router.push(detailHref)}
          className="border border-[var(--line)] rounded-lg px-4 py-2 text-sm hover:bg-black/5 disabled:opacity-50"
        >
          取消
        </button>
      </div>
      {err ? <p className="text-sm text-[var(--danger)]">{err}</p> : null}
    </div>
  );
}

/** 客户公开：关键词另页编辑（支持分类） */
export function PromoKeywordsPublicEditor({
  token,
  siteDomain,
  expiresAt,
  initialKeywords,
}: {
  token: string;
  siteDomain: string | null;
  expiresAt: string | null;
  initialKeywords: string;
}) {
  const router = useRouter();
  const backHref = `/p/${token}`;
  const { categories, setCategories, total } = useCategoryState(initialKeywords);
  const [submitterName, setSubmitterName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setBusy(true);
    setErr("");
    const local = dedupeKeywordCategories(categories);
    setCategories(
      local.categories.length ? local.categories : categoriesForEditor(""),
    );
    const res = await fetch(`/api/promo/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categories: local.categories,
        submitterName,
        onlyKeywords: true,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(data.error || "提交失败");
      return;
    }
    window.alert(dedupeTip(local.removed, local.after));
    router.push(backHref);
  }

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={backHref}
          className="text-[13px] text-[var(--brand)] hover:underline underline-offset-2"
        >
          ← 返回信息核对
        </Link>
        <h1 className="text-xl font-semibold mt-2">关键词列表</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          {siteDomain || "信息核对"}
          {expiresAt ? (
            <span className="ml-2">· 请于 {new Date(expiresAt).toLocaleString("zh-CN")} 前完成</span>
          ) : null}
          <span className="ml-2">· 当前 {total} 词（提交时去重）</span>
        </p>
      </div>

      <CategorizedKeywordsEditor
        categories={categories}
        onChange={setCategories}
        minHeightPerCategory={180}
      />

      <label className="block text-sm space-y-1">
        <span className="text-xs text-[var(--muted)]">您的姓名（提交必填）</span>
        <input
          value={submitterName}
          onChange={(e) => setSubmitterName(e.target.value)}
          className="w-full border border-[var(--line)] rounded-lg px-3 py-2 text-sm"
          placeholder="请输入姓名"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="bg-[var(--brand)] text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50"
        >
          {busy ? "提交中…" : "提交"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => router.push(backHref)}
          className="border border-[var(--line)] rounded-lg px-4 py-2 text-sm hover:bg-black/5 disabled:opacity-50"
        >
          取消
        </button>
      </div>
      {err ? <p className="text-sm text-[var(--danger)]">{err}</p> : null}
    </div>
  );
}
