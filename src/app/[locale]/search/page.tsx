import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { Link } from "@/i18n/navigation";
import { searchProviders } from "@/lib/search";
import { ProviderCard } from "@/components/provider-card";
import SearchBairroFilter from "./BairroFilter";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: t("search.title") };
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; bairro_id?: string }>;
}) {
  const { locale } = await params;
  const { q = "", bairro_id } = await searchParams;
  const t = await getTranslations({ locale });

  if (!q.trim()) redirect("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ results, usedFallback: _usedFallback }, { data: bairros }] =
    await Promise.all([
      searchProviders({
        query: q,
        bairroId: bairro_id ?? null,
        userId: user?.id ?? null,
        supabase,
      }),
      supabase.from("bairros").select("id, name, slug").order("name"),
    ]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted mb-6">
          <Link href="/" className="hover:text-primary transition-colors">
            {t("common.appName")}
          </Link>
          <span>/</span>
          <span className="text-primary">{t("search.title")}</span>
        </div>

        <h1 className="text-2xl font-bold text-primary mb-4">
          {t("search.resultsFor", { q })}
        </h1>

        {/* Bairro filter pills */}
        <div className="mb-8">
          <SearchBairroFilter
            bairros={bairros ?? []}
            currentBairroId={bairro_id ?? ""}
            query={q}
            allLabel={t("search.allBairros")}
          />
        </div>

        {results.length === 0 ? (
          <div className="py-20 text-center text-muted">
            <div className="text-5xl mb-4">🔍</div>
            <p>{t("search.noResults")}</p>
            {bairro_id && (
              <p className="mt-2 text-sm">
                <Link
                  href={`/search?q=${encodeURIComponent(q)}`}
                  className="text-accent hover:text-accent-hover"
                >
                  {t("search.tryWithout")}
                </Link>
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((provider) => (
              <ProviderCard
                key={provider.id}
                name={provider.name}
                slug={provider.slug}
                categoryIcon={provider.categories[0]?.icon}
                bairroName={provider.home_bairro?.name}
                description={provider.description_pt}
                whatsapp={provider.whatsapp}
                categories={provider.categories}
                locale={locale}
                contactLabel={t("provider.contactWhatsApp")}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-border py-6">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-muted">
          {t("common.appName")} &mdash; {t("common.tagline")}
        </div>
      </footer>
    </div>
  );
}
