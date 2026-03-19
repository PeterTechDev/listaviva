# Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin dashboard at `/[locale]/admin/dashboard` showing provider stats, search analytics, and supply/demand signals across three tabs.

**Architecture:** Server Component page fetches 7 data sets in parallel via typed functions in `src/lib/dashboard.ts`, passes results to `DashboardClient.tsx` (`"use client"`) which renders tabs with `useState`. Recharts renders bar charts (client-only). Admin access enforced with `requireAdmin(locale)` in the page itself. Three Supabase RPC functions handle aggregation queries.

**Tech Stack:** Next.js 16 App Router, Supabase (RPCs), Recharts, Vitest, next-intl.

---

### Task 1: Migration + Recharts

**Files:**
- Create: `supabase/migrations/005_dashboard_rpcs.sql`
- Modify: `package.json` (recharts added)

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/005_dashboard_rpcs.sql

-- Returns top search queries by frequency
create or replace function public.get_top_queries(limit_count int default 20)
returns table(query_text text, search_count bigint, avg_results numeric)
language sql stable as $$
  select query_text, count(*) as search_count, round(avg(results_count)::numeric, 1) as avg_results
  from public.search_queries
  group by query_text
  order by search_count desc
  limit limit_count;
$$;

-- Returns zero-result queries by frequency
create or replace function public.get_zero_result_queries(limit_count int default 20)
returns table(query_text text, search_count bigint)
language sql stable as $$
  select query_text, count(*) as search_count
  from public.search_queries
  where results_count = 0
  group by query_text
  order by search_count desc
  limit limit_count;
$$;

-- Returns categories ranked by provider scarcity (fewest providers first).
-- Pure supply-side view. Demand signal is zero-result queries (Search Analytics tab).
create or replace function public.get_supply_demand()
returns table(name_pt text, provider_count bigint)
language sql stable as $$
  select
    c.name_pt,
    coalesce(pc.provider_count, 0) as provider_count
  from public.categories c
  left join (
    select category_id, count(*) as provider_count
    from public.provider_categories
    group by category_id
  ) pc on c.id = pc.category_id
  order by provider_count asc;
$$;
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use `mcp__plugin_supabase_supabase__apply_migration` with the SQL above. Project ID: `eglgafwlzcgkdjfynitp`.

- [ ] **Step 3: Install recharts**

```bash
cd /Users/peter/personal/listaviva && npm install recharts
```

Expected: recharts added to `dependencies` in `package.json`.

- [ ] **Step 4: Commit**

```bash
cd /Users/peter/personal/listaviva
git add supabase/migrations/005_dashboard_rpcs.sql package.json package-lock.json
git commit -m "feat: add dashboard RPCs migration and install recharts (issue #12)"
```

---

### Task 2: Translation Keys

**Files:**
- Modify: `messages/pt-BR.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Add `dashboard` namespace to pt-BR.json**

Add this block inside the root JSON object (alongside existing namespaces):

```json
"dashboard": {
  "title": "Dashboard",
  "overview": "Visão geral",
  "searchAnalytics": "Buscas",
  "supplyDemand": "Oferta & Demanda",
  "activeProviders": "Prestadores ativos",
  "pendingProviders": "Prestadores pendentes",
  "totalSearches": "Total de buscas",
  "pendingActions": "Ações pendentes",
  "byCategory": "Por categoria",
  "byBairro": "Por bairro",
  "topQueries": "Buscas mais frequentes",
  "zeroResults": "Buscas sem resultado",
  "query": "Busca",
  "count": "Contagem",
  "avgResults": "Média de resultados",
  "category": "Categoria",
  "searches": "Buscas",
  "providers": "Prestadores",
  "noData": "Sem dados ainda"
}
```

- [ ] **Step 2: Add `dashboard` namespace to en.json**

```json
"dashboard": {
  "title": "Dashboard",
  "overview": "Overview",
  "searchAnalytics": "Search Analytics",
  "supplyDemand": "Supply & Demand",
  "activeProviders": "Active providers",
  "pendingProviders": "Pending providers",
  "totalSearches": "Total searches",
  "pendingActions": "Pending actions",
  "byCategory": "By category",
  "byBairro": "By neighborhood",
  "topQueries": "Top queries",
  "zeroResults": "Zero-result searches",
  "query": "Query",
  "count": "Count",
  "avgResults": "Avg results",
  "category": "Category",
  "searches": "Searches",
  "providers": "Providers",
  "noData": "No data yet"
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/peter/personal/listaviva
git add messages/pt-BR.json messages/en.json
git commit -m "feat: add dashboard translation namespace (issue #12)"
```

---

### Task 3: Data Layer Tests (TDD — write failing tests first)

**Files:**
- Create: `src/lib/dashboard.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/dashboard.test.ts
import { describe, it, expect, vi } from "vitest";
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
    const mockSelect = vi.fn().mockResolvedValue({ data: null, error: { message: "fail" } });
    const supabase = { from: vi.fn().mockReturnValue({ select: mockSelect }) };

    const result = await getProviderStats(supabase as any);

    expect(result).toEqual({ total: 0, active: 0, pending: 0, inactive: 0 });
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
    const makeChain = () => ({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: { message: "fail" } }) }) });
    const supabase = { from: vi.fn().mockImplementation(() => makeChain()) };

    const result = await getPendingActions(supabase as any);

    expect(result).toEqual({ pendingClaims: 0, pendingRecommendations: 0, total: 0 });
  });
});

// ── getProvidersByCategory ────────────────────────────────────────────────────

describe("getProvidersByCategory", () => {
  it("groups and sorts providers by category", async () => {
    const mockSelect = vi.fn().mockResolvedValue({
      data: [
        { categories: { name_pt: "Elétrica" } },
        { categories: { name_pt: "Elétrica" } },
        { categories: { name_pt: "Hidráulica" } },
      ],
      error: null,
    });
    const supabase = { from: vi.fn().mockReturnValue({ select: mockSelect }) };

    const result = await getProvidersByCategory(supabase as any);

    expect(result).toEqual([
      { name_pt: "Elétrica", count: 2 },
      { name_pt: "Hidráulica", count: 1 },
    ]);
    expect(supabase.from).toHaveBeenCalledWith("provider_categories");
  });

  it("returns empty array on error", async () => {
    const mockSelect = vi.fn().mockResolvedValue({ data: null, error: { message: "fail" } });
    const supabase = { from: vi.fn().mockReturnValue({ select: mockSelect }) };

    const result = await getProvidersByCategory(supabase as any);

    expect(result).toEqual([]);
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

  it("returns empty array on error", async () => {
    const mockEq = vi.fn().mockResolvedValue({ data: null, error: { message: "fail" } });
    const supabase = { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq: mockEq }) }) };

    const result = await getProvidersByBairro(supabase as any);

    expect(result).toEqual([]);
  });
});

// ── getTopQueries ─────────────────────────────────────────────────────────────

describe("getTopQueries", () => {
  it("calls get_top_queries RPC and returns rows", async () => {
    const rows = [{ query_text: "eletricista", search_count: 5, avg_results: 3.0 }];
    const mockRpc = vi.fn().mockResolvedValue({ data: rows, error: null });
    const supabase = { rpc: mockRpc };

    const result = await getTopQueries(supabase as any);

    expect(mockRpc).toHaveBeenCalledWith("get_top_queries");
    expect(result).toEqual(rows);
  });

  it("returns empty array on error", async () => {
    const supabase = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "fail" } }) };

    const result = await getTopQueries(supabase as any);

    expect(result).toEqual([]);
  });
});

// ── getZeroResultQueries ──────────────────────────────────────────────────────

describe("getZeroResultQueries", () => {
  it("calls get_zero_result_queries RPC and returns rows", async () => {
    const rows = [{ query_text: "marceneiro", search_count: 17 }];
    const mockRpc = vi.fn().mockResolvedValue({ data: rows, error: null });
    const supabase = { rpc: mockRpc };

    const result = await getZeroResultQueries(supabase as any);

    expect(mockRpc).toHaveBeenCalledWith("get_zero_result_queries");
    expect(result).toEqual(rows);
  });

  it("returns empty array on error", async () => {
    const supabase = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "fail" } }) };

    const result = await getZeroResultQueries(supabase as any);

    expect(result).toEqual([]);
  });
});

// ── getSupplyDemand ───────────────────────────────────────────────────────────

describe("getSupplyDemand", () => {
  it("calls get_supply_demand RPC and returns rows", async () => {
    const rows = [
      { name_pt: "Marcenaria", provider_count: 0 },
      { name_pt: "Elétrica", provider_count: 5 },
    ];
    const mockRpc = vi.fn().mockResolvedValue({ data: rows, error: null });
    const supabase = { rpc: mockRpc };

    const result = await getSupplyDemand(supabase as any);

    expect(mockRpc).toHaveBeenCalledWith("get_supply_demand");
    expect(result).toEqual(rows);
  });

  it("returns empty array on error", async () => {
    const supabase = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "fail" } }) };

    const result = await getSupplyDemand(supabase as any);

    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/peter/personal/listaviva && npx vitest run src/lib/dashboard.test.ts
```

Expected: Tests fail with "Cannot find module './dashboard'" or similar. That's correct.

- [ ] **Step 3: Commit failing tests**

```bash
cd /Users/peter/personal/listaviva
git add src/lib/dashboard.test.ts
git commit -m "test: add failing tests for dashboard data layer (issue #12)"
```

---

### Task 4: Data Layer Implementation

**Files:**
- Create: `src/lib/dashboard.ts`

- [ ] **Step 1: Implement all 7 functions**

```ts
// src/lib/dashboard.ts
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
```

- [ ] **Step 2: Run tests to confirm they pass**

```bash
cd /Users/peter/personal/listaviva && npx vitest run src/lib/dashboard.test.ts
```

Expected: All tests pass (14 tests).

- [ ] **Step 3: Commit**

```bash
cd /Users/peter/personal/listaviva
git add src/lib/dashboard.ts
git commit -m "feat: implement dashboard data layer with 7 typed functions (issue #12)"
```

---

### Task 5: Dashboard Page + Client Component

**Files:**
- Create: `src/app/[locale]/admin/dashboard/page.tsx`
- Create: `src/app/[locale]/admin/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Create the Server Component page**

```tsx
// src/app/[locale]/admin/dashboard/page.tsx
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
```

- [ ] **Step 2: Create the Client Component**

```tsx
// src/app/[locale]/admin/dashboard/DashboardClient.tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type {
  ProviderStats,
  PendingActions,
  CategoryCount,
  BairroCount,
  TopQuery,
  ZeroResultQuery,
  SupplyDemandRow,
} from "@/lib/dashboard";

type Tab = "overview" | "search" | "supply";

type Props = {
  stats: ProviderStats;
  pendingActions: PendingActions;
  byCategory: CategoryCount[];
  byBairro: BairroCount[];
  topQueries: TopQuery[];
  zeroQueries: ZeroResultQuery[];
  supplyDemand: SupplyDemandRow[];
};

export default function DashboardClient({
  stats,
  pendingActions,
  byCategory,
  byBairro,
  topQueries,
  zeroQueries,
  supplyDemand,
}: Props) {
  const t = useTranslations("dashboard");
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const totalSearches =
    topQueries.reduce((s, r) => s + Number(r.search_count), 0) +
    zeroQueries.reduce((s, r) => s + Number(r.search_count), 0);

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: t("overview") },
    { id: "search", label: t("searchAnalytics") },
    { id: "supply", label: t("supplyDemand") },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab.id
                ? "bg-white border border-b-white border-gray-200 text-gray-900 -mb-px"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard label={t("activeProviders")} value={stats.active} />
            <StatCard label={t("pendingProviders")} value={stats.pending} />
            <StatCard label={t("totalSearches")} value={totalSearches} />
            <StatCard label={t("pendingActions")} value={pendingActions.total} />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-semibold mb-4">{t("byCategory")}</h2>
              {byCategory.length === 0 ? (
                <p className="text-sm text-gray-400">{t("noData")}</p>
              ) : (
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(byCategory.length * 28, 100)}
                >
                  <BarChart layout="vertical" data={byCategory}>
                    <XAxis type="number" />
                    <YAxis dataKey="name_pt" type="category" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#6366f1" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-semibold mb-4">{t("byBairro")}</h2>
              {byBairro.length === 0 ? (
                <p className="text-sm text-gray-400">{t("noData")}</p>
              ) : (
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(byBairro.length * 28, 100)}
                >
                  <BarChart layout="vertical" data={byBairro}>
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10b981" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Search Analytics */}
      {activeTab === "search" && (
        <div className="grid grid-cols-2 gap-4">
          {/* Top queries */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold mb-4">{t("topQueries")}</h2>
            {topQueries.length === 0 ? (
              <p className="text-sm text-gray-400">{t("noData")}</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-100">
                    <th className="text-left py-2 font-medium">{t("query")}</th>
                    <th className="text-right py-2 font-medium">{t("count")}</th>
                    <th className="text-right py-2 font-medium">{t("avgResults")}</th>
                  </tr>
                </thead>
                <tbody>
                  {topQueries.map((row) => (
                    <tr key={row.query_text} className="border-b border-gray-50">
                      <td className="py-2">{row.query_text}</td>
                      <td className="py-2 text-right">{Number(row.search_count)}</td>
                      <td className="py-2 text-right">{Number(row.avg_results)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Zero-result queries */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold mb-4 text-red-600">{t("zeroResults")}</h2>
            {zeroQueries.length === 0 ? (
              <p className="text-sm text-gray-400">{t("noData")}</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-100">
                    <th className="text-left py-2 font-medium">{t("query")}</th>
                    <th className="text-right py-2 font-medium">{t("searches")}</th>
                  </tr>
                </thead>
                <tbody>
                  {zeroQueries.map((row) => (
                    <tr key={row.query_text} className="border-b border-gray-50">
                      <td className="py-2">{row.query_text}</td>
                      <td className="py-2 text-right">{Number(row.search_count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab: Supply & Demand */}
      {activeTab === "supply" && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold mb-1">{t("supplyDemand")}</h2>
          <p className="text-xs text-gray-400 mb-4">
            Categories with fewest providers — biggest supply gaps.
          </p>
          {supplyDemand.length === 0 ? (
            <p className="text-sm text-gray-400">{t("noData")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-gray-100">
                  <th className="text-left py-2 font-medium">{t("category")}</th>
                  <th className="text-right py-2 font-medium">{t("providers")}</th>
                </tr>
              </thead>
              <tbody>
                {supplyDemand.map((row) => (
                  <tr key={row.name_pt} className="border-b border-gray-50">
                    <td className="py-2">{row.name_pt}</td>
                    <td className="py-2 text-right font-mono">{Number(row.provider_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}
```

- [ ] **Step 3: Run the build to verify TypeScript is happy**

```bash
cd /Users/peter/personal/listaviva && npm run build
```

Expected: Build completes with no errors. If Recharts types cause issues, install `@types/recharts` or check the import paths.

- [ ] **Step 4: Commit**

```bash
cd /Users/peter/personal/listaviva
git add src/app/[locale]/admin/dashboard/
git commit -m "feat: add admin dashboard page and client component (issue #12)"
```

---

### Task 6: Admin Nav Link + Final Verification

**Files:**
- Modify: `src/app/[locale]/admin/layout.tsx`

- [ ] **Step 1: Add dashboard nav item to admin layout**

In `src/app/[locale]/admin/layout.tsx`, add the dashboard item to the `navItems` array (the `admin.dashboard` key already exists in both message files):

```ts
const navItems = [
  { href: "/admin/dashboard" as const, label: t("admin.dashboard"), icon: "📊" },
  { href: "/admin/bairros" as const, label: t("admin.bairros"), icon: "🏘" },
  { href: "/admin/categories" as const, label: t("admin.categories"), icon: "📂" },
  { href: "/admin/providers" as const, label: t("admin.listings"), icon: "👤" },
  { href: "/admin/claims" as const, label: t("admin.claims"), icon: "📋" },
  { href: "/admin/recommendations" as const, label: t("admin.recommendations"), icon: "💡" },
];
```

- [ ] **Step 2: Run the full build — must pass**

```bash
cd /Users/peter/personal/listaviva && npm run build
```

Expected: Build completes cleanly with no TypeScript or ESLint errors.

- [ ] **Step 3: Run all tests to confirm nothing regressed**

```bash
cd /Users/peter/personal/listaviva && npx vitest run
```

Expected: All tests pass.

- [ ] **Step 4: Commit and close issue**

```bash
cd /Users/peter/personal/listaviva
git add src/app/[locale]/admin/layout.tsx
git commit -m "feat: add Dashboard nav link to admin sidebar (issue #12)"
```

Then close issue #12:
```bash
gh issue close 12 --comment "Dashboard implemented at /[locale]/admin/dashboard with three tabs: Overview (stat cards + bar charts), Search Analytics (top queries + zero-result queries), Supply & Demand (categories by provider count). Recharts for visualization, server-side data fetching with Supabase RPCs."
```
