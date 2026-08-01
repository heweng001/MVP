"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function BlacklistForm({ sites }: { sites: { id: string; name: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    const fd = new FormData(form);
    const res = await fetch("/api/admin/blacklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: fd.get("type"),
        value: fd.get("value"),
        reason: fd.get("reason"),
        siteId: fd.get("siteId") || null,
      }),
    });
    setBusy(false);
    if (!res.ok) return;
    form.reset();
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white border border-[var(--line)] rounded-xl p-4 flex flex-wrap gap-2 items-end"
    >
      <select name="type" className="border border-[var(--line)] rounded-lg px-2 py-1.5 text-sm">
        <option value="email">邮箱</option>
        <option value="domain">邮箱域名</option>
        <option value="url">正文 URL/域名</option>
      </select>
      <input
        name="value"
        required
        placeholder="值"
        className="border border-[var(--line)] rounded-lg px-2 py-1.5 text-sm"
      />
      <select name="siteId" className="border border-[var(--line)] rounded-lg px-2 py-1.5 text-sm">
        <option value="">全局</option>
        {sites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <input
        name="reason"
        placeholder="原因"
        className="border border-[var(--line)] rounded-lg px-2 py-1.5 text-sm flex-1 min-w-[160px]"
      />
      <button
        disabled={busy}
        className="bg-[var(--brand)] text-white rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
      >
        添加
      </button>
    </form>
  );
}
