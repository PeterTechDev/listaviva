# Community Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow authenticated consumers to recommend providers via a form; admins approve submissions which auto-create live provider listings.

**Architecture:** A new `/[locale]/account/recommend` page (Server Component + Client form) submits to a server action that inserts a `pending` recommendation. An admin queue at `/[locale]/admin/recommendations` lets admins approve (creates a provider + links category) or reject (marks closed). One migration adds `category_id` FK to the existing `recommendations` table.

**Tech Stack:** Next.js 16 App Router, Supabase, next-intl, Vitest, TypeScript, Tailwind CSS.

---

## File Map

| File | Action |
|---|---|
| `supabase/migrations/004_recommendations_category.sql` | Create |
| `messages/pt-BR.json` | Modify — add `recommendations` namespace |
| `messages/en.json` | Modify — add `recommendations` namespace |
| `src/app/[locale]/account/recommend/actions.ts` | Create |
| `src/app/[locale]/account/recommend/actions.test.ts` | Create |
| `src/app/[locale]/account/recommend/RecommendForm.tsx` | Create |
| `src/app/[locale]/account/recommend/page.tsx` | Create |
| `src/app/[locale]/account/page.tsx` | Modify — add recommend link |
| `src/app/[locale]/admin/recommendations/actions.ts` | Create |
| `src/app/[locale]/admin/recommendations/actions.test.ts` | Create |
| `src/app/[locale]/admin/recommendations/RecommendationsManager.tsx` | Create |
| `src/app/[locale]/admin/recommendations/page.tsx` | Create |
| `src/app/[locale]/admin/layout.tsx` | Modify — add nav link |

---

### Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/004_recommendations_category.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/004_recommendations_category.sql
alter table public.recommendations
  add column category_id uuid references public.categories on delete set null;
```

- [ ] **Step 2: Apply the migration**

Run:
```bash
npx supabase db push
```

Expected: Migration applied successfully. If `supabase` CLI is not available, apply via the Supabase dashboard SQL editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/004_recommendations_category.sql
git commit -m "feat: add category_id FK to recommendations table"
```

---

### Task 2: Translation Keys

**Files:**
- Modify: `messages/pt-BR.json`
- Modify: `messages/en.json`

The `admin.recommendations` key already exists in both files — only the new `recommendations` namespace needs to be added.

- [ ] **Step 1: Add recommendations namespace to `messages/pt-BR.json`**

Add after the `"adminClaims"` block (before the `"search"` block):

```json
  "recommendations": {
    "recommend": "Recomendar prestador",
    "recommendDesc": "Conhece um bom prestador? Indique-o aqui.",
    "providerName": "Nome do prestador",
    "category": "Categoria",
    "whatsapp": "WhatsApp",
    "bairro": "Bairro",
    "description": "Descrição (opcional)",
    "submit": "Enviar indicação",
    "title": "Indicações",
    "empty": "Nenhuma indicação pendente",
    "approve": "Aprovar",
    "reject": "Rejeitar",
    "submitter": "Enviado por",
    "date": "Data"
  },
```

- [ ] **Step 2: Add recommendations namespace to `messages/en.json`**

Add after the `"adminClaims"` block (before the `"search"` block):

```json
  "recommendations": {
    "recommend": "Recommend a provider",
    "recommendDesc": "Know a good provider? Recommend them here.",
    "providerName": "Provider name",
    "category": "Category",
    "whatsapp": "WhatsApp",
    "bairro": "Neighborhood",
    "description": "Description (optional)",
    "submit": "Submit recommendation",
    "title": "Recommendations",
    "empty": "No pending recommendations",
    "approve": "Approve",
    "reject": "Reject",
    "submitter": "Submitted by",
    "date": "Date"
  },
```

- [ ] **Step 3: Commit**

```bash
git add messages/pt-BR.json messages/en.json
git commit -m "feat: add recommendations translation namespace"
```

---

### Task 3: Consumer Action Tests (TDD — write first)

**Files:**
- Create: `src/app/[locale]/account/recommend/actions.test.ts`

The test file must exist before the action file. Tests mock the Supabase client and `next/navigation` redirect.

- [ ] **Step 1: Create the test file**

```ts
// src/app/[locale]/account/recommend/actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.hoisted(() => vi.fn());
const mockInsert = vi.hoisted(() => vi.fn());
const mockRedirect = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn().mockReturnValue({ insert: mockInsert }),
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

import { submitRecommendation } from "./actions";

function makeFormData(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("provider_name", "Joao Eletrica");
  fd.set("category_id", "cat-uuid");
  fd.set("whatsapp", "27999999999");
  fd.set("bairro_id", "bairro-uuid");
  fd.set("description", "Great electrician");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockInsert.mockResolvedValue({ error: null });
});

describe("submitRecommendation", () => {
  it("returns error when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const result = await submitRecommendation(
      { error: null },
      makeFormData()
    );

    expect(result).toEqual({ error: "Not authenticated" });
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("returns error when provider_name is empty", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const result = await submitRecommendation(
      { error: null },
      makeFormData({ provider_name: "" })
    );

    expect(result).toEqual({ error: "Name is required" });
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("inserts recommendation with status pending and submitted_by user id", async () => {
    const userId = "user-abc";
    mockGetUser.mockResolvedValue({ data: { user: { id: userId } } });

    await submitRecommendation({ error: null }, makeFormData());

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        submitted_by: userId,
        status: "pending",
        provider_name: "Joao Eletrica",
      })
    );
    expect(mockRedirect).toHaveBeenCalledWith("/account");
  });

  it("returns db error when insert fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockInsert.mockResolvedValue({ error: { message: "DB failure" } });

    const result = await submitRecommendation(
      { error: null },
      makeFormData()
    );

    expect(result).toEqual({ error: "DB failure" });
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail (action file doesn't exist yet)**

Run:
```bash
cd /Users/peter/personal/listaviva && npx vitest run src/app/\[locale\]/account/recommend/actions.test.ts
```

Expected: FAIL — cannot find module `./actions`

---

### Task 4: Consumer Server Action

**Files:**
- Create: `src/app/[locale]/account/recommend/actions.ts`

- [ ] **Step 1: Create the action file**

```ts
// src/app/[locale]/account/recommend/actions.ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function submitRecommendation(
  _prev: { error: string | null },
  formData: FormData
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const provider_name = (formData.get("provider_name") as string)?.trim();
  if (!provider_name) return { error: "Name is required" };

  const category_id = (formData.get("category_id") as string) || null;
  const whatsapp = (formData.get("whatsapp") as string)?.trim() || null;
  const bairro_id = (formData.get("bairro_id") as string) || null;
  const description = (formData.get("description") as string)?.trim() || null;

  const { error } = await supabase.from("recommendations").insert({
    submitted_by: user.id,
    provider_name,
    category_id,
    whatsapp,
    bairro_id,
    description,
    status: "pending",
  });

  if (error) return { error: error.message };

  redirect("/account");
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run:
```bash
cd /Users/peter/personal/listaviva && npx vitest run src/app/\[locale\]/account/recommend/actions.test.ts
```

Expected: 4 tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/\[locale\]/account/recommend/actions.ts src/app/\[locale\]/account/recommend/actions.test.ts
git commit -m "feat: add submitRecommendation server action with tests"
```

---

### Task 5: Consumer Submission UI

**Files:**
- Create: `src/app/[locale]/account/recommend/RecommendForm.tsx`
- Create: `src/app/[locale]/account/recommend/page.tsx`

- [ ] **Step 1: Create `RecommendForm.tsx` (client component)**

```tsx
// src/app/[locale]/account/recommend/RecommendForm.tsx
"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { submitRecommendation } from "./actions";

function SubmitButton() {
  const t = useTranslations("recommendations");
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
    >
      {pending ? "..." : t("submit")}
    </button>
  );
}

interface Category {
  id: string;
  name_pt: string;
}

interface Bairro {
  id: string;
  name: string;
}

export default function RecommendForm({
  categories,
  bairros,
}: {
  categories: Category[];
  bairros: Bairro[];
}) {
  const t = useTranslations("recommendations");
  const [state, formAction] = useActionState(submitRecommendation, {
    error: null,
  });

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {state.error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("providerName")} *
        </label>
        <input
          type="text"
          name="provider_name"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("category")} *
        </label>
        <select
          name="category_id"
          required
          defaultValue=""
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="" disabled>
            —
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name_pt}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("whatsapp")}
        </label>
        <input
          type="text"
          name="whatsapp"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("bairro")}
        </label>
        <select
          name="bairro_id"
          defaultValue=""
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">—</option>
          {bairros.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("description")}
        </label>
        <textarea
          name="description"
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <SubmitButton />
    </form>
  );
}
```

- [ ] **Step 2: Create `page.tsx` (Server Component wrapper)**

```tsx
// src/app/[locale]/account/recommend/page.tsx
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/header";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import RecommendForm from "./RecommendForm";

export default async function RecommendPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const t = await getTranslations({ locale, namespace: "recommendations" });
  const supabase = await createClient();

  const [{ data: categories }, { data: bairros }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name_pt")
      .order("sort_order"),
    supabase.from("bairros").select("id, name").order("name"),
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-lg mx-auto px-4 py-12 w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t("title")}</h1>
        <p className="text-sm text-gray-500 mb-8">{t("recommendDesc")}</p>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <RecommendForm
            categories={categories ?? []}
            bairros={bairros ?? []}
          />
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run:
```bash
cd /Users/peter/personal/listaviva && npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\[locale\]/account/recommend/
git commit -m "feat: add consumer recommendation form UI"
```

---

### Task 6: Add Recommend Link to Account Page

**Files:**
- Modify: `src/app/[locale]/account/page.tsx`

The account page already has a grid of cards for consumers with no provider. Add a "Recommend a provider" card to that grid. Also add a link for users who already have a provider.

- [ ] **Step 1: Add the recommend card**

In `src/app/[locale]/account/page.tsx`, the consumer section (when `provider` is null) shows a grid with "Create listing" and "Claim listing" cards. Add a third card for recommendations. Also add a link below the existing provider card for authenticated users with a provider.

The change in the `{provider ? (...) : (...)}` block:

In the `provider` truthy branch, add after the "Ver perfil público" link:
```tsx
<Link
  href="/account/recommend"
  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
>
  {t("recommendations.recommend")} →
</Link>
```

In the `!provider` branch (the grid), add a third card after the "claim" card:
```tsx
<Link
  href="/account/recommend"
  className="flex flex-col items-center gap-3 p-8 bg-white rounded-xl border-2 border-gray-200 hover:border-gray-400 hover:shadow-sm transition-all text-center"
>
  <span className="text-4xl">💡</span>
  <span className="font-semibold text-gray-900">
    {t("recommendations.recommend")}
  </span>
  <span className="text-sm text-gray-500">
    {t("recommendations.recommendDesc")}
  </span>
</Link>
```

The `t` in `account/page.tsx` is already initialised with `await getTranslations({ locale })` which loads all namespaces, so `t("recommendations.recommend")` will work.

- [ ] **Step 2: Verify build**

```bash
cd /Users/peter/personal/listaviva && npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/\[locale\]/account/page.tsx
git commit -m "feat: add recommend provider link to account page"
```

---

### Task 7: Admin Action Tests (TDD — write first)

**Files:**
- Create: `src/app/[locale]/admin/recommendations/actions.test.ts`

- [ ] **Step 1: Create the test file**

```ts
// src/app/[locale]/admin/recommendations/actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.hoisted(() => vi.fn());
const mockToSlug = vi.hoisted(() => vi.fn());
const mockEmbedText = vi.hoisted(() => vi.fn());
const mockBuildProviderText = vi.hoisted(() => vi.fn());
const mockRevalidatePath = vi.hoisted(() => vi.fn());

vi.mock("@/lib/slug", () => ({ toSlug: mockToSlug }));
vi.mock("@/lib/embeddings", () => ({
  embedText: mockEmbedText,
  buildProviderText: mockBuildProviderText,
}));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));

// --- Supabase mock factory ---
const ADMIN_USER = { id: "admin-user-id" };
const FAKE_REC = {
  id: "rec-id",
  provider_name: "Joao Eletrica",
  whatsapp: "27999",
  bairro_id: "bairro-id",
  description: "Ótimo eletricista",
  category_id: "cat-id",
  status: "pending",
};

function makeSupabase({
  recData = FAKE_REC as typeof FAKE_REC | null,
  slugExisting = null as { slug: string } | null,
  providerInsertError = null as { message: string } | null,
  providerInsertId = "new-prov-id",
} = {}) {
  // rec update chain (.update().eq())
  const recUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
  const recUpdateMock = vi.fn().mockReturnValue({ eq: recUpdateEqMock });
  const recUpdateChain = { update: recUpdateMock };

  // rec select chain (.select().eq().eq().maybeSingle())
  const recMaybeSingleMock = vi.fn().mockResolvedValue({ data: recData });
  const recSelectChain = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle: recMaybeSingleMock }),
      }),
    }),
  };

  // provider slug check chain (.select("slug").eq().maybeSingle())
  const slugMaybeSingleMock = vi.fn().mockResolvedValue({ data: slugExisting });
  const slugCheckChain = {
    eq: vi.fn().mockReturnValue({ maybeSingle: slugMaybeSingleMock }),
  };

  // provider insert chain (.insert().select("id").single())
  const providerInsertMock = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: providerInsertError ? null : { id: providerInsertId },
        error: providerInsertError,
      }),
    }),
  });

  // provider update chain (.update().eq()) — used for embedding
  const providerUpdateChain = { update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) };

  // provider_categories insert mock
  const provCatInsertMock = vi.fn().mockResolvedValue({ error: null });
  // provider_categories select chain — used for embedding (.select().eq())
  const provCatSelectChain = { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };

  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table === "recommendations") {
      return { ...recSelectChain, ...recUpdateChain };
    }
    if (table === "providers") {
      return {
        select: vi.fn().mockReturnValue(slugCheckChain),
        insert: providerInsertMock,
        ...providerUpdateChain,
      };
    }
    if (table === "provider_categories") {
      return { insert: provCatInsertMock, ...provCatSelectChain };
    }
    return {};
  });

  return {
    supabase: {
      auth: { getUser: mockGetUser },
      from: fromMock,
    },
    mocks: { recUpdateMock, provCatInsertMock, providerInsertMock, fromMock, recUpdateEqMock },
  };
}

let mockSupabase: ReturnType<typeof makeSupabase>["supabase"];

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockImplementation(() => Promise.resolve(mockSupabase)),
}));

import { approveRecommendation, rejectRecommendation } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: ADMIN_USER } });
  mockToSlug.mockReturnValue("joao-eletrica");
  mockEmbedText.mockResolvedValue([0.1, 0.2]);
  mockBuildProviderText.mockReturnValue("Joao Eletrica");
  const setup = makeSupabase();
  mockSupabase = setup.supabase;
});

describe("approveRecommendation", () => {
  it("creates a provider with status active and description_pt from recommendation", async () => {
    const { supabase, mocks } = makeSupabase();
    mockSupabase = supabase;

    await approveRecommendation("rec-id");

    expect(mocks.providerInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Joao Eletrica",
        status: "active",
        tier: "free",
        description_pt: "Ótimo eletricista",
      })
    );
  });

  it("inserts provider_categories when category_id is present", async () => {
    const { supabase, mocks } = makeSupabase();
    mockSupabase = supabase;

    await approveRecommendation("rec-id");

    expect(mocks.provCatInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider_id: "new-prov-id",
        category_id: "cat-id",
      })
    );
  });

  it("skips provider_categories insert when category_id is null", async () => {
    const { supabase, mocks } = makeSupabase({
      recData: { ...FAKE_REC, category_id: null },
    });
    mockSupabase = supabase;

    await approveRecommendation("rec-id");

    expect(mocks.provCatInsertMock).not.toHaveBeenCalled();
  });

  it("updates recommendation to approved with created_provider_id and reviewed_by", async () => {
    const { supabase, mocks } = makeSupabase();
    mockSupabase = supabase;

    await approveRecommendation("rec-id");

    // recUpdateMock is the `.update()` spy — it receives the payload object
    expect(mocks.recUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "approved",
        created_provider_id: "new-prov-id",
        reviewed_by: ADMIN_USER.id,
      })
    );
  });

  it("returns error when recommendation not found", async () => {
    const { supabase } = makeSupabase({ recData: null });
    mockSupabase = supabase;

    const result = await approveRecommendation("rec-id");

    expect(result).toEqual({ error: "Not found" });
  });

  it("returns error when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const result = await approveRecommendation("rec-id");

    expect(result).toEqual({ error: "Unauthorized" });
  });
});

describe("rejectRecommendation", () => {
  it("updates recommendation to rejected with reviewed_by set", async () => {
    const { supabase, mocks } = makeSupabase();
    mockSupabase = supabase;

    await rejectRecommendation("rec-id");

    // recUpdateMock is the `.update()` spy — it receives the payload object
    expect(mocks.recUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rejected",
        reviewed_by: ADMIN_USER.id,
      })
    );
  });

  it("returns error when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const result = await rejectRecommendation("rec-id");

    expect(result).toEqual({ error: "Unauthorized" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail (actions file doesn't exist yet)**

Run:
```bash
cd /Users/peter/personal/listaviva && npx vitest run "src/app/\[locale\]/admin/recommendations/actions.test.ts"
```

Expected: FAIL — cannot find module `./actions`

---

### Task 8: Admin Server Actions

**Files:**
- Create: `src/app/[locale]/admin/recommendations/actions.ts`

- [ ] **Step 1: Create the actions file**

```ts
// src/app/[locale]/admin/recommendations/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { toSlug } from "@/lib/slug";
import { buildProviderText, embedText } from "@/lib/embeddings";

export async function approveRecommendation(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: recommendation } = await supabase
    .from("recommendations")
    .select("*")
    .eq("id", id)
    .eq("status", "pending")
    .maybeSingle();
  if (!recommendation) return { error: "Not found" };

  // Slug with collision handling
  const baseSlug = toSlug(recommendation.provider_name);
  let slug = baseSlug;
  const { data: existing } = await supabase
    .from("providers")
    .select("slug")
    .eq("slug", baseSlug)
    .maybeSingle();
  if (existing) slug = `${baseSlug}-${Date.now().toString(36)}`;

  const { data: newProvider, error: insertError } = await supabase
    .from("providers")
    .insert({
      name: recommendation.provider_name,
      slug,
      whatsapp: recommendation.whatsapp,
      home_bairro_id: recommendation.bairro_id,
      description_pt: recommendation.description ?? null,
      status: "active",
      tier: "free",
    })
    .select("id")
    .single();
  if (insertError) return { error: insertError.message };

  if (recommendation.category_id) {
    await supabase.from("provider_categories").insert({
      provider_id: newProvider.id,
      category_id: recommendation.category_id,
    });
  }

  await supabase
    .from("recommendations")
    .update({
      status: "approved",
      reviewed_by: user.id,
      created_provider_id: newProvider.id,
    })
    .eq("id", id);

  // Generate embedding — non-blocking
  try {
    const { data: cats } = await supabase
      .from("provider_categories")
      .select("categories(name_pt)")
      .eq("provider_id", newProvider.id);
    const catNames = (cats ?? []).flatMap((c) => {
      const cat = c.categories;
      return Array.isArray(cat)
        ? cat.map((x) => x.name_pt)
        : cat
        ? [(cat as { name_pt: string }).name_pt]
        : [];
    });
    const text = buildProviderText(
      recommendation.provider_name,
      recommendation.description ?? null,
      catNames
    );
    const embedding = await embedText(text);
    await supabase
      .from("providers")
      .update({ embedding: JSON.stringify(embedding) })
      .eq("id", newProvider.id);
  } catch {
    // non-blocking
  }

  revalidatePath("/[locale]/admin/recommendations", "page");
  revalidatePath("/[locale]/category/[slug]", "page");
}

export async function rejectRecommendation(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  await supabase
    .from("recommendations")
    .update({ status: "rejected", reviewed_by: user.id })
    .eq("id", id);

  revalidatePath("/[locale]/admin/recommendations", "page");
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run:
```bash
cd /Users/peter/personal/listaviva && npx vitest run "src/app/\[locale\]/admin/recommendations/actions.test.ts"
```

Expected: All tests PASS

- [ ] **Step 3: Run all tests to ensure nothing is broken**

Run:
```bash
cd /Users/peter/personal/listaviva && npx vitest run
```

Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add "src/app/[locale]/admin/recommendations/actions.ts" "src/app/[locale]/admin/recommendations/actions.test.ts"
git commit -m "feat: add approveRecommendation and rejectRecommendation actions with tests"
```

---

### Task 9: Admin UI

**Files:**
- Create: `src/app/[locale]/admin/recommendations/RecommendationsManager.tsx`
- Create: `src/app/[locale]/admin/recommendations/page.tsx`

- [ ] **Step 1: Create `RecommendationsManager.tsx` (client component)**

Follows the same pattern as `src/app/[locale]/admin/claims/ClaimsManager.tsx`.

```tsx
// src/app/[locale]/admin/recommendations/RecommendationsManager.tsx
"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { approveRecommendation, rejectRecommendation } from "./actions";

interface Recommendation {
  id: string;
  provider_name: string;
  whatsapp: string | null;
  description: string | null;
  created_at: string;
  categories: { name_pt: string } | null;
  bairros: { name: string } | null;
  profiles: { full_name: string | null } | null;
}

export default function RecommendationsManager({
  recommendations,
}: {
  recommendations: Recommendation[];
}) {
  const t = useTranslations("recommendations");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleApprove(id: string) {
    startTransition(async () => {
      const result = await approveRecommendation(id);
      if (result?.error) setError(result.error);
    });
  }

  function handleReject(id: string) {
    startTransition(async () => {
      const result = await rejectRecommendation(id);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {recommendations.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            {t("empty")}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t("providerName")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t("category")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t("whatsapp")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t("bairro")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider max-w-xs">
                  {t("description")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t("submitter")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t("date")}
                </th>
                <th className="px-4 py-3 w-40" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recommendations.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {r.provider_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {r.categories?.name_pt ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {r.whatsapp ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {r.bairros?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                    {r.description ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {r.profiles?.full_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => handleApprove(r.id)}
                      disabled={isPending}
                      className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-medium hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                    >
                      {t("approve")}
                    </button>
                    <button
                      onClick={() => handleReject(r.id)}
                      disabled={isPending}
                      className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 disabled:opacity-50 transition-colors"
                    >
                      {t("reject")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `page.tsx` (Server Component)**

```tsx
// src/app/[locale]/admin/recommendations/page.tsx
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import RecommendationsManager from "./RecommendationsManager";

export default async function RecommendationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "recommendations" });
  const supabase = await createClient();

  const { data: rawRecommendations } = await supabase
    .from("recommendations")
    .select(
      `
      id, provider_name, whatsapp, description, created_at, category_id,
      categories(name_pt),
      bairros(name),
      profiles!submitted_by(full_name)
    `
    )
    .eq("status", "pending")
    .order("created_at");

  // Supabase returns related rows as arrays — normalize to single objects
  const recommendations = (rawRecommendations ?? []).map((r) => ({
    ...r,
    categories: Array.isArray(r.categories)
      ? (r.categories[0] ?? null)
      : r.categories,
    bairros: Array.isArray(r.bairros) ? (r.bairros[0] ?? null) : r.bairros,
    profiles: Array.isArray(r.profiles) ? (r.profiles[0] ?? null) : r.profiles,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
      <RecommendationsManager recommendations={recommendations} />
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run:
```bash
cd /Users/peter/personal/listaviva && npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add "src/app/[locale]/admin/recommendations/"
git commit -m "feat: add admin recommendations moderation UI"
```

---

### Task 10: Admin Nav Link + Final Verification

**Files:**
- Modify: `src/app/[locale]/admin/layout.tsx`

- [ ] **Step 1: Add recommendations nav item to admin layout**

In `src/app/[locale]/admin/layout.tsx`, add to the `navItems` array (after the claims entry):

```ts
{ href: "/admin/recommendations" as const, label: t("admin.recommendations"), icon: "💡" },
```

The `admin.recommendations` key already exists in both message files (`"Indicações"` / `"Recommendations"`).

- [ ] **Step 2: Run all tests**

```bash
cd /Users/peter/personal/listaviva && npx vitest run
```

Expected: All tests pass (should have at minimum: 6 embeddings tests, 5 search tests, 4 submitRecommendation tests, 8 admin recommendation action tests)

- [ ] **Step 3: Final build**

```bash
cd /Users/peter/personal/listaviva && npm run build
```

Expected: Build succeeds with no errors or type errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/[locale]/admin/layout.tsx"
git commit -m "feat: add recommendations nav link to admin sidebar (issue #11)"
```

- [ ] **Step 5: Close the GitHub issue**

```bash
gh issue close 11 --comment "Community recommendations feature implemented: consumer submission form at /account/recommend, admin moderation queue at /admin/recommendations with approve (auto-creates provider) and reject actions."
```
