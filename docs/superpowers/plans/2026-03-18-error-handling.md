# Error Handling — Silent Failures Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate silent failures where Supabase DB errors become invisible 404s, add user-facing error boundaries, and harden two data-shaping helpers.

**Architecture:** Four focused tasks — (1) shared utility helpers with unit tests; (2) locale-scoped + root error boundaries; (3) fix `.single()` error handling in the two public-facing Server Component pages; (4) add logging to auth helpers. Tasks are independent and can be committed separately. No new dependencies.

**Tech Stack:** Next.js 16 App Router, Supabase JS v2 (`PGRST116` = row-not-found error code), Vitest, Tailwind v4 design tokens.

---

## Design Tokens Reference (for error boundary UI)

All tokens from `src/app/globals.css` `@theme`:
- `bg-background` (#FAF6EF), `bg-surface` (#F0EAE0), `bg-accent` (#C85C38)
- `text-primary` (#1C1410), `text-muted` (#7A6A5F)
- `border-border` (#E0D5C8), `bg-accent-hover` (#A8431F)

---

## File Map

| Status | File | Change |
|--------|------|--------|
| Create | `src/lib/supabase/utils.ts` | `parseWorkingHours()` + `buildWhatsAppHref()` helpers |
| Create | `src/lib/supabase/utils.test.ts` | Unit tests for both helpers |
| Create | `src/app/error.tsx` | Root error boundary (fallback) |
| Create | `src/app/[locale]/error.tsx` | Locale-scoped error boundary (what users see) |
| Modify | `src/app/[locale]/category/[slug]/page.tsx` | Fix `.single()` error handling |
| Modify | `src/app/[locale]/provider/[slug]/page.tsx` | Fix 2× `.single()` + use `parseWorkingHours` + `buildWhatsAppHref` |
| Modify | `src/components/provider-card.tsx` | Use `buildWhatsAppHref` |
| Modify | `src/lib/auth/index.ts` | Log DB error, add test coverage |
| Modify | `src/lib/auth/index.test.ts` | Test DB error logging behavior |

---

## Task 1: Utility helpers

**Files:**
- Create: `src/lib/supabase/utils.ts`
- Create: `src/lib/supabase/utils.test.ts`

Two pure functions that replace unsafe patterns used in multiple files.

- [ ] **Step 1: Write failing tests**

Create `src/lib/supabase/utils.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseWorkingHours, buildWhatsAppHref } from "./utils";

describe("parseWorkingHours", () => {
  it("returns valid object as-is", () => {
    const input = { monday: "9h-18h", tuesday: "9h-18h" };
    expect(parseWorkingHours(input)).toEqual(input);
  });

  it("returns {} for null", () => {
    expect(parseWorkingHours(null)).toEqual({});
  });

  it("returns {} for array", () => {
    expect(parseWorkingHours(["9h-18h"])).toEqual({});
  });

  it("returns {} for string", () => {
    expect(parseWorkingHours("closed")).toEqual({});
  });

  it("returns {} for number", () => {
    expect(parseWorkingHours(42)).toEqual({});
  });

  it("returns {} for undefined", () => {
    expect(parseWorkingHours(undefined)).toEqual({});
  });
});

describe("buildWhatsAppHref", () => {
  it("returns href for valid number", () => {
    expect(buildWhatsAppHref("+55 27 99999-9999")).toBe(
      "https://wa.me/5527999999999"
    );
  });

  it("returns href for bare digits", () => {
    expect(buildWhatsAppHref("5527999999999")).toBe(
      "https://wa.me/5527999999999"
    );
  });

  it("returns null for null", () => {
    expect(buildWhatsAppHref(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(buildWhatsAppHref(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(buildWhatsAppHref("")).toBeNull();
  });

  it("returns null for non-digit string like 'N/A'", () => {
    expect(buildWhatsAppHref("N/A")).toBeNull();
  });

  it("returns null for string shorter than 7 digits", () => {
    expect(buildWhatsAppHref("123456")).toBeNull();
  });

  it("strips all non-digit characters", () => {
    expect(buildWhatsAppHref("(27) 9 9999-9999")).toBe(
      "https://wa.me/27999999999"
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/supabase/utils.test.ts`
Expected: FAIL — "Cannot find module './utils'"

- [ ] **Step 3: Implement the helpers**

Create `src/lib/supabase/utils.ts`:

```ts
/**
 * Safely casts a Supabase JSON column to Record<string, string>.
 * Returns {} if the value is null, an array, or a non-object primitive.
 */
export function parseWorkingHours(raw: unknown): Record<string, string> {
  if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, string>;
  }
  return {};
}

/**
 * Builds a WhatsApp deep link from a phone number string.
 * Returns null if the number is missing or contains fewer than 7 digits
 * (guards against "N/A", "-", empty strings stored in the DB).
 */
export function buildWhatsAppHref(
  whatsapp: string | null | undefined
): string | null {
  if (!whatsapp) return null;
  const digits = whatsapp.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return `https://wa.me/${digits}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/supabase/utils.test.ts`
Expected: 14 tests pass

- [ ] **Step 5: Run full suite**

Run: `npx vitest run`
Expected: all tests pass (47 + 14 new = 61)

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase/utils.ts src/lib/supabase/utils.test.ts
git commit -m "feat: add parseWorkingHours and buildWhatsAppHref utility helpers"
```

---

## Task 2: Error boundaries

**Files:**
- Create: `src/app/[locale]/error.tsx`
- Create: `src/app/error.tsx`

Next.js error boundaries must be `"use client"`. They receive `error` (the thrown value) and `reset` (retry function). The locale-scoped one at `src/app/[locale]/error.tsx` is what users will actually see; the root one at `src/app/error.tsx` is a fallback.

- [ ] **Step 1: Create locale-scoped error boundary**

Create `src/app/[locale]/error.tsx`:

```tsx
"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <div className="text-5xl mb-4">⚠️</div>
      <h1 className="text-xl font-bold text-primary mb-2">
        Algo deu errado
      </h1>
      <p className="text-muted mb-6 max-w-sm">
        Ocorreu um erro inesperado. Tente novamente ou volte para a página
        inicial.
      </p>
      <div className="flex gap-3 flex-wrap justify-center">
        <button
          onClick={reset}
          className="px-4 py-2 bg-accent text-white rounded-xl font-medium hover:bg-accent-hover transition-colors"
        >
          Tentar novamente
        </button>
        <a
          href="/"
          className="px-4 py-2 bg-surface border border-border text-muted rounded-xl font-medium hover:border-accent hover:text-accent transition-colors"
        >
          Página inicial
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create root error boundary**

Create `src/app/error.tsx` with the same content as above (identical — same copy).

- [ ] **Step 3: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: zero errors

- [ ] **Step 4: Run full suite**

Run: `npx vitest run`
Expected: all tests still pass

- [ ] **Step 5: Commit**

```bash
git add src/app/error.tsx src/app/[locale]/error.tsx
git commit -m "feat: add error boundaries — user-facing error page with retry"
```

---

## Task 3: Fix `.single()` error handling in public pages

**Files:**
- Modify: `src/app/[locale]/category/[slug]/page.tsx`
- Modify: `src/app/[locale]/provider/[slug]/page.tsx`
- Modify: `src/components/provider-card.tsx`

**Pattern to apply in every page `.single()` call:**
```ts
const { data: thing, error } = await supabase.from("table")...single();

if (error) {
  if (error.code === "PGRST116") notFound(); // row not found — correct 404
  console.error("[page-name] Supabase error", {
    slug,
    code: error.code,
    message: error.message,
  });
  throw error; // real DB/auth/network error → triggers error.tsx (500)
}
if (!thing) notFound(); // fallback (should be unreachable after error check)
```

`PGRST116` is the PostgREST error code for "no rows returned" — the only case that should produce a 404.

- [ ] **Step 1: Fix `src/app/[locale]/category/[slug]/page.tsx`**

Replace lines 22–28 (the `.single()` fetch + null check):

```ts
const { data: category, error: categoryError } = await supabase
  .from("categories")
  .select("id, name_pt, name_en, slug, icon")
  .eq("slug", slug)
  .single();

if (categoryError) {
  if (categoryError.code === "PGRST116") notFound();
  console.error("[category-page] Supabase error", {
    slug,
    code: categoryError.code,
    message: categoryError.message,
  });
  throw categoryError;
}
if (!category) notFound();
```

- [ ] **Step 2: Fix `src/app/[locale]/provider/[slug]/page.tsx` — `generateMetadata`**

Replace the `.single()` fetch block inside `generateMetadata` (currently lines ~57-66):

```ts
const { data: provider, error: metaError } = await supabase
  .from("providers")
  .select("name, description_pt, description_en")
  .eq("slug", slug)
  .eq("status", "active")
  .single();

if (metaError && metaError.code !== "PGRST116") {
  console.error("[provider-page] generateMetadata Supabase error", {
    slug,
    code: metaError.code,
    message: metaError.message,
  });
}

if (!provider) return {};
```

Note: `generateMetadata` should NOT throw on DB errors — a metadata failure should not crash the page render. Return `{}` (empty metadata) as a safe fallback.

- [ ] **Step 3: Fix `src/app/[locale]/provider/[slug]/page.tsx` — `ProviderPage`**

Replace the main `.single()` fetch block (currently lines ~95-107) and update the `workingHours` and `whatsappHref` lines:

At the top of the file, add import:
```ts
import { parseWorkingHours, buildWhatsAppHref } from "@/lib/supabase/utils";
```

Replace the main fetch:
```ts
const { data: provider, error: providerError } = await supabase
  .from("providers")
  .select(
    `
    id, name, slug, description_pt, description_en,
    whatsapp, phone, working_hours,
    home_bairro:home_bairro_id(name, slug),
    provider_photos(url, sort_order),
    provider_categories(
      categories(id, name_pt, name_en, slug, icon)
    ),
    provider_service_areas(
      bairros(id, name)
    )
    `
  )
  .eq("slug", slug)
  .eq("status", "active")
  .single();

if (providerError) {
  if (providerError.code === "PGRST116") notFound();
  console.error("[provider-page] Supabase error", {
    slug,
    code: providerError.code,
    message: providerError.message,
  });
  throw providerError;
}
if (!provider) notFound();
```

Replace the `workingHours` line:
```ts
const workingHours = parseWorkingHours(provider.working_hours);
```

Replace the `whatsappHref` line:
```ts
const whatsappHref = buildWhatsAppHref(provider.whatsapp);
```

- [ ] **Step 4: Fix `src/components/provider-card.tsx`**

Add import at top:
```ts
import { buildWhatsAppHref } from "@/lib/supabase/utils";
```

The `provider-card.tsx` receives `whatsapp?: string` as a prop. Find the `whatsapp &&` block (currently line ~73-83) and replace the inline href construction:

```tsx
{buildWhatsAppHref(whatsapp) && (
  <a
    href={buildWhatsAppHref(whatsapp)!}
    target="_blank"
    rel="noopener noreferrer"
    className="mt-3 flex items-center gap-1.5 text-sm font-medium text-whatsapp hover:opacity-80 transition-opacity"
  >
    <WhatsAppIcon />
    {contactLabel}
  </a>
)}
```

Or cleaner — compute once:
```tsx
const waHref = buildWhatsAppHref(whatsapp);
// ... inside JSX:
{waHref && (
  <a
    href={waHref}
    target="_blank"
    rel="noopener noreferrer"
    className="mt-3 flex items-center gap-1.5 text-sm font-medium text-whatsapp hover:opacity-80 transition-opacity"
  >
    <WhatsAppIcon />
    {contactLabel}
  </a>
)}
```

Note: `provider-card.tsx` is a Server Component (no `"use client"`). Compute `waHref` near the top of the component function body.

- [ ] **Step 5: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: zero errors

- [ ] **Step 6: Run full suite**

Run: `npx vitest run`
Expected: all tests pass

- [ ] **Step 7: Verify no legacy whatsapp pattern remains**

Run: `grep -rn "wa\.me/\${" src/`
Expected: no output (all uses now go through `buildWhatsAppHref`)

- [ ] **Step 8: Commit**

```bash
git add \
  "src/app/[locale]/category/[slug]/page.tsx" \
  "src/app/[locale]/provider/[slug]/page.tsx" \
  "src/components/provider-card.tsx"
git commit -m "fix: distinguish Supabase not-found from real errors; use utility helpers"
```

---

## Task 4: Add logging to auth helpers

**Files:**
- Modify: `src/lib/auth/index.ts`
- Modify: `src/lib/auth/index.test.ts`

`getCurrentUser()` already returns `null` on profile fetch failure (correct fail-safe for auth — don't expose errors). The fix is to add logging so failures are visible without changing the return value. We also add a test to verify the DB error case logs rather than throws.

- [ ] **Step 1: Add test for DB error logging**

In `src/lib/auth/index.test.ts`, add to the `getCurrentUser` describe block:

```ts
it("returns null and logs when profile fetch returns a db error", async () => {
  const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  mockSingle.mockResolvedValue({
    data: null,
    error: { code: "PGRST301", message: "connection refused" },
  });

  const result = await getCurrentUser();

  expect(result).toBeNull();
  expect(consoleSpy).toHaveBeenCalledWith(
    expect.stringContaining("[auth]"),
    expect.objectContaining({ code: "PGRST301" })
  );
  consoleSpy.mockRestore();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/auth/index.test.ts`
Expected: FAIL — console.error not called

- [ ] **Step 3: Add logging to `getCurrentUser`**

In `src/lib/auth/index.ts`, update the profile fetch:

```ts
export async function getCurrentUser(): Promise<UserProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, full_name, avatar_url, locale")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("[auth] profile fetch failed", {
      userId: user.id,
      code: error.code,
      message: error.message,
    });
  }

  return profile ?? null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/auth/index.test.ts`
Expected: all tests pass (including the new one)

- [ ] **Step 5: Run full suite**

Run: `npx vitest run`
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/index.ts src/lib/auth/index.test.ts
git commit -m "fix: log Supabase error in getCurrentUser instead of silently returning null"
```

---

## Final Verification

- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npx vitest run` — all tests pass (61+)
- [ ] `grep -rn "wa\.me/\${" src/` — empty (all WhatsApp hrefs go through `buildWhatsAppHref`)
- [ ] `grep -rn "working_hours as Record" src/` — empty (all casts use `parseWorkingHours`)
- [ ] `src/app/error.tsx` and `src/app/[locale]/error.tsx` both exist
