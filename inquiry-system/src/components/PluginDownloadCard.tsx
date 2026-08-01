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
    <div className="rounded-xl border border-[var(--brand)]/25 bg-[var(--brand)]/5 p-4 space-y-3">
      <div className="text-sm font-medium">下载 WordPress 插件包</div>
      <p className="text-sm text-[var(--muted)] leading-relaxed">
        下载后解压，将文件夹 <code className="bg-black/5 px-1 rounded">wp-inquiry-bridge</code>{" "}
        上传到目标网站服务器的：
      </p>
      <code className="block text-xs sm:text-sm bg-white border border-[var(--line)] rounded-lg px-3 py-2 break-all">
        wp-content/plugins/wp-inquiry-bridge/
      </code>
      <p className="text-xs text-[var(--muted)] leading-relaxed">
        解压后目录内应能看到 <code className="bg-black/5 px-1 rounded">inquiry-bridge.php</code>
        。也可用 WordPress 后台「插件 → 安装插件 → 上传插件」直接上传本 zip（需支持 zip 安装）。
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={download}
        className="bg-[var(--brand)] text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50"
      >
        {busy ? "正在打包…" : "下载 wp-inquiry-bridge.zip"}
      </button>
      {err && <p className="text-sm text-[var(--danger)]">{err}</p>}
    </div>
  );
}
