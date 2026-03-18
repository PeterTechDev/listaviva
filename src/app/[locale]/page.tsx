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
          <h1 className="font-display text-4xl sm:text-5xl font-semibold text-primary leading-tight tracking-tight">
            {t("home.hero")}
          </h1>
          <p className="mt-4 text-base text-muted max-w-md mx-auto leading-relaxed">
            {t("home.subtitle")}
          </p>

          {/* Search bar */}
          <div className="mt-8 max-w-xl mx-auto">
            <form method="GET" action={`/${locale}/search`}>
              <div className="relative">
                <input
                  type="text"
                  name="q"
                  placeholder={t("common.searchPlaceholder")}
                  className="w-full h-14 pl-5 pr-32 rounded-xl border border-border bg-surface text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent shadow-sm text-base"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-2 h-10 px-5 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent-hover transition-colors"
                >
                  {t("common.search")}
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* Category grid */}
        {categories && categories.length > 0 && (
          <section className="max-w-5xl mx-auto px-4 pb-16">
            <h2 className="font-display text-2xl font-medium text-primary mb-5">
              {t("home.featuredCategories")}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/category/${cat.slug}`}
                  className="flex items-center gap-3 p-4 bg-surface rounded-xl border border-border hover:border-accent hover:shadow-sm transition-all group"
                >
                  {cat.icon && (
                    <span className="text-2xl flex-shrink-0">{cat.icon}</span>
                  )}
                  <span className="text-sm font-medium text-primary group-hover:text-accent transition-colors leading-snug">
                    {locale === "en" ? (cat.name_en ?? cat.name_pt) : cat.name_pt}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* How it works */}
        <section className="bg-surface py-14">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="font-display text-2xl font-medium text-center text-primary mb-10">
              {t("home.howItWorks")}
            </h2>
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
                  <div className="w-11 h-11 rounded-full bg-accent text-white font-display font-semibold text-lg flex items-center justify-center mx-auto">
                    {step}
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-primary">{title}</h3>
                  <p className="mt-2 text-sm text-muted leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-muted">
          {t("common.appName")} &mdash; {t("common.tagline")}
        </div>
      </footer>
    </div>
  );
}
