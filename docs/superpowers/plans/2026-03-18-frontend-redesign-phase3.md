# Frontend Redesign Phase 3 — Shared Components & Design Token Sweep

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract duplicated provider card markup and WhatsApp icon into shared components, replace `<select>` bairro filters with horizontal pill scrollers, and apply Tailwind v4 design tokens to the category listing and search results pages.

**Architecture:** Five focused tasks, each independently committable. Tasks 1 and 2 create leaf-node components (no dependencies). Tasks 3–5 consume them. The ProviderCard unifies two slightly different data shapes via a normalized props interface — callers normalize their data before rendering.

**Tech Stack:** Next.js 16 App Router, Tailwind v4 CSS-first (`@theme` tokens → `bg-accent`, `text-muted`, etc.), `lucide-react` (already installed), `@/i18n/navigation` for i18n-aware `Link` + `useRouter`.

---

## File Map

| Status | File | Responsibility |
|--------|------|----------------|
| Create | `src/components/whatsapp-icon.tsx` | Shared WhatsApp SVG icon — DRY across all pages |
| Create | `src/components/provider-card.tsx` | Shared photo-dominant provider card with design tokens |
| Modify | `src/app/[locale]/category/[slug]/BairroFilter.tsx` | Replace `<select>` with horizontal pill scroller |
| Modify | `src/app/[locale]/category/[slug]/page.tsx` | Use `ProviderCard`, apply design tokens, remove inline icon/card |
| Create | `src/app/[locale]/search/BairroFilter.tsx` | Pill filter for search page (ID-based, preserves `q` param) |
| Modify | `src/app/[locale]/search/page.tsx` | Use `ProviderCard`, use new `BairroFilter`, apply design tokens |
| Modify | `src/app/globals.css` | Add `.scrollbar-none` utility (used by pill scrollers) |

---

## Design Tokens Reference

From `src/app/globals.css` `@theme` block:

| Token | Value | Tailwind utility |
|-------|-------|-----------------|
| `--color-background` | `#FAF6EF` | `bg-background` |
| `--color-surface` | `#F0EAE0` | `bg-surface` |
| `--color-border` | `#E0D5C8` | `border-border` |
| `--color-primary` | `#1C1410` | `text-primary` |
| `--color-muted` | `#7A6A5F` | `text-muted` |
| `--color-accent` | `#C85C38` | `text-accent`, `bg-accent` |
| `--color-accent-hover` | `#A8431F` | `bg-accent-hover` |
| `--color-whatsapp` | `#25D366` | `text-whatsapp` |

---

## Task 1: WhatsApp Icon Component

**Files:**
- Create: `src/components/whatsapp-icon.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/whatsapp-icon.tsx
export function WhatsAppIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/whatsapp-icon.tsx
git commit -m "feat: extract shared WhatsAppIcon component"
```

---

## Task 2: Shared ProviderCard Component

**Files:**
- Create: `src/components/provider-card.tsx`

The card accepts a normalized props interface. Callers are responsible for extracting `photoUrl`, `bairroName`, and `description` from their raw Supabase data before rendering.

**Data shape notes:**
- Category page passes `photoUrl` (from `provider_photos`) and `categoryIcon` (for placeholder fallback)
- Search page has no photos; passes `categories[]` for badge rendering and uses `categories[0]?.icon` as `categoryIcon`
- Category page locale-selects the description before passing; search page passes `description_pt` unconditionally because `ProviderSearchResult` (from `src/lib/search.ts`) does not expose `description_en` — that's a pre-existing gap to fix separately in `searchProviders`

- [ ] **Step 1: Create the component**

```tsx
// src/components/provider-card.tsx
import { Link } from "@/i18n/navigation";
import { WhatsAppIcon } from "@/components/whatsapp-icon";

interface ProviderCardProps {
  name: string;
  slug: string;
  photoUrl?: string | null;
  categoryIcon?: string | null;
  bairroName?: string | null;
  description?: string | null;
  whatsapp?: string | null;
  categories?: {
    name_pt: string;
    name_en?: string | null;
    icon?: string | null;
  }[];
  locale: string;
  contactLabel: string;
}

export function ProviderCard({
  name,
  slug,
  photoUrl,
  categoryIcon,
  bairroName,
  description,
  whatsapp,
  categories,
  locale,
  contactLabel,
}: ProviderCardProps) {
  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden hover:shadow-md transition-shadow">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={name}
          className="w-full h-40 object-cover"
        />
      ) : (
        <div className="w-full h-40 bg-background flex items-center justify-center">
          <span className="text-4xl">{categoryIcon ?? "🏢"}</span>
        </div>
      )}
      <div className="p-4">
        <Link
          href={`/provider/${slug}`}
          className="font-semibold text-primary hover:text-accent transition-colors"
        >
          {name}
        </Link>
        {bairroName && (
          <p className="text-xs text-accent mt-0.5">📍 {bairroName}</p>
        )}
        {categories && categories.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {categories.map((cat) => (
              <span
                key={cat.name_pt}
                className="text-xs bg-background border border-border text-muted px-2 py-0.5 rounded-full"
              >
                {cat.icon && <span className="mr-1">{cat.icon}</span>}
                {locale === "en" ? (cat.name_en ?? cat.name_pt) : cat.name_pt}
              </span>
            ))}
          </div>
        )}
        {description && (
          <p className="mt-2 text-sm text-muted line-clamp-2">{description}</p>
        )}
        {whatsapp && (
          <a
            href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center gap-1.5 text-sm font-medium text-whatsapp hover:opacity-80 transition-opacity"
          >
            <WhatsAppIcon />
            {contactLabel}
          </a>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/provider-card.tsx
git commit -m "feat: add shared ProviderCard component with design tokens"
```

---

## Task 3: BairroFilter → Pill Scroller (Category Page) + scrollbar-none utility

**Files:**
- Modify: `src/app/[locale]/category/[slug]/BairroFilter.tsx`
- Modify: `src/app/globals.css`

The `<select>` is replaced with a horizontal pill row. The prop interface is unchanged so `page.tsx` needs no edits for this task. `filterLabel` prop is kept for API compatibility but no longer rendered.

- [ ] **Step 1: Add scrollbar-none utility to globals.css**

Append to `src/app/globals.css`:

```css
/* ── Utilities ──────────────────────────────────────────────────────────── */

.scrollbar-none {
  scrollbar-width: none; /* Firefox */
}

.scrollbar-none::-webkit-scrollbar {
  display: none; /* Chrome, Safari */
}
```

- [ ] **Step 2: Replace BairroFilter with pill implementation**

Full replacement of `src/app/[locale]/category/[slug]/BairroFilter.tsx`:

```tsx
"use client";

import { useRouter, usePathname } from "@/i18n/navigation";

interface Bairro {
  id: string;
  name: string;
  slug: string;
}

export default function BairroFilter({
  bairros,
  currentBairro,
  allLabel,
}: {
  bairros: Bairro[];
  currentBairro: string;
  filterLabel: string; // kept for interface compat, not rendered
  allLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function handleSelect(slug: string) {
    if (slug) {
      router.push(`${pathname}?bairro=${slug}`);
    } else {
      router.push(pathname);
    }
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap scrollbar-none">
      <button
        onClick={() => handleSelect("")}
        className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
          !currentBairro
            ? "bg-accent text-white"
            : "bg-surface border border-border text-muted hover:border-accent hover:text-accent"
        }`}
      >
        {allLabel}
      </button>
      {bairros.map((b) => (
        <button
          key={b.id}
          onClick={() => handleSelect(b.slug)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            currentBairro === b.slug
              ? "bg-accent text-white"
              : "bg-surface border border-border text-muted hover:border-accent hover:text-accent"
          }`}
        >
          {b.name}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/app/[locale]/category/[slug]/BairroFilter.tsx
git commit -m "feat: replace BairroFilter select with pill scroller"
```

---

## Task 4: Category Listing Page — Design Token Sweep

**Files:**
- Modify: `src/app/[locale]/category/[slug]/page.tsx`

Replace all legacy Tailwind classes (`gray-*`, `emerald-*`, `white`) with design tokens. Remove inline `WhatsAppIcon` and inline provider card markup; use `<ProviderCard>` instead.

**Legacy → token mapping for this file:**
- `bg-white` → `bg-surface`
- `border-gray-200` → `border-border`
- `text-gray-900` → `text-primary`
- `text-gray-400`, `text-gray-500` → `text-muted`
- `text-gray-600` → `text-muted`
- `text-gray-700` → `text-primary`
- `text-emerald-600`, `text-emerald-700` → `text-accent`
- `hover:text-emerald-700` → `hover:text-accent-hover`
- `bg-emerald-500` → `bg-accent`
- `bg-emerald-600` → `bg-accent`
- `hover:bg-emerald-600` → `hover:bg-accent-hover`
- `focus:ring-emerald-500` → `focus:ring-accent`
- `bg-gradient-to-br from-emerald-50 to-emerald-100` → `bg-background` (ProviderCard handles this)
- `border-gray-100` → `border-border`

- [ ] **Step 1: Rewrite page.tsx**

Note: The h1 + BairroFilter wrapper is intentionally changed from `sm:flex-row sm:items-center sm:justify-between` (side-by-side on wide viewports) to always-stacked `flex-col gap-4`. This gives the pill scroller full width on all viewports.

Full replacement of `src/app/[locale]/category/[slug]/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/header";
import { ProviderCard } from "@/components/provider-card";
import BairroFilter from "./BairroFilter";

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ bairro?: string }>;
}) {
  const { locale, slug } = await params;
  const { bairro: bairroFilter } = await searchParams;
  const t = await getTranslations({ locale });

  const supabase = await createClient();

  const { data: category } = await supabase
    .from("categories")
    .select("id, name_pt, name_en, slug, icon")
    .eq("slug", slug)
    .single();

  if (!category) notFound();

  const categoryName =
    locale === "en" ? (category.name_en ?? category.name_pt) : category.name_pt;

  const { data: bairros } = await supabase
    .from("bairros")
    .select("id, name, slug")
    .order("name");

  let providerQuery = supabase
    .from("providers")
    .select(
      `
      id,
      name,
      slug,
      description_pt,
      description_en,
      whatsapp,
      home_bairro:home_bairro_id(name, slug),
      provider_categories!inner(category_id),
      provider_photos(url, sort_order)
      `
    )
    .eq("status", "active")
    .eq("provider_categories.category_id", category.id)
    .order("name");

  if (bairroFilter) {
    const { data: areaProviderIds } = await supabase
      .from("provider_service_areas")
      .select("provider_id, bairros!inner(slug)")
      .eq("bairros.slug", bairroFilter);

    const ids = areaProviderIds?.map((r) => r.provider_id) ?? [];
    if (ids.length === 0) {
      return (
        <CategoryPageLayout
          header={<Header />}
          categoryName={categoryName}
          icon={category.icon}
          bairros={bairros ?? []}
          currentBairro={bairroFilter}
          locale={locale}
          t={t}
        >
          <EmptyState message={t("catalog.noProvidersWithFilter")} />
        </CategoryPageLayout>
      );
    }
    providerQuery = providerQuery.in("id", ids);
  }

  const { data: providers } = await providerQuery;

  return (
    <CategoryPageLayout
      header={<Header />}
      categoryName={categoryName}
      icon={category.icon}
      bairros={bairros ?? []}
      currentBairro={bairroFilter}
      locale={locale}
      t={t}
    >
      {!providers || providers.length === 0 ? (
        <EmptyState message={t("catalog.noProviders")} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {providers.map((provider) => {
            const photo = provider.provider_photos
              ?.sort(
                (a: { sort_order: number }, b: { sort_order: number }) =>
                  a.sort_order - b.sort_order
              )
              ?.[0]?.url;
            const desc =
              locale === "en"
                ? (provider.description_en ?? provider.description_pt)
                : provider.description_pt;
            const bairroRaw = provider.home_bairro;
            const bairroName = Array.isArray(bairroRaw)
              ? (bairroRaw[0] as { name: string } | undefined)?.name
              : (bairroRaw as { name: string } | null)?.name;

            return (
              <ProviderCard
                key={provider.id}
                name={provider.name}
                slug={provider.slug}
                photoUrl={photo}
                categoryIcon={category.icon}
                bairroName={bairroName}
                description={desc}
                whatsapp={provider.whatsapp}
                locale={locale}
                contactLabel={t("provider.contactWhatsApp")}
              />
            );
          })}
        </div>
      )}
    </CategoryPageLayout>
  );
}

function CategoryPageLayout({
  header,
  categoryName,
  icon,
  bairros,
  currentBairro,
  locale,
  t,
  children,
}: {
  header: React.ReactNode;
  categoryName: string;
  icon: string | null;
  bairros: { id: string; name: string; slug: string }[];
  currentBairro?: string;
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {header}
      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted mb-6">
          <Link href="/" className="hover:text-primary transition-colors">
            {t("common.appName")}
          </Link>
          <span>/</span>
          <span className="text-primary">
            {icon && <span className="mr-1">{icon}</span>}
            {categoryName}
          </span>
        </div>

        <div className="flex flex-col gap-4 mb-6">
          <h1 className="text-2xl font-bold text-primary">
            {icon && <span className="mr-2">{icon}</span>}
            {categoryName}
          </h1>

          {/* Bairro filter pills */}
          <BairroFilter
            bairros={bairros}
            currentBairro={currentBairro ?? ""}
            filterLabel={t("catalog.filterByBairro")}
            allLabel={t("catalog.allBairros")}
          />
        </div>

        {/* Compact search bar */}
        <form method="GET" action={`/${locale}/search`} className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              name="q"
              placeholder={t("common.searchPlaceholder")}
              className="flex-1 h-10 px-4 rounded-xl border border-border bg-surface text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-sm"
            />
            <button
              type="submit"
              className="h-10 px-4 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent-hover transition-colors"
            >
              {t("common.search")}
            </button>
          </div>
        </form>
        {children}
      </main>

      <footer className="border-t border-border py-6">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-muted">
          {t("common.appName")} &mdash; {t("common.tagline")}
        </div>
      </footer>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-20 text-center text-muted">
      <div className="text-5xl mb-4">🔍</div>
      <p>{message}</p>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/[locale]/category/[slug]/page.tsx
git commit -m "feat: apply design tokens to category listing page, use ProviderCard"
```

---

## Task 5: Search Results Page — Design Token Sweep + Pill Filter

**Files:**
- Create: `src/app/[locale]/search/BairroFilter.tsx`
- Modify: `src/app/[locale]/search/page.tsx`

The search page filter uses `bairro_id` (UUID) instead of bairro slug, and must preserve the `q` query param. A separate `BairroFilter` client component handles this routing pattern.

- [ ] **Step 1: Create search BairroFilter client component**

```tsx
// src/app/[locale]/search/BairroFilter.tsx
"use client";

import { useRouter } from "@/i18n/navigation";

interface Bairro {
  id: string;
  name: string;
}

export default function SearchBairroFilter({
  bairros,
  currentBairroId,
  query,
  allLabel,
}: {
  bairros: Bairro[];
  currentBairroId: string;
  query: string;
  allLabel: string;
}) {
  const router = useRouter();

  function handleSelect(id: string) {
    const params = new URLSearchParams({ q: query });
    if (id) params.set("bairro_id", id);
    router.push(`/search?${params.toString()}`);
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap scrollbar-none">
      <button
        onClick={() => handleSelect("")}
        className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
          !currentBairroId
            ? "bg-accent text-white"
            : "bg-surface border border-border text-muted hover:border-accent hover:text-accent"
        }`}
      >
        {allLabel}
      </button>
      {bairros.map((b) => (
        <button
          key={b.id}
          onClick={() => handleSelect(b.id)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            currentBairroId === b.id
              ? "bg-accent text-white"
              : "bg-surface border border-border text-muted hover:border-accent hover:text-accent"
          }`}
        >
          {b.name}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite search page.tsx**

Full replacement of `src/app/[locale]/search/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { Link } from "@/i18n/navigation";
import { searchProviders } from "@/lib/search";
import { ProviderCard } from "@/components/provider-card";
import SearchBairroFilter from "./BairroFilter";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: t("search.title") };
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; bairro_id?: string }>;
}) {
  const { locale } = await params;
  const { q = "", bairro_id } = await searchParams;
  const t = await getTranslations({ locale });

  if (!q.trim()) redirect("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ results, usedFallback: _usedFallback }, { data: bairros }] =
    await Promise.all([
      searchProviders({
        query: q,
        bairroId: bairro_id ?? null,
        userId: user?.id ?? null,
        supabase,
      }),
      supabase.from("bairros").select("id, name, slug").order("name"),
    ]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted mb-6">
          <Link href="/" className="hover:text-primary transition-colors">
            {t("common.appName")}
          </Link>
          <span>/</span>
          <span className="text-primary">{t("search.title")}</span>
        </div>

        <h1 className="text-2xl font-bold text-primary mb-4">
          {t("search.resultsFor", { q })}
        </h1>

        {/* Bairro filter pills */}
        <div className="mb-8">
          <SearchBairroFilter
            bairros={bairros ?? []}
            currentBairroId={bairro_id ?? ""}
            query={q}
            allLabel={t("search.allBairros")}
          />
        </div>

        {results.length === 0 ? (
          <div className="py-20 text-center text-muted">
            <div className="text-5xl mb-4">🔍</div>
            <p>{t("search.noResults")}</p>
            {bairro_id && (
              <p className="mt-2 text-sm">
                <Link
                  href={`/search?q=${encodeURIComponent(q)}`}
                  className="text-accent hover:text-accent-hover"
                >
                  {t("search.tryWithout")}
                </Link>
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((provider) => (
              <ProviderCard
                key={provider.id}
                name={provider.name}
                slug={provider.slug}
                categoryIcon={provider.categories[0]?.icon}
                bairroName={provider.home_bairro?.name}
                description={provider.description_pt}
                whatsapp={provider.whatsapp}
                categories={provider.categories}
                locale={locale}
                contactLabel={t("provider.contactWhatsApp")}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-border py-6">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-muted">
          {t("common.appName")} &mdash; {t("common.tagline")}
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/search/BairroFilter.tsx src/app/[locale]/search/page.tsx
git commit -m "feat: apply design tokens to search results page, use ProviderCard + pill filter"
```

---

## Final Verification

After all 5 tasks are committed:

- [ ] Run `npx tsc --noEmit` — zero errors
- [ ] Run `npm test` — all tests pass
- [ ] No `emerald-`, `gray-`, or `bg-white` left in modified files: `grep -r "emerald\|bg-white\|text-gray\|border-gray" src/app/[locale]/category src/app/[locale]/search`
- [ ] Both components (`WhatsAppIcon`, `ProviderCard`) are exported and used (no dead code)
