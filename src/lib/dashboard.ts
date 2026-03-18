import type { SupabaseClient } from "@supabase/supabase-js";

export type ProviderStats = {
  total: number;
  active: number;
  pending: number;
  inactive: number;
};

export type PendingActions = {
  pendingClaims: number;
  pendingRecommendations: number;
  total: number;
};

export type CategoryCount = { name_pt: string; count: number };
export type BairroCount = { name: string; count: number };
export type TopQuery = { query_text: string; search_count: number; avg_results: number };
export type ZeroResultQuery = { query_text: string; search_count: number };
export type SupplyDemandRow = { name_pt: string; provider_count: number };

export async function getProviderStats(supabase: SupabaseClient): Promise<ProviderStats> {
  const { data, error } = await supabase.from("providers").select("status");
  if (error || !data) return { total: 0, active: 0, pending: 0, inactive: 0 };
  const total = data.length;
  const active = data.filter((r) => r.status === "active").length;
  const pending = data.filter((r) => r.status === "pending").length;
  const inactive = data.filter((r) => r.status === "inactive").length;
  return { total, active, pending, inactive };
}

export async function getPendingActions(supabase: SupabaseClient): Promise<PendingActions> {
  const [claimsRes, recsRes] = await Promise.all([
    supabase.from("claim_requests").select("id").eq("status", "pending"),
    supabase.from("recommendations").select("id").eq("status", "pending"),
  ]);
  const pendingClaims = claimsRes.error ? 0 : (claimsRes.data?.length ?? 0);
  const pendingRecommendations = recsRes.error ? 0 : (recsRes.data?.length ?? 0);
  return { pendingClaims, pendingRecommendations, total: pendingClaims + pendingRecommendations };
}

export async function getProvidersByCategory(supabase: SupabaseClient): Promise<CategoryCount[]> {
  const { data, error } = await supabase.from("provider_categories").select("categories(name_pt)");
  if (error || !data) return [];
  const counts: Record<string, number> = {};
  for (const row of data) {
    const name = (row.categories as { name_pt: string } | null)?.name_pt;
    if (name) counts[name] = (counts[name] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([name_pt, count]) => ({ name_pt, count }))
    .sort((a, b) => b.count - a.count);
}

export async function getProvidersByBairro(supabase: SupabaseClient): Promise<BairroCount[]> {
  const { data, error } = await supabase
    .from("providers")
    .select("bairros(name)")
    .eq("status", "active");
  if (error || !data) return [];
  const counts: Record<string, number> = {};
  for (const row of data) {
    const name = (row.bairros as { name: string } | null)?.name;
    if (name) counts[name] = (counts[name] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

export async function getTopQueries(supabase: SupabaseClient): Promise<TopQuery[]> {
  const { data, error } = await supabase.rpc("get_top_queries");
  if (error || !data) return [];
  return data;
}

export async function getZeroResultQueries(supabase: SupabaseClient): Promise<ZeroResultQuery[]> {
  const { data, error } = await supabase.rpc("get_zero_result_queries");
  if (error || !data) return [];
  return data;
}

export async function getSupplyDemand(supabase: SupabaseClient): Promise<SupplyDemandRow[]> {
  const { data, error } = await supabase.rpc("get_supply_demand");
  if (error || !data) return [];
  return data;
}
