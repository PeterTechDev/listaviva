# Community Recommendations — Design

**Issue:** #11

## Goal

Allow logged-in consumers to recommend service providers they know. Submissions go to an admin moderation queue; approved recommendations become live provider listings automatically.

## Architecture

A new page at `/[locale]/account/recommend` lets authenticated consumers submit a provider recommendation (name, category, WhatsApp, bairro, optional description). Submissions are stored as `pending` in the existing `recommendations` table. Admins review at `/[locale]/admin/recommendations`, where a single approve click creates a live provider listing and links the category. Reject simply marks the recommendation closed.

**Tech Stack:** Next.js 16 App Router, Supabase (existing `recommendations` table), Vitest for tests.

## Data Model

The `recommendations` table and its RLS policies already exist in the initial schema. One migration adds a `category_id` FK:

```sql
-- 004_recommendations_category.sql
alter table public.recommendations
  add column category_id uuid references public.categories on delete set null;
```

Existing columns used:
- `id`, `submitted_by`, `provider_name`, `whatsapp`, `bairro_id`, `description`
- `status` — `'pending' | 'approved' | 'rejected'`
- `reviewed_by` — set to admin's user ID on approve/reject
- `created_provider_id` — set to the new provider's ID on approve
- `category_suggestion text` — kept as-is (not used by new form, was pre-existing)

## File Map

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/004_recommendations_category.sql` | Create | Add `category_id` FK to `recommendations` |
| `src/app/[locale]/account/recommend/page.tsx` | Create | Consumer submission form (Server Component wrapper) |
| `src/app/[locale]/account/recommend/RecommendForm.tsx` | Create | Client component: form with error display |
| `src/app/[locale]/account/recommend/actions.ts` | Create | `submitRecommendation` server action |
| `src/app/[locale]/account/page.tsx` | Modify | Add "Recommend a provider" link |
| `src/app/[locale]/admin/recommendations/page.tsx` | Create | Admin moderation queue (Server Component) |
| `src/app/[locale]/admin/recommendations/RecommendationsManager.tsx` | Create | Client component: table + approve/reject buttons |
| `src/app/[locale]/admin/recommendations/actions.ts` | Create | `approveRecommendation`, `rejectRecommendation` |
| `src/app/[locale]/admin/layout.tsx` | Modify | Add Recommendations nav link |
| `messages/pt-BR.json` | Modify | Add `recommendations` namespace (`admin.recommendations` already exists) |
| `messages/en.json` | Modify | Add `recommendations` namespace (`admin.recommendations` already exists) |
| `src/app/[locale]/account/recommend/actions.test.ts` | Create | Unit tests for `submitRecommendation` |
| `src/app/[locale]/admin/recommendations/actions.test.ts` | Create | Unit tests for approve/reject |

## Consumer Submission Flow

### `src/app/[locale]/account/recommend/page.tsx`

Server Component. Reads `locale` from `await params`. Checks auth via `supabase.auth.getUser()` — if no user, `redirect(\`/${locale}/login\`)` using `redirect` from `"next/navigation"` (same pattern used by `account/page.tsx`, `admin/page.tsx`, etc.). Fetches categories (ordered by `sort_order`) and bairros (ordered by `name`) in parallel. Renders `<RecommendForm>` passing `categories` and `bairros` as props.

Category names in the `<select>` use `category.name_pt` regardless of locale.

### `src/app/[locale]/account/recommend/RecommendForm.tsx`

Client component. Receives `categories` and `bairros` as props. Uses `useActionState` (from `"react"`, the Next.js 16 / React 19 API) to wire the server action and display inline errors. Uses `useFormStatus` for the submit button's pending state.

```tsx
"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { submitRecommendation } from "./actions";

function SubmitButton() {
  const t = useTranslations("recommendations");
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? "..." : t("submit")}
    </button>
  );
}

export default function RecommendForm({ categories, bairros }) {
  const t = useTranslations("recommendations");
  const [state, formAction] = useActionState(submitRecommendation, { error: null });
  return (
    <form action={formAction}>
      {state.error && <p className="text-red-600 text-sm">{state.error}</p>}
      {/* fields using t("providerName"), t("category"), etc. */}
      <SubmitButton />
    </form>
  );
}
```

**Form fields** (all labels via `t` from `useTranslations("recommendations")`):
- `provider_name` — required text input, label: `t("providerName")`
- `category_id` — `<select>` from categories, label: `t("category")`; first option is a disabled placeholder "—". The field is required via HTML `required` attribute; no additional server-side validation is performed beyond accepting null (browser enforces required, server accepts nullable for robustness).
- `whatsapp` — optional text input, label: `t("whatsapp")`
- `bairro_id` — optional `<select>` from bairros with empty "all" option, label: `t("bairro")`
- `description` — optional `<textarea>`, label: `t("description")`
- Submit button: `t("submit")`

### `src/app/[locale]/account/recommend/actions.ts`

```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function submitRecommendation(
  _prev: { error: string | null },
  formData: FormData
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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

  redirect("/account"); // next-intl middleware locale-prefixes bare paths automatically
}
```

Note: `redirect` from `"next/navigation"` is used here (matching the existing pattern in `account/actions.ts`). The next-intl middleware intercepts the bare `/account` path and adds the current locale prefix automatically.

### Entry point on account page

Add a link to `/account/recommend` in `src/app/[locale]/account/page.tsx`, visible to all authenticated users. Use the existing `Link` component from `@/i18n/navigation`. Label: `t("recommendations.recommend")`.

## Admin Moderation Queue

### `src/app/[locale]/admin/recommendations/page.tsx`

Server Component. Fetches pending recommendations inside the async component function:

```ts
import { createClient } from "@/lib/supabase/server";
import RecommendationsManager from "./RecommendationsManager";

export default async function RecommendationsPage() {
  const supabase = await createClient();
  const { data: rawRecommendations } = await supabase
    .from("recommendations")
    .select(`
      id, provider_name, whatsapp, description, created_at, category_id,
      categories(name_pt),
      bairros(name),
      profiles!submitted_by(full_name)
    `)
    .eq("status", "pending")
    .order("created_at");

  // Supabase returns related rows as arrays; normalize to single objects
  const recommendations = (rawRecommendations ?? []).map((r) => ({
    ...r,
    categories: Array.isArray(r.categories) ? r.categories[0] ?? null : r.categories,
    bairros: Array.isArray(r.bairros) ? r.bairros[0] ?? null : r.bairros,
    profiles: Array.isArray(r.profiles) ? r.profiles[0] ?? null : r.profiles,
  }));

  return <RecommendationsManager recommendations={recommendations} />;
}
```

The `profiles!submitted_by(full_name)` join hint disambiguates the FK when `recommendations` has multiple references to `profiles` (both `submitted_by` and `reviewed_by`).

### `src/app/[locale]/admin/recommendations/RecommendationsManager.tsx`

Client component following the same pattern as `ClaimsManager`. Uses `useTranslations("recommendations")` — intentionally sharing the single `recommendations` namespace with the consumer form, rather than a separate `adminRecommendations` namespace. All consumer and admin UI keys (approve, reject, empty, submitter, date, etc.) live together under `recommendations`. Table columns:

| Column | Value |
|---|---|
| Provider name | `recommendations.provider_name` |
| Category | `recommendations.categories?.name_pt` |
| WhatsApp | `recommendations.whatsapp` |
| Bairro | `recommendations.bairros?.name` |
| Description | `recommendations.description` (truncated) |
| Submitted by | `recommendations.profiles?.full_name` |
| Date | `recommendations.created_at` formatted |
| Actions | Approve / Reject buttons |

Uses `useTransition` for optimistic pending state on buttons, identical to `ClaimsManager`.

### `src/app/[locale]/admin/recommendations/actions.ts`

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { toSlug } from "@/lib/slug";
import { buildProviderText, embedText } from "@/lib/embeddings";
```

#### `approveRecommendation(id: string)`

```ts
export async function approveRecommendation(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: recommendation } = await supabase
    .from("recommendations")
    .select("*")
    .eq("id", id)
    .eq("status", "pending")
    .maybeSingle();
  if (!recommendation) return { error: "Not found" };

  // Slug generation with collision handling
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
    .update({ status: "approved", reviewed_by: user.id, created_provider_id: newProvider.id })
    .eq("id", id);

  // Generate embedding (non-blocking)
  try {
    const { data: cats } = await supabase
      .from("provider_categories")
      .select("categories(name_pt)")
      .eq("provider_id", newProvider.id);
    const catNames = (cats ?? []).flatMap((c) => {
      const cat = c.categories;
      return Array.isArray(cat) ? cat.map((x) => x.name_pt) : cat ? [(cat as { name_pt: string }).name_pt] : [];
    });
    const text = buildProviderText(recommendation.provider_name, recommendation.description ?? null, catNames);
    const embedding = await embedText(text);
    await supabase.from("providers").update({ embedding: JSON.stringify(embedding) }).eq("id", newProvider.id);
  } catch { /* non-blocking */ }

  revalidatePath("/[locale]/admin/recommendations", "page");
  revalidatePath("/[locale]/category/[slug]", "page");
}
```

#### `rejectRecommendation(id: string)`

```ts
export async function rejectRecommendation(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  await supabase
    .from("recommendations")
    .update({ status: "rejected", reviewed_by: user.id })
    .eq("id", id);

  revalidatePath("/[locale]/admin/recommendations", "page");
}
```

### Slug collision handling

Before inserting the provider, check if the slug already exists. A race condition between check and insert is theoretically possible but acceptable given low admin traffic — the `providers.slug` unique constraint will surface a DB error if it occurs, which is caught and returned.

### Admin nav

In `src/app/[locale]/admin/layout.tsx`, add a nav link to `/admin/recommendations` with label `t("admin.recommendations")`. The `admin.recommendations` key already exists in both message files — no new key needed.

## Translation Keys

New `recommendations` namespace in both message files:

```
recommendations.recommend      — "Recomendar prestador" / "Recommend a provider"
recommendations.recommendDesc  — "Conhece um bom prestador? Indique-o aqui." / "Know a good provider? Recommend them here."
recommendations.providerName   — "Nome do prestador" / "Provider name"
recommendations.category       — "Categoria" / "Category"
recommendations.whatsapp       — "WhatsApp" / "WhatsApp"
recommendations.bairro         — "Bairro" / "Neighborhood"
recommendations.description    — "Descrição (opcional)" / "Description (optional)"
recommendations.submit         — "Enviar indicação" / "Submit recommendation"
recommendations.title          — "Indicações" / "Recommendations"
recommendations.empty          — "Nenhuma indicação pendente" / "No pending recommendations"
recommendations.approve        — "Aprovar" / "Approve"
recommendations.reject         — "Rejeitar" / "Reject"
recommendations.submitter      — "Enviado por" / "Submitted by"
recommendations.date           — "Data" / "Date"
```

Existing key in `admin` namespace (already present in both message files — verify only):
```
admin.recommendations  — "Indicações" / "Recommendations"
```

## Tests

### `src/app/[locale]/account/recommend/actions.test.ts`

Mocks `@/lib/supabase/server` and `@/i18n/navigation` (`redirect`). Tests for `submitRecommendation` (pass `null` as first arg per `useActionState` signature):
- Unauthenticated user returns `{ error: "Not authenticated" }` and `redirect` is not called
- Empty `provider_name` returns `{ error: "Name is required" }` and `redirect` is not called
- Valid submission inserts to `recommendations` with `status: 'pending'` and `submitted_by: user.id`, then calls `redirect("/account")`

### `src/app/[locale]/admin/recommendations/actions.test.ts`

Mocks `@/lib/supabase/server`, `@/lib/slug` (`toSlug`), `@/lib/embeddings` (`embedText`, `buildProviderText`), and `next/cache` (`revalidatePath`). Tests for `approveRecommendation`:
- Creates a provider row with `status: 'active'` and `description_pt` populated from recommendation `description`
- Inserts `provider_categories` when `category_id` is present
- Skips `provider_categories` insert when `category_id` is null
- Updates recommendation to `status: 'approved'` with `created_provider_id` and `reviewed_by: user.id` set

Tests for `rejectRecommendation`:
- Updates recommendation to `status: 'rejected'` with `reviewed_by: user.id` set

## Error Handling

- Unauthenticated submission → `{ error: "Not authenticated" }` (shown inline by `RecommendForm` via `useActionState`)
- DB insert failure on submission → `{ error: error.message }` (shown inline by `RecommendForm`)
- Approve on already-approved/rejected recommendation → `{ error: "Not found" }` (displayed in `RecommendationsManager`)
- Unauthenticated admin action → `{ error: "Unauthorized" }` (displayed in `RecommendationsManager`)
- Slug collision → resolved by appending timestamp suffix; unique constraint acts as safety net
- Embedding generation failure → silent (non-blocking try/catch)
