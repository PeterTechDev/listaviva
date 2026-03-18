import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import ProvidersClient from "./ProvidersClient";

export default async function ProvidersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { locale } = await params;
  const { q, status } = await searchParams;
  const t = await getTranslations({ locale, namespace: "adminProviders" });

  const supabase = await createClient();

  let query = supabase
    .from("providers")
    .select(
      "id, name, slug, status, tier, created_at, home_bairro:home_bairro_id(name)"
    )
    .order("created_at", { ascending: false });

  if (q) query = query.ilike("name", `%${q}%`);
  if (status && status !== "all") query = query.eq("status", status);

  const { data: providers } = await query;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
        <Link
          href="/admin/providers/new"
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          + {t("add")}
        </Link>
      </div>

      <ProvidersClient
        providers={providers ?? []}
        currentQ={q ?? ""}
        currentStatus={status ?? "all"}
      />
    </div>
  );
}
