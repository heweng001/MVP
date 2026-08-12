"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_B2B_MODIFIERS,
  EXPAND_SOFT_LIMIT,
  EXPANDED_KEYWORD_CATEGORY,
  applyExpandedCategory,
  buildExpandedKeywords,
  collectExpandSeeds,
  estimateExpandedCount,
  parseModifierList,
  type KeywordCategory,
} from "@/lib/promo";

export function ExpandKeywordsButton({
  categories,
  onApply,
}: {
  categories: KeywordCategory[];
  onApply: (next: KeywordCategory[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [modText, setModText] = useState(DEFAULT_B2B_MODIFIERS.join("\n"));
  const [prefix, setPrefix] = useState(true);
  const [suffix, setSuffix] = useState(true);

  const seeds = useMemo(() => collectExpandSeeds(categories), [categories]);
  const modifiers = useMemo(() => parseModifierList(modText), [modText]);
  const estimate = estimateExpandedCount(seeds.length, modifiers.length, {
    prefix,
    suffix,
  });

  function generate() {
    if (!prefix && !suffix) {
      window.alert("请至少勾选「加在开头」或「加在末尾」");
      return;
    }
    if (!modifiers.length) {
      window.alert("请至少填写一个 B 端词");
      return;
    }
    if (!seeds.length) {
      window.alert("没有可拓展的种子词（需为 1～3 个英文单词，且不在「拓展词」类）");
      return;
    }
    if (estimate > EXPAND_SOFT_LIMIT) {
      const ok = window.confirm(
        `预计约生成 ${estimate} 条拓展词（超过建议上限 ${EXPAND_SOFT_LIMIT}）。\n仍要继续？将覆盖「${EXPANDED_KEYWORD_CATEGORY}」类现有内容。`,
      );
      if (!ok) return;
    } else {
      const ok = window.confirm(
        `将用当前 B 端词生成拓展词，并覆盖「${EXPANDED_KEYWORD_CATEGORY}」类。\n种子 ${seeds.length} 个 · B 端词 ${modifiers.length} 个 · 预计约 ${estimate} 条。\n确认生成？`,
      );
      if (!ok) return;
    }

    const { items, skipped } = buildExpandedKeywords(seeds, {
      modifiers,
      prefix,
      suffix,
    });
    const next = applyExpandedCategory(categories, items);
    onApply(next);
    setOpen(false);
    window.alert(
      `已写入「${EXPANDED_KEYWORD_CATEGORY}」：${items.length} 条` +
        (skipped ? `（跳过 ${skipped} 组：种子已含对应 B 端词）` : ""),
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border border-[var(--line)] rounded-lg px-2.5 py-1 text-[12px] hover:bg-black/5"
      >
        生成拓展词
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-lg max-h-[90vh] overflow-y-auto">
            <div>
              <h2 className="text-lg font-semibold">生成拓展词</h2>
              <p className="text-xs text-[var(--muted)] mt-1 leading-relaxed">
                从除「{EXPANDED_KEYWORD_CATEGORY}」外的类中，选取 1～3 个英文单词的种子，与 B
                端词组合生成前缀/后缀短语，写入并覆盖「{EXPANDED_KEYWORD_CATEGORY}」类。
              </p>
            </div>

            <div className="rounded-lg border border-[var(--line)] bg-slate-50 px-3 py-2 text-xs text-[var(--muted)]">
              当前可拓展种子：
              <span className="tabular-nums text-[var(--ink)] font-medium"> {seeds.length}</span>
              {" · "}
              B 端词：
              <span className="tabular-nums text-[var(--ink)] font-medium"> {modifiers.length}</span>
              {" · "}
              预计约：
              <span className="tabular-nums text-[var(--ink)] font-medium"> {estimate}</span> 条
              {estimate > EXPAND_SOFT_LIMIT ? (
                <span className="text-[var(--warn)]">（超过建议上限 {EXPAND_SOFT_LIMIT}）</span>
              ) : null}
            </div>

            <label className="block text-sm space-y-1">
              <span className="text-xs text-[var(--muted)]">
                B 端词（一行一个，或逗号分隔；可自由增删）
              </span>
              <textarea
                value={modText}
                onChange={(e) => setModText(e.target.value)}
                className="w-full border border-[var(--line)] rounded-lg px-3 py-2 text-sm min-h-[120px] font-mono"
                placeholder={DEFAULT_B2B_MODIFIERS.join("\n")}
              />
            </label>

            <div className="flex flex-wrap gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={prefix}
                  onChange={(e) => setPrefix(e.target.checked)}
                />
                加在开头（如 oem ball valve）
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={suffix}
                  onChange={(e) => setSuffix(e.target.checked)}
                />
                加在末尾（如 ball valve oem）
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="border border-[var(--line)] rounded-lg px-3 py-1.5 text-sm"
              >
                取消
              </button>
              <button
                type="button"
                onClick={generate}
                className="bg-[var(--brand)] text-white rounded-lg px-3 py-1.5 text-sm"
              >
                生成并覆盖「{EXPANDED_KEYWORD_CATEGORY}」
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
