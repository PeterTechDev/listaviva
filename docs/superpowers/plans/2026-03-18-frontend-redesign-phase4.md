# Frontend Redesign Phase 4 — Provider Detail Page

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the warm terracotta design system to the provider detail page, replace the inline `WhatsAppIcon` with the shared component, and add a sticky WhatsApp CTA at the bottom for mobile users.

**Architecture:** Two focused tasks — Task 1 fixes the single legacy token in the PhotoGallery client component; Task 2 does the full token sweep on the page, imports the shared `WhatsAppIcon`, and adds the sticky mobile CTA. The sticky CTA is a `fixed` element rendered outside the content flow; extra bottom padding on the content div compensates for the overlap.

**Tech Stack:** Next.js 16 App Router (Server Component page), Tailwind v4 CSS-first (`@theme` tokens), `@/components/whatsapp-icon` (already exists from Phase 3).

---

## Design Tokens Reference

All tokens are in `src/app/globals.css` `@theme`:

| Legacy class | Design token |
|---|---|
| `text-gray-400`, `text-gray-500`, `text-gray-600` | `text-muted` |
| `text-gray-700`, `text-gray-900` | `text-primary` |
| `text-emerald-600` | `text-accent` |
| `bg-emerald-500`, `bg-emerald-600` | `bg-whatsapp` (WhatsApp CTA) |
| `hover:bg-emerald-600` | `hover:opacity-90` |
| `bg-emerald-50 text-emerald-700` | `bg-surface border border-border text-muted` |
| `bg-gray-100 text-gray-600` | `bg-surface border border-border text-muted` |
| `bg-gray-50 border-gray-100` | `bg-surface border-border` |
| `even:bg-white` | `even:bg-background` |
| `border-gray-100` | `border-border` |
| `border-emerald-500` | `border-accent` |

**Important:** WhatsApp CTAs use `bg-whatsapp` (#25D366) — not `bg-accent` (#C85C38). WhatsApp green is a trusted brand signal and must stay green.

---

## File Map

| Status | File | Change |
|--------|------|--------|
| Modify | `src/app/[locale]/provider/[slug]/PhotoGallery.tsx` | `border-emerald-500` → `border-accent`; add `scrollbar-none` to thumbnail row |
| Modify | `src/app/[locale]/provider/[slug]/page.tsx` | Full token sweep; import shared `WhatsAppIcon`; add sticky mobile CTA |

---

## Task 1: PhotoGallery — design token fix

**Files:**
- Modify: `src/app/[locale]/provider/[slug]/PhotoGallery.tsx`

Two changes: active thumbnail border color and thumbnail scroll container class.

- [ ] **Step 1: Apply changes**

Full replacement of `src/app/[locale]/provider/[slug]/PhotoGallery.tsx`:

```tsx
"use client";
import { useState } from "react";

export default function PhotoGallery({ photos, name }: { photos: string[]; name: string }) {
  const [selected, setSelected] = useState(0);

  if (photos.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photos[selected]}
        alt={name}
        className="w-full h-72 object-cover rounded-xl"
      />
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {photos.map((url, i) => (
            <button key={url} onClick={() => setSelected(i)} className="flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`${name} ${i + 1}`}
                className={`w-16 h-16 object-cover rounded-lg border-2 transition-colors ${
                  i === selected ? "border-accent" : "border-transparent"
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: zero errors

- [ ] **Step 3: Commit**

```bash
git add "src/app/[locale]/provider/[slug]/PhotoGallery.tsx"
git commit -m "feat: apply design tokens to PhotoGallery component"
```

---

## Task 2: Provider detail page — full redesign

**Files:**
- Modify: `src/app/[locale]/provider/[slug]/page.tsx`

Key changes vs. current:
1. Import `WhatsAppIcon` from `@/components/whatsapp-icon`; delete the local `WhatsAppIcon` function at the bottom of the file
2. All legacy color classes replaced with design tokens (see table above)
3. WhatsApp CTA buttons use `bg-whatsapp hover:opacity-90` (green, NOT terracotta)
4. Header WhatsApp button is `hidden md:inline-flex` — desktop-only (mobile uses sticky bar)
5. Bottom in-content WhatsApp CTA is `hidden md:block` — desktop-only
6. Sticky mobile CTA: `fixed bottom-0 z-10 md:hidden` with `paddingBottom: calc(5rem + env(safe-area-inset-bottom))` to sit above the BottomNav (the layout wraps all content in `pb-20` for the nav; `5rem` = 80px = the nav's reserved space)
7. Content div gets `pb-16 md:pb-0` to add 64px extra bottom clearance on mobile, preventing the sticky CTA from obscuring the last content block

- [ ] **Step 1: Rewrite page.tsx**

Full replacement of `src/app/[locale]/provider/[slug]/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/header";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import PhotoGallery from "./PhotoGallery";
import type { Metadata } from "next";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const DAY_LABELS: Record<string, { pt: string; en: string }> = {
  monday: { pt: "Segunda", en: "Monday" },
  tuesday: { pt: "Terça", en: "Tuesday" },
  wednesday: { pt: "Quarta", en: "Wednesday" },
  thursday: { pt: "Quinta", en: "Thursday" },
  friday: { pt: "Sexta", en: "Friday" },
  saturday: { pt: "Sábado", en: "Saturday" },
  sunday: { pt: "Domingo", en: "Sunday" },
};

type Category = {
  id: string;
  name_pt: string;
  name_en: string | null;
  slug: string;
  icon: string | null;
};

type Bairro = { id: string; name: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const supabase = await createClient();
  const { data: provider } = await supabase
    .from("providers")
    .select("name, description_pt, description_en")
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  if (!provider) return {};

  const desc =
    locale === "en"
      ? (provider.description_en ?? provider.description_pt)
      : provider.description_pt;

  return {
    title: provider.name,
    description: desc ?? undefined,
  };
}

export default async function ProviderPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale });
  const supabase = await createClient();

  const { data: provider } = await supabase
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

  if (!provider) notFound();

  const photos = (provider.provider_photos ?? [])
    .sort(
      (a: { sort_order: number }, b: { sort_order: number }) =>
        a.sort_order - b.sort_order
    )
    .map((p: { url: string }) => p.url);

  const desc =
    locale === "en"
      ? (provider.description_en ?? provider.description_pt)
      : provider.description_pt;

  const homeBairroRaw = provider.home_bairro;
  const homeBairro = Array.isArray(homeBairroRaw)
    ? (homeBairroRaw[0] as { name: string; slug: string } | undefined)
    : (homeBairroRaw as { name: string; slug: string } | null);

  const categories: Category[] = (provider.provider_categories ?? [])
    .map(
      (pc: { categories: Category | Category[] | null }) =>
        Array.isArray(pc.categories) ? pc.categories[0] : pc.categories
    )
    .filter((c): c is Category => c != null);

  const serviceAreas: Bairro[] = (provider.provider_service_areas ?? [])
    .map(
      (sa: { bairros: Bairro | Bairro[] | null }) =>
        Array.isArray(sa.bairros) ? sa.bairros[0] : sa.bairros
    )
    .filter((b): b is Bairro => b != null);

  const workingHours = (provider.working_hours as Record<string, string>) ?? {};

  const whatsappHref = provider.whatsapp
    ? `https://wa.me/${provider.whatsapp.replace(/\D/g, "")}`
    : null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-8 w-full">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted mb-6">
          <Link href="/" className="hover:text-primary transition-colors">
            {t("common.appName")}
          </Link>
          <span>/</span>
          <span className="text-primary">{provider.name}</span>
        </div>

        <div className="space-y-6 pb-16 md:pb-0">
          {/* Photos */}
          <PhotoGallery photos={photos} name={provider.name} />

          {/* Header info */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-primary">{provider.name}</h1>
              {homeBairro && (
                <p className="text-sm text-accent mt-0.5">📍 {homeBairro.name}</p>
              )}
            </div>
            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:inline-flex items-center gap-2 px-4 py-2 bg-whatsapp text-white rounded-xl font-medium hover:opacity-90 transition-opacity whitespace-nowrap"
              >
                <WhatsAppIcon size={18} />
                {t("provider.contactWhatsApp")}
              </a>
            )}
          </div>

          {/* Description */}
          {desc ? (
            <p className="text-muted leading-relaxed">{desc}</p>
          ) : (
            <p className="text-muted italic">{t("provider.noDescription")}</p>
          )}

          {/* Categories */}
          {categories.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-2">
                {t("provider.categories")}
              </h2>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/category/${cat.slug}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface border border-border text-muted rounded-full text-sm font-medium hover:border-accent hover:text-accent transition-colors"
                  >
                    {cat.icon && <span>{cat.icon}</span>}
                    {locale === "en" ? (cat.name_en ?? cat.name_pt) : cat.name_pt}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Service areas */}
          {serviceAreas.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-2">
                {t("provider.serviceAreas")}
              </h2>
              <div className="flex flex-wrap gap-2">
                {serviceAreas.map((b) => (
                  <span
                    key={b.id}
                    className="px-3 py-1 bg-surface border border-border text-muted rounded-full text-sm"
                  >
                    {b.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Working hours */}
          {Object.keys(workingHours).length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-2">
                {t("provider.workingHours")}
              </h2>
              <div className="bg-surface rounded-xl overflow-hidden border border-border">
                {DAYS.map((day) => (
                  <div
                    key={day}
                    className="flex justify-between px-4 py-2.5 even:bg-background text-sm"
                  >
                    <span className="font-medium text-primary">
                      {locale === "en" ? DAY_LABELS[day].en : DAY_LABELS[day].pt}
                    </span>
                    <span className="text-muted">
                      {workingHours[day] || t("provider.closed")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom WhatsApp CTA — desktop only, mobile uses sticky bar below */}
          {whatsappHref && (
            <div className="hidden md:block pt-4 border-t border-border">
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-whatsapp text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
              >
                <WhatsAppIcon size={18} />
                {t("provider.contactWhatsApp")}
              </a>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-border py-6">
        <div className="max-w-3xl mx-auto px-4 text-center text-sm text-muted">
          {t("common.appName")} &mdash; {t("common.tagline")}
        </div>
      </footer>

      {/* Sticky WhatsApp CTA — mobile only, sits above BottomNav */}
      {whatsappHref && (
        <div
          className="fixed bottom-0 left-0 right-0 z-10 md:hidden bg-background/95 backdrop-blur-sm border-t border-border px-4 pt-3"
          style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}
        >
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-whatsapp text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
          >
            <WhatsAppIcon size={18} />
            {t("provider.contactWhatsApp")}
          </a>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify no legacy classes remain**

Run: `grep -E "emerald|text-gray|bg-gray|border-gray|bg-white" "src/app/[locale]/provider/[slug]/page.tsx"`
Expected: no output

- [ ] **Step 3: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: zero errors

- [ ] **Step 4: Commit**

```bash
git add "src/app/[locale]/provider/[slug]/page.tsx"
git commit -m "feat: redesign provider detail page — design tokens, shared WhatsAppIcon, sticky WhatsApp CTA"
```

---

## Final Verification

- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npx vitest run` — 47 tests pass
- [ ] No legacy classes: `grep -rE "emerald|text-gray|bg-gray|border-gray|bg-white" "src/app/[locale]/provider/"` — empty
- [ ] Inline `WhatsAppIcon` function deleted from `page.tsx` (only one should be in the codebase for this path, imported from `@/components/whatsapp-icon`)
