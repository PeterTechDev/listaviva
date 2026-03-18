# Semantic Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI-powered semantic search to Listaviva so consumers can query in natural language and see ranked provider results.

**Architecture:** A `/[locale]/search` Server Component page calls `searchProviders()` in `src/lib/search.ts`, which embeds the query via OpenAI `text-embedding-3-small`, calls a `match_providers` Supabase RPC for cosine similarity, falls back to trigram `.ilike()` on zero results, logs queries, and returns enriched provider data. Embeddings are generated on provider create/update and can be batch-backfilled via an admin API route.

**Tech Stack:** Next.js 16 App Router, Supabase pgvector (provisioned), OpenAI `text-embedding-3-small`, Vitest + vite-tsconfig-paths (first tests in this project).

**Spec:** `docs/superpowers/specs/2026-03-18-semantic-search-design.md`

---

## File Map

| File | Action |
|---|---|
| `package.json` | Modify — add `openai` (prod), `vitest` / `vite-tsconfig-paths` / `@vitest/coverage-v8` (dev) |
| `vitest.config.ts` | Create — Vitest config with path aliases |
| `supabase/migrations/003_search_rpc.sql` | Create — `match_providers` RPC |
| `src/lib/embeddings.ts` | Create — `embedText` + `buildProviderText` |
| `src/lib/embeddings.test.ts` | Create — unit tests for `embedText` |
| `src/lib/search.ts` | Create — full search pipeline |
| `src/lib/search.test.ts` | Create — unit tests for search pipeline |
| `src/app/api/admin/embed-providers/route.ts` | Create — batch embed route |
| `src/app/[locale]/search/page.tsx` | Create — results page |
| `src/app/[locale]/admin/providers/actions.ts` | Modify — add embedding after create/update |
| `src/app/[locale]/account/actions.ts` | Modify — add embedding in createOwnProvider (before redirect) and updateOwnProvider |
| `src/app/[locale]/page.tsx` | Modify — wire search form to `/search` |
| `src/app/[locale]/category/[slug]/page.tsx` | Modify — add compact search bar |
| `messages/pt-BR.json` | Modify — add `search` namespace |
| `messages/en.json` | Modify — add `search` namespace |

---

## Task 1: Install packages and configure Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install production and dev dependencies**

```bash
npm install openai && npm install -D vitest vite-tsconfig-paths @vitest/coverage-v8
```

- [ ] **Step 2: Verify `@/*` path alias exists in `tsconfig.json`**

Check that `tsconfig.json` has `"paths": { "@/*": ["./src/*"] }`. It does — confirmed in the existing config.

- [ ] **Step 3: Create `vitest.config.ts` at project root**

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: { environment: "node", globals: true },
});
```

- [ ] **Step 4: Verify Vitest runs (no tests yet)**

```bash
npx vitest run
```

Expected: "No test files found" or exit 0.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "feat: add openai and vitest dependencies (issue #10)"
```

---

## Task 2: Create the DB migration for `match_providers` RPC

**Files:**
- Create: `supabase/migrations/003_search_rpc.sql`

Migration history: `001_initial_schema.sql` (base schema), `002_claim_requests.sql` (claims feature). This migration is `003`. The `vector` extension, `pg_trgm` extension, `providers.embedding vector(1536)` column with HNSW index, and `search_queries` table are already in `001_initial_schema.sql`. This migration adds only the RPC function.

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/003_search_rpc.sql
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

- [ ] **Step 2: Apply the migration via Supabase MCP**

Use the `mcp__plugin_supabase_supabase__apply_migration` tool with:
- `project_id`: the Listaviva project ID (check `src/lib/supabase/server.ts` or `.env.local` for `NEXT_PUBLIC_SUPABASE_URL`)
- `name`: `003_search_rpc`
- `query`: the SQL above

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/003_search_rpc.sql
git commit -m "feat: add match_providers RPC for semantic search (issue #10)"
```

---

## Task 3: Create `src/lib/embeddings.ts` with tests

**Files:**
- Create: `src/lib/embeddings.ts`
- Create: `src/lib/embeddings.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `src/lib/embeddings.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Capture mockCreate at module scope — vi.mock is hoisted before imports,
// so this reference is the same instance used inside embeddings.ts
const mockCreate = vi.fn();
vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    embeddings: { create: mockCreate },
  })),
}));

import { embedText, buildProviderText } from "./embeddings";

describe("embedText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a number[] on success", async () => {
    const fakeEmbedding = [0.1, 0.2, 0.3];
    mockCreate.mockResolvedValueOnce({
      data: [{ embedding: fakeEmbedding }],
    });
    const result = await embedText("test query");
    expect(result).toEqual(fakeEmbedding);
    expect(Array.isArray(result)).toBe(true);
  });

  it("slices input to 8192 chars before calling the API", async () => {
    const longInput = "x".repeat(10000);
    mockCreate.mockResolvedValueOnce({
      data: [{ embedding: [0.1] }],
    });
    await embedText(longInput);
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.input.length).toBe(8192);
  });

  it("re-throws when the OpenAI client throws", async () => {
    mockCreate.mockRejectedValueOnce(new Error("API error"));
    await expect(embedText("test")).rejects.toThrow("API error");
  });
});

describe("buildProviderText", () => {
  it("joins name, description, and category names", () => {
    const result = buildProviderText("João", "Encanador experiente", ["Encanamento", "Reformas"]);
    expect(result).toBe("João Encanador experiente Encanamento Reformas");
  });

  it("omits null description", () => {
    const result = buildProviderText("Maria", null, ["Limpeza"]);
    expect(result).toBe("Maria Limpeza");
  });

  it("works with no categories", () => {
    const result = buildProviderText("Pedro", "Eletricista", []);
    expect(result).toBe("Pedro Eletricista");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/embeddings.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/lib/embeddings.ts`**

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

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/embeddings.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/embeddings.ts src/lib/embeddings.test.ts
git commit -m "feat: add embedText and buildProviderText with tests (issue #10)"
```

---

## Task 4: Create `src/lib/search.ts` with tests

**Files:**
- Create: `src/lib/search.ts`
- Create: `src/lib/search.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/search.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchProviders } from "./search";

vi.mock("./embeddings", () => ({
  embedText: vi.fn(),
}));

import { embedText } from "./embeddings";
const mockEmbedText = embedText as ReturnType<typeof vi.fn>;

// Factory: builds a Supabase mock.
// The `from("providers")` table is called twice in the fallback path (fallback ilike query,
// then enrich query), but only once in the semantic path (enrich query only).
// We discriminate by which chainable method is called first after .select():
//   - fallback path calls .eq("status", "active") then .or(...)
//   - enrich path calls .in("id", [...])
// We detect this by tracking whether .in() is called on the builder.
function makeSupabase({
  rpcData = [] as unknown[],
  fallbackData = [] as unknown[],
  enrichData = [] as unknown[],
} = {}) {
  const insertMock = vi.fn().mockResolvedValue({ error: null });

  function makeProviderBuilder(data: unknown[]) {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "or", "ilike"]) {
      b[m] = vi.fn().mockReturnValue(b);
    }
    // .in() signals the enrich query — return enrichData
    b["in"] = vi.fn().mockImplementation(() => {
      const eb: Record<string, unknown> = {};
      eb.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: enrichData, error: null }).then(resolve);
      return eb;
    });
    b.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data, error: null }).then(resolve);
    return b;
  }

  return {
    rpc: vi.fn().mockResolvedValue({ data: rpcData, error: null }),
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "search_queries") {
        return { insert: insertMock };
      }
      if (table === "providers") {
        // Both fallback and enrich go through this branch.
        // The enrich path calls .in() which returns enrichData.
        // The fallback path chains .eq().or() and resolves via .then with fallbackData.
        return makeProviderBuilder(fallbackData);
      }
      return {};
    }),
    _insertMock: insertMock,
  };
}

const FAKE_EMBEDDING = [0.1, 0.2, 0.3];
const FAKE_PROVIDER = {
  id: "p1",
  name: "João Eletricista",
  slug: "joao-eletricista",
  description_pt: "Serviços elétricos",
  whatsapp: "27999999999",
  home_bairro: { name: "Centro", slug: "centro" },
  categories: [{ categories: { name_pt: "Eletricidade", name_en: null, icon: "⚡" } }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockEmbedText.mockResolvedValue(FAKE_EMBEDDING);
});

describe("searchProviders — semantic path", () => {
  it("returns results and usedFallback=false when RPC finds matches", async () => {
    const rpcRow = { id: "p1" };
    const supabase = makeSupabase({ rpcData: [rpcRow], enrichData: [FAKE_PROVIDER] });

    const { results, usedFallback } = await searchProviders({
      query: "eletricista",
      supabase: supabase as any,
    });

    expect(usedFallback).toBe(false);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("p1");
    expect(results[0].name).toBe("João Eletricista");
  });

  it("calls RPC with bairro_filter when bairroId is provided", async () => {
    const supabase = makeSupabase({ rpcData: [{ id: "p1" }], enrichData: [FAKE_PROVIDER] });

    await searchProviders({
      query: "eletricista",
      bairroId: "bairro-uuid",
      supabase: supabase as any,
    });

    expect(supabase.rpc).toHaveBeenCalledWith("match_providers", expect.objectContaining({
      bairro_filter: "bairro-uuid",
    }));
  });

  it("logs query with results_count > 0", async () => {
    const supabase = makeSupabase({ rpcData: [{ id: "p1" }], enrichData: [FAKE_PROVIDER] });

    await searchProviders({ query: "eletricista", supabase: supabase as any });

    expect(supabase._insertMock).toHaveBeenCalledWith(expect.objectContaining({
      query_text: "eletricista",
      results_count: 1,
    }));
  });
});

describe("searchProviders — fallback path", () => {
  it("uses trigram fallback when RPC returns empty", async () => {
    const supabase = makeSupabase({ rpcData: [], fallbackData: [FAKE_PROVIDER], enrichData: [FAKE_PROVIDER] });

    const { results, usedFallback } = await searchProviders({
      query: "eletricista",
      supabase: supabase as any,
    });

    expect(usedFallback).toBe(true);
    expect(results).toHaveLength(1);
  });

  it("uses trigram fallback when embedText throws", async () => {
    mockEmbedText.mockRejectedValueOnce(new Error("OpenAI down"));
    const supabase = makeSupabase({ fallbackData: [FAKE_PROVIDER], enrichData: [FAKE_PROVIDER] });

    const { usedFallback } = await searchProviders({
      query: "eletricista",
      supabase: supabase as any,
    });

    expect(usedFallback).toBe(true);
  });

  it("does not throw to caller when embedText fails", async () => {
    mockEmbedText.mockRejectedValueOnce(new Error("OpenAI down"));
    const supabase = makeSupabase({ fallbackData: [], enrichData: [] });

    await expect(
      searchProviders({ query: "test", supabase: supabase as any })
    ).resolves.not.toThrow();
  });
});

describe("searchProviders — zero results", () => {
  it("logs results_count: 0 on empty semantic results with no fallback data", async () => {
    const supabase = makeSupabase({ rpcData: [], fallbackData: [], enrichData: [] });

    await searchProviders({ query: "xyz", supabase: supabase as any });

    expect(supabase._insertMock).toHaveBeenCalledWith(expect.objectContaining({
      results_count: 0,
    }));
  });

  it("returns empty results array on zero results", async () => {
    const supabase = makeSupabase({ rpcData: [], fallbackData: [], enrichData: [] });
    const { results } = await searchProviders({ query: "xyz", supabase: supabase as any });
    expect(results).toEqual([]);
  });
});

describe("searchProviders — logging", () => {
  it("passes userId to the insert", async () => {
    const supabase = makeSupabase({ rpcData: [{ id: "p1" }], enrichData: [FAKE_PROVIDER] });

    await searchProviders({
      query: "test",
      userId: "user-uuid",
      supabase: supabase as any,
    });

    expect(supabase._insertMock).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "user-uuid",
    }));
  });

  it("does not throw when logging insert fails (RLS policy violation)", async () => {
    const supabase = makeSupabase({ rpcData: [], fallbackData: [] });
    supabase._insertMock.mockRejectedValueOnce(new Error("RLS policy violation"));

    await expect(
      searchProviders({ query: "test", supabase: supabase as any })
    ).resolves.not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/search.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/lib/search.ts`**

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

  // Semantic path: embed query then call pgvector RPC
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

  // Trigram fallback: description_pt is plain text, not tsvector — use .ilike()
  if (usedFallback) {
    let q = supabase
      .from("providers")
      .select("id")
      .eq("status", "active")
      .or(`name.ilike.%${query}%,description_pt.ilike.%${query}%`);
    if (bairroId) q = (q as any).eq("home_bairro_id", bairroId);
    const { data: fallbackRows } = await (q as any);
    resultIds = ((fallbackRows ?? []) as { id: string }[]).map((r) => r.id);
  }

  // Log query — anonymous users get RLS policy violation, swallowed intentionally
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

  // Enrich: fetch bairro + categories for the result IDs
  // provider_categories returns [{ categories: { name_pt, name_en, icon } }] — must flatten
  const { data: enriched } = await (supabase
    .from("providers")
    .select(`
      id, name, slug, description_pt, whatsapp,
      home_bairro:bairros(name, slug),
      categories:provider_categories(categories(name_pt, name_en, icon))
    `)
    .in("id", resultIds) as any);

  const results: ProviderSearchResult[] = ((enriched ?? []) as any[]).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description_pt: row.description_pt,
    whatsapp: row.whatsapp,
    home_bairro: Array.isArray(row.home_bairro) ? (row.home_bairro[0] ?? null) : (row.home_bairro ?? null),
    // Flatten nested provider_categories → categories junction
    categories: (row.categories ?? []).flatMap(
      (pc: { categories: unknown }) =>
        Array.isArray(pc.categories)
          ? pc.categories
          : pc.categories
          ? [pc.categories]
          : []
    ) as { name_pt: string; name_en: string | null; icon: string | null }[],
  }));

  return { results, usedFallback };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/search.test.ts
```

Expected: all tests PASS. Fix any failures before continuing.

- [ ] **Step 5: Run all tests to confirm nothing broke**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/search.ts src/lib/search.test.ts
git commit -m "feat: add searchProviders with semantic and trigram fallback (issue #10)"
```

---

## Task 5: Wire embedding generation into admin provider actions

**Files:**
- Modify: `src/app/[locale]/admin/providers/actions.ts`

The embedding block must be appended at the **end** of `createProvider` (before its `return { success: true, id: providerId }`) and `updateProvider` (before its `return { success: true }`). Both functions do NOT call `redirect()`, so placement at the very end is safe.

- [ ] **Step 1: Add import to `actions.ts`**

At the top of `src/app/[locale]/admin/providers/actions.ts`, add:

```ts
import { buildProviderText, embedText } from "@/lib/embeddings";
```

- [ ] **Step 2: Add embedding block to `createProvider`**

After the `if (photo_urls.length > 0) { ... }` block (line ~77) and before the `revalidatePath` calls at lines 79-81, insert:

```ts
  // Generate embedding — failure is non-blocking
  try {
    const { data: cats } = await supabase
      .from("provider_categories")
      .select("categories(name_pt)")
      .eq("provider_id", providerId);
    const catNames = (cats ?? []).flatMap((c: { categories: unknown }) =>
      Array.isArray(c.categories)
        ? (c.categories as { name_pt: string }[]).map((x) => x.name_pt)
        : c.categories
        ? [(c.categories as { name_pt: string }).name_pt]
        : []
    );
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

- [ ] **Step 3: Add the same embedding block to `updateProvider`**

After the `if (photo_urls.length > 0) { ... }` block for `updateProvider` (around line ~150) and before the `revalidatePath` calls, insert the same block — but use `id` as the variable name (not `providerId`):

```ts
  // Generate embedding — failure is non-blocking
  try {
    const { data: cats } = await supabase
      .from("provider_categories")
      .select("categories(name_pt)")
      .eq("provider_id", id);
    const catNames = (cats ?? []).flatMap((c: { categories: unknown }) =>
      Array.isArray(c.categories)
        ? (c.categories as { name_pt: string }[]).map((x) => x.name_pt)
        : c.categories
        ? [(c.categories as { name_pt: string }).name_pt]
        : []
    );
    const text = buildProviderText(name, description_pt ?? null, catNames);
    const embedding = await embedText(text);
    await supabase
      .from("providers")
      .update({ embedding: JSON.stringify(embedding) })
      .eq("id", id);
  } catch {
    // non-blocking
  }
```

- [ ] **Step 4: Run build to verify no type errors**

```bash
npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/\[locale\]/admin/providers/actions.ts
git commit -m "feat: generate embeddings on admin provider create/update (issue #10)"
```

---

## Task 6: Wire embedding generation into account (self-service) actions

**Files:**
- Modify: `src/app/[locale]/account/actions.ts`

**Critical:** In `createOwnProvider`, the embedding block must go **before** the `redirect("/account")` call on line 82, because `redirect()` throws and terminates execution. In `updateOwnProvider`, the block can go at the very end.

- [ ] **Step 1: Add import to account actions**

At the top of `src/app/[locale]/account/actions.ts`, add:

```ts
import { buildProviderText, embedText } from "@/lib/embeddings";
```

- [ ] **Step 2: Add embedding block in `createOwnProvider` before `redirect("/account")`**

The current end of `createOwnProvider` is (lines 76-82):

```ts
  // Upgrade role to provider
  await supabase
    .from("profiles")
    .update({ role: "provider" })
    .eq("id", user.id);

  redirect("/account");
```

Insert the embedding block **between** the role upgrade and the redirect:

```ts
  // Upgrade role to provider
  await supabase
    .from("profiles")
    .update({ role: "provider" })
    .eq("id", user.id);

  // Generate embedding — non-blocking, must be before redirect()
  try {
    const { data: cats } = await supabase
      .from("provider_categories")
      .select("categories(name_pt)")
      .eq("provider_id", providerId);
    const catNames = (cats ?? []).flatMap((c: { categories: unknown }) =>
      Array.isArray(c.categories)
        ? (c.categories as { name_pt: string }[]).map((x) => x.name_pt)
        : c.categories
        ? [(c.categories as { name_pt: string }).name_pt]
        : []
    );
    const text = buildProviderText(name, description_pt ?? null, catNames);
    const embedding = await embedText(text);
    await supabase
      .from("providers")
      .update({ embedding: JSON.stringify(embedding) })
      .eq("id", providerId);
  } catch {
    // non-blocking
  }

  redirect("/account");
```

- [ ] **Step 3: Add embedding block at end of `updateOwnProvider`**

After the `revalidatePath` call at line 155, append:

```ts
  // Generate embedding — non-blocking
  try {
    const { data: cats } = await supabase
      .from("provider_categories")
      .select("categories(name_pt)")
      .eq("provider_id", providerId);
    const catNames = (cats ?? []).flatMap((c: { categories: unknown }) =>
      Array.isArray(c.categories)
        ? (c.categories as { name_pt: string }[]).map((x) => x.name_pt)
        : c.categories
        ? [(c.categories as { name_pt: string }).name_pt]
        : []
    );
    const text = buildProviderText(name, description_pt ?? null, catNames);
    const embedding = await embedText(text);
    await supabase
      .from("providers")
      .update({ embedding: JSON.stringify(embedding) })
      .eq("id", providerId)
      .eq("user_id", user.id);
  } catch {
    // non-blocking
  }
```

- [ ] **Step 4: Run build**

```bash
npm run build
```

Expected: success.

- [ ] **Step 5: Commit**

```bash
git add src/app/\[locale\]/account/actions.ts
git commit -m "feat: generate embeddings on self-service provider create/update (issue #10)"
```

---

## Task 7: Create the batch embed API route

**Files:**
- Create: `src/app/api/admin/embed-providers/route.ts`

This route is called manually (e.g., `curl`) to backfill embeddings for providers that were created before this feature. It uses the Supabase service-role key directly and is protected by a `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` header check.

- [ ] **Step 1: Create the route**

```ts
// src/app/api/admin/embed-providers/route.ts
import { createClient } from "@supabase/supabase-js";
import { embedText, buildProviderText } from "@/lib/embeddings";

export const runtime = "nodejs";

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
      const catNames = (
        (provider as any).provider_categories ?? []
      ).flatMap((pc: { categories: unknown }) =>
        Array.isArray(pc.categories)
          ? (pc.categories as { name_pt: string }[]).map((c) => c.name_pt)
          : pc.categories
          ? [(pc.categories as { name_pt: string }).name_pt]
          : []
      );
      const text = buildProviderText(
        provider.name,
        (provider as any).description_pt ?? null,
        catNames
      );
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

- [ ] **Step 2: Run build to verify no errors**

```bash
npm run build
```

Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/embed-providers/route.ts
git commit -m "feat: add batch embed route for existing providers (issue #10)"
```

---

## Task 8: Add translation keys

**Files:**
- Modify: `messages/pt-BR.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Add `search` namespace to `messages/pt-BR.json`**

Add this block after the `"adminClaims"` section (before the closing `}`):

```json
  "search": {
    "title": "Busca",
    "noResults": "Nenhum prestador encontrado",
    "resultsFor": "Resultados para \"{q}\"",
    "filterBairro": "Filtrar por bairro",
    "allBairros": "Todos os bairros",
    "tryWithout": "Tente sem filtro de bairro"
  }
```

Note: `search.placeholder` is intentionally omitted — the existing `common.searchPlaceholder` covers the input placeholder.

- [ ] **Step 2: Add `search` namespace to `messages/en.json`**

Add the same block (English):

```json
  "search": {
    "title": "Search",
    "noResults": "No providers found",
    "resultsFor": "Results for \"{q}\"",
    "filterBairro": "Filter by neighborhood",
    "allBairros": "All neighborhoods",
    "tryWithout": "Try without neighborhood filter"
  }
```

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: success.

- [ ] **Step 4: Commit**

```bash
git add messages/pt-BR.json messages/en.json
git commit -m "feat: add search translation keys (issue #10)"
```

---

## Task 9: Create the `/[locale]/search` results page

**Files:**
- Create: `src/app/[locale]/search/page.tsx`

The page is a Server Component. It reads `searchParams.q` and `searchParams.bairro_id`, calls `searchProviders()`, and renders results. Cards match the catalog page style.

- [ ] **Step 1: Create the page**

```tsx
// src/app/[locale]/search/page.tsx
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/header";
import { createClient } from "@/lib/supabase/server";
import { searchProviders } from "@/lib/search";
import { getCurrentUser } from "@/lib/auth";

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; bairro_id?: string }>;
}) {
  const { locale } = await params;
  const { q, bairro_id } = await searchParams;

  if (!q?.trim()) redirect("/");

  const t = await getTranslations({ locale });
  const supabase = await createClient();
  const user = await getCurrentUser();

  // Fetch all bairros for the filter dropdown
  const { data: bairros } = await supabase
    .from("bairros")
    .select("id, name, slug")
    .order("name");

  const { results, usedFallback } = await searchProviders({
    query: q,
    bairroId: bairro_id || null,
    userId: user?.id || null,
    supabase,
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {t("search.resultsFor", { q })}
        </h1>

        {usedFallback && results.length > 0 && (
          <p className="text-sm text-gray-400 mb-4">
            {/* Semantic search fell back to text search */}
          </p>
        )}

        {/* Bairro filter */}
        <form method="GET" className="mb-6 flex items-center gap-3">
          <input type="hidden" name="q" value={q} />
          <label className="text-sm text-gray-600">{t("search.filterBairro")}</label>
          {/* onChange omitted — submit via the noscript button; JS auto-submit is out of scope */}
          <select
            name="bairro_id"
            defaultValue={bairro_id ?? ""}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">{t("search.allBairros")}</option>
            {(bairros ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <noscript>
            <button type="submit" className="text-sm text-emerald-600 underline">
              {t("common.search")}
            </button>
          </noscript>
        </form>

        {results.length === 0 ? (
          <div className="py-20 text-center text-gray-400">
            <div className="text-5xl mb-4">🔍</div>
            <p className="mb-2">{t("search.noResults")}</p>
            {bairro_id && (
              <Link
                href={`/search?q=${encodeURIComponent(q)}`}
                className="text-sm text-emerald-600 underline"
              >
                {t("search.tryWithout")}
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((provider) => (
              <div
                key={provider.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="p-4">
                  <Link
                    href={`/provider/${provider.slug}`}
                    className="font-semibold text-gray-900 hover:text-emerald-700 transition-colors"
                  >
                    {provider.name}
                  </Link>
                  {provider.home_bairro && (
                    <p className="text-xs text-emerald-600 mt-0.5">
                      📍 {provider.home_bairro.name}
                    </p>
                  )}
                  {provider.categories.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {provider.categories.map((cat) => (
                        <span
                          key={cat.name_pt}
                          className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full"
                        >
                          {cat.icon && <span className="mr-1">{cat.icon}</span>}
                          {cat.name_pt}
                        </span>
                      ))}
                    </div>
                  )}
                  {provider.description_pt && (
                    <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                      {provider.description_pt}
                    </p>
                  )}
                  {provider.whatsapp && (
                    <a
                      href={`https://wa.me/${provider.whatsapp.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
                    >
                      {t("provider.contactWhatsApp")}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-gray-100 py-6">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-gray-400">
          {t("common.appName")} &mdash; {t("common.tagline")}
        </div>
      </footer>
    </div>
  );
}
```

**Notes:**
- `getTranslations({ locale })` is called without a namespace so all cross-namespace keys (`provider.contactWhatsApp`, `common.search`, `search.resultsFor`) work via full dot-path access. Do **not** add `namespace: "search"` — it would break the cross-namespace calls.
- The bairro `<select>` has no `onChange` — form submission requires the submit button below the select. Auto-submit on select change would require a client component wrapper (out of scope).
- `search.title` is used as the HTML page `<title>` via `generateMetadata`. Add this before the default export:

```tsx
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: `${t("search.title")} — ${t("common.appName")}` };
}
```

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: success. Fix any TypeScript errors before committing.

- [ ] **Step 3: Commit**

```bash
git add src/app/\[locale\]/search/page.tsx
git commit -m "feat: add /search results page (issue #10)"
```

---

## Task 10: Wire homepage search form and catalog search bar

**Files:**
- Modify: `src/app/[locale]/page.tsx`
- Modify: `src/app/[locale]/category/[slug]/page.tsx`

### Homepage

The existing search `<input>` and `<button>` on the homepage are currently inert. Wrap them in a `<form>` that GETs `/[locale]/search`.

- [ ] **Step 1: Modify the homepage search bar in `src/app/[locale]/page.tsx`**

Find the search bar section (around line 36-47):

```tsx
          {/* Search bar */}
          <div className="mt-8 max-w-xl mx-auto">
            <div className="relative">
              <input
                type="text"
                placeholder={t("common.searchPlaceholder")}
                className="w-full h-12 pl-4 pr-12 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
              />
              <button className="absolute right-2 top-2 h-8 px-4 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors">
                {t("common.search")}
              </button>
            </div>
          </div>
```

Replace with:

```tsx
          {/* Search bar — GET form, no JS required */}
          <form
            method="GET"
            action={`/${locale}/search`}
            className="mt-8 max-w-xl mx-auto"
          >
            <div className="relative">
              <input
                type="text"
                name="q"
                placeholder={t("common.searchPlaceholder")}
                className="w-full h-12 pl-4 pr-12 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
              />
              <button
                type="submit"
                className="absolute right-2 top-2 h-8 px-4 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
              >
                {t("common.search")}
              </button>
            </div>
          </form>
```

### Catalog page

Add a compact search bar above the provider grid.

- [ ] **Step 2: Add search bar to `CategoryPageLayout` in `src/app/[locale]/category/[slug]/page.tsx`**

In the `CategoryPageLayout` function, the props destructuring needs a `locale` prop (already there). Add a search bar below the bairro filter row (around line 224).

After the closing `</div>` of the `<div className="flex flex-col sm:flex-row...">` section (around line 223), insert:

```tsx
        {/* Compact search bar */}
        <form
          method="GET"
          action={`/${locale}/search`}
          className="mb-6 flex gap-2"
        >
          <input
            type="text"
            name="q"
            placeholder={t("common.searchPlaceholder")}
            className="flex-1 h-9 px-3 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="submit"
            className="h-9 px-4 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
          >
            {t("common.search")}
          </button>
        </form>
```

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: success.

- [ ] **Step 4: Commit**

```bash
git add src/app/\[locale\]/page.tsx src/app/\[locale\]/category/\[slug\]/page.tsx
git commit -m "feat: wire search form on homepage and catalog page (issue #10)"
```

---

## Task 11: Run all tests and final build check

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 2: Run final build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 3: Close the GitHub issue**

```bash
gh issue close 10 --comment "Semantic search implemented: pgvector RPC with OpenAI text-embedding-3-small, trigram fallback, query logging, /search results page, and tests."
```

