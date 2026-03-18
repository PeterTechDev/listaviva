# Admin Dashboard — Design

**Issue:** #12

## Goal

Give admins a single dashboard at `/[locale]/admin/dashboard` showing catalog health, search intelligence, and supply/demand signals. All data is fetched server-side from existing tables; no new data collection needed.

## Architecture

A Server Component page fetches all data in parallel via typed functions in `src/lib/dashboard.ts`, then renders a `DashboardClient.tsx` client component (`"use client"`) that manages tab state with `useState`. Three aggregation queries (top queries, zero-result queries, supply/demand) run via Supabase RPCs defined in a new migration. Admin access enforced via `requireAdmin(locale)` at the top of the page — this is an intentional security addition; other admin pages currently rely on the layout-level auth check only. Recharts renders the two bar charts inside the client component; since Recharts is a client-only library, all chart components must live in `DashboardClient.tsx`.

**Tech Stack:** Next.js 16 App Router, Supabase (RPCs for aggregations), Recharts, Vitest.

## Data Model

No changes to existing tables. New migration `005_dashboard_rpcs.sql` adds three SQL functions:

```sql
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
-- Note: search_queries use free-text and cannot be reliably joined to category
-- names, so this view shows pure supply-side data — which categories have
-- the fewest providers. Zero-result queries (Search Analytics tab) serve as
-- the demand signal.
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

The `providers` count by status, counts by category, counts by bairro, and pending actions count use the Supabase JS client directly (no RPC needed).

## File Map

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/005_dashboard_rpcs.sql` | Create | Three SQL RPC functions for aggregations |
| `src/lib/dashboard.ts` | Create | Typed data-fetching functions |
| `src/lib/dashboard.test.ts` | Create | Unit tests for dashboard functions |
| `src/app/[locale]/admin/dashboard/page.tsx` | Create | Server Component — fetches data, enforces admin |
| `src/app/[locale]/admin/dashboard/DashboardClient.tsx` | Create | Client Component — tabs + charts + tables |
| `src/app/[locale]/admin/layout.tsx` | Modify | Add Dashboard nav link (nav item only; `admin.dashboard` key already exists) |
| `messages/pt-BR.json` | Modify | Add `dashboard` namespace |
| `messages/en.json` | Modify | Add `dashboard` namespace |

## Data Layer (`src/lib/dashboard.ts`)

Exports six typed functions, each accepting a `SupabaseClient`:

```ts
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

export async function getProviderStats(supabase: SupabaseClient): Promise<ProviderStats>;
export async function getPendingActions(supabase: SupabaseClient): Promise<PendingActions>;
export async function getProvidersByCategory(supabase: SupabaseClient): Promise<CategoryCount[]>;
export async function getProvidersByBairro(supabase: SupabaseClient): Promise<BairroCount[]>;
export async function getTopQueries(supabase: SupabaseClient): Promise<TopQuery[]>;
export async function getZeroResultQueries(supabase: SupabaseClient): Promise<ZeroResultQuery[]>;
export async function getSupplyDemand(supabase: SupabaseClient): Promise<SupplyDemandRow[]>;
```

**Implementation details:**

- `getProviderStats`: `supabase.from("providers").select("status")` — counts rows by status in JS. For the current catalog size this is fine; a future RPC can replace it if needed.
- `getPendingActions`: fetches `claim_requests` WHERE `status = 'pending'` and `recommendations` WHERE `status = 'pending'` in parallel, counts rows in JS, returns `{ pendingClaims, pendingRecommendations, total }`.
- `getProvidersByCategory`: `supabase.from("provider_categories").select("categories(name_pt)")` — groups by category name in JS, sorts desc by count. Acceptable at current catalog scale.
- `getProvidersByBairro`: `supabase.from("providers").select("bairros(name)").eq("status","active")` — groups by bairro name in JS, top 10.
- `getTopQueries`: `supabase.rpc("get_top_queries")` — returns rows directly.
- `getZeroResultQueries`: `supabase.rpc("get_zero_result_queries")` — returns rows directly.
- `getSupplyDemand`: `supabase.rpc("get_supply_demand")` — returns rows directly.

## Page (`src/app/[locale]/admin/dashboard/page.tsx`)

Server Component. Enforces admin via `requireAdmin(locale)` (imported from `@/lib/auth`). Fetches all seven data sets in parallel with `Promise.all`. Passes results to `<DashboardClient>`.

```ts
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  getProviderStats, getPendingActions, getProvidersByCategory,
  getProvidersByBairro, getTopQueries, getZeroResultQueries, getSupplyDemand,
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

## Client Component (`DashboardClient.tsx`)

`"use client"` at top. Uses `useState` for active tab (`"overview" | "search" | "supply"`). Uses `useTranslations("dashboard")`. All Recharts components must live here (client-only library).

### Tab: Overview

- Four stat cards:
  - Active providers: `stats.active`
  - Pending providers: `stats.pending`
  - Total searches: `topQueries.reduce((s, r) => s + r.search_count, 0) + zeroQueries.reduce((s, r) => s + r.search_count, 0)`
  - Pending actions: `pendingActions.total` (claims + recommendations)
- `BarChart` (Recharts, horizontal layout) — providers by category. `layout="vertical"`, `YAxis dataKey="name_pt" type="category"`, `XAxis type="number"`, `Bar dataKey="count"` fill `#6366f1`. Wrapped in `<ResponsiveContainer width="100%" height={Math.max(byCategory.length * 28, 100)}>`.
- `BarChart` (Recharts, horizontal) — top 10 bairros by provider count. Same layout pattern, fill `#10b981`.

### Tab: Search Analytics

Two side-by-side tables:
- **Top queries**: columns `t("query")`, `t("count")`, `t("avgResults")`. Rows from `topQueries`. Empty state: `t("noData")`.
- **Zero-result queries**: columns `t("query")`, `t("searches")`. Header styled red. Rows from `zeroQueries`. Empty state: `t("noData")`.

### Tab: Supply & Demand

Single table: `t("category")`, `t("providers")`. Sorted by `provider_count` asc (already from RPC — fewest providers first = biggest gaps). The demand signal is the zero-result queries in the Search Analytics tab; this tab shows the supply side. Empty state: `t("noData")`.

## Admin Nav

Add to `navItems` in `src/app/[locale]/admin/layout.tsx`:

```ts
{ href: "/admin/dashboard" as const, label: t("admin.dashboard"), icon: "📊" }
```

The `admin.dashboard` key already exists in both message files — no change needed to message files for this key. Only the nav item itself needs to be added.

## Translation Keys

New `dashboard` namespace in both message files:

```
dashboard.title            — "Dashboard" / "Dashboard"
dashboard.overview         — "Visão geral" / "Overview"
dashboard.searchAnalytics  — "Buscas" / "Search Analytics"
dashboard.supplyDemand     — "Oferta & Demanda" / "Supply & Demand"
dashboard.activeProviders  — "Prestadores ativos" / "Active providers"
dashboard.pendingProviders — "Prestadores pendentes" / "Pending providers"
dashboard.totalSearches    — "Total de buscas" / "Total searches"
dashboard.pendingActions   — "Ações pendentes" / "Pending actions"
dashboard.byCategory       — "Por categoria" / "By category"
dashboard.byBairro         — "Por bairro" / "By neighborhood"
dashboard.topQueries       — "Buscas mais frequentes" / "Top queries"
dashboard.zeroResults      — "Buscas sem resultado" / "Zero-result searches"
dashboard.query            — "Busca" / "Query"
dashboard.count            — "Contagem" / "Count"
dashboard.avgResults       — "Média de resultados" / "Avg results"
dashboard.category         — "Categoria" / "Category"
dashboard.searches         — "Buscas" / "Searches"
dashboard.providers        — "Prestadores" / "Providers"
dashboard.noData           — "Sem dados ainda" / "No data yet"
```

## Tests (`src/lib/dashboard.test.ts`)

Mocks `@/lib/supabase/server` via `vi.hoisted` pattern. Tests:

- `getProviderStats`: mock returns rows `[{status:"active"},{status:"active"},{status:"pending"}]` — asserts `{ total: 3, active: 2, pending: 1, inactive: 0 }`.
- `getPendingActions`: mock returns pending claim_requests and pending recommendations — asserts correct counts and `total`.
- `getProvidersByCategory`: mock returns `provider_categories` rows — asserts sorted category counts.
- `getProvidersByBairro`: mock returns provider rows — asserts top 10 sorted bairro counts.
- `getTopQueries`: mock `supabase.rpc` returns `[{ query_text: "eletricista", search_count: 5, avg_results: 3.0 }]` — asserts RPC called with `"get_top_queries"` and result returned.
- `getZeroResultQueries`: same pattern with `"get_zero_result_queries"`.
- `getSupplyDemand`: same pattern with `"get_supply_demand"`.

Admin access enforcement is verified by mocking `@/lib/auth` (`requireAdmin`) and confirming it is called when the page renders — tested as a unit-level import mock in `dashboard.test.ts` (import the page module, mock `requireAdmin`, call the page function).

## Error Handling

- Any failed fetch returns empty array / zero counts (all functions catch errors and return defaults).
- Empty state: each section shows `t("dashboard.noData")` when its data array is empty.
- Recharts renders gracefully with empty data (no chart displayed, no crash).

## Dependency

Add to `package.json`: `recharts` (prod dependency). Run `npm install recharts`.
