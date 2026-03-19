# Admin Dashboard Redesign — Design Spec (Carbon Theme)

**Goal:** Replace the hand-rolled dark admin sidebar and raw-Tailwind dashboard with a shadcn/ui-based Carbon theme, bringing design-system consistency, accessibility, and a polished portfolio-grade admin experience — while preserving the public app's custom brand identity entirely.

**Audience:** Peter (single admin user). Internal tool only — no public-facing pages affected.

**Portfolio angle:** Demonstrates considered design-system strategy: adopting shadcn/ui for internal tooling while intentionally deferring custom brand identity work to the public-facing pages.

---

## Problem

The original `/[locale]/admin/` area was built with hand-rolled dark Tailwind:

- A bare `<aside>` with emoji icons and a hardcoded color map
- `DashboardClient` with indigo/emerald chart colors unrelated to the Listaviva brand
- No component reuse, no accessible primitives, inconsistent spacing and type hierarchy
- Looked amateur for a portfolio piece despite the underlying data being solid

---

## Design Decisions

### 1. shadcn/ui for admin only — public app untouched

shadcn/ui is a practical default for admin dashboards: accessible, well-structured, and fast to ship. The public-facing app carries Listaviva's custom identity (Fraunces + DM Sans, terracotta palette, warm neighborly feel) and will be designed separately once visual references are gathered.

This split is intentional. Using shadcn/ui on internal tooling is not a shortcut — it's the right tool for a single-admin dashboard.

### 2. "Carbon" dark theme

| Token | Value | Role |
|-------|-------|------|
| Background | `zinc-950` | Page / sidebar base |
| Cards | `zinc-900` | Stat cards, table containers |
| Borders | `zinc-800` | Dividers, card edges |
| Primary text | `zinc-100` | Headings, active labels |
| Muted text | `zinc-400` | Secondary labels, metadata |
| Subtle text | `zinc-500` | Placeholder, tertiary |
| Accent | `#C85C38` (terracotta) | Active nav, icon highlights, CTA |
| Numbers | `font-mono` + `tabular-nums` | Stat values and table columns |

The terracotta accent threads the admin back to the Listaviva brand without imposing the full public identity on an internal tool.

### 3. CSS token coexistence (shadcn + Listaviva globals)

`npx shadcn@latest init` generates `--color-background`, `--color-primary`, `--color-accent`, `--color-border` — all of which collide with Listaviva's existing `@theme` tokens in `globals.css`.

**Solution:** All shadcn-generated tokens are renamed with a `--color-shadcn-` prefix. Listaviva's original tokens remain unchanged. Admin-specific dark theme properties are scoped under `.admin-sidebar-carbon` class.

This means the public app is completely insulated from shadcn's design token layer.

### 4. shadcn `base-nova` style

`npx shadcn@latest init` selected the `base-nova` style, which uses `@base-ui/react` primitives instead of Radix UI. No new npm packages were required — `@base-ui/react` and `class-variance-authority` were already present in the project.

13 component files scaffolded into `src/components/ui/`:
`sidebar`, `card`, `badge`, `button`, `table`, `input`, `select`, `separator`, `skeleton`, `tabs`, `avatar`, `sheet`, `tooltip`

### 5. Collapsible sidebar with grouped navigation

Replaced the flat emoji list with three semantic groups:

| Group | Items |
|-------|-------|
| Analytics | Dashboard (BarChart3) |
| Catálogo | Prestadores (Users), Categorias (Tag), Bairros (MapPin) |
| Moderação | Solicitações (FileCheck), Recomendações (Lightbulb) |

**Active state:** terracotta bg tint (12% opacity) + terracotta text + terracotta icon color.

**Collapse:** Supports `collapsible="icon"` mode — sidebar shrinks to icon-only strip on toggle.

**Mobile:** At 768px, the sidebar automatically switches to a Sheet-based drawer via a `useIsMobile()` hook (`src/hooks/use-mobile.ts`).

### 6. DashboardClient visual overhaul

The data layer is completely unchanged — all Supabase RPCs, server-side data fetching, and TypeScript types are preserved as-is. Only the rendering layer was rewritten:

| Before | After |
|--------|-------|
| Raw `<div>` grid with inline styles | shadcn `Card` components |
| Indigo/emerald chart colors | Terracotta + warm gold brand palette |
| Plain number display | `font-mono` stat values with lucide icon headers |
| No visual status cues | Pulse dot for pending actions, Badge for counts |
| Generic table styling | Zinc-themed rows with hover states |
| Plain tooltips | Dark zinc-800 tooltips matching the theme |

Badge variants for counts: rose (zero), amber (low), zinc (normal).

---

## Architecture

### New files

| File | Purpose |
|------|---------|
| `src/components/admin/app-sidebar.tsx` | Client sidebar — grouped nav, active state detection, user footer |
| `src/components/ui/*.tsx` (13 files) | shadcn components (see §4) |
| `src/hooks/use-mobile.ts` | `useIsMobile()` responsive hook |
| `components.json` | shadcn CLI configuration |

### Modified files

| File | Change |
|------|--------|
| `src/app/globals.css` | Added `--color-shadcn-*` tokens; `.admin-sidebar-carbon` scoped theme |
| `src/app/[locale]/admin/layout.tsx` | Replaced `<aside>` with `SidebarProvider` + `AdminSidebar` |
| `src/app/[locale]/admin/dashboard/DashboardClient.tsx` | Full visual rewrite with Carbon dark theme |

### Intentionally unchanged

- All server actions (`actions.ts` in each admin subdirectory)
- All data fetching logic (RPCs, provider/claims/recommendations queries)
- All other admin client components (ProvidersClient, CategoriesManager, BairrosManager, ClaimsManager, RecommendationsManager)
- All translation files — sidebar nav labels are hardcoded English pending i18n confirmation
- All public app pages and components

---

## What Remains (follow-up work)

| Item | Notes |
|------|-------|
| Other admin pages | Providers, Categories, Bairros, Claims, Recommendations still use raw Tailwind — upgrade to shadcn `Table`/`Badge`/`Button`/`Dialog` in a separate pass |
| i18n for sidebar nav | Hardcoded English — add `useTranslations()` once translation keys are confirmed |
| Admin page redirect | `admin/page.tsx` redirects to `/admin/bairros`; should redirect to `/admin/dashboard` now that the dashboard is the feature showcase |
