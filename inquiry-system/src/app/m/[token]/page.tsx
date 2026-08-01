import { MarkConfirm } from "@/components/MarkConfirm";
import { getInquiryByToken, markWindowInfo } from "@/lib/mark";
import { STATUS_LABELS } from "@/lib/constants";
import { notFound } from "next/navigation";

type Ctx = { params: Promise<{ token: string }>; searchParams: Promise<{ a?: string }> };

export default async function MarkPage({ params, searchParams }: Ctx) {
  const { token } = await params;
  const sp = await searchParams;
  const action = sp.a === "invalid" ? "invalid" : sp.a === "valid" ? "valid" : "";
  const inquiry = await getInquiryByToken(token);
  if (!inquiry) notFound();

  const window = markWindowInfo(inquiry.sentAt);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white border border-[var(--line)] rounded-2xl p-8 shadow-sm">
        <h1 className="text-xl font-semibold mb-2">询盘标记确认</h1>
        <p className="text-sm text-[var(--muted)] mb-4">
          来自 {inquiry.site.domain}
        </p>
        <div className="text-sm space-y-1 mb-6">
          <div>当前状态：{STATUS_LABELS[inquiry.status] || inquiry.status}</div>
          <div>联系人：{inquiry.name || "—"} / {inquiry.email || "—"}</div>
        </div>
        <MarkConfirm
          token={token}
          preferredAction={action}
          canMark={window.canMark}
          reason={window.reason}
          currentStatus={inquiry.status}
        />
      </div>
    </main>
  );
}
