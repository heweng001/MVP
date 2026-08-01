"use client";

import { useState } from "react";

export function PluginDownloadCard() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/plugin/download");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `下载失败（${res.status}）`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "wp-inquiry-bridge.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--line)] bg-black/[0.02] p-3 space-y-2">
      <p className="text-xs text-[var(--muted)] leading-relaxed">
        下载后解压，将 <code className="bg-black/5 px-1 rounded">wp-inquiry-bridge</code>{" "}
        放到目标站{" "}
        <code className="bg-black/5 px-1 rounded">wp-content/plugins/wp-inquiry-bridge/</code>
        ；或 WP 后台「插件 → 上传插件」直接上传 zip。
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={download}
        className="bg-[var(--brand)] text-white rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
      >
        {busy ? "正在打包…" : "下载 wp-inquiry-bridge.zip"}
      </button>
      {err && <p className="text-sm text-[var(--danger)]">{err}</p>}
    </div>
  );
}
