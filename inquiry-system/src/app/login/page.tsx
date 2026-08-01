"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: fd.get("username"),
        password: fd.get("password"),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "登录失败");
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--bg)]">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-[var(--panel)] border border-[var(--line)] rounded-lg p-7 shadow-sm"
      >
        <div className="mb-6">
          <div className="text-[11px] font-medium tracking-wide text-[var(--brand)] uppercase mb-1">
            贸牛 · SaaS
          </div>
          <h1 className="text-xl font-semibold tracking-tight">询盘管理系统</h1>
          <p className="text-[var(--muted)] mt-1 text-[13px]">服务商管理后台</p>
        </div>
        <label className="block text-[13px] mb-1.5 text-[var(--muted)]">用户名</label>
        <input
          name="username"
          required
          className="w-full border border-[var(--line)] rounded-md px-3 py-2 mb-3"
          defaultValue="admin"
        />
        <label className="block text-[13px] mb-1.5 text-[var(--muted)]">密码</label>
        <input
          name="password"
          type="password"
          required
          className="w-full border border-[var(--line)] rounded-md px-3 py-2 mb-4"
        />
        {error ? <p className="text-[var(--danger)] text-sm mb-3">{error}</p> : null}
        <button
          disabled={loading}
          className="w-full bg-[var(--brand)] text-white rounded-md py-2.5 text-[13px] font-medium disabled:opacity-60"
        >
          {loading ? "登录中…" : "登录"}
        </button>
      </form>
      <p className="mt-6 text-[11px] text-[var(--muted)]">
        © {new Date().getFullYear()} 福建贸牛科技股份有限公司 保留所有权利
      </p>
    </main>
  );
}
