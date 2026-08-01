"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  initial: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    from: string;
    hasPassword: boolean;
    configured: boolean;
    source: "database" | "env" | "none";
  };
};

export function SmtpSettingsForm({ initial }: Props) {
  const router = useRouter();
  const [host, setHost] = useState(initial.host);
  const [port, setPort] = useState(String(initial.port || 587));
  const [secure, setSecure] = useState(initial.secure);
  const [user, setUser] = useState(initial.user);
  const [from, setFrom] = useState(initial.from);
  const [pass, setPass] = useState("");
  const [clearPassword, setClearPassword] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [hasPassword, setHasPassword] = useState(initial.hasPassword);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    const res = await fetch("/api/admin/settings/smtp", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host,
        port: Number(port) || 587,
        secure,
        user,
        from,
        pass: clearPassword ? "" : pass,
        clearPassword,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(data.error || "保存失败");
      return;
    }
    setPass("");
    setClearPassword(false);
    setHasPassword(Boolean(data.smtp?.hasPassword));
    setMsg("已保存发件设置");
    router.refresh();
  }

  async function onTest() {
    setBusy(true);
    setMsg(null);
    setErr(null);
    const res = await fetch("/api/admin/settings/smtp/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: testTo }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(data.error || "测试发送失败");
      return;
    }
    setMsg(`测试邮件已发送至 ${testTo.trim()}`);
  }

  const statusText =
    initial.source === "database"
      ? "当前使用后台已保存的配置"
      : initial.source === "env"
        ? "尚未在后台保存，暂回退使用服务器 .env"
        : "尚未配置，询盘邮件无法发出";

  return (
    <div className="space-y-4 max-w-xl">
      <div
        className={`text-sm rounded-lg px-3 py-2 border ${
          initial.configured
            ? "border-[var(--brand)]/30 bg-[var(--brand)]/5"
            : "border-[var(--warn)]/40 bg-[var(--warn)]/5 text-[var(--warn)]"
        }`}
      >
        {statusText}
      </div>

      <form onSubmit={onSave} className="bg-white border border-[var(--line)] rounded-xl p-5 space-y-4">
        <label className="block text-sm space-y-1">
          <span>SMTP 主机</span>
          <input
            required
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="smtp.example.com（只填主机名，不要粘贴整段配置）"
            className="w-full border border-[var(--line)] rounded-lg px-3 py-2"
          />
          <span className="text-xs text-[var(--muted)]">
            示例：smtp.exmail.qq.com / smtp.qiye.aliyun.com，不要填端口或账号。
          </span>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm space-y-1">
            <span>端口</span>
            <input
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className="w-full border border-[var(--line)] rounded-lg px-3 py-2"
            />
          </label>
          <label className="flex items-end gap-2 text-sm pb-2">
            <input
              type="checkbox"
              checked={secure}
              onChange={(e) => setSecure(e.target.checked)}
            />
            <span>SSL/TLS（secure）</span>
          </label>
        </div>
        <p className="text-xs text-[var(--muted)] -mt-2">
          常用：587 不勾选（STARTTLS）；465 勾选 SSL。端口与勾选不一致会导致 wrong version number。
        </p>

        <label className="block text-sm space-y-1">
          <span>SMTP 账号</span>
          <input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="发信账号"
            className="w-full border border-[var(--line)] rounded-lg px-3 py-2"
          />
        </label>

        <label className="block text-sm space-y-1">
          <span>SMTP 密码</span>
          <input
            type="password"
            value={pass}
            onChange={(e) => {
              setPass(e.target.value);
              if (e.target.value) setClearPassword(false);
            }}
            placeholder={hasPassword ? "已保存，留空表示不修改" : "授权码 / 密码"}
            className="w-full border border-[var(--line)] rounded-lg px-3 py-2"
            autoComplete="new-password"
            disabled={clearPassword}
          />
          {hasPassword && (
            <label className="flex items-center gap-2 text-xs text-[var(--muted)] mt-1">
              <input
                type="checkbox"
                checked={clearPassword}
                onChange={(e) => {
                  setClearPassword(e.target.checked);
                  if (e.target.checked) setPass("");
                }}
              />
              清除已保存密码
            </label>
          )}
        </label>

        <label className="block text-sm space-y-1">
          <span>发件人 From</span>
          <input
            required
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder='询盘系统 <noreply@your-domain.com>'
            className="w-full border border-[var(--line)] rounded-lg px-3 py-2"
          />
          <span className="text-xs text-[var(--muted)]">
            客户收到邮件时显示的发件名称与地址，需与服务商允许的发信域名一致。
          </span>
        </label>

        <button
          type="submit"
          disabled={busy}
          className="bg-[var(--brand)] text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50"
        >
          保存
        </button>
      </form>

      <div className="bg-white border border-[var(--line)] rounded-xl p-5 space-y-3">
        <div className="text-sm font-medium">发送测试邮件</div>
        <p className="text-xs text-[var(--muted)]">请先保存配置，再测是否能真正发出。</p>
        <div className="flex flex-wrap gap-2">
          <input
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="你的邮箱"
            className="border border-[var(--line)] rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
          />
          <button
            type="button"
            disabled={busy || !testTo.trim()}
            onClick={onTest}
            className="border border-[var(--line)] rounded-lg px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50"
          >
            发送测试
          </button>
        </div>
      </div>

      {msg && <p className="text-sm text-[var(--brand)]">{msg}</p>}
      {err && <p className="text-sm text-[var(--danger)]">{err}</p>}
    </div>
  );
}
