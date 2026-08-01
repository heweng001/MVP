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
    <main className="min-h-screen flex items-start justify-center p-6 pt-12">
      <div className="w-full max-w-2xl">
        {!valid ? (
          <div className="bg-white border border-[var(--line)] rounded-2xl p-8 shadow-sm space-y-2">
            <h1 className="text-xl font-semibold">链接已失效</h1>
            <p className="text-sm text-[var(--muted)]">
              该编辑链接已超过 7 天有效期，请联系管理员重新发送。
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
    </main>
  );
}
