import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/header";
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

  // Fetch category
  const { data: category } = await supabase
    .from("categories")
    .select("id, name_pt, name_en, slug, icon")
    .eq("slug", slug)
    .single();

  if (!category) notFound();

  const categoryName =
    locale === "en" ? (category.name_en ?? category.name_pt) : category.name_pt;

  // Fetch all bairros for the filter
  const { data: bairros } = await supabase
    .from("bairros")
    .select("id, name, slug")
    .order("name");

  // Build provider query: providers in this category
  // If bairro filter is set, only show providers who serve that bairro
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
    // Filter by service area: providers that serve the selected bairro
    const { data: areaProviderIds } = await supabase
      .from("provider_service_areas")
      .select("provider_id, bairros!inner(slug)")
      .eq("bairros.slug", bairroFilter);

    const ids = areaProviderIds?.map((r) => r.provider_id) ?? [];
    if (ids.length === 0) {
      // No providers serve this area → return empty result
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
                (
                  a: { sort_order: number },
                  b: { sort_order: number }
                ) => a.sort_order - b.sort_order
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
              <div
                key={provider.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo}
                    alt={provider.name}
                    className="w-full h-40 object-cover"
                  />
                ) : (
                  <div className="w-full h-40 bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center">
                    <span className="text-4xl">{category.icon ?? "🏢"}</span>
                  </div>
                )}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900">{provider.name}</h3>
                  {bairroName && (
                    <p className="text-xs text-emerald-600 mt-0.5">
                      📍 {bairroName}
                    </p>
                  )}
                  {desc && (
                    <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                      {desc}
                    </p>
                  )}
                  {provider.whatsapp && (
                    <a
                      href={`https://wa.me/${provider.whatsapp.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
                    >
                      <WhatsAppIcon />
                      {t("provider.contactWhatsApp")}
                    </a>
                  )}
                </div>
              </div>
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
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
          <Link href="/" className="hover:text-gray-600 transition-colors">
            {t("common.appName")}
          </Link>
          <span>/</span>
          <span className="text-gray-700">
            {icon && <span className="mr-1">{icon}</span>}
            {categoryName}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {icon && <span className="mr-2">{icon}</span>}
            {categoryName}
          </h1>

          {/* Bairro filter */}
          <BairroFilter
            bairros={bairros}
            currentBairro={currentBairro ?? ""}
            filterLabel={t("catalog.filterByBairro")}
            allLabel={t("catalog.allBairros")}
          />
        </div>

        {children}
      </main>

      <footer className="border-t border-gray-100 py-6">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-gray-400">
          {t("common.appName")} &mdash; {t("common.tagline")}
        </div>
      </footer>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-20 text-center text-gray-400">
      <div className="text-5xl mb-4">🔍</div>
      <p>{message}</p>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
