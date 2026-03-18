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
| `src/lib/embeddings.ts` | Create | `embedText(text): Promise<number[]>` via OpenAI SDK |
| `src/lib/search.ts` | Create | Full search pipeline: embed → similarity → fallback → log |
| `src/app/[locale]/search/page.tsx` | Create | Results page (Server Component) |
| `src/app/api/admin/embed-providers/route.ts` | Create | Batch embed all providers (service role, admin-only) |
| `src/app/[locale]/admin/providers/actions.ts` | Modify | Generate embedding on create/update |
| `src/app/[locale]/account/actions.ts` | Modify | Same for `createOwnProvider` / `updateOwnProvider` |
| `src/app/[locale]/page.tsx` | Modify | Wire homepage search form to `/search` |
| `src/app/[locale]/category/[slug]/page.tsx` | Modify | Add search bar linking to `/search` |
| `messages/pt-BR.json` | Modify | Add `search` namespace |
| `messages/en.json` | Modify | Same |
| `supabase/migrations/003_search_rpc.sql` | Create | `match_providers` RPC function |
| `vitest.config.ts` | Create | Vitest config with path aliases |
| `src/lib/embeddings.test.ts` | Create | Unit tests for `embedText` |
| `src/lib/search.test.ts` | Create | Unit tests for search pipeline |

## Embeddings

### `src/lib/embeddings.ts`

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
```

### Embedding text construction

```ts
function buildProviderText(
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

After all provider data is written (categories, service areas, photos), append this block to `createProvider`, `updateProvider`, `createOwnProvider`, and `updateOwnProvider`:

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

`GET /api/admin/embed-providers` — uses `SUPABASE_SERVICE_ROLE_KEY`. Protected by `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` header check. Fetches all active providers where `embedding IS NULL`, generates embeddings sequentially, updates each row. Returns `{ processed: N, errors: M }`.

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
}): Promise<{ results: ProviderSearchResult[]; usedFallback: boolean }>
```

**Flow:**
1. `embedText(query)` → get vector
2. Call `match_providers` RPC (with `bairro_filter` if provided)
3. If RPC returns ≥ 1 results → semantic path
4. If RPC returns 0 → trigram fallback: `providers` table with `.ilike("name", "%q%")` and `.textSearch` on `description_pt`, filtered by `status = 'active'` and optionally bairro
5. Log to `search_queries`: `{ query_text: query, results_count, user_id, bairro_filter_id }`
6. If `embedText` throws → skip to trigram fallback immediately (graceful degradation)
7. Fetch full provider rows (bairro name, categories) for the result IDs in a second query

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

Dev deps: `vitest`, `vite-tsconfig-paths`, `@vitest/coverage-v8`.

### `src/lib/embeddings.test.ts`

Mocks `openai` module. Verifies:
- Returns a `number[]` on success
- Slices input to 8192 chars before calling the API
- Re-throws when the OpenAI client throws

### `src/lib/search.test.ts`

Mocks Supabase client and `embedText`. Verifies:
- **Semantic path**: RPC returns results → they are returned, `results_count > 0` logged
- **Fallback path**: RPC returns empty → trigram query runs, result logged
- **Zero-result logging**: both paths log `results_count: 0` when nothing found
- **Bairro filter**: RPC called with `bairro_filter` when `bairroId` provided; trigram also filters by bairro
- **Embed failure**: `embedText` throws → falls back to trigram, does not throw to caller

## Translation Keys

New `search` namespace in both message files:

```
search.title        — "Busca" / "Search"
search.placeholder  — "O que você precisa?" / "What do you need?"
search.noResults    — "Nenhum prestador encontrado" / "No providers found"
search.resultsFor   — "Resultados para \"{q}\"" / "Results for \"{q}\""
search.filterBairro — "Filtrar por bairro" / "Filter by neighborhood"
search.allBairros   — "Todos os bairros" / "All neighborhoods"
search.tryWithout   — "Tente sem filtro de bairro" / "Try without neighborhood filter"
```

## Error Handling

- Empty `q` → redirect to `/`
- `embedText` failure → silent fallback to trigram; no error shown to user
- Both paths return zero → empty state rendered, query still logged
- Batch embed route → per-row errors caught, counted in `errors` response field; other rows continue

## Tests Not Included

- Actual embedding quality / Portuguese semantic relevance (requires live OpenAI)
- Supabase RLS enforcement (DB-level concern)
- E2E browser tests
