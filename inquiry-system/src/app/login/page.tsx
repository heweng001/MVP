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
    <main className="min-h-screen flex items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md bg-white border border-[var(--line)] rounded-2xl p-8 shadow-sm"
      >
        <h1 className="text-2xl font-semibold tracking-tight mb-1">询盘管理系统</h1>
        <p className="text-[var(--muted)] mb-6 text-sm">服务商管理后台 · 单管理员登录</p>
        <label className="block text-sm mb-2">用户名</label>
        <input
          name="username"
          required
          className="w-full border border-[var(--line)] rounded-lg px-3 py-2 mb-4"
          defaultValue="admin"
        />
        <label className="block text-sm mb-2">密码</label>
        <input
          name="password"
          type="password"
          required
          className="w-full border border-[var(--line)] rounded-lg px-3 py-2 mb-4"
        />
        {error ? <p className="text-[var(--danger)] text-sm mb-3">{error}</p> : null}
        <button
          disabled={loading}
          className="w-full bg-[var(--brand)] text-white rounded-lg py-2.5 font-medium disabled:opacity-60"
        >
          {loading ? "登录中…" : "登录"}
        </button>
      </form>
    </main>
  );
}
