import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import ProviderForm from "../../ProviderForm";

export default async function EditProviderPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "adminProviders" });
  const supabase = await createClient();

  const [
    { data: provider },
    { data: bairros },
    { data: categories },
    { data: providerCategories },
    { data: serviceAreas },
    { data: photos },
  ] = await Promise.all([
    supabase
      .from("providers")
      .select("*")
      .eq("id", id)
      .single(),
    supabase.from("bairros").select("id, name").order("name"),
    supabase
      .from("categories")
      .select("id, name_pt, name_en, icon")
      .order("sort_order"),
    supabase
      .from("provider_categories")
      .select("category_id")
      .eq("provider_id", id),
    supabase
      .from("provider_service_areas")
      .select("bairro_id")
      .eq("provider_id", id),
    supabase
      .from("provider_photos")
      .select("url, sort_order")
      .eq("provider_id", id)
      .order("sort_order"),
  ]);

  if (!provider) notFound();

  const initialData = {
    id: provider.id,
    name: provider.name,
    slug: provider.slug,
    description_pt: provider.description_pt,
    description_en: provider.description_en,
    whatsapp: provider.whatsapp,
    phone: provider.phone,
    home_bairro_id: provider.home_bairro_id,
    status: provider.status,
    tier: provider.tier,
    working_hours: (provider.working_hours as Record<string, string>) ?? {},
    categoryIds: providerCategories?.map((pc) => pc.category_id) ?? [],
    serviceAreaIds: serviceAreas?.map((sa) => sa.bairro_id) ?? [],
    photos: photos?.map((p) => ({ url: p.url })) ?? [],
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/providers"
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← {t("backToList")}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {t("editTitle")}: {provider.name}
        </h1>
      </div>

      <ProviderForm
        bairros={bairros ?? []}
        categories={categories ?? []}
        initialData={initialData}
        mode="edit"
      />
    </div>
  );
}
