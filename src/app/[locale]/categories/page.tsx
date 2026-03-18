import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/header";

export default async function CategoriesPage({
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
    .order("sort_order");

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full">
        <h1 className="font-display text-3xl font-semibold text-primary mb-6">
          {t("home.featuredCategories")}
        </h1>
        {categories && categories.length > 0 ? (
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
        ) : (
          <p className="text-muted">{t("common.noResults")}</p>
        )}
      </main>
    </div>
  );
}
