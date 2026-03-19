# Frontend Redesign — Phase 1+2: Foundation, Navigation & Homepage

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic emerald/gray Tailwind defaults with a warm terracotta design system (fonts, color tokens, bottom nav, homepage redesign), giving Listaviva a distinctive brand identity that feels local and trustworthy on mobile.

**Architecture:** Tailwind v4 design tokens are defined as CSS custom properties inside the `@theme` block in `globals.css` — they automatically become Tailwind utilities (`bg-accent`, `text-muted`, etc.). Fonts are loaded via `next/font/google` in `layout.tsx` and injected as CSS variables. Navigation splits into a minimal top header (logo + locale) and a fixed bottom bar (Home / Search / Categories / Account) for mobile-first UX.

**Tech Stack:** Next.js 16 App Router, Tailwind v4 (CSS-first), `next/font/google` (Fraunces + DM Sans), next-intl v4, React 19 Server + Client Components.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/app/globals.css` | Modify | Design tokens (`@theme`), font variable wiring, base body styles |
| `src/app/[locale]/layout.tsx` | Modify | Load fonts via `next/font/google`, inject CSS vars, update `themeColor` |
| `src/components/bottom-nav.tsx` | **Create** | Fixed bottom navigation bar (client component) |
| `src/components/header-client.tsx` | Modify | Strip to logo + locale switcher only; auth moves to bottom nav Account tab |
| `src/app/[locale]/page.tsx` | Modify | Homepage redesign: hero, category grid, how-it-works |

---

## Task 1: Git Branch

- [ ] **Create feature branch**

```bash
cd /Users/peter/personal/listaviva
git checkout -b feat/issue-14-frontend-redesign
```

- [ ] **Verify**

```bash
git branch --show-current
# Expected: feat/issue-14-frontend-redesign
```

---

## Task 2: Load Fonts in Layout

**Files:**
- Modify: `src/app/[locale]/layout.tsx`

`next/font/google` is built into Next.js — no install needed. Load Fraunces (serif display) and DM Sans (body/UI). Assign both as CSS variables so Tailwind can reference them.

- [ ] **Update `layout.tsx`**

Replace the entire file content:

```tsx
import type { Metadata, Viewport } from "next";
import { Fraunces, DM_Sans } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import "../globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Listaviva — Serviços locais em Linhares",
  description:
    "Encontre prestadores de serviço na sua região. Do eletricista à cabeleireira, conectamos você aos melhores profissionais de Linhares.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#C85C38",
  width: "device-width",
  initialScale: 1,
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} className={`${fraunces.variable} ${dmSans.variable}`}>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="antialiased font-sans bg-background text-primary">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

- [ ] **Verify build compiles**

```bash
cd /Users/peter/personal/listaviva && npm run build 2>&1 | tail -20
# Expected: no font-related errors
```

---

## Task 3: Design Tokens in globals.css

**Files:**
- Modify: `src/app/globals.css`

Replace the entire file. The existing `globals.css` uses `@theme inline` to alias pre-existing CSS vars — this plan replaces that with a direct `@theme {}` block that defines all tokens in one place. In Tailwind v4, every `--color-*` variable inside `@theme` automatically becomes a Tailwind color utility (`bg-accent`, `text-muted`, etc.), and every `--font-*` becomes a font-family utility (`font-sans`, `font-serif`).

- [ ] **Replace `globals.css`**

```css
@import "tailwindcss";

/* ── Design Tokens ──────────────────────────────────────────────────────── */

@theme {
  /* Fonts */
  --font-serif:  var(--font-fraunces), Georgia, serif;
  --font-sans:   var(--font-dm-sans), system-ui, sans-serif;

  /* Background & Surface */
  --color-background: #FAF6EF;
  --color-surface:    #F0EAE0;
  --color-border:     #E0D5C8;

  /* Text */
  --color-primary:    #1C1410;
  --color-muted:      #7A6A5F;

  /* Brand */
  --color-accent:       #C85C38;
  --color-accent-hover: #A8431F;
  --color-warm:         #E8A040;

  /* WhatsApp (never change this — it's a trusted brand signal) */
  --color-whatsapp: #25D366;

  /* Spacing / Radii */
  --radius-card: 0.75rem;
}

/* ── Base Styles ────────────────────────────────────────────────────────── */

body {
  background-color: var(--color-background);
  color: var(--color-primary);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}

/* Bottom nav safe-area padding on iPhone */
.pb-safe {
  padding-bottom: max(1rem, env(safe-area-inset-bottom));
}

/* Heading utility — apply Fraunces to all display text */
.font-display {
  font-family: var(--font-serif);
}
```

- [ ] **Verify Tailwind utilities resolve**

```bash
cd /Users/peter/personal/listaviva && npm run build 2>&1 | grep -E "error|Error|warning" | head -20
# Expected: no color/font resolution errors
```

---

## Task 4: Bottom Navigation Bar

**Files:**
- Create: `src/components/bottom-nav.tsx`

Fixed bottom bar. Four tabs: Início / Busca / Categorias / Conta. Active tab highlights in accent color. Must handle iPhone safe-area inset with `env(safe-area-inset-bottom)`. The Account tab is where auth-aware content lives (replaces the auth links in the top header).

- [ ] **Create `src/components/bottom-nav.tsx`**

```tsx
"use client";

import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

const tabs = [
  {
    key: "home",
    href: "/",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    labelKey: "nav.home",
  },
  {
    key: "search",
    href: "/search",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
    labelKey: "nav.search",
  },
  {
    key: "categories",
    href: "/categories",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
    labelKey: "nav.categories",
  },
  {
    key: "account",
    href: "/account",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    labelKey: "nav.account",
  },
] as const;

export function BottomNav() {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 bg-surface border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-4 h-16">
        {tabs.map(({ key, href, icon, labelKey }) => {
          const active =
            key === "home" ? pathname === "/" : pathname.startsWith(`/${key}`);
          return (
            <Link
              key={key}
              href={href}
              className={`flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              {icon(active)}
              <span>{t(labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Add translation keys** — open each messages file and add the `nav` section:

`messages/pt-BR.json` — add inside the root object:
```json
"nav": {
  "home": "Início",
  "search": "Busca",
  "categories": "Categorias",
  "account": "Conta"
}
```

`messages/en.json` — add:
```json
"nav": {
  "home": "Home",
  "search": "Search",
  "categories": "Categories",
  "account": "Account"
}
```

- [ ] **Verify build**

```bash
cd /Users/peter/personal/listaviva && npm run build 2>&1 | tail -10
# Expected: compiled successfully
```

---

## Task 5: Slim Down the Top Header

**Files:**
- Modify: `src/components/header-client.tsx`

The top header now only needs: logo (left) + locale switcher (right). Auth links move to the Account tab in BottomNav. This keeps the top bar clean and mobile-friendly.

- [ ] **Replace `header-client.tsx`**

```tsx
"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

export function HeaderClient() {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const otherLocale = locale === "pt-BR" ? "en" : "pt-BR";

  return (
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-display text-xl font-semibold text-accent tracking-tight">
          {t("common.appName")}
        </Link>
        <Link
          href={pathname}
          locale={otherLocale}
          className="text-xs font-medium text-muted hover:text-primary transition-colors uppercase tracking-wide"
        >
          {otherLocale === "en" ? "EN" : "PT"}
        </Link>
      </div>
    </header>
  );
}
```

- [ ] **Update `src/components/header.tsx`** — remove props it no longer needs:

```tsx
import { HeaderClient } from "./header-client";

export function Header() {
  return <HeaderClient />;
}
```

- [ ] **Verify build**

```bash
cd /Users/peter/personal/listaviva && npm run build 2>&1 | tail -10
# Expected: compiled successfully (auth prop warnings gone)
```

> **Note on auth sign-out:** The sign-out button is intentionally removed from the top header. It will live on the `/account` page (which the Account tab in BottomNav links to). The account page already handles auth state. The `getCurrentUser()` call in `header.tsx` is also removed since the slim header no longer needs auth data — this is a deliberate simplification.

- [ ] **Commit header changes**

```bash
git add src/components/header.tsx src/components/header-client.tsx
git commit -m "feat(header): slim to logo + locale switcher only, move auth to account page"
```

---

## Task 6: Integrate BottomNav into the Locale Layout

**Files:**
- Modify: `src/app/[locale]/layout.tsx`

Add `BottomNav` to the layout and add bottom padding so page content isn't hidden behind the nav bar (16 = 64px = nav height + safe area).

- [ ] **Add BottomNav import and usage** in `layout.tsx`

After the existing imports add:
```tsx
import { BottomNav } from "@/components/bottom-nav";
```

Inside the `<body>` element, wrap children and add the nav:
```tsx
<body className="antialiased font-sans bg-background text-primary">
  <NextIntlClientProvider messages={messages}>
    <div className="pb-20">
      {children}
    </div>
    <BottomNav />
  </NextIntlClientProvider>
</body>
```

- [ ] **Commit BottomNav integration**

```bash
git add src/app/[locale]/layout.tsx src/components/bottom-nav.tsx
git commit -m "feat(nav): add BottomNav to layout — mobile-first navigation with safe-area support"
```

- [ ] **Build + visual check**

```bash
cd /Users/peter/personal/listaviva && npm run build 2>&1 | tail -10
```

```bash
cd /Users/peter/personal/listaviva && npm run dev &
# Open http://localhost:3000 — verify: warm parchment bg, Fraunces logo, bottom nav visible
```

---

## Task 7: Homepage Redesign

**Files:**
- Modify: `src/app/[locale]/page.tsx`

Apply the new design language to the homepage: Fraunces headline, terracotta search CTA, warmer category grid, updated "how it works" section.

- [ ] **Replace `src/app/[locale]/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/header";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name_pt, name_en, slug, icon")
    .order("sort_order")
    .limit(12);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* ── Hero ───────────────────────────────────────────────────── */}
        <section className="px-4 pt-14 pb-10 text-center max-w-2xl mx-auto">
          <h1 className="font-display text-4xl sm:text-5xl font-semibold text-primary leading-tight tracking-tight">
            {t("home.hero")}
          </h1>
          <p className="mt-4 text-base text-muted max-w-md mx-auto leading-relaxed">
            {t("home.subtitle")}
          </p>

          {/* Search */}
          <div className="mt-8">
            <form method="GET" action={`/${locale}/search`}>
              <div className="relative max-w-lg mx-auto">
                <input
                  type="text"
                  name="q"
                  placeholder={t("common.searchPlaceholder")}
                  className="w-full h-14 pl-5 pr-32 rounded-xl border border-border bg-surface text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent shadow-sm text-base"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-2 h-10 px-5 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent-hover transition-colors"
                >
                  {t("common.search")}
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* ── Category Grid ──────────────────────────────────────────── */}
        {categories && categories.length > 0 && (
          <section className="px-4 pb-12 max-w-5xl mx-auto">
            <h2 className="font-display text-2xl font-medium text-primary mb-5">
              {t("home.featuredCategories")}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/category/${cat.slug}`}
                  className="flex items-center gap-3 p-4 bg-surface rounded-xl border border-border hover:border-accent hover:shadow-sm transition-all group"
                >
                  {cat.icon && (
                    <span className="text-2xl flex-shrink-0">{cat.icon}</span>
                  )}
                  <span className="text-sm font-medium text-primary group-hover:text-accent transition-colors leading-snug">
                    {locale === "en" ? (cat.name_en ?? cat.name_pt) : cat.name_pt}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── How it Works ───────────────────────────────────────────── */}
        <section className="bg-surface py-14">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="font-display text-2xl font-medium text-center text-primary mb-10">
              {t("home.howItWorks")}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {[
                { step: "1", title: t("home.step1Title"), desc: t("home.step1Desc") },
                { step: "2", title: t("home.step2Title"), desc: t("home.step2Desc") },
                { step: "3", title: t("home.step3Title"), desc: t("home.step3Desc") },
              ].map(({ step, title, desc }) => (
                <div key={step} className="text-center">
                  <div className="w-11 h-11 rounded-full bg-accent text-white font-display font-semibold text-lg flex items-center justify-center mx-auto">
                    {step}
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-primary">{title}</h3>
                  <p className="mt-2 text-sm text-muted leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-muted">
          {t("common.appName")} &mdash; {t("common.tagline")}
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Build**

```bash
cd /Users/peter/personal/listaviva && npm run build 2>&1 | tail -10
# Expected: compiled successfully
```

- [ ] **Visual check on mobile viewport**

Open browser DevTools → iPhone 14 Pro viewport (393×852). Verify:
- Fraunces font renders on h1
- Background is warm parchment (#FAF6EF), not white
- Search bar has terracotta focus ring on tap
- Category cards use `bg-surface` (#F0EAE0) background
- Step circles are terracotta, not emerald green
- Bottom nav is visible and doesn't overlap footer

- [ ] **Commit**

```bash
git add src/app/\[locale\]/page.tsx
git commit -m "feat(homepage): redesign with terracotta tokens and Fraunces typography

- Replace emerald palette with accent/surface/muted tokens throughout
- h1 uses font-display (Fraunces) for editorial warmth
- Search bar enlarged (h-14), terracotta submit button
- Category cards use surface background with accent hover
- How-it-works step circles now terracotta

Part of #14"
```

---

## Task 8: Lint + Final Build Verification

- [ ] **Run lint**

```bash
cd /Users/peter/personal/listaviva && npm run lint 2>&1 | tail -20
# Expected: no errors (warnings OK)
```

- [ ] **Run full build**

```bash
cd /Users/peter/personal/listaviva && npm run build 2>&1 | tail -20
# Expected: ✓ compiled successfully
```

- [ ] **Push branch**

```bash
git push -u origin feat/issue-14-frontend-redesign
```

- [ ] **Open PR**

```bash
gh pr create \
  --title "feat: frontend redesign phase 1+2 — design tokens, fonts, bottom nav, homepage" \
  --body "$(cat <<'EOF'
## Summary

- Loads Fraunces (serif display) + DM Sans (body) via `next/font/google`
- Replaces emerald/gray palette with warm terracotta design tokens in Tailwind v4 `@theme`
- Adds fixed `BottomNav` component (Home / Search / Categories / Account) — mobile-first navigation
- Slims top header to logo + locale switcher only
- Redesigns homepage hero (larger search, Fraunces h1, terracotta CTAs, warmer section backgrounds)
- Updates PWA `themeColor` to `#C85C38`

## Test plan
- [ ] `npm run build` passes with no errors
- [ ] Open on mobile viewport (375px): bottom nav visible, no content hidden behind it
- [ ] Fraunces font renders on page headings
- [ ] Background is warm parchment (#FAF6EF), not white
- [ ] Search focus ring is terracotta, not emerald
- [ ] Category cards use surface background with accent hover border
- [ ] Step circles are terracotta

Closes part of #14

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Notes for Later Phases

The remaining phases from issue #14 will be separate plans:

- **Phase 3:** Provider card component + category listing page
- **Phase 4:** Provider detail page (photo gallery prominence, sticky WhatsApp CTA)
- **Phase 5:** Search results page + mobile polish + empty/loading/error states

Each phase builds on the design tokens established here — just apply `text-accent`, `bg-surface`, `font-display`, etc. throughout.
