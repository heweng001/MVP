"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { CopyField } from "./CopyField";
import { HelpCallout } from "./HelpCallout";

type FormCfg = {
  id: string;
  formId: string;
  label: string;
  toEmails: string;
  ccEmails: string;
  enabled: boolean;
};

export function SiteFormConfigPanel({
  siteId,
  domain,
  siteKey,
  ingestUrl,
  productKeywords,
  spamExtraWords,
  forms,
  onClose,
}: {
  siteId: string;
  domain: string;
  siteKey: string;
  ingestUrl: string;
  productKeywords: string;
  spamExtraWords: string;
  forms: FormCfg[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pk, setPk] = useState(productKeywords);
  const [sw, setSw] = useState(spamExtraWords);

  async function saveKeywords() {
    setBusy(true);
    await fetch(`/api/admin/sites/${siteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productKeywords: pk, spamExtraWords: sw }),
    });
    setBusy(false);
    router.refresh();
  }

  async function saveForm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    const fd = new FormData(form);
    const res = await fetch("/api/admin/forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteId,
        formId: fd.get("formId"),
        label: fd.get("label"),
        toEmails: fd.get("toEmails"),
        ccEmails: fd.get("ccEmails"),
      }),
    });
    setBusy(false);
    if (!res.ok) return;
    form.reset();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="w-full max-w-lg bg-white h-full overflow-y-auto shadow-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">配置表单对接</h2>
            <p className="text-sm text-[var(--muted)] mt-0.5">{domain}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm border border-[var(--line)] rounded-lg px-2 py-1"
          >
            关闭
          </button>
        </div>

        <HelpCallout title="操作提示" guideHref="/admin/guide">
          <ol className="list-decimal pl-4 space-y-1">
            <li>复制下方 API URL 与 Site Key。</li>
            <li>
              打开该 WordPress 站点后台 → <strong>设置 → Inquiry Bridge</strong>，粘贴保存。
            </li>
            <li>填写表单 ID 白名单（WPForms 的 form_id），建议只填询盘表。</li>
            <li>在本面板配置「表单收件」——决定系统代发时发给哪些客户邮箱。</li>
            <li>保留 WPForms 原生通知作为故障降级备用。</li>
          </ol>
        </HelpCallout>

        <CopyField
          label="API URL（各站相同）"
          value={ingestUrl}
          hint="填到插件「API URL」，必须以 /api/ingest 结尾。"
        />
        <CopyField
          label="Site Key（本站专用）"
          value={siteKey}
          hint="填到插件「Site Key」。每个网站一把，勿与其它站共用。"
        />

        <div className="border border-[var(--line)] rounded-xl p-3 space-y-2">
          <div className="text-sm font-medium">反垃圾词表（可选）</div>
          <label className="block text-sm">
            <span className="text-xs text-[var(--muted)]">产品关键词</span>
            <textarea
              value={pk}
              onChange={(e) => setPk(e.target.value)}
              className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5 text-sm min-h-[64px]"
              placeholder="valve, pump, quotation"
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs text-[var(--muted)]">扩展垃圾词</span>
            <textarea
              value={sw}
              onChange={(e) => setSw(e.target.value)}
              className="mt-1 w-full border border-[var(--line)] rounded-lg px-2 py-1.5 text-sm min-h-[64px]"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={saveKeywords}
            className="text-sm border border-[var(--line)] rounded-lg px-3 py-1.5"
          >
            保存词表
          </button>
        </div>

        <div className="border border-[var(--line)] rounded-xl p-3 space-y-3">
          <div>
            <div className="text-sm font-medium">表单收件配置</div>
            <p className="text-xs text-[var(--muted)] mt-1">
              form_id 在 WPForms 表单列表或编辑地址中可见。未配置收件人时，系统无法代发询盘邮件。
            </p>
          </div>
          <ul className="text-sm space-y-1">
            {forms.length === 0 ? (
              <li className="text-[var(--warn)]">尚未配置表单收件</li>
            ) : (
              forms.map((f) => (
                <li key={f.id} className="border-b border-[var(--line)] py-1.5">
                  Form {f.formId}
                  {f.label ? `（${f.label}）` : ""} → {f.toEmails}
                  {f.ccEmails ? `；CC ${f.ccEmails}` : ""}
                </li>
              ))
            )}
          </ul>
          <form onSubmit={saveForm} className="grid gap-2">
            <input
              name="formId"
              required
              placeholder="WPForms form_id，如 34"
              className="border border-[var(--line)] rounded-lg px-2 py-1.5 text-sm"
            />
            <input
              name="label"
              placeholder="备注标签，如：联系我们"
              className="border border-[var(--line)] rounded-lg px-2 py-1.5 text-sm"
            />
            <input
              name="toEmails"
              required
              placeholder="收件人，逗号分隔"
              className="border border-[var(--line)] rounded-lg px-2 py-1.5 text-sm"
            />
            <input
              name="ccEmails"
              placeholder="抄送 CC，逗号分隔"
              className="border border-[var(--line)] rounded-lg px-2 py-1.5 text-sm"
            />
            <button
              disabled={busy}
              className="bg-[var(--brand)] text-white rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
            >
              保存/更新表单收件
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
