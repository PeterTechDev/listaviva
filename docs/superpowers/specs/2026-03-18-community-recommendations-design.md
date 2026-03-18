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
| `src/app/[locale]/account/recommend/page.tsx` | Create | Consumer submission form |
| `src/app/[locale]/account/recommend/actions.ts` | Create | `submitRecommendation` server action |
| `src/app/[locale]/account/page.tsx` | Modify | Add "Recommend a provider" link |
| `src/app/[locale]/admin/recommendations/page.tsx` | Create | Admin moderation queue (Server Component) |
| `src/app/[locale]/admin/recommendations/RecommendationsManager.tsx` | Create | Client component: table + approve/reject buttons |
| `src/app/[locale]/admin/recommendations/actions.ts` | Create | `approveRecommendation`, `rejectRecommendation` |
| `src/app/[locale]/admin/layout.tsx` | Modify | Add Recommendations nav link |
| `messages/pt-BR.json` | Modify | Add `recommendations` namespace |
| `messages/en.json` | Modify | Add `recommendations` namespace |
| `src/app/[locale]/account/recommend/actions.test.ts` | Create | Unit tests for `submitRecommendation` |
| `src/app/[locale]/admin/recommendations/actions.test.ts` | Create | Unit tests for approve/reject |

## Consumer Submission Flow

### `src/app/[locale]/account/recommend/page.tsx`

Server Component. Checks auth — if no user, `redirect("/login")`. Fetches all categories (ordered by `sort_order`) and all bairros (ordered by `name`) from Supabase. Renders a form that calls `submitRecommendation`.

**Form fields:**
- `provider_name` — required text input, label: `t("recommendations.providerName")`
- `category_id` — required `<select>` from categories, label: `t("recommendations.category")`
- `whatsapp` — optional text input, label: `t("recommendations.whatsapp")`
- `bairro_id` — optional `<select>` from bairros with empty "all" option, label: `t("recommendations.bairro")`
- `description` — optional `<textarea>`, label: `t("recommendations.description")`
- Submit button: `t("recommendations.submit")`

### `src/app/[locale]/account/recommend/actions.ts`

```ts
"use server";

export async function submitRecommendation(formData: FormData) {
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

  redirect("/account");
}
```

### Entry point on account page

Add a link to `/[locale]/account/recommend` in `src/app/[locale]/account/page.tsx`, visible to all authenticated users. Use the existing `Link` component from `@/i18n/navigation`. Label: `t("recommendations.recommend")`.

## Admin Moderation Queue

### `src/app/[locale]/admin/recommendations/page.tsx`

Server Component. Fetches pending recommendations:

```ts
const { data: recommendations } = await supabase
  .from("recommendations")
  .select(`
    id, provider_name, whatsapp, description, created_at,
    categories(name_pt),
    bairros(name),
    profiles!submitted_by(full_name)
  `)
  .eq("status", "pending")
  .order("created_at");
```

Passes data to `<RecommendationsManager>`.

### `src/app/[locale]/admin/recommendations/RecommendationsManager.tsx`

Client component following the same pattern as `ClaimsManager`. Table columns:

| Column | Value |
|---|---|
| Provider name | `recommendations.provider_name` |
| Category | `categories.name_pt` |
| WhatsApp | `recommendations.whatsapp` |
| Bairro | `bairros.name` |
| Description | `recommendations.description` (truncated) |
| Submitted by | `profiles.full_name` |
| Date | `recommendations.created_at` formatted |
| Actions | Approve / Reject buttons |

Uses `useTransition` for optimistic pending state on buttons, identical to `ClaimsManager`.

### `src/app/[locale]/admin/recommendations/actions.ts`

#### `approveRecommendation(id: string)`

1. Fetch recommendation — verify `status = 'pending'`; return `{ error }` if not found
2. Generate slug: `toSlug(recommendation.provider_name)` — handle slug collision by appending a short suffix if needed (check `providers` table for existing slug)
3. Insert into `providers`: `{ name, slug, whatsapp, home_bairro_id: bairro_id, status: 'active', tier: 'free' }`
4. If `category_id`: insert into `provider_categories`: `{ provider_id: newProvider.id, category_id }`
5. Update recommendation: `{ status: 'approved', reviewed_by: admin.id, created_provider_id: newProvider.id }`
6. Generate embedding (non-blocking try/catch — same pattern as admin provider actions):
   ```ts
   try {
     const { data: cats } = await supabase
       .from("provider_categories")
       .select("categories(name_pt)")
       .eq("provider_id", newProvider.id);
     const catNames = /* flatten cats */;
     const text = buildProviderText(name, null, catNames);
     const embedding = await embedText(text);
     await supabase.from("providers").update({ embedding: JSON.stringify(embedding) }).eq("id", newProvider.id);
   } catch { /* non-blocking */ }
   ```
7. `revalidatePath("/[locale]/admin/recommendations", "page")`

#### `rejectRecommendation(id: string)`

1. Get admin user — verify authenticated
2. Update recommendation: `{ status: 'rejected', reviewed_by: admin.id }`
3. `revalidatePath("/[locale]/admin/recommendations", "page")`

### Slug collision handling

Before inserting the provider, check if the slug already exists:
```ts
const baseSlug = toSlug(provider_name);
let slug = baseSlug;
const { data: existing } = await supabase
  .from("providers")
  .select("slug")
  .eq("slug", baseSlug)
  .maybeSingle();
if (existing) slug = `${baseSlug}-${Date.now().toString(36)}`;
```

### Admin nav

In `src/app/[locale]/admin/layout.tsx`, add a nav link to `/admin/recommendations` with label `t("admin.recommendations")`. The translation key already exists in both message files.

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

## Tests

### `src/app/[locale]/account/recommend/actions.test.ts`

Mocks Supabase client. Tests for `submitRecommendation`:
- Unauthenticated user returns `{ error: "Not authenticated" }`
- Empty `provider_name` returns `{ error: "Name is required" }`
- Valid submission inserts to `recommendations` with `status: 'pending'` and `submitted_by: user.id`

### `src/app/[locale]/admin/recommendations/actions.test.ts`

Mocks Supabase client, `toSlug`, `embedText`, `buildProviderText`. Tests for `approveRecommendation`:
- Creates a provider row with `status: 'active'`
- Inserts `provider_categories` when `category_id` is present
- Skips `provider_categories` insert when `category_id` is null
- Updates recommendation to `status: 'approved'` with `created_provider_id` set

Tests for `rejectRecommendation`:
- Updates recommendation to `status: 'rejected'` with `reviewed_by` set

## Error Handling

- Unauthenticated submission → `{ error: "Not authenticated" }` (no redirect)
- DB insert failure on submission → `{ error: error.message }` (shown to user)
- Approve on already-approved/rejected recommendation → `{ error: "Not found" }` (no-op)
- Slug collision → resolved by appending timestamp suffix
- Embedding generation failure → silent (non-blocking try/catch)
