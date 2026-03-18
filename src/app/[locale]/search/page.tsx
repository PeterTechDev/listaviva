import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { Link } from "@/i18n/navigation";
import { searchProviders } from "@/lib/search";
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
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
          <Link href="/" className="hover:text-gray-600 transition-colors">
            {t("common.appName")}
          </Link>
          <span>/</span>
          <span className="text-gray-700">{t("search.title")}</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          {t("search.resultsFor", { q })}
        </h1>

        {/* Bairro filter form */}
        <form method="GET" className="flex items-center gap-2 mb-8">
          <input type="hidden" name="q" value={q} />
          <label className="text-sm text-gray-500 whitespace-nowrap">
            {t("search.filterBairro")}:
          </label>
          <select
            name="bairro_id"
            defaultValue={bairro_id ?? ""}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">{t("search.allBairros")}</option>
            {(bairros ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors"
          >
            {t("search.filterBairro")}
          </button>
        </form>

        {results.length === 0 ? (
          <div className="py-20 text-center text-gray-400">
            <div className="text-5xl mb-4">🔍</div>
            <p>{t("search.noResults")}</p>
            {bairro_id && (
              <p className="mt-2 text-sm">
                <Link
                  href={`/search?q=${encodeURIComponent(q)}`}
                  className="text-emerald-600 hover:text-emerald-700"
                >
                  {t("search.tryWithout")}
                </Link>
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((provider) => (
              <div
                key={provider.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="p-4">
                  <Link
                    href={`/provider/${provider.slug}`}
                    className="font-semibold text-gray-900 hover:text-emerald-700 transition-colors"
                  >
                    {provider.name}
                  </Link>
                  {provider.home_bairro && (
                    <p className="text-xs text-emerald-600 mt-0.5">
                      📍 {provider.home_bairro.name}
                    </p>
                  )}
                  {provider.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {provider.categories.map((cat) => (
                        <span
                          key={cat.name_pt}
                          className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full"
                        >
                          {cat.icon && (
                            <span className="mr-1">{cat.icon}</span>
                          )}
                          {locale === "en"
                            ? (cat.name_en ?? cat.name_pt)
                            : cat.name_pt}
                        </span>
                      ))}
                    </div>
                  )}
                  {provider.description_pt && (
                    <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                      {provider.description_pt}
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
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-gray-100 py-6">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-gray-400">
          {t("common.appName")} &mdash; {t("common.tagline")}
        </div>
      </footer>
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
