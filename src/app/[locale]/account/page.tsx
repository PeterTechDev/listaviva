import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth";

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const user = await getCurrentUser();

  if (!user) redirect(`/${locale}/login`);

  const supabase = await createClient();
  const { data: provider } = await supabase
    .from("providers")
    .select("id, name, slug, status")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto px-4 py-12 w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">
          {t("account.title")}
        </h1>

        {provider ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">{provider.name}</h2>
                <span
                  className={`inline-flex mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                    provider.status === "active"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {provider.status === "active"
                    ? "Ativo"
                    : t("account.listingPending")}
                </span>
              </div>
              <Link
                href="/account/edit"
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
              >
                {t("account.editListing")}
              </Link>
            </div>
            <div className="flex gap-3 pt-2">
              <Link
                href={`/provider/${provider.slug}`}
                className="text-sm text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                Ver perfil público →
              </Link>
              <Link
                href="/account/recommend"
                className="text-sm text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                {t("recommendations.recommend")}
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/account/create"
              className="flex flex-col items-center gap-3 p-8 bg-white rounded-xl border-2 border-emerald-200 hover:border-emerald-400 hover:shadow-sm transition-all text-center"
            >
              <span className="text-4xl">✨</span>
              <span className="font-semibold text-gray-900">
                {t("account.createListing")}
              </span>
              <span className="text-sm text-gray-500">
                Crie um novo perfil para o seu negócio
              </span>
            </Link>
            <Link
              href="/account/claim"
              className="flex flex-col items-center gap-3 p-8 bg-white rounded-xl border-2 border-gray-200 hover:border-gray-400 hover:shadow-sm transition-all text-center"
            >
              <span className="text-4xl">🔍</span>
              <span className="font-semibold text-gray-900">
                {t("account.claimListing")}
              </span>
              <span className="text-sm text-gray-500">
                Reivindique um perfil já existente
              </span>
            </Link>
            <Link
              href="/account/recommend"
              className="flex flex-col items-center gap-3 p-8 bg-white rounded-xl border-2 border-blue-200 hover:border-blue-400 hover:shadow-sm transition-all text-center"
            >
              <span className="text-4xl">💡</span>
              <span className="font-semibold text-gray-900">
                {t("recommendations.recommend")}
              </span>
              <span className="text-sm text-gray-500">
                Recomende um novo fornecedor
              </span>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
