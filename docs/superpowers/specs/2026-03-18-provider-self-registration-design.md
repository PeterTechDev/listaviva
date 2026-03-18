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
| `/[locale]/account/edit` | Provider | Edit own listing |
| `/[locale]/admin/claims` | Admin | Review pending claim requests |

## Navigation

Header shows a role-aware link for signed-in users:
- `consumer` → "Become a provider" → `/account`
- `provider` → "My listing" → `/account`
- `admin` → existing admin link unchanged

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

No changes to existing tables. `providers.user_id` and `profiles.role` already exist. Existing RLS already enforces provider ownership.

## Server Actions

### `src/app/[locale]/account/actions.ts`

**`createOwnProvider(formData)`**
- Inserts provider with `status: 'pending'`, `user_id: auth.uid()`
- Upgrades `profiles.role` to `'provider'`
- Redirects to `/account`

**`updateOwnProvider(formData)`**
- Updates provider where `user_id = auth.uid()` (RLS enforces this)
- Revalidates public profile page

**`submitClaim(providerId, message?)`**
- Validates: provider has no owner, user has no existing pending claim for it
- Inserts into `claim_requests`
- Returns confirmation (no redirect — stays on page)

### `src/app/[locale]/admin/claims/actions.ts`

**`approveClaim(claimId)`**
- Sets `claim_requests.status = 'approved'`
- Sets `providers.user_id` to claimant's id
- Upgrades claimant `profiles.role` to `'provider'`
- Rejects all other pending claims for the same provider
- Revalidates admin claims page

**`rejectClaim(claimId)`**
- Sets `claim_requests.status = 'rejected'`
- Revalidates admin claims page

## Components

**`AccountDashboard`** (Server Component) — reads role from profile, conditionally renders create/claim CTAs or edit link + listing status badge.

**`ClaimSearch`** (Client Component) — debounced search input, fetches unowned providers matching query, renders results list with "Claim" button per result. On claim, calls `submitClaim` action.

**`ClaimsManager`** (Client Component) — table of pending claims with Approve/Reject buttons, `useTransition` for pending state. Follows the same pattern as `ProvidersClient`.

**Provider form reuse** — `/account/create` and `/account/edit` reuse the existing `ProviderForm` component from `/admin/providers`. Create mode hides the `status` and `tier` fields (locked to `pending`/`free`).

## Error Handling

- Unauthenticated access to `/account/*` redirects to `/login`
- Provider accessing `/account/create` when they already own a listing is redirected to `/account`
- Duplicate claim (same user + same provider, status pending) returns a client-visible error message
- Claiming an already-owned provider returns an error

## Tests

No test framework installed — tests skipped for this issue, consistent with previous issues.

## Translation Keys

New keys needed in both `messages/pt-BR.json` and `messages/en.json` under a new `"account"` namespace.
