import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const mockEmbedTextFn = vi.hoisted(() => vi.fn());

vi.mock("@/lib/embeddings", () => ({
  embedText: mockEmbedTextFn,
  buildProviderText: vi.fn(),
}));

import { embedText } from "@/lib/embeddings";
import { searchProviders } from "@/lib/search";

const mockEmbedText = mockEmbedTextFn;

/**
 * Build a Supabase mock that supports the search pipeline.
 * The providers table is called twice in the fallback path:
 *   call 0 = fallback ilike query (select + eq + or → awaited)
 *   call 1 = enrich query (select + in → awaited)
 * Detection: the enrich query calls .in(), so we check for that.
 */
function makeSupabaseMock({
  rpcData = [] as unknown[],
  fallbackData = [] as unknown[],
  enrichData = [] as unknown[],
} = {}) {
  return {
    rpc: vi.fn().mockResolvedValue({ data: rpcData, error: null }),
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "search_queries") {
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }

      if (table === "providers") {
        const builder: Record<string, unknown> = {};
        const methods = ["select", "eq", "or", "ilike"];
        for (const m of methods) {
          builder[m] = vi.fn().mockReturnValue(builder);
        }
        // .in() always means enrich call — return enrichData
        builder["in"] = vi.fn().mockResolvedValue({ data: enrichData, error: null });
        // Awaiting the builder itself (thenable) always means fallback call — return fallbackData
        builder["then"] = (
          resolve: (v: { data: unknown[]; error: null }) => unknown
        ) => Promise.resolve({ data: fallbackData, error: null }).then(resolve);

        return builder;
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    }),
  } as unknown as SupabaseClient;
}

const FAKE_EMBEDDING = [0.1, 0.2, 0.3];

const ENRICH_ROW = {
  id: "provider-1",
  name: "João Elétrica",
  slug: "joao-eletrica",
  description_pt: "Serviços elétricos",
  whatsapp: "27999999999",
  home_bairro: { name: "Centro", slug: "centro" },
  categories: [
    { categories: { name_pt: "Elétrica", name_en: "Electrical", icon: "⚡" } },
  ],
};

beforeEach(() => {
  mockEmbedText.mockReset();
  mockEmbedText.mockResolvedValue(FAKE_EMBEDDING);
});

describe("searchProviders — semantic path", () => {
  it("returns enriched results when RPC returns matches", async () => {
    const rpcData = [{ id: "provider-1" }];
    const supabase = makeSupabaseMock({ rpcData, enrichData: [ENRICH_ROW] });

    const { results, usedFallback } = await searchProviders({
      query: "eletricista",
      supabase,
    });

    expect(usedFallback).toBe(false);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("João Elétrica");
    // categories must be flattened
    expect(results[0].categories).toEqual([
      { name_pt: "Elétrica", name_en: "Electrical", icon: "⚡" },
    ]);
  });

  it("passes bairro_filter to RPC when bairroId provided", async () => {
    const rpcData = [{ id: "provider-1" }];
    const supabase = makeSupabaseMock({ rpcData, enrichData: [ENRICH_ROW] });

    await searchProviders({
      query: "eletricista",
      bairroId: "bairro-uuid",
      supabase,
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      "match_providers",
      expect.objectContaining({ bairro_filter: "bairro-uuid" })
    );
  });
});

describe("searchProviders — fallback path", () => {
  it("uses trigram fallback when RPC returns empty", async () => {
    const supabase = makeSupabaseMock({
      rpcData: [],
      fallbackData: [{ id: "provider-1" }],
      enrichData: [ENRICH_ROW],
    });

    const { results, usedFallback } = await searchProviders({
      query: "eletricista",
      supabase,
    });

    expect(usedFallback).toBe(true);
    expect(results).toHaveLength(1);
  });

  it("uses trigram fallback when embedText throws", async () => {
    mockEmbedText.mockRejectedValue(new Error("OpenAI down"));
    const supabase = makeSupabaseMock({
      fallbackData: [{ id: "provider-1" }],
      enrichData: [ENRICH_ROW],
    });

    const { results, usedFallback } = await searchProviders({
      query: "eletricista",
      supabase,
    });

    expect(usedFallback).toBe(true);
    expect(results).toHaveLength(1);
  });
});

describe("searchProviders — zero results", () => {
  it("returns empty results and logs results_count: 0", async () => {
    const supabase = makeSupabaseMock({ rpcData: [], fallbackData: [] });

    const { results } = await searchProviders({
      query: "something obscure",
      supabase,
    });

    expect(results).toHaveLength(0);
    // logging is fire-and-forget (try/catch), so we just verify no throw
  });
});
