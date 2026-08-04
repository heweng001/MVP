"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CopyField } from "./CopyField";
import { PluginDownloadCard } from "./PluginDownloadCard";
import { DEFAULT_MAIL_HIDDEN_FIELDS } from "@/lib/mail-hidden-config";

type FormCfg = {
  id: string;
  formId: string;
  label: string;
  toEmails: string;
  ccEmails: string;
  enabled: boolean;
};

type FieldOpt = { id: string; label: string; builtin?: boolean };

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
  mailHiddenFields = DEFAULT_MAIL_HIDDEN_FIELDS,
  onClose,
}: {
  siteId: string;
  domain: string;
  siteKey: string;
  ingestUrl: string;
  forms: FormCfg[];
  mailHiddenFields?: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<string[]>(mailHiddenFields);
  const [fieldOptions, setFieldOptions] = useState<FieldOpt[]>([]);
  const [hiddenMsg, setHiddenMsg] = useState("");

  useEffect(() => {
    setHiddenIds(mailHiddenFields);
  }, [mailHiddenFields]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/admin/sites/${siteId}`);
      const data = await res.json().catch(() => ({}));
      if (cancelled || !res.ok) return;
      if (Array.isArray(data.site?.mailHiddenFields)) {
        setHiddenIds(data.site.mailHiddenFields);
      }
      if (Array.isArray(data.fieldOptions)) {
        setFieldOptions(data.fieldOptions);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [siteId]);

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

  function toggleHidden(id: string) {
    setHiddenIds((prev) => {
      if (id === "geo" || id === "journey") {
        // 内置默认项不可取消
        return prev.includes(id) ? prev : [...prev, id];
      }
      return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    });
  }

  async function saveHiddenFields() {
    setBusy(true);
    setHiddenMsg("");
    const res = await fetch(`/api/admin/sites/${siteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mailHiddenFields: hiddenIds }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setHiddenMsg(data.error || "保存失败");
      return;
    }
    if (Array.isArray(data.site?.mailHiddenFields)) {
      setHiddenIds(data.site.mailHiddenFields);
    }
    setHiddenMsg("已保存邮件隐藏字段");
    router.refresh();
  }

  const options: FieldOpt[] =
    fieldOptions.length > 0
      ? fieldOptions
      : [
          { id: "geo", label: "买家的地理位置（默认隐藏）", builtin: true },
          { id: "journey", label: "买家浏览路径（默认隐藏）", builtin: true },
        ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="w-full max-w-lg bg-white h-full overflow-y-auto shadow-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">配置对接清单</h2>
            <p className="text-sm text-[var(--muted)] mt-0.5">{domain}</p>
            <p className="text-xs text-[var(--muted)] mt-1">
              请按下方步骤完成。插件装在客户 WordPress 站，不在本系统服务器。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm border border-[var(--line)] rounded-lg px-2 py-1 shrink-0"
          >
            关闭
          </button>
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
                <li key={f.id} className="border-b border-[var(--line)] py-1.5 text-xs">
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
              placeholder="备注，如：联系我们"
              className="border border-[var(--line)] rounded-lg px-2 py-1.5 text-sm"
            />
            <input
              name="toEmails"
              required
              placeholder="收件人邮箱，逗号分隔"
              className="border border-[var(--line)] rounded-lg px-2 py-1.5 text-sm"
            />
            <input
              name="ccEmails"
              placeholder="抄送 CC，逗号分隔（可选）"
              className="border border-[var(--line)] rounded-lg px-2 py-1.5 text-sm"
            />
            <button
              disabled={busy}
              className="bg-[var(--brand)] text-white rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
            >
              保存/更新表单收件
            </button>
          </form>
        </Step>

        <Step n={4} title="邮件隐藏字段（可选）">
          <p className="text-xs text-[var(--muted)]">
            勾选的字段放在邮件分割线下方：SEO
            站需客户标「有效」后才在反馈页可见真值；展示型站即使标有效也不显示真值。未勾选且非空的字段显示在分割线上方。地理位置与浏览路径默认隐藏且不可取消。
          </p>
          <div className="space-y-1.5 max-h-56 overflow-y-auto border border-[var(--line)] rounded-lg p-2">
            {options.map((opt) => {
              const checked = hiddenIds.includes(opt.id);
              const locked = opt.id === "geo" || opt.id === "journey";
              return (
                <label
                  key={opt.id}
                  className={`flex items-start gap-2 text-xs ${locked ? "opacity-90" : ""}`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={checked}
                    disabled={locked || busy}
                    onChange={() => toggleHidden(opt.id)}
                  />
                  <span>
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-[var(--muted)] ml-1">({opt.id})</span>
                    {locked ? (
                      <span className="text-[var(--muted)] ml-1">· 默认</span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
          <p className="text-[11px] text-[var(--muted)]">
            列表来自该站最近询盘字段；尚无询盘时仅显示默认两项。保存后对新发出的邮件生效。
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => saveHiddenFields()}
            className="bg-[var(--brand)] text-white rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
          >
            保存隐藏字段
          </button>
          {hiddenMsg ? <p className="text-xs text-[var(--muted)]">{hiddenMsg}</p> : null}
        </Step>

        <Step n={5} title="保留 WPForms 原生通知（降级备用）">
          <p className="text-xs text-[var(--muted)]">
            请<strong>保留</strong> WPForms 该表单的通知收件人。插件推送成功时会阻止本次原生发信；推送失败时仍由
            WPForms 发信，避免丢单。
          </p>
          <p className="text-xs text-[var(--muted)]">
            配置完成后，在站点前台提交一封测试询盘：本系统「询盘列表」应出现记录，步骤 3
            配置的收件邮箱应收到带「有效/无效」按钮的邮件（需已在「发件设置」配好 SMTP）。
          </p>
        </Step>
      </div>
    </div>
  );
}
