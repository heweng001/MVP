import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AdminNav } from "@/components/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <AdminNav />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-5 md:p-7">{children}</main>
        <footer className="px-5 md:px-7 py-3 border-t border-[var(--line)] bg-[var(--panel)] text-[11px] text-[var(--muted)]">
          © {new Date().getFullYear()} 福建贸牛科技股份有限公司 保留所有权利
        </footer>
      </div>
    </div>
  );
}
