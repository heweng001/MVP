"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { ensureRichHtml } from "@/lib/promo";

export function PromoRichEditor({
  value,
  onChange,
  placeholder = "支持图文与表格；可从 Excel/Word 直接粘贴表格",
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ allowBase64: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: ensureRichHtml(value),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "promo-rich-editor prose prose-sm max-w-none min-h-[180px] px-3 py-2 focus:outline-none",
      },
      handlePaste(_view, event) {
        const files = event.clipboardData?.files;
        if (files && files.length > 0) {
          event.preventDefault();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  if (!editor) {
    return (
      <div className="min-h-[180px] rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--muted)]">
        加载编辑器…
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--line)] bg-white overflow-hidden">
      <div className="flex flex-wrap gap-1 border-b border-[var(--line)] bg-black/[0.02] px-2 py-1.5">
        <ToolbarBtn
          label="粗体"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarBtn
          label="斜体"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarBtn
          label="列表"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarBtn
          label="编号"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarBtn
          label="表格"
          active={editor.isActive("table")}
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
        />
        <ToolbarBtn
          label="删表"
          onClick={() => editor.chain().focus().deleteTable().run()}
          disabled={!editor.isActive("table")}
        />
        <ToolbarBtn
          label="图片链接"
          onClick={() => {
            const url = window.prompt("粘贴图片 URL（不支持本地上传）");
            if (!url?.trim()) return;
            if (!/^https?:\/\//i.test(url.trim())) {
              window.alert("仅支持 http(s) 外链图片");
              return;
            }
            editor.chain().focus().setImage({ src: url.trim() }).run();
          }}
        />
      </div>
      <EditorContent editor={editor} />
      <p className="px-3 py-1.5 text-[11px] text-[var(--muted)] border-t border-[var(--line)] bg-black/[0.02]">
        {placeholder}
      </p>
    </div>
  );
}

function ToolbarBtn({
  label,
  onClick,
  active,
  disabled,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`px-2 py-1 text-xs rounded border ${
        active
          ? "border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand)]"
          : "border-[var(--line)] bg-white text-[var(--ink)] hover:bg-black/5"
      } disabled:opacity-40`}
    >
      {label}
    </button>
  );
}
