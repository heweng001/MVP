"use client";

import { KeywordsLineEditor } from "@/components/promo/KeywordsLineEditor";
import { ExpandKeywordsButton } from "@/components/promo/ExpandKeywordsButton";
import type { KeywordCategory } from "@/lib/promo";

export function CategorizedKeywordsEditor({
  categories,
  onChange,
  minHeightPerCategory = 160,
  showExpand = true,
}: {
  categories: KeywordCategory[];
  onChange: (next: KeywordCategory[]) => void;
  minHeightPerCategory?: number;
  /** 是否显示「生成拓展词」（默认开） */
  showExpand?: boolean;
}) {
  function updateAt(index: number, patch: Partial<KeywordCategory>) {
    onChange(
      categories.map((c, i) =>
        i === index
          ? {
              name: patch.name !== undefined ? patch.name : c.name,
              items: patch.items !== undefined ? patch.items : c.items,
            }
          : c,
      ),
    );
  }

  function removeAt(index: number) {
    if (categories.length <= 1) {
      onChange([{ name: "未分类", items: [] }]);
      return;
    }
    onChange(categories.filter((_, i) => i !== index));
  }

  function addCategory() {
    onChange([...categories, { name: `分类${categories.length + 1}`, items: [] }]);
  }

  const total = categories.reduce((n, c) => n + c.items.filter(Boolean).length, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
        <span>
          类名可自定义；每类一行一个词。提交时跨类全局去重。共{" "}
          <span className="tabular-nums text-[var(--ink)]">{categories.length}</span> 类 ·{" "}
          <span className="tabular-nums text-[var(--ink)]">{total}</span> 词
        </span>
        <div className="flex flex-wrap gap-2">
          {showExpand ? (
            <ExpandKeywordsButton categories={categories} onApply={onChange} />
          ) : null}
          <button
            type="button"
            onClick={addCategory}
            className="border border-[var(--line)] rounded-lg px-2.5 py-1 text-[12px] hover:bg-black/5"
          >
            + 添加分类
          </button>
        </div>
      </div>

      {categories.map((cat, index) => (
        <div
          key={index}
          className="rounded-xl border border-[var(--line)] bg-white overflow-hidden shadow-sm"
        >
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-[var(--line)] bg-slate-50/80">
            <label className="flex-1 min-w-[140px] text-sm">
              <span className="sr-only">分类名称</span>
              <input
                value={cat.name}
                onChange={(e) => updateAt(index, { name: e.target.value })}
                className="w-full border border-[var(--line)] rounded-lg px-2.5 py-1.5 text-sm bg-white"
                placeholder="分类名称"
              />
            </label>
            <span className="text-[11px] text-[var(--muted)] tabular-nums">
              {cat.items.filter(Boolean).length} 词
            </span>
            <button
              type="button"
              onClick={() => removeAt(index)}
              className="text-[12px] text-[var(--danger)] hover:underline px-1"
            >
              删除此类
            </button>
          </div>
          <div className="p-2">
            <KeywordsLineEditor
              value={cat.items.join("\n")}
              onChange={(v) =>
                updateAt(index, {
                  items: v.split("\n"),
                })
              }
              placeholder="一行一个关键词"
              minHeight={minHeightPerCategory}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
