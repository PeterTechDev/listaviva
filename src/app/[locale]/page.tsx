import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/header";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name_pt, name_en, slug, icon")
    .order("sort_order")
    .limit(12);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-5xl mx-auto px-4 pt-16 pb-12 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">
            {t("home.hero")}
          </h2>
          <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
            {t("home.subtitle")}
          </p>

          {/* Search bar */}
          <div className="mt-8 max-w-xl mx-auto">
            <div className="relative">
              <input
                type="text"
                placeholder={t("common.searchPlaceholder")}
                className="w-full h-12 pl-4 pr-12 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
              />
              <button className="absolute right-2 top-2 h-8 px-4 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors">
                {t("common.search")}
              </button>
            </div>
          </div>
        </section>

        {/* Category grid */}
        {categories && categories.length > 0 && (
          <section className="max-w-5xl mx-auto px-4 pb-16">
            <h3 className="text-xl font-bold text-gray-900 mb-6">
              {t("home.featuredCategories")}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/category/${cat.slug}`}
                  className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-emerald-300 hover:shadow-sm transition-all group"
                >
                  {cat.icon && (
                    <span className="text-2xl flex-shrink-0">{cat.icon}</span>
                  )}
                  <span className="text-sm font-medium text-gray-700 group-hover:text-emerald-700 transition-colors">
                    {locale === "en" ? (cat.name_en ?? cat.name_pt) : cat.name_pt}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* How it works */}
        <section className="bg-gray-50 py-16">
          <div className="max-w-5xl mx-auto px-4">
            <h3 className="text-2xl font-bold text-center text-gray-900 mb-12">
              {t("home.howItWorks")}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {[
                {
                  step: "1",
                  title: t("home.step1Title"),
                  desc: t("home.step1Desc"),
                },
                {
                  step: "2",
                  title: t("home.step2Title"),
                  desc: t("home.step2Desc"),
                },
                {
                  step: "3",
                  title: t("home.step3Title"),
                  desc: t("home.step3Desc"),
                },
              ].map(({ step, title, desc }) => (
                <div key={step} className="text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 font-bold text-xl flex items-center justify-center mx-auto">
                    {step}
                  </div>
                  <h4 className="mt-4 text-lg font-semibold text-gray-900">
                    {title}
                  </h4>
                  <p className="mt-2 text-gray-500">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-gray-400">
          {t("common.appName")} &mdash; {t("common.tagline")}
        </div>
      </footer>
    </div>
  );
}
