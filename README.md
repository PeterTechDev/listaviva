# Listaviva

> A hyperlocal service catalog for Linhares, ES (Brazil) — think Yelp, but for informal service providers in a mid-sized Brazilian city where most workers still find clients through WhatsApp and word of mouth.

**Portfolio project.** Public code, private data.

---

## The Problem

In cities like Linhares, thousands of skilled workers — electricians, cleaners, seamstresses, personal trainers — have no online presence. Consumers can't find them through Google. The providers themselves aren't going to build a website.

Listaviva bridges that gap: a simple, mobile-first directory where consumers search in natural language ("preciso de encanador no centro") and providers get a profile page with a direct WhatsApp button — the contact method they already use.

---

## What It Does

**For consumers**
- Search by service type, neighborhood, or keyword — results are ranked by semantic similarity, not just exact keyword matches, so "limpeza" finds "diarista" even if they don't share a word
- Browse by category or neighborhood
- View provider profiles with photos, working hours, and a one-tap WhatsApp contact button

**For service providers**
- Register by chatting with an AI assistant instead of filling out a long form — describe your services the way you'd describe them to a friend
- Claim an existing listing if someone recommended you before you signed up
- No app to install — works in any mobile browser, and can be added to the home screen like an app

**For the platform**
- Admin dashboard tracking which searches return no results — a direct map of unmet local demand
- Supply vs. demand charts by category, showing where to focus provider recruitment

---

## Interesting Technical Decisions

**AI-powered onboarding instead of a form** — Most providers are non-technical and register on mobile. A traditional multi-field form has high drop-off. The onboarding flow is a conversational chat: the AI asks questions naturally, extracts structured data (category, location, hours, WhatsApp) using tool calling, and shows a live preview of the listing as it's being built.

**Semantic search with pgvector** — Search runs against OpenAI embeddings stored in Postgres. A user typing "conserto de geladeira" finds appliance repair providers even if none used that exact phrase in their description.

**Zero-result tracking as a product signal** — Every search that returns nothing is logged. The admin dashboard surfaces these as a ranked list of unmet demand — useful for deciding which provider categories to actively recruit.

**Dual design system** — The public app has a custom warm identity (Fraunces serif, terracotta, beige) designed to feel trusted and neighborly. The admin area uses shadcn/ui with a Carbon dark theme — the right tool for an internal dashboard, no custom design work needed.

---

## Tech Stack

| | |
|---|---|
| **Framework** | Next.js 16 (React, App Router) |
| **Database** | Supabase (Postgres with vector search, auth, file storage) |
| **AI** | OpenAI — chat-based onboarding and search embeddings |
| **Styling** | Tailwind CSS, shadcn/ui (admin), custom design tokens (public) |
| **i18n** | Portuguese (pt-BR) and English |
| **PWA** | Installable, offline-capable |

---

## Running Locally

```bash
git clone https://github.com/PeterTechDev/listaviva
cd listaviva
npm install
cp .env.local.example .env.local   # fill in Supabase + OpenAI keys
npm run dev
```

Open [http://localhost:3000/pt-BR](http://localhost:3000/pt-BR).

> Requires a Supabase project with the schema applied and an OpenAI API key. See `.env.local.example` for the full list of required variables.
