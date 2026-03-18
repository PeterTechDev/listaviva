# Admin Dashboard — Design

**Issue:** #12

## Goal

Give admins a single dashboard at `/[locale]/admin/dashboard` showing catalog health, search intelligence, and supply/demand signals. All data is fetched server-side from existing tables; no new data collection needed.

## Architecture

A Server Component page fetches all data in parallel via typed functions in `src/lib/dashboard.ts`, then renders a `DashboardClient.tsx` client component that manages tab state with `useState`. Three aggregation queries (top queries, zero-result queries, supply/demand) run via Supabase RPCs defined in a new migration. Admin access enforced via `requireAdmin(locale)` at the top of the page. Recharts renders the two bar charts inside the client component.

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

-- Returns categories ranked by unmet demand (searches / max(providers, 1))
create or replace function public.get_supply_demand()
returns table(name_pt text, search_count bigint, provider_count bigint, gap_score numeric)
language sql stable as $$
  select
    c.name_pt,
    coalesce(sq.search_count, 0) as search_count,
    coalesce(pc.provider_count, 0) as provider_count,
    round(coalesce(sq.search_count, 0)::numeric / greatest(coalesce(pc.provider_count, 0), 1), 1) as gap_score
  from public.categories c
  left join (
    select query_text, count(*) as search_count
    from public.search_queries
    group by query_text
  ) sq on lower(c.name_pt) = lower(sq.query_text)
  left join (
    select category_id, count(*) as provider_count
    from public.provider_categories
    group by category_id
  ) pc on c.id = pc.category_id
  order by gap_score desc;
$$;
```

The `providers` count by status and counts by category/bairro use the Supabase JS client directly (no RPC needed — simple selects with joins).

## File Map

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/005_dashboard_rpcs.sql` | Create | Three SQL RPC functions for aggregations |
| `src/lib/dashboard.ts` | Create | Typed data-fetching functions |
| `src/lib/dashboard.test.ts` | Create | Unit tests for dashboard functions |
| `src/app/[locale]/admin/dashboard/page.tsx` | Create | Server Component — fetches data, enforces admin |
| `src/app/[locale]/admin/dashboard/DashboardClient.tsx` | Create | Client Component — tabs + charts + tables |
| `src/app/[locale]/admin/layout.tsx` | Modify | Add Dashboard nav link |
| `messages/pt-BR.json` | Modify | Add `dashboard` namespace |
| `messages/en.json` | Modify | Add `dashboard` namespace |

## Data Layer (`src/lib/dashboard.ts`)

Exports five typed functions, each accepting a `SupabaseClient`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type ProviderStats = {
  total: number;
  active: number;
  pending: number;
  inactive: number;
};

export type CategoryCount = { name_pt: string; count: number };
export type BairroCount = { name: string; count: number };
export type TopQuery = { query_text: string; search_count: number; avg_results: number };
export type ZeroResultQuery = { query_text: string; search_count: number };
export type SupplyDemandRow = {
  name_pt: string;
  search_count: number;
  provider_count: number;
  gap_score: number;
};

export async function getProviderStats(supabase: SupabaseClient): Promise<ProviderStats>;
export async function getProvidersByCategory(supabase: SupabaseClient): Promise<CategoryCount[]>;
export async function getProvidersByBairro(supabase: SupabaseClient): Promise<BairroCount[]>;
export async function getTopQueries(supabase: SupabaseClient): Promise<TopQuery[]>;
export async function getZeroResultQueries(supabase: SupabaseClient): Promise<ZeroResultQuery[]>;
export async function getSupplyDemand(supabase: SupabaseClient): Promise<SupplyDemandRow[]>;
```

**Implementation details:**

- `getProviderStats`: `supabase.from("providers").select("status")` — counts rows by status in JS.
- `getProvidersByCategory`: `supabase.from("provider_categories").select("categories(name_pt)")` — groups by category name in JS, sorts desc by count.
- `getProvidersByBairro`: `supabase.from("providers").select("bairros(name)").eq("status","active")` — groups by bairro name in JS, top 10.
- `getTopQueries`: `supabase.rpc("get_top_queries")` — returns rows directly.
- `getZeroResultQueries`: `supabase.rpc("get_zero_result_queries")` — returns rows directly.
- `getSupplyDemand`: `supabase.rpc("get_supply_demand")` — returns rows directly.

## Page (`src/app/[locale]/admin/dashboard/page.tsx`)

Server Component. Enforces admin via `requireAdmin(locale)`. Fetches all six data sets in parallel with `Promise.all`. Passes results to `<DashboardClient>`.

```ts
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdmin(locale);

  const supabase = await createClient();

  const [stats, byCategory, byBairro, topQueries, zeroQueries, supplyDemand] =
    await Promise.all([
      getProviderStats(supabase),
      getProvidersByCategory(supabase),
      getProvidersByBairro(supabase),
      getTopQueries(supabase),
      getZeroResultQueries(supabase),
      getSupplyDemand(supabase),
    ]);

  return (
    <DashboardClient
      stats={stats}
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

Client component. Uses `useState` for active tab (`"overview" | "search" | "supply"`). Uses `useTranslations("dashboard")`.

### Tab: Overview

- Four stat cards: active providers, pending providers, total searches (`topQueries` + `zeroQueries` total), pending actions (sum of pending claims + pending recommendations — passed as part of `stats`).
- `BarChart` (Recharts, horizontal) — providers by category. `layout="vertical"`, `YAxis dataKey="name_pt"`, `XAxis type="number"`, `Bar dataKey="count"` fill `#6366f1`.
- `BarChart` (Recharts, horizontal) — top 10 bairros by provider count. Same layout, fill `#10b981`.

### Tab: Search Analytics

Two side-by-side tables:
- **Top queries**: columns Query, Count, Avg results. Rows from `topQueries`.
- **Zero-result queries**: columns Query, Searches. Rows from `zeroQueries`. Header in red to signal urgency.

### Tab: Supply & Demand

Single table: Category, Searches, Providers, Gap score. Sorted by gap score desc (already sorted from RPC). Gap score cell colored: `>= 10` → red badge, `>= 3` → orange badge, else yellow badge.

## Admin Nav

Add to `navItems` in `src/app/[locale]/admin/layout.tsx`:

```ts
{ href: "/admin/dashboard" as const, label: t("admin.dashboard"), icon: "📊" }
```

Add `admin.dashboard` key to both message files:
- pt-BR: `"dashboard": "Dashboard"`
- en: `"dashboard": "Dashboard"`

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
dashboard.gapScore         — "Gap" / "Gap"
dashboard.noData           — "Sem dados ainda" / "No data yet"
```

## Tests (`src/lib/dashboard.test.ts`)

Mocks `@/lib/supabase/server`. Tests:

- `getProviderStats`: given rows with mixed statuses, returns correct counts for active/pending/inactive/total.
- `getProvidersByCategory`: given provider_categories rows, returns sorted category counts.
- `getProvidersByBairro`: given provider rows, returns top 10 sorted bairro counts.
- `getTopQueries`: RPC called with `"get_top_queries"`, returns rows as-is.
- `getZeroResultQueries`: RPC called with `"get_zero_result_queries"`, returns rows as-is.
- `getSupplyDemand`: RPC called with `"get_supply_demand"`, returns rows as-is.
- Admin access: `requireAdmin` is called — verified by checking that a non-admin redirect fires (tested at the page level via mock).

## Error Handling

- Any failed fetch returns empty array / zero counts (all functions default to `[]`/`{}` on error).
- Empty state: each section shows `t("dashboard.noData")` when its data array is empty.
- Recharts renders gracefully with empty data (no chart, no crash).

## Dependency

Add to `package.json`: `recharts` (prod dependency). Run `npm install recharts`.
