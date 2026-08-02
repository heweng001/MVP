import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { STATUS_LABELS } from "@/lib/constants";
import { InquiryActions } from "@/components/InquiryActions";
import { PageHeader } from "@/components/PageHeader";
import { extractHiddenFields } from "@/lib/wp-fields";
import { format } from "date-fns";

type Ctx = { params: Promise<{ id: string }> };

export default async function InquiryDetailPage({ params }: Ctx) {
  const { id } = await params;
  const item = await prisma.inquiry.findUnique({
    where: { id },
    include: { site: { include: { client: true } } },
  });
  if (!item) notFound();

  let hits: string[] = [];
  try {
    hits = JSON.parse(item.spamHits);
  } catch {
    hits = [];
  }

  const hiddenFields = extractHiddenFields(item.rawPayload);

  return (
    <div className="space-y-4 max-w-3xl">
      <PageHeader
        title="询盘详情"
        hint={`${item.site.client.name} · ${item.site.domain} · ${STATUS_LABELS[item.status] || item.status}`}
      />

      <div className="bg-[var(--panel)] border border-[var(--line)] rounded-lg p-4 space-y-3 shadow-sm">
        <InquiryActions id={item.id} mode="detail" forwarded={Boolean(item.sentAt)} />
        <dl className="grid md:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-[var(--muted)]">提交时间</dt>
            <dd>{format(item.submittedAt, "yyyy-MM-dd HH:mm:ss")}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">发信时间</dt>
            <dd>{item.sentAt ? format(item.sentAt, "yyyy-MM-dd HH:mm:ss") : "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">标记时间</dt>
            <dd>{item.markedAt ? format(item.markedAt, "yyyy-MM-dd HH:mm:ss") : "—"}</dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-[var(--muted)]">客户反馈原因</dt>
            <dd className="whitespace-pre-wrap mt-1">
              {item.markReason?.trim() ? item.markReason : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">垃圾分</dt>
            <dd>{item.spamScore}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">姓名</dt>
            <dd>{item.name || "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">邮箱</dt>
            <dd>{item.email || "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">电话</dt>
            <dd>{item.phone || "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">主题</dt>
            <dd>{item.subject || "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Form / Entry</dt>
            <dd>
              {item.formId} / {item.entryId}
            </dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-[var(--muted)]">来源页</dt>
            <dd className="break-all">{item.pageUrl || "—"}</dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-[var(--muted)]">正文</dt>
            <dd className="whitespace-pre-wrap mt-1 bg-black/[0.03] rounded-lg p-3">
              {item.message || "(空)"}
            </dd>
          </div>
          {hiddenFields.length ? (
            <div className="md:col-span-2">
              <dt className="text-[var(--muted)] mb-1">隐藏字段（WPForms Hidden）</dt>
              <dd className="rounded-lg border border-[var(--line)] overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {hiddenFields.map((f) => (
                      <tr key={f.id} className="border-t border-[var(--line)] first:border-t-0">
                        <td className="px-3 py-2 text-[var(--muted)] w-[30%] align-top">{f.label}</td>
                        <td className="px-3 py-2 break-all whitespace-pre-wrap">
                          {f.html ? (
                            <div
                              className="text-sm [&_table]:w-full [&_td]:border [&_td]:border-[var(--line)] [&_td]:px-2 [&_td]:py-1"
                              dangerouslySetInnerHTML={{ __html: f.value }}
                            />
                          ) : (
                            f.value
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </dd>
            </div>
          ) : null}
        </dl>
        {hits.length ? (
          <div>
            <div className="text-sm text-[var(--muted)] mb-1">命中规则</div>
            <ul className="text-sm list-disc pl-5">
              {hits.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {item.degraded ? (
          <p className="text-sm text-[var(--warn)]">本条曾触发降级放行/发信异常。</p>
        ) : null}
        {item.autoSentReview ? (
          <p className="text-sm text-[var(--muted)]">本条因待审超时自动发送。</p>
        ) : null}
        {item.notes ? (
          <pre className="text-xs text-[var(--muted)] whitespace-pre-wrap">{item.notes}</pre>
        ) : null}
      </div>
    </div>
  );
}
