import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  getProviderStats,
  getPendingActions,
  getProvidersByCategory,
  getProvidersByBairro,
  getTopQueries,
  getZeroResultQueries,
  getSupplyDemand,
} from "@/lib/dashboard";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdmin(locale);

  const supabase = await createClient();

  const [stats, pendingActions, byCategory, byBairro, topQueries, zeroQueries, supplyDemand] =
    await Promise.all([
      getProviderStats(supabase),
      getPendingActions(supabase),
      getProvidersByCategory(supabase),
      getProvidersByBairro(supabase),
      getTopQueries(supabase),
      getZeroResultQueries(supabase),
      getSupplyDemand(supabase),
    ]);

  return (
    <DashboardClient
      stats={stats}
      pendingActions={pendingActions}
      byCategory={byCategory}
      byBairro={byBairro}
      topQueries={topQueries}
      zeroQueries={zeroQueries}
      supplyDemand={supplyDemand}
    />
  );
}
