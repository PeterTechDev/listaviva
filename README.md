# Listaviva

Hyperlocal service catalog for Linhares, ES (Brazil). Helps consumers discover informal service providers — electricians, hairdressers, cleaners — who normally rely on word-of-mouth and social media for visibility.

Three-sided value: consumers find services, providers gain a searchable profile, and the platform collects hyperlocal market intelligence (zero-result queries, supply/demand gaps by category and neighborhood).

**Portfolio project.** Public code, private data.

---

## Features

- **Semantic search** — pgvector embeddings match queries to providers even with spelling variation or informal language
- **Conversational provider onboarding** — AI-guided chat replaces a long registration form; providers describe their services naturally on mobile
- **Provider profiles** — photos, categories, neighborhood, working hours, direct WhatsApp contact
- **Self-registration & listing claims** — providers request or claim their listing without admin intervention
- **Community recommendations** — users suggest providers not yet in the catalog
- **Admin dashboard** — Carbon dark theme with stats, search analytics, and supply/demand visualization by category
- **PWA** — installable, works offline for previously visited pages
- **Bilingual** — Portuguese (pt-BR) primary, English (en) secondary

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Database | Supabase — Postgres + pgvector + Auth + Storage |
| AI | OpenAI (conversational onboarding, embeddings) |
| UI — public | Custom design system: Fraunces + DM Sans, terracotta palette |
| UI — admin | shadcn/ui (base-nova), Carbon dark theme |
| Styling | Tailwind CSS v4 |
| i18n | next-intl |
| Charts | Recharts |
| PWA | @ducanh2912/next-pwa |

---

## Project Structure

```
src/
├── app/
│   ├── [locale]/
│   │   ├── page.tsx               # Home — search + category browse
│   │   ├── search/                # Search results
│   │   ├── category/[slug]/       # Browse by category
│   │   ├── provider/[slug]/       # Provider profile + WhatsApp CTA
│   │   ├── account/               # Provider self-registration (conversational AI)
│   │   ├── login/                 # Social login (Google)
│   │   └── admin/                 # Admin area (auth-gated)
│   │       ├── dashboard/         # Stats, charts, query analytics
│   │       ├── providers/         # Provider management
│   │       ├── categories/        # Category management
│   │       ├── bairros/           # Neighborhood management
│   │       ├── claims/            # Listing claim requests
│   │       └── recommendations/   # Community recommendations
│   └── api/
│       ├── onboarding/chat/       # AI onboarding route handler
│       ├── admin/embed-providers/ # Embedding generation
│       └── auth/callback/         # Supabase OAuth callback
├── components/
│   ├── admin/                     # Admin sidebar (shadcn/ui)
│   └── ui/                        # shadcn/ui components
└── lib/
    ├── auth/                      # Session helpers, role checks
    ├── dashboard.ts               # Admin data fetching (Supabase RPCs)
    └── supabase/                  # Client/server Supabase instances
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- Supabase project with schema applied
- OpenAI API key

### Setup

```bash
git clone https://github.com/PeterTechDev/listaviva
cd listaviva
npm install
```

Copy the example env file and fill in your values:

```bash
cp .env.local.example .env.local
```

```bash
npm run dev
```

Open [http://localhost:3000/pt-BR](http://localhost:3000/pt-BR).

---

## Admin

The admin area at `/admin` requires a user with the `admin` role in the `profiles` table. In development, the login page exposes a one-click dev login for seeded accounts.
