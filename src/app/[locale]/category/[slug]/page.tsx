import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/header";
import { ProviderCard } from "@/components/provider-card";
import BairroFilter from "./BairroFilter";

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ bairro?: string }>;
}) {
  const { locale, slug } = await params;
  const { bairro: bairroFilter } = await searchParams;
  const t = await getTranslations({ locale });

  const supabase = await createClient();

  const { data: category } = await supabase
    .from("categories")
    .select("id, name_pt, name_en, slug, icon")
    .eq("slug", slug)
    .single();

  if (!category) notFound();

  const categoryName =
    locale === "en" ? (category.name_en ?? category.name_pt) : category.name_pt;

  const { data: bairros } = await supabase
    .from("bairros")
    .select("id, name, slug")
    .order("name");

  let providerQuery = supabase
    .from("providers")
    .select(
      `
      id,
      name,
      slug,
      description_pt,
      description_en,
      whatsapp,
      home_bairro:home_bairro_id(name, slug),
      provider_categories!inner(category_id),
      provider_photos(url, sort_order)
      `
    )
    .eq("status", "active")
    .eq("provider_categories.category_id", category.id)
    .order("name");

  if (bairroFilter) {
    const { data: areaProviderIds } = await supabase
      .from("provider_service_areas")
      .select("provider_id, bairros!inner(slug)")
      .eq("bairros.slug", bairroFilter);

    const ids = areaProviderIds?.map((r) => r.provider_id) ?? [];
    if (ids.length === 0) {
      return (
        <CategoryPageLayout
          header={<Header />}
          categoryName={categoryName}
          icon={category.icon}
          bairros={bairros ?? []}
          currentBairro={bairroFilter}
          locale={locale}
          t={t}
        >
          <EmptyState message={t("catalog.noProvidersWithFilter")} />
        </CategoryPageLayout>
      );
    }
    providerQuery = providerQuery.in("id", ids);
  }

  const { data: providers } = await providerQuery;

  return (
    <CategoryPageLayout
      header={<Header />}
      categoryName={categoryName}
      icon={category.icon}
      bairros={bairros ?? []}
      currentBairro={bairroFilter}
      locale={locale}
      t={t}
    >
      {!providers || providers.length === 0 ? (
        <EmptyState message={t("catalog.noProviders")} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {providers.map((provider) => {
            const photo = provider.provider_photos
              ?.sort(
                (a: { sort_order: number }, b: { sort_order: number }) =>
                  a.sort_order - b.sort_order
              )
              ?.[0]?.url;
            const desc =
              locale === "en"
                ? (provider.description_en ?? provider.description_pt)
                : provider.description_pt;
            const bairroRaw = provider.home_bairro;
            const bairroName = Array.isArray(bairroRaw)
              ? (bairroRaw[0] as { name: string } | undefined)?.name
              : (bairroRaw as { name: string } | null)?.name;

            return (
              <ProviderCard
                key={provider.id}
                name={provider.name}
                slug={provider.slug}
                photoUrl={photo}
                categoryIcon={category.icon}
                bairroName={bairroName}
                description={desc}
                whatsapp={provider.whatsapp}
                locale={locale}
                contactLabel={t("provider.contactWhatsApp")}
              />
            );
          })}
        </div>
      )}
    </CategoryPageLayout>
  );
}

function CategoryPageLayout({
  header,
  categoryName,
  icon,
  bairros,
  currentBairro,
  locale,
  t,
  children,
}: {
  header: React.ReactNode;
  categoryName: string;
  icon: string | null;
  bairros: { id: string; name: string; slug: string }[];
  currentBairro?: string;
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {header}
      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted mb-6">
          <Link href="/" className="hover:text-primary transition-colors">
            {t("common.appName")}
          </Link>
          <span>/</span>
          <span className="text-primary">
            {icon && <span className="mr-1">{icon}</span>}
            {categoryName}
          </span>
        </div>

        <div className="flex flex-col gap-4 mb-6">
          <h1 className="text-2xl font-bold text-primary">
            {icon && <span className="mr-2">{icon}</span>}
            {categoryName}
          </h1>

          {/* Bairro filter pills */}
          <BairroFilter
            bairros={bairros}
            currentBairro={currentBairro ?? ""}
            filterLabel={t("catalog.filterByBairro")}
            allLabel={t("catalog.allBairros")}
          />
        </div>

        {/* Compact search bar */}
        <form method="GET" action={`/${locale}/search`} className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              name="q"
              placeholder={t("common.searchPlaceholder")}
              className="flex-1 h-10 px-4 rounded-xl border border-border bg-surface text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-sm"
            />
            <button
              type="submit"
              className="h-10 px-4 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent-hover transition-colors"
            >
              {t("common.search")}
            </button>
          </div>
        </form>
        {children}
      </main>

      <footer className="border-t border-border py-6">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-muted">
          {t("common.appName")} &mdash; {t("common.tagline")}
        </div>
      </footer>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-20 text-center text-muted">
      <div className="text-5xl mb-4">🔍</div>
      <p>{message}</p>
    </div>
  );
}
