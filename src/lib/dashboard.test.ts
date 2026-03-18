import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getProviderStats,
  getPendingActions,
  getProvidersByCategory,
  getProvidersByBairro,
  getTopQueries,
  getZeroResultQueries,
  getSupplyDemand,
} from "./dashboard";

// ── getProviderStats ──────────────────────────────────────────────────────────

describe("getProviderStats", () => {
  it("counts providers by status correctly", async () => {
    const mockSelect = vi.fn().mockResolvedValue({
      data: [
        { status: "active" },
        { status: "active" },
        { status: "pending" },
      ],
      error: null,
    });
    const supabase = { from: vi.fn().mockReturnValue({ select: mockSelect }) };

    const result = await getProviderStats(supabase as any);

    expect(result).toEqual({ total: 3, active: 2, pending: 1, inactive: 0 });
    expect(supabase.from).toHaveBeenCalledWith("providers");
  });

  it("returns zeros on error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const mockSelect = vi.fn().mockResolvedValue({ data: null, error: { message: "fail" } });
    const supabase = { from: vi.fn().mockReturnValue({ select: mockSelect }) };

    const result = await getProviderStats(supabase as any);

    expect(result).toEqual({ total: 0, active: 0, pending: 0, inactive: 0 });
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("getProviderStats"), expect.anything());
    consoleError.mockRestore();
  });
});

// ── getPendingActions ─────────────────────────────────────────────────────────

describe("getPendingActions", () => {
  it("counts pending claims and recommendations", async () => {
    const makeEq = (data: unknown[]) => vi.fn().mockResolvedValue({ data, error: null });
    const makeChain = (data: unknown[]) => ({ select: vi.fn().mockReturnValue({ eq: makeEq(data) }) });

    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "claim_requests") return makeChain([{ id: "1" }, { id: "2" }]);
        if (table === "recommendations") return makeChain([{ id: "3" }]);
        return makeChain([]);
      }),
    };

    const result = await getPendingActions(supabase as any);

    expect(result).toEqual({ pendingClaims: 2, pendingRecommendations: 1, total: 3 });
  });

  it("returns zeros on error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const makeChain = () => ({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: { message: "fail" } }) }) });
    const supabase = { from: vi.fn().mockImplementation(() => makeChain()) };

    const result = await getPendingActions(supabase as any);

    expect(result).toEqual({ pendingClaims: 0, pendingRecommendations: 0, total: 0 });
    expect(consoleError).toHaveBeenCalledTimes(2);
    consoleError.mockRestore();
  });

  it("counts the successful table when only one fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "claim_requests") {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: { message: "fail" } }) }) };
        }
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [{ id: "1" }], error: null }) }) };
      }),
    };

    const result = await getPendingActions(supabase as any);

    expect(result).toEqual({ pendingClaims: 0, pendingRecommendations: 1, total: 1 });
    expect(consoleError).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });
});

// ── getProvidersByCategory ────────────────────────────────────────────────────

describe("getProvidersByCategory", () => {
  it("groups and sorts active providers by category", async () => {
    const mockEq = vi.fn().mockResolvedValue({
      data: [
        { provider_categories: [{ categories: { name_pt: "Elétrica" } }, { categories: { name_pt: "Elétrica" } }] },
        { provider_categories: [{ categories: { name_pt: "Hidráulica" } }] },
      ],
      error: null,
    });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const supabase = { from: vi.fn().mockReturnValue({ select: mockSelect }) };

    const result = await getProvidersByCategory(supabase as any);

    expect(result).toEqual([
      { name_pt: "Elétrica", count: 2 },
      { name_pt: "Hidráulica", count: 1 },
    ]);
    expect(supabase.from).toHaveBeenCalledWith("providers");
    expect(mockEq).toHaveBeenCalledWith("status", "active");
  });

  it("skips rows with null category join", async () => {
    const mockEq = vi.fn().mockResolvedValue({
      data: [
        { provider_categories: [{ categories: { name_pt: "Elétrica" } }, { categories: null }] },
      ],
      error: null,
    });
    const supabase = { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq: mockEq }) }) };

    const result = await getProvidersByCategory(supabase as any);

    expect(result).toEqual([{ name_pt: "Elétrica", count: 1 }]);
  });

  it("returns empty array on error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const mockEq = vi.fn().mockResolvedValue({ data: null, error: { message: "fail" } });
    const supabase = { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq: mockEq }) }) };

    const result = await getProvidersByCategory(supabase as any);

    expect(result).toEqual([]);
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("getProvidersByCategory"), expect.anything());
    consoleError.mockRestore();
  });
});

// ── getProvidersByBairro ──────────────────────────────────────────────────────

describe("getProvidersByBairro", () => {
  it("groups, sorts, and limits to top 10 bairros", async () => {
    // 11 entries: Centro x6, Praia x3, Norte x2, and 8 others with 1 each
    const data = [
      ...Array(6).fill({ bairros: { name: "Centro" } }),
      ...Array(3).fill({ bairros: { name: "Praia" } }),
      ...Array(2).fill({ bairros: { name: "Norte" } }),
      ...["A", "B", "C", "D", "E", "F", "G", "H"].map((n) => ({ bairros: { name: n } })),
    ];
    const mockEq = vi.fn().mockResolvedValue({ data, error: null });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const supabase = { from: vi.fn().mockReturnValue({ select: mockSelect }) };

    const result = await getProvidersByBairro(supabase as any);

    expect(result).toHaveLength(10);
    expect(result[0]).toEqual({ name: "Centro", count: 6 });
    expect(result[1]).toEqual({ name: "Praia", count: 3 });
    expect(result[2]).toEqual({ name: "Norte", count: 2 });
    expect(supabase.from).toHaveBeenCalledWith("providers");
    expect(mockEq).toHaveBeenCalledWith("status", "active");
  });

  it("skips rows with null bairro join", async () => {
    const mockEq = vi.fn().mockResolvedValue({
      data: [{ bairros: { name: "Centro" } }, { bairros: null }],
      error: null,
    });
    const supabase = { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq: mockEq }) }) };

    const result = await getProvidersByBairro(supabase as any);

    expect(result).toEqual([{ name: "Centro", count: 1 }]);
  });

  it("returns empty array on error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const mockEq = vi.fn().mockResolvedValue({ data: null, error: { message: "fail" } });
    const supabase = { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq: mockEq }) }) };

    const result = await getProvidersByBairro(supabase as any);

    expect(result).toEqual([]);
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("getProvidersByBairro"), expect.anything());
    consoleError.mockRestore();
  });
});

// ── getTopQueries ─────────────────────────────────────────────────────────────

describe("getTopQueries", () => {
  it("calls get_top_queries RPC and normalizes numeric types", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: [{ query_text: "eletricista", search_count: BigInt(5), avg_results: "3.1" }],
      error: null,
    });
    const supabase = { rpc: mockRpc };

    const result = await getTopQueries(supabase as any);

    expect(mockRpc).toHaveBeenCalledWith("get_top_queries");
    expect(result).toEqual([{ query_text: "eletricista", search_count: 5, avg_results: 3.1 }]);
    expect(typeof result[0].search_count).toBe("number");
    expect(typeof result[0].avg_results).toBe("number");
  });

  it("returns empty array on error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const supabase = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "fail" } }) };

    const result = await getTopQueries(supabase as any);

    expect(result).toEqual([]);
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("getTopQueries"), expect.anything());
    consoleError.mockRestore();
  });
});

// ── getZeroResultQueries ──────────────────────────────────────────────────────

describe("getZeroResultQueries", () => {
  it("calls get_zero_result_queries RPC and normalizes numeric types", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: [{ query_text: "marceneiro", search_count: BigInt(17) }],
      error: null,
    });
    const supabase = { rpc: mockRpc };

    const result = await getZeroResultQueries(supabase as any);

    expect(mockRpc).toHaveBeenCalledWith("get_zero_result_queries");
    expect(result).toEqual([{ query_text: "marceneiro", search_count: 17 }]);
    expect(typeof result[0].search_count).toBe("number");
  });

  it("returns empty array on error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const supabase = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "fail" } }) };

    const result = await getZeroResultQueries(supabase as any);

    expect(result).toEqual([]);
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("getZeroResultQueries"), expect.anything());
    consoleError.mockRestore();
  });
});

// ── getSupplyDemand ───────────────────────────────────────────────────────────

describe("getSupplyDemand", () => {
  it("calls get_supply_demand RPC and normalizes numeric types", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: [
        { name_pt: "Marcenaria", provider_count: BigInt(0) },
        { name_pt: "Elétrica", provider_count: BigInt(5) },
      ],
      error: null,
    });
    const supabase = { rpc: mockRpc };

    const result = await getSupplyDemand(supabase as any);

    expect(mockRpc).toHaveBeenCalledWith("get_supply_demand");
    expect(result).toEqual([
      { name_pt: "Marcenaria", provider_count: 0 },
      { name_pt: "Elétrica", provider_count: 5 },
    ]);
    expect(typeof result[0].provider_count).toBe("number");
  });

  it("returns empty array on error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const supabase = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "fail" } }) };

    const result = await getSupplyDemand(supabase as any);

    expect(result).toEqual([]);
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("getSupplyDemand"), expect.anything());
    consoleError.mockRestore();
  });
});
