# Provider Self-Registration + Claim Listing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let providers sign up, create their own listing, or claim an existing one — with admin approval for claims.

**Architecture:** Account dashboard at `/account` detects role; reuses existing `ProviderForm` (refactored with `action`/`redirectTo` props); new `claim_requests` table for admin-approved ownership transfers; `Header` split into Server + Client to expose `profiles.role`.

**Tech Stack:** Next.js 16 App Router, Supabase SSR client, next-intl, Tailwind CSS

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `messages/pt-BR.json` | Modify | Add `account` + `adminClaims` keys |
| `messages/en.json` | Modify | Same |
| `supabase/migrations/002_claim_requests.sql` | Create | `claim_requests` table + storage policy |
| `src/components/header.tsx` | Modify | Convert to Server Component wrapper |
| `src/components/header-client.tsx` | Create | Client Component with sign-out + role-aware link |
| `src/app/[locale]/admin/providers/ProviderForm.tsx` | Modify | Add `action`/`redirectTo`/`selfService` props |
| `src/app/[locale]/admin/providers/new/page.tsx` | Modify | Pass explicit `action` + `redirectTo` |
| `src/app/[locale]/admin/providers/[id]/edit/page.tsx` | Modify | Pass explicit `action` + `redirectTo` |
| `src/app/[locale]/account/actions.ts` | Create | `createOwnProvider`, `updateOwnProvider`, `submitClaim`, `searchUnownedProviders` |
| `src/app/[locale]/account/page.tsx` | Create | Account dashboard |
| `src/app/[locale]/account/create/page.tsx` | Create | Create listing page |
| `src/app/[locale]/account/claim/ClaimSearch.tsx` | Create | Client search + claim component |
| `src/app/[locale]/account/claim/page.tsx` | Create | Claim listing page |
| `src/app/[locale]/account/edit/page.tsx` | Create | Edit own listing page |
| `src/app/[locale]/admin/claims/actions.ts` | Create | `approveClaim`, `rejectClaim` |
| `src/app/[locale]/admin/claims/ClaimsManager.tsx` | Create | Client claims table |
| `src/app/[locale]/admin/claims/page.tsx` | Create | Admin claims review page |
| `src/app/[locale]/admin/layout.tsx` | Modify | Add Claims nav link |

---

### Task 1: Translation keys

**Files:**
- Modify: `messages/pt-BR.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Add keys to `messages/pt-BR.json`**

Add inside the top-level JSON object (alongside existing keys):

```json
"account": {
  "title": "Minha conta",
  "becomeProvider": "Quero ser prestador",
  "createListing": "Criar novo anúncio",
  "claimListing": "Reivindicar anúncio existente",
  "myListing": "Meu anúncio",
  "editListing": "Editar anúncio",
  "listingPending": "Aguardando aprovação",
  "claimSearch": "Buscar por nome ou telefone...",
  "claimSubmit": "Solicitar este anúncio",
  "claimSent": "Solicitação enviada! Aguarde a aprovação do administrador.",
  "claimDuplicate": "Você já tem uma solicitação pendente para este anúncio.",
  "claimOwned": "Este anúncio já tem um dono."
},
"adminClaims": {
  "title": "Reivindicações",
  "approve": "Aprovar",
  "reject": "Rejeitar",
  "empty": "Nenhuma solicitação pendente",
  "claimant": "Solicitante",
  "provider": "Anúncio",
  "message": "Mensagem",
  "createdAt": "Data"
}
```

Also add `"claims": "Reivindicações"` to the existing `"admin"` namespace.

- [ ] **Step 2: Add keys to `messages/en.json`**

```json
"account": {
  "title": "My account",
  "becomeProvider": "Become a provider",
  "createListing": "Create new listing",
  "claimListing": "Claim existing listing",
  "myListing": "My listing",
  "editListing": "Edit listing",
  "listingPending": "Pending approval",
  "claimSearch": "Search by name or phone...",
  "claimSubmit": "Request this listing",
  "claimSent": "Request sent! Awaiting admin approval.",
  "claimDuplicate": "You already have a pending request for this listing.",
  "claimOwned": "This listing already has an owner."
},
"adminClaims": {
  "title": "Claim Requests",
  "approve": "Approve",
  "reject": "Reject",
  "empty": "No pending requests",
  "claimant": "Claimant",
  "provider": "Listing",
  "message": "Message",
  "createdAt": "Date"
}
```

Also add `"claims": "Claims"` to the existing `"admin"` namespace.

- [ ] **Step 3: Commit**

```bash
git add messages/pt-BR.json messages/en.json
git commit -m "feat: add account and adminClaims translation keys"
```

---

### Task 2: Database migration

**Files:**
- Create: `supabase/migrations/002_claim_requests.sql`

- [ ] **Step 1: Create migration file**

```sql
-- claim_requests table
create table public.claim_requests (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.providers on delete cascade not null,
  user_id uuid references public.profiles on delete cascade not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  message text,
  created_at timestamptz not null default now()
);

alter table public.claim_requests enable row level security;

create policy "Users can view own claims"
  on public.claim_requests for select using (user_id = auth.uid());

create policy "Users can insert own claims"
  on public.claim_requests for insert with check (user_id = auth.uid());

create policy "Admins can manage all claims"
  on public.claim_requests for all using (public.is_admin());

-- Storage: allow authenticated users to upload provider photos
create policy "Authenticated users can upload photos"
  on storage.objects for insert
  with check (
    bucket_id = 'provider-photos'
    and auth.role() = 'authenticated'
  );
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use the `mcp__plugin_supabase_supabase__apply_migration` tool with:
- `project_id`: the Listaviva project ID (check `.env.local` for `NEXT_PUBLIC_SUPABASE_URL` to identify the project)
- `name`: `claim_requests`
- `query`: contents of the migration file

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/002_claim_requests.sql
git commit -m "feat: add claim_requests table and storage policy"
```

---

### Task 3: Header — Server/Client split

**Files:**
- Create: `src/components/header-client.tsx`
- Modify: `src/components/header.tsx`

The current `header.tsx` is a Client Component. We split it: `Header` becomes a Server Component that fetches `profiles.role` and passes it down; `HeaderClient` keeps all the browser logic.

- [ ] **Step 1: Create `src/components/header-client.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/auth";

export function HeaderClient({
  initialRole,
  avatarUrl,
  fullName,
}: {
  initialRole: UserRole | null;
  avatarUrl: string | null;
  fullName: string | null;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const otherLocale = locale === "pt-BR" ? "en" : "pt-BR";
  const [isSignedIn, setIsSignedIn] = useState(initialRole !== null);

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      setIsSignedIn(!!session?.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-emerald-600">
          {t("common.appName")}
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href={pathname}
            locale={otherLocale}
            className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            {t("common.switchLanguage")}
          </Link>

          {isSignedIn ? (
            <div className="flex items-center gap-3">
              {/* Role-aware link */}
              {initialRole === "admin" ? (
                <Link
                  href="/admin/bairros"
                  className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
                >
                  Admin
                </Link>
              ) : initialRole === "provider" ? (
                <Link
                  href="/account"
                  className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
                >
                  {t("account.myListing")}
                </Link>
              ) : (
                <Link
                  href="/account"
                  className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
                >
                  {t("account.becomeProvider")}
                </Link>
              )}
              {avatarUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={fullName ?? ""}
                  className="w-7 h-7 rounded-full"
                />
              )}
              <button
                onClick={handleSignOut}
                className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
              >
                {t("common.logout")}
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              {t("common.login")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Replace `src/components/header.tsx` with Server Component**

```tsx
import { getCurrentUser } from "@/lib/auth";
import { HeaderClient } from "./header-client";

export async function Header() {
  const user = await getCurrentUser();
  return (
    <HeaderClient
      initialRole={user?.role ?? null}
      avatarUrl={user?.avatar_url ?? null}
      fullName={user?.full_name ?? null}
    />
  );
}
```

- [ ] **Step 3: Run build to verify**

```bash
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/header.tsx src/components/header-client.tsx
git commit -m "feat: split Header into Server+Client for role-aware nav"
```

---

### Task 4: Refactor ProviderForm + update admin callers

**Files:**
- Modify: `src/app/[locale]/admin/providers/ProviderForm.tsx`
- Modify: `src/app/[locale]/admin/providers/new/page.tsx`
- Modify: `src/app/[locale]/admin/providers/[id]/edit/page.tsx`

- [ ] **Step 1: Update `ProviderForm.tsx`**

Make these changes:

**Remove** line 7:
```ts
import { createProvider, updateProvider } from "./actions";
```

**Replace** the `ProviderFormProps` interface (lines 44-49):
```tsx
interface ProviderFormProps {
  bairros: Bairro[];
  categories: Category[];
  initialData?: ProviderData;
  mode: "create" | "edit";
  action: (formData: FormData) => Promise<{ error?: string } | unknown>;
  redirectTo: string;
  selfService?: boolean;
}
```

**Replace** the function signature destructuring (line 51-56):
```tsx
export default function ProviderForm({
  bairros,
  categories,
  initialData = {},
  mode,
  action,
  redirectTo,
  selfService = false,
}: ProviderFormProps) {
```

**Replace** `handleSubmit` (lines 144-158):
```tsx
function handleSubmit() {
  startTransition(async () => {
    const result = await action(buildFormData());
    if (result && "error" in result && result.error) {
      setError(result.error);
      return;
    }
    router.push(redirectTo);
  });
}
```

**Replace** the cancel button `onClick` (line 412):
```tsx
onClick={() => router.push(redirectTo)}
```

**Wrap** the status/tier selects (the `grid-cols-3` div at lines 237-276) to hide them in self-service mode:
```tsx
{!selfService && (
  <div className="grid grid-cols-3 gap-4">
    {/* ... existing homeBairro, status, tier selects ... */}
    <div>
      <label className={labelClass}>{t("homeBairro")}</label>
      <select value={homeBairroId} onChange={(e) => setHomeBairroId(e.target.value)} className={inputClass}>
        <option value="">—</option>
        {bairros.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
    </div>
    <div>
      <label className={labelClass}>{t("status")}</label>
      <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
        <option value="active">{t("statusActive")}</option>
        <option value="pending">{t("statusPending")}</option>
        <option value="inactive">{t("statusInactive")}</option>
      </select>
    </div>
    <div>
      <label className={labelClass}>{t("tier")}</label>
      <select value={tier} onChange={(e) => setTier(e.target.value)} className={inputClass}>
        <option value="free">{t("tierFree")}</option>
        <option value="premium">{t("tierPremium")}</option>
      </select>
    </div>
  </div>
)}
```

Also add the homeBairro select when `selfService` is true (it's still needed for providers to set their location):
```tsx
{selfService && (
  <div>
    <label className={labelClass}>{t("homeBairro")}</label>
    <select value={homeBairroId} onChange={(e) => setHomeBairroId(e.target.value)} className={inputClass}>
      <option value="">—</option>
      {bairros.map((b) => (
        <option key={b.id} value={b.id}>{b.name}</option>
      ))}
    </select>
  </div>
)}
```

- [ ] **Step 2: Update `new/page.tsx`**

Add `action` and `redirectTo` props to the `<ProviderForm />` render:

```tsx
import { createProvider } from "../actions";
// ...
<ProviderForm
  bairros={bairros ?? []}
  categories={categories ?? []}
  initialData={{}}
  mode="create"
  action={createProvider}
  redirectTo="/admin/providers"
/>
```

- [ ] **Step 3: Update `[id]/edit/page.tsx`**

Add `action` and `redirectTo` props:

```tsx
import { updateProvider } from "../../actions";
// ...
<ProviderForm
  bairros={bairros ?? []}
  categories={categories ?? []}
  initialData={initialData}
  mode="edit"
  action={(fd) => updateProvider(provider.id, fd)}
  redirectTo="/admin/providers"
/>
```

- [ ] **Step 4: Run build**

```bash
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/\[locale\]/admin/providers/ProviderForm.tsx \
        src/app/\[locale\]/admin/providers/new/page.tsx \
        src/app/\[locale\]/admin/providers/\[id\]/edit/page.tsx
git commit -m "feat: refactor ProviderForm with action/redirectTo props"
```

---

### Task 5: Account server actions

**Files:**
- Create: `src/app/[locale]/account/actions.ts`

- [ ] **Step 1: Create `actions.ts`**

```ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toSlug } from "@/lib/slug";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export async function createOwnProvider(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const name = (formData.get("name") as string).trim();
  const slug = ((formData.get("slug") as string) || toSlug(name)).trim();
  const description_pt = (formData.get("description_pt") as string)?.trim() || null;
  const description_en = (formData.get("description_en") as string)?.trim() || null;
  const whatsapp = (formData.get("whatsapp") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const home_bairro_id = (formData.get("home_bairro_id") as string) || null;
  const category_ids = formData.getAll("category_ids") as string[];
  const service_area_ids = formData.getAll("service_area_ids") as string[];
  const photo_urls = formData.getAll("photo_urls") as string[];

  const working_hours: Record<string, string> = {};
  for (const day of DAYS) {
    const val = (formData.get(`hours_${day}`) as string)?.trim();
    if (val) working_hours[day] = val;
  }

  if (!name || !slug) return { error: "Name is required" };

  const { data: provider, error } = await supabase
    .from("providers")
    .insert({
      name,
      slug,
      description_pt,
      description_en,
      whatsapp,
      phone,
      home_bairro_id,
      status: "pending",
      tier: "free",
      working_hours,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const providerId = provider.id;

  if (category_ids.length > 0) {
    await supabase
      .from("provider_categories")
      .insert(category_ids.map((cid) => ({ provider_id: providerId, category_id: cid })));
  }

  if (service_area_ids.length > 0) {
    await supabase
      .from("provider_service_areas")
      .insert(service_area_ids.map((bid) => ({ provider_id: providerId, bairro_id: bid })));
  }

  if (photo_urls.length > 0) {
    await supabase
      .from("provider_photos")
      .insert(photo_urls.map((url, i) => ({ provider_id: providerId, url, sort_order: i })));
  }

  // Upgrade role to provider
  await supabase
    .from("profiles")
    .update({ role: "provider" })
    .eq("id", user.id);

  redirect("/account");
}

export async function updateOwnProvider(
  providerId: string,
  formData: FormData
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const name = (formData.get("name") as string).trim();
  const slug = ((formData.get("slug") as string) || toSlug(name)).trim();
  const description_pt = (formData.get("description_pt") as string)?.trim() || null;
  const description_en = (formData.get("description_en") as string)?.trim() || null;
  const whatsapp = (formData.get("whatsapp") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const home_bairro_id = (formData.get("home_bairro_id") as string) || null;
  const category_ids = formData.getAll("category_ids") as string[];
  const service_area_ids = formData.getAll("service_area_ids") as string[];
  const photo_urls = formData.getAll("photo_urls") as string[];

  const working_hours: Record<string, string> = {};
  for (const day of DAYS) {
    const val = (formData.get(`hours_${day}`) as string)?.trim();
    if (val) working_hours[day] = val;
  }

  if (!name || !slug) return { error: "Name is required" };

  const { error } = await supabase
    .from("providers")
    .update({
      name,
      slug,
      description_pt,
      description_en,
      whatsapp,
      phone,
      home_bairro_id,
      working_hours,
    })
    .eq("id", providerId)
    .eq("user_id", user.id); // RLS also enforces this

  if (error) return { error: error.message };

  // Replace categories
  await supabase.from("provider_categories").delete().eq("provider_id", providerId);
  if (category_ids.length > 0) {
    await supabase
      .from("provider_categories")
      .insert(category_ids.map((cid) => ({ provider_id: providerId, category_id: cid })));
  }

  // Replace service areas
  await supabase.from("provider_service_areas").delete().eq("provider_id", providerId);
  if (service_area_ids.length > 0) {
    await supabase
      .from("provider_service_areas")
      .insert(service_area_ids.map((bid) => ({ provider_id: providerId, bairro_id: bid })));
  }

  // Replace photos
  await supabase.from("provider_photos").delete().eq("provider_id", providerId);
  if (photo_urls.length > 0) {
    await supabase
      .from("provider_photos")
      .insert(photo_urls.map((url, i) => ({ provider_id: providerId, url, sort_order: i })));
  }

  revalidatePath("/[locale]/provider/[slug]", "page");
}

export async function submitClaim(providerId: string, message?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Check provider is unowned
  const { data: provider } = await supabase
    .from("providers")
    .select("user_id")
    .eq("id", providerId)
    .single();

  if (!provider) return { error: "Provider not found" };
  if (provider.user_id) return { error: "owned" };

  // Check no existing pending claim from this user
  const { data: existing } = await supabase
    .from("claim_requests")
    .select("id")
    .eq("provider_id", providerId)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) return { error: "duplicate" };

  const { error } = await supabase.from("claim_requests").insert({
    provider_id: providerId,
    user_id: user.id,
    message: message || null,
  });

  if (error) return { error: error.message };
  return { success: true };
}

export async function searchUnownedProviders(query: string) {
  const supabase = await createClient();
  const q = query.trim();
  if (!q) return [];

  const { data } = await supabase
    .from("providers")
    .select("id, name, whatsapp, home_bairro:home_bairro_id(name)")
    .is("user_id", null)
    .or(`name.ilike.%${q}%,whatsapp.ilike.%${q}%`)
    .limit(10);

  return data ?? [];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\[locale\]/account/actions.ts
git commit -m "feat: add account server actions (createOwnProvider, submitClaim)"
```

---

### Task 6: Admin claims server actions

**Files:**
- Create: `src/app/[locale]/admin/claims/actions.ts`

- [ ] **Step 1: Create `actions.ts`**

```ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function approveClaim(claimId: string) {
  const supabase = await createClient();

  // Fetch the claim
  const { data: claim, error: fetchError } = await supabase
    .from("claim_requests")
    .select("id, provider_id, user_id")
    .eq("id", claimId)
    .eq("status", "pending")
    .single();

  if (fetchError || !claim) return { error: "Claim not found" };

  // Set provider owner
  const { error: providerError } = await supabase
    .from("providers")
    .update({ user_id: claim.user_id })
    .eq("id", claim.provider_id);

  if (providerError) return { error: providerError.message };

  // Upgrade claimant role
  await supabase
    .from("profiles")
    .update({ role: "provider" })
    .eq("id", claim.user_id);

  // Approve this claim
  await supabase
    .from("claim_requests")
    .update({ status: "approved" })
    .eq("id", claimId);

  // Reject all other pending claims for this provider
  await supabase
    .from("claim_requests")
    .update({ status: "rejected" })
    .eq("provider_id", claim.provider_id)
    .eq("status", "pending")
    .neq("id", claimId);

  revalidatePath("/[locale]/admin/claims", "page");
}

export async function rejectClaim(claimId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("claim_requests")
    .update({ status: "rejected" })
    .eq("id", claimId);

  if (error) return { error: error.message };

  revalidatePath("/[locale]/admin/claims", "page");
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\[locale\]/admin/claims/actions.ts
git commit -m "feat: add admin claim approval/rejection actions"
```

---

### Task 7: Account pages

**Files:**
- Create: `src/app/[locale]/account/page.tsx`
- Create: `src/app/[locale]/account/create/page.tsx`
- Create: `src/app/[locale]/account/claim/ClaimSearch.tsx`
- Create: `src/app/[locale]/account/claim/page.tsx`
- Create: `src/app/[locale]/account/edit/page.tsx`

- [ ] **Step 1: Create `src/app/[locale]/account/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth";

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const user = await getCurrentUser();

  if (!user) redirect(`/${locale}/login`);

  const supabase = await createClient();
  const { data: provider } = await supabase
    .from("providers")
    .select("id, name, slug, status")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto px-4 py-12 w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">
          {t("account.title")}
        </h1>

        {provider ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">{provider.name}</h2>
                <span
                  className={`inline-flex mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                    provider.status === "active"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {provider.status === "active"
                    ? "Ativo"
                    : t("account.listingPending")}
                </span>
              </div>
              <Link
                href="/account/edit"
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
              >
                {t("account.editListing")}
              </Link>
            </div>
            <Link
              href={`/provider/${provider.slug}`}
              className="text-sm text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              Ver perfil público →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/account/create"
              className="flex flex-col items-center gap-3 p-8 bg-white rounded-xl border-2 border-emerald-200 hover:border-emerald-400 hover:shadow-sm transition-all text-center"
            >
              <span className="text-4xl">✨</span>
              <span className="font-semibold text-gray-900">
                {t("account.createListing")}
              </span>
              <span className="text-sm text-gray-500">
                Crie um novo perfil para o seu negócio
              </span>
            </Link>
            <Link
              href="/account/claim"
              className="flex flex-col items-center gap-3 p-8 bg-white rounded-xl border-2 border-gray-200 hover:border-gray-400 hover:shadow-sm transition-all text-center"
            >
              <span className="text-4xl">🔍</span>
              <span className="font-semibold text-gray-900">
                {t("account.claimListing")}
              </span>
              <span className="text-sm text-gray-500">
                Reivindique um perfil já existente
              </span>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/[locale]/account/create/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth";
import ProviderForm from "../../admin/providers/ProviderForm";
import { createOwnProvider } from "../actions";

export default async function CreateListingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const user = await getCurrentUser();

  if (!user) redirect(`/${locale}/login`);

  // Already has a listing → go to account
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("providers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) redirect(`/${locale}/account`);

  const [{ data: bairros }, { data: categories }] = await Promise.all([
    supabase.from("bairros").select("id, name").order("name"),
    supabase.from("categories").select("id, name_pt, name_en, icon").order("sort_order"),
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-8 w-full">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/account"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← {t("common.back")}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("account.createListing")}
          </h1>
        </div>
        <ProviderForm
          bairros={bairros ?? []}
          categories={categories ?? []}
          initialData={{}}
          mode="create"
          action={createOwnProvider}
          redirectTo="/account"
          selfService
        />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/app/[locale]/account/claim/ClaimSearch.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { searchUnownedProviders, submitClaim } from "../actions";

type ProviderResult = {
  id: string;
  name: string;
  whatsapp: string | null;
  home_bairro: { name: string } | { name: string }[] | null;
};

export default function ClaimSearch() {
  const t = useTranslations("account");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProviderResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [claimedId, setClaimedId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSearch() {
    startTransition(async () => {
      const data = await searchUnownedProviders(query);
      setResults(data as ProviderResult[]);
      setSearched(true);
    });
  }

  function handleClaim(providerId: string) {
    setClaimError(null);
    startTransition(async () => {
      const result = await submitClaim(providerId);
      if (result.error === "duplicate") {
        setClaimError(t("claimDuplicate"));
      } else if (result.error === "owned") {
        setClaimError(t("claimOwned"));
      } else if (result.error) {
        setClaimError(result.error);
      } else {
        setClaimedId(providerId);
      }
    });
  }

  if (claimedId) {
    return (
      <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700">
        {t("claimSent")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder={t("claimSearch")}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          onClick={handleSearch}
          disabled={!query.trim() || isPending}
          className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50 transition-colors"
        >
          Buscar
        </button>
      </div>

      {claimError && (
        <p className="text-sm text-red-600">{claimError}</p>
      )}

      {searched && results.length === 0 && (
        <p className="text-sm text-gray-500 py-4 text-center">
          Nenhum resultado encontrado
        </p>
      )}

      {results.map((p) => {
        const bairroRaw = p.home_bairro;
        const bairroName = Array.isArray(bairroRaw)
          ? bairroRaw[0]?.name
          : bairroRaw?.name;

        return (
          <div
            key={p.id}
            className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200"
          >
            <div>
              <p className="font-medium text-gray-900">{p.name}</p>
              {bairroName && (
                <p className="text-sm text-gray-500">📍 {bairroName}</p>
              )}
            </div>
            <button
              onClick={() => handleClaim(p.id)}
              disabled={isPending}
              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {t("claimSubmit")}
            </button>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Create `src/app/[locale]/account/claim/page.tsx`**

```tsx
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ClaimSearch from "./ClaimSearch";

export default async function ClaimListingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const user = await getCurrentUser();

  if (!user) redirect(`/${locale}/login`);

  // Already has a listing → go to account
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("providers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) redirect(`/${locale}/account`);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto px-4 py-8 w-full">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/account"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← {t("common.back")}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("account.claimListing")}
          </h1>
        </div>
        <ClaimSearch />
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Create `src/app/[locale]/account/edit/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth";
import ProviderForm from "../../admin/providers/ProviderForm";
import { updateOwnProvider } from "../actions";

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const user = await getCurrentUser();

  if (!user) redirect(`/${locale}/login`);

  const supabase = await createClient();

  const { data: provider } = await supabase
    .from("providers")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!provider) notFound();

  const [
    { data: bairros },
    { data: categories },
    { data: providerCategories },
    { data: serviceAreas },
    { data: photos },
  ] = await Promise.all([
    supabase.from("bairros").select("id, name").order("name"),
    supabase.from("categories").select("id, name_pt, name_en, icon").order("sort_order"),
    supabase.from("provider_categories").select("category_id").eq("provider_id", provider.id),
    supabase.from("provider_service_areas").select("bairro_id").eq("provider_id", provider.id),
    supabase.from("provider_photos").select("url, sort_order").eq("provider_id", provider.id).order("sort_order"),
  ]);

  const initialData = {
    id: provider.id,
    name: provider.name,
    slug: provider.slug,
    description_pt: provider.description_pt,
    description_en: provider.description_en,
    whatsapp: provider.whatsapp,
    phone: provider.phone,
    home_bairro_id: provider.home_bairro_id,
    status: provider.status,
    tier: provider.tier,
    working_hours: (provider.working_hours as Record<string, string>) ?? {},
    categoryIds: providerCategories?.map((pc) => pc.category_id) ?? [],
    serviceAreaIds: serviceAreas?.map((sa) => sa.bairro_id) ?? [],
    photos: photos?.map((p) => ({ url: p.url })) ?? [],
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-8 w-full">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/account"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← {t("common.back")}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("account.editListing")}
          </h1>
        </div>
        <ProviderForm
          bairros={bairros ?? []}
          categories={categories ?? []}
          initialData={initialData}
          mode="edit"
          action={(fd) => updateOwnProvider(provider.id, fd)}
          redirectTo="/account"
          selfService
        />
      </main>
    </div>
  );
}
```

- [ ] **Step 6: Run build**

```bash
npm run build 2>&1 | tail -30
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/\[locale\]/account/
git commit -m "feat: add account dashboard, create, claim, edit pages"
```

---

### Task 8: Admin claims page + layout update

**Files:**
- Create: `src/app/[locale]/admin/claims/ClaimsManager.tsx`
- Create: `src/app/[locale]/admin/claims/page.tsx`
- Modify: `src/app/[locale]/admin/layout.tsx`

- [ ] **Step 1: Create `ClaimsManager.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { approveClaim, rejectClaim } from "./actions";

interface Claim {
  id: string;
  status: string;
  message: string | null;
  created_at: string;
  providers: { name: string } | null;
  profiles: { full_name: string | null } | null;
}

export default function ClaimsManager({ claims }: { claims: Claim[] }) {
  const t = useTranslations("adminClaims");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleApprove(id: string) {
    startTransition(async () => {
      const result = await approveClaim(id);
      if (result?.error) setError(result.error);
    });
  }

  function handleReject(id: string) {
    startTransition(async () => {
      const result = await rejectClaim(id);
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
        {claims.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">{t("empty")}</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t("provider")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t("claimant")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t("message")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t("createdAt")}
                </th>
                <th className="px-4 py-3 w-40" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {claims.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {c.providers?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {c.profiles?.full_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                    {c.message ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => handleApprove(c.id)}
                      disabled={isPending}
                      className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-medium hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                    >
                      {t("approve")}
                    </button>
                    <button
                      onClick={() => handleReject(c.id)}
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

- [ ] **Step 2: Create `src/app/[locale]/admin/claims/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import ClaimsManager from "./ClaimsManager";

export default async function ClaimsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const supabase = await createClient();

  const { data: claims } = await supabase
    .from("claim_requests")
    .select(
      `
      id, status, message, created_at,
      providers(name),
      profiles(full_name)
      `
    )
    .eq("status", "pending")
    .order("created_at");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">
        {t("adminClaims.title")}
      </h1>
      <ClaimsManager claims={(claims ?? []) as Parameters<typeof ClaimsManager>[0]["claims"]} />
    </div>
  );
}
```

- [ ] **Step 3: Add Claims link to admin layout**

In `src/app/[locale]/admin/layout.tsx`, add to `navItems`:

```tsx
{ href: "/admin/claims" as const, label: t("admin.claims"), icon: "📋" },
```

- [ ] **Step 4: Run build**

```bash
npm run build 2>&1 | tail -30
```

Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add src/app/\[locale\]/admin/claims/ src/app/\[locale\]/admin/layout.tsx
git commit -m "feat: add admin claims review page"
```

---

### Task 9: Final build + close issue

- [ ] **Step 1: Run full build**

```bash
cd ~/personal/listaviva && npm run build 2>&1
```

Expected: all routes build cleanly including:
- `/[locale]/account`
- `/[locale]/account/create`
- `/[locale]/account/claim`
- `/[locale]/account/edit`
- `/[locale]/admin/claims`

- [ ] **Step 2: Close issue**

```bash
gh issue close 9
```
