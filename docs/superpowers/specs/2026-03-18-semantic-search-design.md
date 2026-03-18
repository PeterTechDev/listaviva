# Semantic Search Design — Listaviva
**Date:** 2026-03-18
**Issue:** #10 — Semantic search with embeddings + pgvector
**Status:** Approved

---

## Context

Listaviva is a hyperlocal service catalog for Linhares, ES (Brazil). Consumers search in Portuguese natural language (e.g., "preciso de alguém pra consertar meu chuveiro") and need to find relevant providers even when their words don't match category names exactly.

**Priorities driving this design:**
1. Best Portuguese language quality
2. Lowest cost (bootstrap project)
3. Portfolio-worthy — showcases clean abstraction, pgvector-native architecture, and data intelligence

---

## Decision: What We're NOT Building

- No hybrid BM25 + RRF + LLM reranking stack — marginal quality gain at Listaviva's scale (100–500 providers at launch), high complexity cost
- No QMD (local GGUF model tool) in production — incompatible with Vercel serverless runtime
- No separate vector database — pgvector natively in Supabase is sufficient and simpler

---

## Embedding Provider

**Choice:** OpenAI `text-embedding-3-small`

| Criterion | Result |
|-----------|--------|
| Portuguese quality | Excellent (multilingual by design) |
| Cost | $0.02 / 1M tokens — negligible at launch scale |
| Dimensions | 1536 — matches existing schema (no migration needed) |
| Swappability | Hidden behind `EmbeddingProvider` interface |

The provider is a detail, not the story. The `EmbeddingProvider` interface makes it swappable (Cohere, HuggingFace) without changing any other code.

---

## Module Architecture

The `SearchModule` is a single deep module with a simple public interface. All complexity is internal.

```
src/lib/search/
├── index.ts       ← public interface: search(query, options) → Provider[]
├── embed.ts       ← EmbeddingProvider interface + OpenAI implementation
├── query.ts       ← Supabase pgvector cosine similarity SQL
├── fallback.ts    ← pg_trgm full-text search fallback
└── logger.ts      ← logs every query + result count to search_queries table
```

### Public Interface

```ts
// The only thing the rest of the app needs to know
search(
  query: string,
  options?: {
    bairroId?: string   // filter to providers who serve this bairro
    limit?: number      // default: 20
  }
): Promise<Provider[]>

// Provider — the shape returned by search()
interface Provider {
  id: string
  name: string
  slug: string
  description_pt: string | null
  description_en: string | null
  whatsapp: string | null
  home_bairro: { id: string; name: string } | null
  categories: { id: string; name_pt: string; slug: string }[]
  photos: { url: string; sort_order: number }[]
  similarity_score: number   // cosine similarity (0–1); 0 when result came from fallback
}
```

### Similarity Threshold

Vector search uses a minimum cosine similarity of `0.30`. Results below this threshold are dropped — they indicate the query has no meaningful semantic match in the catalog.

When vector search returns 0 results above the threshold (or OpenAI is unavailable), the fallback runs. The fallback has no similarity threshold — it returns whatever pg_trgm finds, ordered by text relevance score.

### Default Limit

`options.limit` defaults to `20` when not provided.

### EmbeddingProvider Interface

```ts
interface EmbeddingProvider {
  embed(text: string): Promise<number[]>
}

// Current implementation
class OpenAIEmbeddingProvider implements EmbeddingProvider {
  async embed(text: string): Promise<number[]>
}

// Future — zero changes needed outside embed.ts
// class CohereEmbeddingProvider implements EmbeddingProvider
// class HuggingFaceEmbeddingProvider implements EmbeddingProvider
```

---

## Search Flow (Query Time)

```
User query: "quero um eletricista no centro"
     │
     ▼
1. embed(query) → vector[1536]          via OpenAI API
     │
     ├─ OpenAI available ──────────────► pgvector cosine similarity search
     │                                   WHERE status = 'active'
     │                                   AND similarity >= 0.30
     │                                   + bairroId filter (if provided)
     │                                   → ranked Provider[]
     │
     └─ OpenAI unavailable ────────────► pg_trgm full-text fallback
     │   (any of: missing OPENAI_API_KEY,   WHERE status = 'active'
     │    non-2xx HTTP response, thrown      searches: name + description_pt
     │    exception, or 0 results above      via to_tsvector('portuguese', ...)
     │    similarity threshold 0.30)         → Provider[]
     │
     ▼
4. log to search_queries (always)       query text, results count, bairro filter,
   using service role client            query embedding (if available), user_id
   (bypasses RLS — search is public,    null user_id = anonymous visitor
    logging must work for anon users)
     │
     ▼
5. return Provider[]
```

---

## Embedding Generation (Provider Listings)

### What Gets Embedded

```
"{name}. {description_pt}. Categorias: {category_names}. Bairro: {home_bairro_name}"
```

Example:
```
"João Silva Elétrica. Serviços elétricos residenciais e comerciais, instalação e manutenção. Categorias: Eletricista. Bairro: Centro"
```

### When Embeddings Are Generated

- **After admin saves a listing** — `POST /api/admin/providers/[id]/embed` called inline; admin-only (protected by session role check, returns 403 if not admin)
- **After provider self-registers** — same endpoint called automatically on save
- **Batch backfill** — `POST /api/admin/providers/embed-all`; admin-only; iterates all providers where `embedding IS NULL`, calls OpenAI for each, updates the row; returns `{ processed: n, failed: n }`

Providers saved without an embedding (e.g., OpenAI unavailable) remain `status: active` but have `embedding IS NULL` — they are excluded from vector search until re-embedded via the batch backfill. They remain findable via pg_trgm fallback.

---

## Schema

No migration needed for the providers table — `vector(1536)` and HNSW index already defined in `001_initial_schema.sql`.

New migration `002_search_enhancements.sql`:

```sql
-- Store query embeddings for future intent clustering
alter table public.search_queries
  add column query_embedding vector(1536);

-- Full-text search index for pg_trgm fallback
-- Searches name + description_pt combined
alter table public.providers
  add column search_text tsvector
  generated always as (
    to_tsvector('portuguese', coalesce(name, '') || ' ' || coalesce(description_pt, ''))
  ) stored;

create index idx_providers_search_text on public.providers using gin(search_text);
```

This enables future clustering of search intents without reprocessing history, and powers the pg_trgm fallback on `name` and `description_pt` in Portuguese.

---

## Data Intelligence (Market Gap Detection)

Every search is logged. Zero-result searches are the signal.

```ts
// Logged for every search
{
  query_text: string,
  results_count: number,     // 0 = market gap signal
  bairro_filter_id: uuid,    // which area had the gap
  query_embedding: vector,   // for future intent clustering
  user_id: uuid | null,
  created_at: timestamp
}
```

### What This Enables

- **Admin dashboard:** "What are people searching for that has no providers?"
- **Geographic gap map:** Bairro X has 12 searches for "chaveiro" but 0 providers → sales lead
- **Category discovery:** "dedetização" appears 20× in zero-result queries → add as category
- **Demand before supply:** Validate new category decisions with real search data

**Portfolio story:** Every failed search is a lead generation opportunity. The search module feeds behavioral data back into the business.

---

## Testing Strategy

Integration tests against a real Supabase test project. No mocks — consistent with project testing philosophy.

### Seed Data (created before tests run)

```
Provider A: "João Elétrica" — category: Eletricista — bairro: Centro — serves: [Centro, Movelar]
Provider B: "Maria Cabelos" — category: Cabeleireiro — bairro: Shell — serves: [Shell, Colina]
Provider C: "Limpeza Total" — category: Diarista — bairro: Centro — serves: [Centro]
Provider D: "Carlos Encanamentos" — category: Encanador — bairro: Movelar — serves: [Movelar, Centro]
```

### Test Cases

| # | Input | Options | Expected result | Pass condition |
|---|-------|---------|-----------------|----------------|
| 1 | `"consertar chuveiro"` | none | Provider A and/or D | Both electrician and plumber appear; A or D is rank 1 |
| 2 | `"cabeleireira"` | `{ bairroId: Shell.id }` | Provider B only | B appears; A, C, D do not appear |
| 3 | `"cabeleireira"` | `{ bairroId: Centro.id }` | Empty or no B | B does not appear (doesn't serve Centro) |
| 4 | `"xyz123irrelevant@@##"` | none | `[]` | Returns empty array AND `search_queries` table has 1 new row with `results_count: 0` |
| 5 | `"consertar chuveiro"` | none (OpenAI key set to invalid) | Provider A or D | Returns results via pg_trgm fallback; `similarity_score: 0` on all results |
| 6 | `"chaveiro"` | `{ bairroId: Centro.id }` | `[]` | Zero-result log row has `bairro_filter_id: Centro.id` populated |

### EmbeddingProvider Contract Test

```ts
// Not an integration test — call OpenAI directly
const provider = new OpenAIEmbeddingProvider()
const vector = await provider.embed("João Silva Elétrica. Eletricista. Bairro: Centro")
expect(vector).toHaveLength(1536)
expect(vector.every(n => typeof n === "number")).toBe(true)
```

---

## Out of Scope

- BM25 / Reciprocal Rank Fusion — add later if search quality is a real problem
- LLM reranking (Cohere Rerank API) — not needed at launch scale
- QMD local tool — useful for dev experimentation only, not in production path
- Real-time streaming search results
- Search autocomplete / suggestions
