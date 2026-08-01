import { notFound } from "next/navigation";
import { PromoPublicEditor } from "@/components/PromoPublicEditor";
import { getPromoByEditToken, isEditTokenValid } from "@/lib/promo";

type Ctx = { params: Promise<{ token: string }> };

export default async function PromoPublicPage({ params }: Ctx) {
  const { token } = await params;
  const promo = await getPromoByEditToken(token);
  if (!promo) notFound();

  const valid = isEditTokenValid(promo.editTokenExpires);

  return (
    <main className="min-h-screen flex flex-col items-center p-6 pt-12 bg-[var(--bg)]">
      <div className="w-full max-w-2xl bg-[var(--panel)] border border-[var(--line)] rounded-lg p-6 shadow-sm">
        {!valid ? (
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight">链接已失效</h1>
            <p className="text-sm text-[var(--muted)]">
              该信息核对编辑链接已超过 7 天有效期，请联系管理员重新发送。
            </p>
          </div>
        ) : (
          <PromoPublicEditor
            token={token}
            clientName={promo.client.name}
            expiresAt={promo.editTokenExpires?.toISOString() ?? null}
            initial={{
              keywords: promo.keywords,
              productPoints: promo.productPoints,
              adPoints: promo.adPoints,
            }}
          />
        )}
      </div>
      <p className="mt-6 text-[11px] text-[var(--muted)]">
        © {new Date().getFullYear()} 福建贸牛科技股份有限公司 保留所有权利
      </p>
    </main>
  );
}
