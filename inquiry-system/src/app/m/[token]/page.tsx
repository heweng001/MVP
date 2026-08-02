import { MarkConfirm } from "@/components/MarkConfirm";
import { applyMark, getInquiryByToken, markWindowInfo } from "@/lib/mark";
import { notFound } from "next/navigation";

type Ctx = { params: Promise<{ token: string }>; searchParams: Promise<{ a?: string }> };

export default async function MarkPage({ params, searchParams }: Ctx) {
  const { token } = await params;
  const sp = await searchParams;
  const action = sp.a === "invalid" ? "invalid" : sp.a === "valid" ? "valid" : "";

  let inquiry = await getInquiryByToken(token);
  if (!inquiry) notFound();

  let justApplied = false;
  let applyError = "";
  const windowBefore = markWindowInfo(inquiry.sentAt);

  // 邮件链接一点即标记：打开页面时服务端直接落库，无需二次确认
  if (action && windowBefore.canMark) {
    const already =
      (action === "valid" && inquiry.status === "valid") ||
      (action === "invalid" && inquiry.status === "invalid");
    if (!already) {
      const result = await applyMark(token, action);
      if (result.ok) {
        justApplied = true;
        inquiry = await getInquiryByToken(token);
        if (!inquiry) notFound();
      } else {
        applyError = result.error;
      }
    } else {
      justApplied = true;
    }
  }

  const window = markWindowInfo(inquiry.sentAt);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--bg)]">
      <div className="w-full max-w-lg bg-[var(--panel)] border border-[var(--line)] rounded-lg p-7 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight mb-1">询盘质量反馈</h1>
        <p className="text-[13px] text-[var(--muted)] mb-5">
          {inquiry.site.domain}
          {inquiry.name || inquiry.email
            ? ` · ${inquiry.name || "—"}${inquiry.email ? ` / ${inquiry.email}` : ""}`
            : ""}
        </p>
        <MarkConfirm
          token={token}
          canMark={window.canMark}
          reason={window.reason}
          currentStatus={inquiry.status}
          remainingMs={window.remainingMs}
          initialMarkReason={inquiry.markReason || ""}
          justApplied={justApplied}
          applyError={applyError}
        />
      </div>
      <p className="mt-6 text-[11px] text-[var(--muted)]">
        © {new Date().getFullYear()} 福建贸牛科技股份有限公司 保留所有权利
      </p>
    </main>
  );
}
