import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth";
import ProviderForm from "../../admin/providers/ProviderForm";
import { updateOwnProvider } from "../actions";

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const user = await getCurrentUser();

  if (!user) redirect(`/${locale}/login`);

  const supabase = await createClient();

  const { data: provider } = await supabase
    .from("providers")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!provider) notFound();

  const [
    { data: bairros },
    { data: categories },
    { data: providerCategories },
    { data: serviceAreas },
    { data: photos },
  ] = await Promise.all([
    supabase.from("bairros").select("id, name").order("name"),
    supabase.from("categories").select("id, name_pt, name_en, icon").order("sort_order"),
    supabase.from("provider_categories").select("category_id").eq("provider_id", provider.id),
    supabase.from("provider_service_areas").select("bairro_id").eq("provider_id", provider.id),
    supabase.from("provider_photos").select("url, sort_order").eq("provider_id", provider.id).order("sort_order"),
  ]);

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
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-8 w-full">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/account"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← {t("common.back")}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("account.editListing")}
          </h1>
        </div>
        <ProviderForm
          bairros={bairros ?? []}
          categories={categories ?? []}
          initialData={initialData}
          mode="edit"
          action={(fd) => updateOwnProvider(provider.id, fd)}
          redirectTo="/account"
          selfService
        />
      </main>
    </div>
  );
}
