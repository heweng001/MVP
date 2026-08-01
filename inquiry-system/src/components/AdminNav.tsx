"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/admin", label: "统计概览" },
  { href: "/admin/inquiries", label: "询盘列表" },
  { href: "/admin/clients", label: "客户列表" },
  { href: "/admin/sites", label: "网站列表" },
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
    <aside className="w-56 shrink-0 border-r border-[var(--line)] bg-white/80 backdrop-blur p-4 min-h-screen">
      <div className="mb-8">
        <div className="text-lg font-semibold">询盘管理</div>
        <div className="text-xs text-[var(--muted)] mt-1">v1.1 MVP</div>
      </div>
      <nav className="flex flex-col gap-1">
        {links.map((l) => {
          const active =
            l.href === "/admin"
              ? pathname === "/admin"
              : pathname === l.href || pathname.startsWith(`${l.href}/`);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-2 text-sm ${
                active ? "bg-[var(--brand)] text-white" : "hover:bg-black/5"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
      <button
        onClick={logout}
        className="mt-10 text-sm text-[var(--muted)] hover:text-[var(--ink)]"
      >
        退出登录
      </button>
    </aside>
  );
}
