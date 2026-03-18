import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import ClaimsManager from "./ClaimsManager";

export default async function ClaimsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const supabase = await createClient();

  const { data: claims } = await supabase
    .from("claim_requests")
    .select(
      `
      id, status, message, created_at,
      providers(name),
      profiles(full_name)
      `
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  // Supabase returns related rows as arrays; normalize to single objects or null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalized = (claims ?? []).map((c: any) => ({
    id: c.id as string,
    status: c.status as string,
    message: c.message as string | null,
    created_at: c.created_at as string,
    providers: Array.isArray(c.providers) ? (c.providers[0] ?? null) : c.providers,
    profiles: Array.isArray(c.profiles) ? (c.profiles[0] ?? null) : c.profiles,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">
        {t("adminClaims.title")}
      </h1>
      <ClaimsManager claims={normalized} />
    </div>
  );
}
