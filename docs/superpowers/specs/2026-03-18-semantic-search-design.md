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
```

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
     │                                   + bairroId filter (if provided)
     │                                   → ranked Provider[]
     │
     └─ OpenAI unavailable ────────────► pg_trgm full-text fallback
                                         → Provider[]
     │
     ▼
4. log to search_queries (always)       query text, results count, bairro filter,
                                        query embedding (if available)
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

- **After admin saves a listing** — `POST /api/admin/providers/[id]/embed` called inline
- **After provider self-registers** — same endpoint called automatically on save
- **Batch backfill** — `POST /api/admin/providers/embed-all` retries all where `embedding IS NULL`

Providers saved without an embedding (e.g., OpenAI unavailable) get `status: needs_embedding` and are still visible but excluded from vector search until re-embedded. They remain findable via pg_trgm fallback.

---

## Schema

No migration needed for the providers table — `vector(1536)` and HNSW index already defined in `001_initial_schema.sql`.

One addition to `search_queries` table:

```sql
alter table public.search_queries
  add column query_embedding vector(1536);
```

This enables future clustering of search intents (50 different phrasings of "eletricista" grouped together) without reprocessing history.

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

| Test | Assertion |
|------|-----------|
| `search("consertar chuveiro")` | Returns electricians/plumbers, ranked by relevance |
| `search("cabeleireira", { bairroId })` | Returns only providers who serve that bairro |
| `search("xyz123irrelevant")` | Returns `[]` AND logs a zero-result entry to DB |
| `search(...)` with OpenAI unavailable | Falls back to pg_trgm, still returns results |
| `embed("João Silva Elétrica...")` | Returns array of length 1536 |
| Zero-result query with bairroId | bairro_filter_id populated in search_queries log |

Seed data: 4 providers across known categories (eletricista, cabeleireiro, diarista, encanador) in known bairros. Tests assert ordering, not just presence.

---

## Out of Scope

- BM25 / Reciprocal Rank Fusion — add later if search quality is a real problem
- LLM reranking (Cohere Rerank API) — not needed at launch scale
- QMD local tool — useful for dev experimentation only, not in production path
- Real-time streaming search results
- Search autocomplete / suggestions
