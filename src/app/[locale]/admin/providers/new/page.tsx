import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import ProviderForm from "../ProviderForm";

export default async function NewProviderPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "adminProviders" });
  const supabase = await createClient();

  const [{ data: bairros }, { data: categories }] = await Promise.all([
    supabase.from("bairros").select("id, name").order("name"),
    supabase
      .from("categories")
      .select("id, name_pt, name_en, icon")
      .order("sort_order"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/providers"
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← {t("backToList")}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{t("createTitle")}</h1>
      </div>

      <ProviderForm
        bairros={bairros ?? []}
        categories={categories ?? []}
        mode="create"
      />
    </div>
  );
}
