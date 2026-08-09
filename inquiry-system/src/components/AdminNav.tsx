"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/admin", label: "统计概览" },
  { href: "/admin/inquiries", label: "询盘列表" },
  { href: "/admin/sites", label: "网站列表" },
  { href: "/admin/promos", label: "信息核对" },
  { href: "/admin/report-template", label: "报表模版" },
  { href: "/admin/clients", label: "客户" },
  { href: "/admin/blacklist", label: "黑名单" },
  { href: "/admin/settings", label: "发件设置" },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-[220px] shrink-0 bg-[var(--sidebar)] text-white flex flex-col min-h-screen">
      <div className="px-4 py-5 border-b border-white/10">
        <div className="text-[15px] font-semibold tracking-tight">询盘管理</div>
        <div className="text-[11px] text-[var(--sidebar-muted)] mt-0.5">贸牛 · SaaS 工作台</div>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {links.map((l) => {
          const active =
            l.href === "/admin"
              ? pathname === "/admin"
              : pathname === l.href || pathname.startsWith(`${l.href}/`);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`block rounded-md px-3 py-2 text-[13px] transition-colors ${
                active
                  ? "bg-[var(--sidebar-active)] text-white font-medium"
                  : "text-slate-300 hover:bg-[var(--sidebar-hover)] hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-white/10 space-y-2">
        <button
          onClick={logout}
          className="w-full text-left text-[12px] text-[var(--sidebar-muted)] hover:text-white px-2 py-1.5 rounded-md hover:bg-[var(--sidebar-hover)]"
        >
          退出登录
        </button>
      </div>
    </aside>
  );
}
