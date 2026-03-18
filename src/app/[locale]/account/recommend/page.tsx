import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import RecommendForm from "./RecommendForm";

export default async function RecommendPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "recommendations" });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const [{ data: categories }, { data: bairros }] = await Promise.all([
    supabase.from("categories").select("id, name_pt").order("sort_order"),
    supabase.from("bairros").select("id, name").order("name"),
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-lg mx-auto px-4 py-8 w-full">
        <h1 className="text-2xl font-bold text-primary mb-2">{t("recommend")}</h1>
        <p className="text-muted mb-6">{t("recommendDesc")}</p>
        <RecommendForm
          categories={categories ?? []}
          bairros={bairros ?? []}
        />
      </main>

      <footer className="border-t border-border py-6">
        <div className="max-w-lg mx-auto px-4 text-center text-sm text-muted">
          {t("recommend")}
        </div>
      </footer>
    </div>
  );
}
