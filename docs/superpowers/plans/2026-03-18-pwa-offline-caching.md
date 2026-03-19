# PWA Offline Caching — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cache visited catalog and provider pages so users can browse offline using the existing `@ducanh2912/next-pwa` setup — no new packages.

**Architecture:** Three file changes: update `next.config.ts` with Workbox caching rules, create a static `/offline` fallback page with its own layout (outside `[locale]`), and fix `manifest.json` theme color. The service worker is generated at build time by `@ducanh2912/next-pwa`; there is no custom `sw.ts`.

**Tech Stack:** Next.js 16 App Router, `@ducanh2912/next-pwa` v10 (Workbox), Tailwind v4, `next/font/google`

---

## Codebase Context

- All user-facing routes live under `src/app/[locale]/` (e.g. `/pt-BR/provider/foo`)
- `src/app/[locale]/layout.tsx` is the effective root layout — it imports `globals.css` and renders `<html><body>` with fonts. There is no `src/app/layout.tsx`.
- The new `/offline` page lives outside `[locale]`, so it needs its own layout (`src/app/offline/layout.tsx`) that mirrors the `[locale]` layout shell (html, body, fonts, globals.css) but without next-intl.
- No middleware file exists; next-intl uses `localeDetection: false` and dynamic `[locale]` segment routing. `/offline` will not be intercepted or redirected.
- Service worker is **disabled in development** (`disable: process.env.NODE_ENV === "development"`). All verification must use `npm run build && npm start`.
- Tests for this feature are manual (service workers cannot be unit tested). Steps are in Task 4.

---

## File Map

| File | Action |
|---|---|
| `public/manifest.json` | Modify — fix `theme_color` |
| `src/app/offline/layout.tsx` | Create — minimal HTML shell for offline page |
| `src/app/offline/page.tsx` | Create — static offline fallback page |
| `next.config.ts` | Modify — add caching rules, fallback, front-end nav caching |

---

## Task 1: Fix manifest theme color

**Files:**
- Modify: `public/manifest.json`

The manifest `theme_color` is `#10b981` (emerald green, leftover from before the redesign). The current accent design token is `#C85C38`.

- [ ] **Step 1: Update theme_color**

Change line 8 of `public/manifest.json`:

```json
{
  "name": "Listaviva",
  "short_name": "Listaviva",
  "description": "Encontre serviços locais em Linhares",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FAF6EF",
  "theme_color": "#C85C38",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

Also update `background_color` from `#ffffff` to `#FAF6EF` (the `bg-background` token) so the PWA splash screen matches the app.

- [ ] **Step 2: Commit**

```bash
git add public/manifest.json
git commit -m "fix: update manifest theme_color and background_color to design tokens"
```

---

## Task 2: Create offline fallback page

**Files:**
- Create: `src/app/offline/layout.tsx`
- Create: `src/app/offline/page.tsx`

The offline page lives outside `[locale]` and needs its own HTML shell. It must import `globals.css` (so Tailwind design tokens are available) and load the fonts used by the rest of the app.

- [ ] **Step 1: Create the layout**

Create `src/app/offline/layout.tsx`:

```tsx
import { Fraunces, DM_Sans } from "next/font/google";
import "../globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  axes: ["SOFT", "WONK", "opsz"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm-sans",
});

export default function OfflineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${fraunces.variable} ${dmSans.variable}`}>
      <body className="font-sans bg-background text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Create the page**

Create `src/app/offline/page.tsx`:

```tsx
export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-3xl font-bold text-accent font-display mb-2">
        Listaviva
      </h1>
      <p className="text-muted text-sm mb-8">Serviços locais em Linhares</p>

      <div className="bg-surface border border-border rounded-2xl p-8 max-w-sm w-full">
        <p className="text-4xl mb-4">📡</p>
        <h2 className="text-xl font-semibold text-primary mb-2">
          Você está sem conexão
        </h2>
        <p className="text-sm text-muted mb-6">
          Verifique sua internet e tente novamente. Páginas visitadas
          anteriormente ainda podem estar disponíveis.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="w-full py-2.5 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent-hover transition-colors"
        >
          Tente novamente
        </button>
      </div>
    </div>
  );
}
```

Note: `onClick` requires this to be a Client Component. Add `"use client"` at the top of the file:

```tsx
"use client";

export default function OfflinePage() {
  // ... same as above
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/offline/layout.tsx src/app/offline/page.tsx
git commit -m "feat: add offline fallback page for PWA"
```

---

## Task 3: Update next.config.ts with caching rules

**Files:**
- Modify: `next.config.ts`

Add three things to the `withPWAInit` call:
1. `cacheOnFrontEndNav: true` — cache pages navigated to via the Next.js router (SPA taps)
2. `fallbacks: { document: "/offline" }` — serve the offline page for uncached navigation requests
3. `workboxOptions.runtimeCaching` — four caching rules (two page patterns, two image patterns)

- [ ] **Step 1: Replace next.config.ts**

```ts
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import withPWAInit from "@ducanh2912/next-pwa";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  cacheOnFrontEndNav: true,
  fallbacks: {
    document: "/offline",
  },
  workboxOptions: {
    runtimeCaching: [
      {
        // Catalog pages and provider profiles (both locales)
        urlPattern: /\/(pt-BR|en)(\/(?:categories|category|provider).*)?$/,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "pages-cache",
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          },
        },
      },
      {
        // Next.js image optimization endpoint
        urlPattern: /\/_next\/image/,
        handler: "CacheFirst",
        options: {
          cacheName: "image-cache",
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          },
        },
      },
      {
        // Supabase Storage provider photos
        urlPattern:
          /^https:\/\/eglgafwlzcgkdjfynitp\.supabase\.co\/storage\//,
        handler: "CacheFirst",
        options: {
          cacheName: "supabase-photos-cache",
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          },
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {};

export default withPWA(withNextIntl(nextConfig));
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors. If TypeScript complains about `handler` types, cast each handler string: `handler: "StaleWhileRevalidate" as const`.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat: add PWA offline caching rules and fallback (issue #13)"
```

---

## Task 4: Manual E2E verification

No automated tests — service workers are generated at build time and must be verified manually via Chrome DevTools. The service worker is **disabled in development**; always test with the production build.

**Setup for all tests:**
```bash
npm run build && npm start
```

Then open `http://localhost:3000/pt-BR` in Chrome.

- [ ] **Test 1 — Service worker registers**
  1. DevTools → Application → Service Workers
  2. Expected: `sw.js` listed with status "activated and is running"
  3. Expected: workbox caches visible in Application → Cache Storage

- [ ] **Test 2 — App shell loads offline**
  1. DevTools → Network → set to "Offline"
  2. Hard reload (`Cmd+Shift+R`)
  3. Expected: page loads from cache (not a browser error page)
  4. Set Network back to "No throttling"

- [ ] **Test 3 — Cached pages load offline (hard navigation)**
  1. Online: visit `/pt-BR/categories` and two provider profiles (via hard navigation or reload so the service worker caches them)
  2. DevTools → Network → Offline
  3. Type those URLs directly in the address bar
  4. Expected: pages load from cache

- [ ] **Test 4 — SPA navigation is cached (validates cacheOnFrontEndNav)**
  1. Online: start at `/pt-BR`, tap a category chip, tap a provider card (these are all client-side navigations)
  2. DevTools → Network → Offline
  3. Navigate back to those same pages via client-side navigation
  4. Expected: pages load from cache (not from network)

- [ ] **Test 5 — Offline fallback for uncached pages**
  1. DevTools → Network → Offline
  2. Navigate to a URL never visited (e.g. `/pt-BR/provider/some-uncached-slug`)
  3. Expected: `/offline` page renders with "Você está sem conexão" message and reload button

- [ ] **Test 6 — "Tente novamente" button works**
  1. While on the offline page, set Network back to "No throttling"
  2. Click "Tente novamente"
  3. Expected: page reloads and resolves normally

- [ ] **Commit verification note**

After all tests pass, close the issue:

```bash
gh issue close 13 --repo PeterTechDev/listaviva --comment "PWA offline caching implemented. Service worker caches visited catalog and provider pages with StaleWhileRevalidate. CacheFirst for images. /offline fallback page for uncached routes. Manual E2E verified."
```

---

## Acceptance Criteria Cross-Check

| Criterion | Implementation |
|---|---|
| Service worker caches visited catalog pages and provider profiles | `pages-cache` StaleWhileRevalidate rule + `cacheOnFrontEndNav: true` |
| Offline fallback page for uncached content | `src/app/offline/page.tsx` + `fallbacks: { document: "/offline" }` |
| Stale-while-revalidate for listings | `handler: "StaleWhileRevalidate"` in `pages-cache` rule |
| App shell always available offline | Automatic Workbox precaching of JS/CSS/fonts at build time |
| Tests: offline shell, cached pages, fallback | Tasks 4 Test 1–5 |
