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
        <h1 className="text-2xl font-bold text-primary mb-8">
          {t("account.title")}
        </h1>

        {provider ? (
          <div className="bg-surface rounded-xl border border-border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-primary">{provider.name}</h2>
                <span
                  className={`inline-flex mt-1 px-2 py-0.5 rounded text-xs font-medium border ${
                    provider.status === "active"
                      ? "border-border text-accent"
                      : "border-border text-muted"
                  }`}
                >
                  {provider.status === "active"
                    ? t("account.statusActive")
                    : t("account.listingPending")}
                </span>
              </div>
              <Link
                href="/account/edit"
                className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
              >
                {t("account.editListing")}
              </Link>
            </div>
            <div className="flex gap-3 pt-2">
              <Link
                href={`/provider/${provider.slug}`}
                className="text-sm text-accent hover:text-accent-hover transition-colors"
              >
                {t("account.viewPublicProfile")}
              </Link>
              <Link
                href="/account/recommend"
                className="text-sm text-accent hover:text-accent-hover transition-colors"
              >
                {t("recommendations.recommend")}
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/account/create"
              className="flex flex-col items-center gap-3 p-8 bg-surface rounded-xl border-2 border-border hover:border-accent hover:shadow-sm transition-all text-center"
            >
              <span className="text-4xl">✨</span>
              <span className="font-semibold text-primary">
                {t("account.createListing")}
              </span>
              <span className="text-sm text-muted">
                {t("account.createListingDesc")}
              </span>
            </Link>
            <Link
              href="/account/claim"
              className="flex flex-col items-center gap-3 p-8 bg-surface rounded-xl border-2 border-border hover:border-accent hover:shadow-sm transition-all text-center"
            >
              <span className="text-4xl">🔍</span>
              <span className="font-semibold text-primary">
                {t("account.claimListing")}
              </span>
              <span className="text-sm text-muted">
                {t("account.claimListingDesc")}
              </span>
            </Link>
            <Link
              href="/account/recommend"
              className="flex flex-col items-center gap-3 p-8 bg-surface rounded-xl border-2 border-border hover:border-accent hover:shadow-sm transition-all text-center"
            >
              <span className="text-4xl">💡</span>
              <span className="font-semibold text-primary">
                {t("recommendations.recommend")}
              </span>
              <span className="text-sm text-muted">
                {t("account.recommendCardDesc")}
              </span>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
