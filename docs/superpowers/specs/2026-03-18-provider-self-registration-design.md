# Provider Self-Registration + Claim Listing — Design

**Issue:** #9

## Goal

Allow providers to sign in, create a new listing, or claim an existing seeded listing. Claims require admin approval before ownership transfers.

## Architecture

Account dashboard at `/[locale]/account` detects role and routes to the appropriate flow. Admin reviews pending claims at `/[locale]/admin/claims`. All ownership enforcement is backed by existing RLS (`providers.user_id`, `owns_provider()`).

## Pages

| Route | Who | Purpose |
|---|---|---|
| `/[locale]/account` | Signed-in users | Dashboard: create/claim CTAs (consumer) or edit link (provider) |
| `/[locale]/account/create` | Consumer | Create new listing (status: pending) |
| `/[locale]/account/claim` | Consumer | Search unowned providers, submit claim request |
| `/[locale]/account/edit` | Provider | Edit own listing (single listing per provider, no `[id]` segment) |
| `/[locale]/admin/claims` | Admin | Review pending claim requests |

## Navigation

`Header` is currently a Client Component. It must be split into:
- `Header` — a Server Component that calls `getCurrentUser()` and passes `role` and `userId` as props to `HeaderClient`. When `getCurrentUser()` returns `null` (unauthenticated), passes `initialRole: null`
- `HeaderClient` — keeps `"use client"`, handles sign-out and auth state changes, accepts `initialRole: UserRole | null`. When `null`, renders the existing login link

Role-aware link rendered by `HeaderClient`:
- `consumer` → "Become a provider" → `/account`
- `provider` → "My listing" → `/account`
- `admin` → existing admin link unchanged
- Not signed in → existing login link unchanged

## Data Model

New table via Supabase migration:

```sql
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
```

**Storage bucket policy** — the `provider-photos` bucket is already created. Add an upload policy that allows any authenticated user to upload (MVP scope — sufficient with DB-level RLS enforcing which provider owns which photos):

```sql
create policy "Authenticated users can upload photos"
  on storage.objects for insert
  with check (
    bucket_id = 'provider-photos'
    and auth.role() = 'authenticated'
  );
```

No other changes to existing tables. `providers.user_id` and `profiles.role` already exist. Existing RLS already enforces provider ownership.

## Server Actions

### `src/app/[locale]/account/actions.ts`

**`createOwnProvider(formData)`**
- Inserts provider with `status: 'pending'`, `user_id: auth.uid()`
- `status` and `tier` are hardcoded server-side (not read from formData) — locked to `'pending'` / `'free'`
- Upgrades `profiles.role` to `'provider'`
- Redirects to `/account`

**`updateOwnProvider(formData)`**
- Reads `provider_id` from a hidden form field (passed by the edit page)
- Updates provider where `id = provider_id AND user_id = auth.uid()` — double-enforced by both the query filter and RLS
- Revalidates `/[locale]/provider/[slug]` public profile page

**`submitClaim(providerId, message?)`**
- Validates: provider has no `user_id` (unowned), user has no existing `pending` claim for it
- Inserts into `claim_requests`
- Returns `{ success: true }` or `{ error: string }` — stays on page, no redirect

### `src/app/[locale]/admin/claims/actions.ts`

**`approveClaim(claimId)`**
- Sets `claim_requests.status = 'approved'`
- Sets `providers.user_id` to the claimant's `user_id`
- Upgrades claimant `profiles.role` to `'provider'`
- Sets all other pending claims for the same provider to `'rejected'`
- Revalidates admin claims page

**`rejectClaim(claimId)`**
- Sets `claim_requests.status = 'rejected'`
- Revalidates admin claims page

## Components

**`AccountDashboard`** (Server Component) — reads role and provider from profile, conditionally renders create/claim CTAs or edit link + listing status badge.

**`ClaimSearch`** (Client Component) — search input that calls a Server Action to find unowned providers matching query by name or phone. Renders results list with "Claim" button per result. On claim, calls `submitClaim`.

**`ClaimsManager`** (Client Component) — table of pending claim requests with Approve/Reject buttons, `useTransition` for pending state. Follows the same pattern as `ProvidersClient`.

**`ProviderForm` changes** — two new props added:
- `redirectTo: string` — destination used for both post-save redirect and the cancel button (replaces the hardcoded `/admin/providers` in both places)
- `action: (formData: FormData) => Promise<{ error?: string }>` — server action to call on submit

Existing admin callers are updated to pass explicit props:
- `/admin/providers/new/page.tsx` → `action={createProvider}` `redirectTo="/admin/providers"`
- `/admin/providers/[id]/edit/page.tsx` → `action={(fd) => updateProvider(provider.id, fd)}` `redirectTo="/admin/providers"` (bound wrapper, because `updateProvider` takes `id` as first arg)

The hard-import of admin actions is removed from `ProviderForm.tsx`.

In self-service mode, the `status` and `tier` fields are hidden from the form (those values are locked server-side).

## Error Handling

- Unauthenticated access to `/account/*` redirects to `/login`
- Provider accessing `/account/create` when they already own a listing is redirected to `/account`
- Duplicate claim (same user + same provider, status pending) returns a client-visible error message
- Claiming an already-owned provider returns an error

## Tests

No test framework installed — tests skipped for this issue, consistent with previous issues.

## Translation Keys

New `"account"` namespace in both message files:

```
account.title           — "Meu perfil" / "My account"
account.becomeProvider  — "Quero ser prestador" / "Become a provider"
account.createListing   — "Criar novo anúncio" / "Create new listing"
account.claimListing    — "Reivindicar anúncio existente" / "Claim existing listing"
account.myListing       — "Meu anúncio" / "My listing"
account.editListing     — "Editar anúncio" / "Edit listing"
account.listingPending  — "Aguardando aprovação" / "Pending approval"
account.claimSearch     — "Buscar por nome ou telefone..." / "Search by name or phone..."
account.claimSubmit     — "Solicitar este anúncio" / "Request this listing"
account.claimSent       — "Solicitação enviada! Aguarde a aprovação do administrador." / "Request sent! Awaiting admin approval."
account.claimDuplicate  — "Você já tem uma solicitação pendente para este anúncio." / "You already have a pending request for this listing."
account.claimOwned      — "Este anúncio já tem um dono." / "This listing already has an owner."
adminClaims.title       — "Solicitações de Reivindicação" / "Claim Requests"
adminClaims.approve     — "Aprovar" / "Approve"
adminClaims.reject      — "Rejeitar" / "Reject"
adminClaims.empty       — "Nenhuma solicitação pendente" / "No pending requests"
adminClaims.claimant    — "Solicitante" / "Claimant"
adminClaims.message     — "Mensagem" / "Message"
```
