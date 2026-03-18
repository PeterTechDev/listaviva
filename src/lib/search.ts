// Use unparameterized SupabaseClient — no generated Database types yet
import type { SupabaseClient } from "@supabase/supabase-js";
import { embedText } from "@/lib/embeddings";

export type ProviderSearchResult = {
  id: string;
  name: string;
  slug: string;
  description_pt: string | null;
  whatsapp: string | null;
  home_bairro: { name: string; slug: string } | null;
  categories: { name_pt: string; name_en: string | null; icon: string | null }[];
};

export async function searchProviders({
  query,
  bairroId,
  userId,
  supabase,
}: {
  query: string;
  bairroId?: string | null;
  userId?: string | null;
  supabase: SupabaseClient;
}): Promise<{ results: ProviderSearchResult[]; usedFallback: boolean }> {
  let resultIds: string[] = [];
  let usedFallback = false;

  // Step 1-3: semantic path
  try {
    const embedding = await embedText(query);
    const { data: rpcRows } = await supabase.rpc("match_providers", {
      query_embedding: embedding,
      bairro_filter: bairroId ?? null,
    });
    if (rpcRows && rpcRows.length > 0) {
      resultIds = (rpcRows as { id: string }[]).map((r) => r.id);
    } else {
      usedFallback = true;
    }
  } catch {
    usedFallback = true;
  }

  // Step 4: trigram fallback (description_pt is plain text — use .ilike())
  if (usedFallback) {
    let q = supabase
      .from("providers")
      .select("id")
      .eq("status", "active")
      .or(`name.ilike.%${query}%,description_pt.ilike.%${query}%`);
    if (bairroId) q = q.eq("home_bairro_id", bairroId);
    const { data: fallbackRows } = await q;
    resultIds = (fallbackRows ?? []).map((r: { id: string }) => r.id);
  }

  // Step 5: log query (RLS blocks anonymous inserts — swallowed intentionally)
  try {
    await supabase.from("search_queries").insert({
      query_text: query,
      results_count: resultIds.length,
      user_id: userId ?? null,
      bairro_filter_id: bairroId ?? null,
    });
  } catch {
    // non-blocking — RLS blocks anonymous inserts
  }

  if (resultIds.length === 0) return { results: [], usedFallback };

  // Step 7: enrich results
  try {
    const { data: enriched } = await supabase
      .from("providers")
      .select(`
        id, name, slug, description_pt, whatsapp,
        home_bairro:bairros(name, slug),
        categories:provider_categories(categories(name_pt, name_en, icon))
      `)
      .in("id", resultIds);

    const results: ProviderSearchResult[] = (enriched ?? []).map((row: any) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description_pt: row.description_pt,
      whatsapp: row.whatsapp,
      home_bairro: row.home_bairro ?? null,
      // Flatten nested provider_categories → categories junction
      categories: (row.categories ?? []).flatMap(
        (pc: { categories: unknown }) =>
          Array.isArray(pc.categories)
            ? pc.categories
            : pc.categories
            ? [pc.categories]
            : []
      ),
    }));

    return { results, usedFallback };
  } catch {
    return { results: [], usedFallback };
  }
}
