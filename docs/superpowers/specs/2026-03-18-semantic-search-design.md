# Semantic Search — Design

**Issue:** #10

## Goal

Add AI-powered semantic search to Listaviva. A consumer types a natural-language query ("preciso de alguém pra consertar meu chuveiro") and sees ranked provider results. All queries are logged; zero-result queries are flagged for admin market-gap analysis.

## Architecture

A dedicated `/[locale]/search` Server Component page receives `q` and `bairro_id` as URL params. The page calls `searchProviders()` in `src/lib/search.ts`, which embeds the query via OpenAI, runs pgvector cosine similarity, falls back to trigram full-text search on zero results, logs the query, and returns ranked providers. Embeddings for providers are generated inline on create/update in both admin and self-service actions, and a batch route handles existing providers.

**Tech Stack:** Next.js 16 App Router, Supabase pgvector (already provisioned), OpenAI `text-embedding-3-small` (key already in `.env.local`), Vitest for tests.

## Data Model

No schema changes to existing tables. The initial migration already provides:

- `providers.embedding vector(1536)` with HNSW cosine index
- `search_queries(id, query_text, results_count, user_id, bairro_filter_id, created_at)` with zero-results partial index
- `vector` and `pg_trgm` extensions installed

New migration `003_search_rpc.sql` adds the `match_providers` RPC function only.

## File Map

| File | Action | Purpose |
|---|---|---|
| `package.json` | Modify | Add `openai` (prod); add `vitest`, `vite-tsconfig-paths`, `@vitest/coverage-v8` (dev) — run `npm install openai && npm install -D vitest vite-tsconfig-paths @vitest/coverage-v8` |
| `src/lib/embeddings.ts` | Create | `embedText(text): Promise<number[]>` via OpenAI SDK; also exports `buildProviderText` |
| `src/lib/search.ts` | Create | Full search pipeline: embed → similarity → fallback → log |
| `src/app/[locale]/search/page.tsx` | Create | Results page (Server Component) |
| `src/app/api/admin/embed-providers/route.ts` | Create | Batch embed all providers (service role, admin-only) |
| `src/app/[locale]/admin/providers/actions.ts` | Modify | Add `import { buildProviderText, embedText } from "@/lib/embeddings"`; generate embedding on create/update |
| `src/app/[locale]/account/actions.ts` | Modify | Add `import { buildProviderText, embedText } from "@/lib/embeddings"`; generate embedding in `createOwnProvider` / `updateOwnProvider` |
| `src/app/[locale]/page.tsx` | Modify | Wire homepage search form to `/search` |
| `src/app/[locale]/category/[slug]/page.tsx` | Modify | Add search bar linking to `/search` |
| `messages/pt-BR.json` | Modify | Add `search` namespace |
| `messages/en.json` | Modify | Same |
| `supabase/migrations/003_search_rpc.sql` | Create | `match_providers` RPC function |
| `vitest.config.ts` | Create | Vitest config with path aliases (verify `@/*` alias in `tsconfig.json` first) |
| `src/lib/embeddings.test.ts` | Create | Unit tests for `embedText` |
| `src/lib/search.test.ts` | Create | Unit tests for search pipeline |

## Embeddings

### `src/lib/embeddings.ts`

Complete file contents:

```ts
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function embedText(text: string): Promise<number[]> {
  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text.slice(0, 8192),
  });
  return response.data[0].embedding;
}

export function buildProviderText(
  name: string,
  descriptionPt: string | null,
  categoryNames: string[]
): string {
  return [name, descriptionPt ?? "", categoryNames.join(" ")]
    .filter(Boolean)
    .join(" ");
}
```

Category names are fetched after the provider insert from `provider_categories` + `categories`. The embedding is generated in a `try/catch` — failure does not block the save or redirect.

### Embedding on admin and self-service actions

After all provider data is written (categories, service areas, photos), add this block to `createProvider`, `updateProvider`, `createOwnProvider`, and `updateOwnProvider`.

**Important for `createOwnProvider` only:** this block must be inserted **before** the final `redirect("/account")` call — `redirect()` throws a `NEXT_REDIRECT` error that terminates execution, so any code after it is unreachable. For `updateOwnProvider`, `createProvider`, and `updateProvider`, the embedding block can go at the very end (those functions end with `revalidatePath(...)` or `return { success: true }`, not `redirect()`).

Each actions file must add at the top: `import { buildProviderText, embedText } from "@/lib/embeddings";`

```ts
try {
  const { data: cats } = await supabase
    .from("provider_categories")
    .select("categories(name_pt)")
    .eq("provider_id", providerId);
  const catNames = (cats ?? []).flatMap((c) => {
    const cat = c.categories;
    return Array.isArray(cat)
      ? cat.map((x) => x.name_pt)
      : cat
      ? [(cat as { name_pt: string }).name_pt]
      : [];
  });
  const text = buildProviderText(name, description_pt ?? null, catNames);
  const embedding = await embedText(text);
  await supabase
    .from("providers")
    .update({ embedding: JSON.stringify(embedding) })
    .eq("id", providerId);
} catch {
  // non-blocking
}
```

### Batch route

`GET /api/admin/embed-providers` — protected by `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` header check. Uses a service-role Supabase client (not the standard server client) to bypass RLS. Fetches all active providers where `embedding IS NULL`, generates embeddings sequentially, updates each row. Returns `{ processed: N, errors: M }`.

```ts
import { createClient } from "@supabase/supabase-js";
import { embedText, buildProviderText } from "@/lib/embeddings";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (authHeader !== `Bearer ${serviceKey}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey
  );

  const { data: providers } = await supabase
    .from("providers")
    .select("id, name, description_pt, provider_categories(categories(name_pt))")
    .eq("status", "active")
    .is("embedding", null);

  let processed = 0;
  let errors = 0;

  // Sequential — avoid overwhelming the OpenAI rate limit
  for (const provider of providers ?? []) {
    try {
      const catNames = (provider.provider_categories ?? []).flatMap(
        (pc: { categories: unknown }) =>
          Array.isArray(pc.categories)
            ? (pc.categories as { name_pt: string }[]).map((c) => c.name_pt)
            : pc.categories
            ? [(pc.categories as { name_pt: string }).name_pt]
            : []
      );
      const text = buildProviderText(provider.name, provider.description_pt ?? null, catNames);
      const embedding = await embedText(text);
      await supabase
        .from("providers")
        .update({ embedding: JSON.stringify(embedding) })
        .eq("id", provider.id);
      processed++;
    } catch {
      errors++;
    }
  }

  return Response.json({ processed, errors });
}
```

## Search Pipeline

### PostgreSQL RPC (`supabase/migrations/003_search_rpc.sql`)

```sql
create or replace function public.match_providers(
  query_embedding vector(1536),
  bairro_filter uuid default null,
  match_threshold float default 0.3,
  match_count int default 20
)
returns table (
  id uuid, name text, slug text, description_pt text,
  whatsapp text, home_bairro_id uuid, similarity float
)
language sql stable
as $$
  select
    p.id, p.name, p.slug, p.description_pt,
    p.whatsapp, p.home_bairro_id,
    1 - (p.embedding <=> query_embedding) as similarity
  from public.providers p
  where
    p.status = 'active'
    and p.embedding is not null
    and 1 - (p.embedding <=> query_embedding) > match_threshold
    and (bairro_filter is null or p.home_bairro_id = bairro_filter)
  order by p.embedding <=> query_embedding
  limit match_count;
$$;
```

### `src/lib/search.ts`

```ts
// Use unparameterized SupabaseClient — the project has no generated Database types yet
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

  // Step 4: trigram fallback (description_pt is plain text, not tsvector — use .ilike())
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

  // Step 5: log query (anon users get RLS policy violation — swallowed intentionally)
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

  // Step 7: enrich — note the nested relation shape from Supabase:
  // provider_categories returns [{ categories: { name_pt, name_en, icon } }]
  // must be flattened to categories: { name_pt, name_en, icon }[]
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
    // Flatten nested provider_categories → categories relation
    categories: (row.categories ?? []).flatMap(
      (pc: { categories: unknown }) =>
        Array.isArray(pc.categories) ? pc.categories : pc.categories ? [pc.categories] : []
    ),
  }));

  return { results, usedFallback };
}
```

## Pages & Components

### `/[locale]/search/page.tsx`

Server Component. Reads `searchParams.q` and `searchParams.bairro_id`.
- Empty `q` → `redirect("/")`
- Calls `searchProviders()` with server Supabase client
- Renders:
  - `<Header />`
  - Heading: `t("search.resultsFor", { q })`
  - Bairro filter `<select>` (GET form, updates `bairro_id` param) — populated from all bairros
  - Provider cards identical to catalog page (name, bairro pill, category pills, WhatsApp button)
  - Empty state: `t("search.noResults")` + hint to remove bairro filter if one is active

### Homepage

Wire the existing search `<input>` to a `<form method="GET" action="/{locale}/search">` with `name="q"`. No JS required.

### Catalog page

Add a compact search bar (text input + submit button) above the provider list. On submit, navigates to `/search?q=...`.

## Tests

### `vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: { environment: "node", globals: true },
});
```

Dev deps: `vitest`, `vite-tsconfig-paths`, `@vitest/coverage-v8`. Production dep: `openai` (for `embedText`).

### `src/lib/embeddings.test.ts`

Mocks `openai` module. Verifies:
- Returns a `number[]` on success
- Slices input to 8192 chars before calling the API
- Re-throws when the OpenAI client throws

### `src/lib/search.test.ts`

Mocks Supabase client and `embedText`. The Supabase mock must support chained query builder calls. The `from("providers")` table is called twice: once for the trigram fallback (`.ilike()`) and once for the enrichment query (`.in()`). The mock must differentiate these — use call-count tracking or check the chained method to distinguish them. The mock below is illustrative; refine per-test as needed:

```ts
import { vi } from "vitest";

vi.mock("@/lib/embeddings");

function makeSupabaseMock({
  rpcData = [],
  fallbackData = [],
  enrichData = [],
}: {
  rpcData?: unknown[];
  fallbackData?: unknown[];
  enrichData?: unknown[];
}) {
  let providersCallCount = 0;
  return {
    rpc: vi.fn().mockResolvedValue({ data: rpcData, error: null }),
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "search_queries") {
        return { insert: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis() };
      }
      if (table === "providers") {
        const callIndex = providersCallCount++;
        const data = callIndex === 0 ? fallbackData : enrichData;
        const builder: Record<string, unknown> = {};
        const methods = ["select", "eq", "or", "ilike", "in"];
        for (const m of methods) builder[m] = vi.fn().mockReturnValue(builder);
        builder.then = (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data, error: null }).then(resolve);
        return builder;
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [], error: null }) };
    }),
  };
}
```

Verifies:
- **Semantic path**: RPC returns results → they are returned, `results_count > 0` logged
- **Fallback path**: RPC returns empty → trigram query runs, result logged
- **Zero-result logging**: both paths log `results_count: 0` when nothing found
- **Bairro filter**: RPC called with `bairro_filter` when `bairroId` provided; trigram also filters by bairro
- **Embed failure**: `embedText` throws → falls back to trigram, does not throw to caller

## Translation Keys

New `search` namespace in both message files:

```
search.title        — "Busca" / "Search"  (used as <title> / <h1> on the results page)
search.noResults    — "Nenhum prestador encontrado" / "No providers found"
search.resultsFor   — "Resultados para \"{q}\"" / "Results for \"{q}\""
search.filterBairro — "Filtrar por bairro" / "Filter by neighborhood"
search.allBairros   — "Todos os bairros" / "All neighborhoods"
search.tryWithout   — "Tente sem filtro de bairro" / "Try without neighborhood filter"
```

Note: the existing `common.searchPlaceholder` key covers the search input placeholder — do not add a duplicate `search.placeholder` key.

## Error Handling

- Empty `q` → redirect to `/`
- `embedText` failure → silent fallback to trigram; no error shown to user
- Both paths return zero → empty state rendered, query still logged
- Batch embed route → per-row errors caught, counted in `errors` response field; other rows continue

## Tests Not Included

- Actual embedding quality / Portuguese semantic relevance (requires live OpenAI)
- Supabase RLS enforcement (DB-level concern)
- E2E browser tests
