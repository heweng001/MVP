"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { CopyField } from "./CopyField";
import { PluginDownloadCard } from "./PluginDownloadCard";
import { SideDrawer } from "./SideDrawer";

type FormCfg = {
  id: string;
  formId: string;
  label: string;
  toEmails: string;
  ccEmails: string;
  enabled: boolean;
};

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-[var(--line)] rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-white text-xs font-semibold">
          {n}
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="text-sm leading-relaxed space-y-2 pl-8">{children}</div>
    </section>
  );
}

export function SiteFormConfigPanel({
  siteId,
  domain,
  siteKey,
  ingestUrl,
  forms,
  enabled: initialEnabled,
  onClose,
}: {
  siteId: string;
  domain: string;
  siteKey: string;
  ingestUrl: string;
  forms: FormCfg[];
  enabled: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [err, setErr] = useState("");

  async function saveAll(e: FormEvent) {
    e.preventDefault();
    const form = document.getElementById("site-form-mail-config") as HTMLFormElement | null;
    const fd = form ? new FormData(form) : new FormData();
    const formId = String(fd.get("formId") || "").trim();
    const toEmails = String(fd.get("toEmails") || "").trim();
    const ccEmails = String(fd.get("ccEmails") || "").trim();
    const addingForm = Boolean(formId || toEmails || ccEmails);

    if (addingForm && !formId) {
      setErr("请填写 WPForms form_id");
      return;
    }
    if (addingForm && !toEmails) {
      setErr("请填写收件人邮箱");
      return;
    }
    if (!addingForm && enabled === initialEnabled) {
      setErr("没有需要保存的更改");
      return;
    }

    setBusy(true);
    setErr("");

    if (enabled !== initialEnabled) {
      const enRes = await fetch(`/api/admin/sites/${siteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!enRes.ok) {
        const data = await enRes.json().catch(() => ({}));
        setBusy(false);
        setErr(data.error || "保存对接状态失败");
        return;
      }
    }

    if (addingForm) {
      const res = await fetch("/api/admin/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, formId, toEmails, ccEmails }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setBusy(false);
        setErr(data.error || "保存表单收件失败");
        return;
      }
      form?.reset();
    }

    setBusy(false);
    router.refresh();
  }

  async function removeForm(id: string, formId: string) {
    if (!confirm(`确认删除 Form ${formId} 的收件配置？`)) return;
    setBusy(true);
    setErr("");
    const res = await fetch("/api/admin/forms", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data.error || "删除失败");
      return;
    }
    router.refresh();
  }

  return (
    <SideDrawer onClose={onClose}>
      <div className="flex flex-col h-full min-h-0">
        <div className="shrink-0 px-5 pt-5 pb-3 flex items-start justify-between gap-3 border-b border-[var(--line)]">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">询盘配置</h2>
            <p className="text-sm text-[var(--muted)] mt-0.5 truncate">{domain}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm border border-[var(--line)] rounded-lg px-2 py-1 shrink-0"
          >
            关闭
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <p className="text-xs text-[var(--muted)]">
          请按下方步骤完成。插件装在客户 WordPress 站，不在本系统服务器。
        </p>

        <div className="rounded-xl border border-[var(--line)] bg-black/[0.02] p-3">
          <label className="text-sm flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={enabled}
              disabled={busy}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span>
              <span className="font-medium">启用询盘对接</span>
              <span className="block text-xs text-[var(--muted)] mt-1 leading-relaxed">
                勾选并保存后：该站 WordPress 插件可用 site_key 把表单询盘推到本系统。
                <br />
                取消勾选并保存后：本系统<strong>拒收</strong>该站推送；询盘走 WPForms
                原生邮件，且不会进本系统列表/报表。
              </span>
            </span>
          </label>
        </div>

        <Step n={1} title="下载并安装 WordPress 插件">
          <p className="text-[var(--muted)] text-xs">
            先装插件，后台才会出现「设置 → 询盘对接」。需该站已安装 WPForms Pro。
          </p>
          <PluginDownloadCard />
          <ol className="list-decimal pl-4 text-xs text-[var(--muted)] space-y-1">
            <li>
              下载 zip → 解压后上传到{" "}
              <code className="bg-black/5 px-1 rounded">wp-content/plugins/wp-inquiry-bridge/</code>
              ，或用 WP「插件 → 上传插件」。
            </li>
            <li>
              在该站后台启用 <strong>Inquiry Bridge for WPForms</strong>。
            </li>
          </ol>
        </Step>

        <Step n={2} title="把本站密钥填进 WordPress 插件">
          <p className="text-xs text-[var(--muted)]">
            打开该站 WP 后台 → <strong>设置 → 询盘对接</strong>，粘贴保存下面两项。
          </p>
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
          <p className="text-xs text-[var(--muted)]">
            建议在插件里填写<strong>表单 ID 白名单</strong>（询盘表的 WPForms form_id，见步骤
            3），避免登录表等其它表单也被推送。
          </p>
        </Step>

        <Step n={3} title="在本系统配置表单收件人（必做）">
          <p className="text-xs text-[var(--muted)]">
            决定系统代发询盘时发给谁。form_id 在 WP 后台 → WPForms → All Forms
            列表或编辑地址的 <code className="bg-black/5 px-1 rounded">form_id=数字</code>{" "}
            中查看。未配置收件人时<strong>无法代发</strong>。
          </p>
          <ul className="text-sm space-y-1">
            {forms.length === 0 ? (
              <li className="text-[var(--warn)] text-xs">尚未配置表单收件，请先添加下方表单。</li>
            ) : (
              forms.map((f) => (
                <li
                  key={f.id}
                  className="border-b border-[var(--line)] py-1.5 text-xs flex items-center justify-between gap-2"
                >
                  <span>
                    Form {f.formId} → {f.toEmails}
                    {f.ccEmails ? `；CC ${f.ccEmails}` : ""}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => removeForm(f.id, f.formId)}
                    className="shrink-0 text-[var(--danger)] hover:underline disabled:opacity-50"
                  >
                    删除
                  </button>
                </li>
              ))
            )}
          </ul>
          <form id="site-form-mail-config" onSubmit={saveAll} className="grid gap-2">
            <input
              name="formId"
              placeholder="WPForms form_id，如 34"
              className="border border-[var(--line)] rounded-lg px-2 py-1.5 text-sm"
            />
            <input
              name="toEmails"
              placeholder="收件人邮箱，逗号分隔"
              className="border border-[var(--line)] rounded-lg px-2 py-1.5 text-sm"
            />
            <input
              name="ccEmails"
              placeholder="抄送 CC，逗号分隔（可选）"
              className="border border-[var(--line)] rounded-lg px-2 py-1.5 text-sm"
            />
          </form>
        </Step>

        <div className="rounded-xl border border-[var(--line)] bg-amber-50/60 px-3 py-2.5 space-y-1.5">
          <p className="text-xs font-medium text-[var(--warn)]">提示：保留 WPForms 原生通知</p>
          <p className="text-xs text-[var(--muted)] leading-relaxed">
            请<strong>保留</strong> WPForms 该表单的通知收件人。插件推送成功时会阻止本次原生发信；推送失败时仍由
            WPForms 发信，避免丢单。
          </p>
          <p className="text-xs text-[var(--muted)] leading-relaxed">
            邮件规则：第一封为标记邮件（不含买家邮箱）；客户标「有效」后，服务期内系统会立刻再发一封含买家邮箱的邮件供回复。
          </p>
        </div>

        {err ? <p className="text-sm text-[var(--danger)]">{err}</p> : null}
        </div>

        <div className="shrink-0 border-t border-[var(--line)] bg-white px-5 py-3 flex justify-start gap-2">
          <button
            type="submit"
            form="site-form-mail-config"
            disabled={busy}
            className="bg-[var(--brand)] text-white rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {busy ? "保存中…" : "保存"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="border border-[var(--line)] rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
          >
            取消
          </button>
        </div>
      </div>
    </SideDrawer>
  );
}
