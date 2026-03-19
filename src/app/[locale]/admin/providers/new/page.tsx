import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import ProviderForm from "../ProviderForm";
import { createProvider } from "../actions";

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
          className="text-sm text-muted hover:text-primary transition-colors"
        >
          ← {t("backToList")}
        </Link>
        <h1 className="text-2xl font-bold text-primary">{t("createTitle")}</h1>
      </div>

      <ProviderForm
        bairros={bairros ?? []}
        categories={categories ?? []}
        initialData={{}}
        mode="create"
        action={createProvider}
        redirectTo="/admin/providers"
      />
    </div>
  );
}
