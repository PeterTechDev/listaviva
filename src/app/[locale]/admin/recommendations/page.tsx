import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import RecommendationsManager from "./RecommendationsManager";

export default async function RecommendationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "recommendations" });

  const supabase = await createClient();
  const { data: rawRecommendations } = await supabase
    .from("recommendations")
    .select(`
      id, provider_name, whatsapp, description, created_at, category_id,
      categories(name_pt),
      bairros(name),
      profiles!submitted_by(full_name)
    `)
    .eq("status", "pending")
    .order("created_at");

  // Supabase returns related rows as arrays; normalize to single objects
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recommendations = ((rawRecommendations ?? []) as any[]).map((r) => ({
    ...r,
    categories: Array.isArray(r.categories) ? r.categories[0] ?? null : r.categories,
    bairros: Array.isArray(r.bairros) ? r.bairros[0] ?? null : r.bairros,
    profiles: Array.isArray(r.profiles) ? r.profiles[0] ?? null : r.profiles,
  }));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>
      <RecommendationsManager recommendations={recommendations} />
    </div>
  );
}
