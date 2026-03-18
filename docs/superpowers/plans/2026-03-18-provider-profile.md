# Provider Profile Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a public provider profile page at `/[locale]/provider/[slug]` with photo gallery, contact info, working hours, and SEO metadata.

**Architecture:** Server Component page with `generateMetadata` for SEO. Client Component `PhotoGallery` for interactive photo selection. Breadcrumb links back to the provider's home bairro category. Provider cards on category pages link to this profile.

**Tech Stack:** Next.js 16 App Router, next-intl, Supabase server client, Tailwind CSS

---

### Task 1: Add translation keys

**Files:**
- Modify: `messages/pt-BR.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Add keys to pt-BR.json**

In the `"provider"` namespace add:
```json
"noDescription": "Sem descrição disponível.",
"closed": "Fechado",
"shareTitle": "Ver {name} no ListaViva",
"categories": "Categorias",
"serviceAreas": "Áreas de Atendimento",
"workingHours": "Horários de Funcionamento",
"contactWhatsApp": "Contatar via WhatsApp"
```

- [ ] **Step 2: Add keys to en.json**

```json
"noDescription": "No description available.",
"closed": "Closed",
"shareTitle": "View {name} on ListaViva",
"categories": "Categories",
"serviceAreas": "Service Areas",
"workingHours": "Working Hours",
"contactWhatsApp": "Contact via WhatsApp"
```

- [ ] **Step 3: Commit**

```bash
git add messages/pt-BR.json messages/en.json
git commit -m "feat: add provider profile translation keys"
```

---

### Task 2: PhotoGallery client component

**Files:**
- Create: `src/app/[locale]/provider/[slug]/PhotoGallery.tsx`

- [ ] **Step 1: Create PhotoGallery.tsx**

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
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((url, i) => (
            <button key={url} onClick={() => setSelected(i)} className="flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`${name} ${i + 1}`}
                className={`w-16 h-16 object-cover rounded-lg border-2 transition-colors ${
                  i === selected ? "border-emerald-500" : "border-transparent"
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

- [ ] **Step 2: Commit**

```bash
git add src/app/[locale]/provider/[slug]/PhotoGallery.tsx
git commit -m "feat: add PhotoGallery client component"
```

---

### Task 3: Provider profile page

**Files:**
- Create: `src/app/[locale]/provider/[slug]/page.tsx`

- [ ] **Step 1: Create page.tsx**

```tsx
import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/header";
import PhotoGallery from "./PhotoGallery";
import type { Metadata } from "next";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const DAY_LABELS: Record<string, { pt: string; en: string }> = {
  monday:    { pt: "Segunda", en: "Monday" },
  tuesday:   { pt: "Terça",   en: "Tuesday" },
  wednesday: { pt: "Quarta",  en: "Wednesday" },
  thursday:  { pt: "Quinta",  en: "Thursday" },
  friday:    { pt: "Sexta",   en: "Friday" },
  saturday:  { pt: "Sábado",  en: "Saturday" },
  sunday:    { pt: "Domingo", en: "Sunday" },
};

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
    .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
    .map((p: { url: string }) => p.url);

  const desc =
    locale === "en"
      ? (provider.description_en ?? provider.description_pt)
      : provider.description_pt;

  const homeBairroRaw = provider.home_bairro;
  const homeBairro = Array.isArray(homeBairroRaw) ? homeBairroRaw[0] : homeBairroRaw;

  const categories = (provider.provider_categories ?? [])
    .map((pc: { categories: { id: string; name_pt: string; name_en: string | null; slug: string; icon: string | null } | null }) => pc.categories)
    .filter(Boolean);

  const serviceAreas = (provider.provider_service_areas ?? [])
    .map((sa: { bairros: { id: string; name: string } | null }) => sa.bairros)
    .filter(Boolean);

  const workingHours = (provider.working_hours as Record<string, string>) ?? {};

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-8 w-full">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
          <Link href="/" className="hover:text-gray-600 transition-colors">
            {t("common.appName")}
          </Link>
          <span>/</span>
          <span className="text-gray-700">{provider.name}</span>
        </div>

        <div className="space-y-6">
          {/* Photos */}
          <PhotoGallery photos={photos} name={provider.name} />

          {/* Header info */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{provider.name}</h1>
              {homeBairro && (
                <p className="text-sm text-emerald-600 mt-0.5">📍 {homeBairro.name}</p>
              )}
            </div>
            {provider.whatsapp && (
              <a
                href={`https://wa.me/${provider.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors whitespace-nowrap"
              >
                <WhatsAppIcon />
                {t("provider.contactWhatsApp")}
              </a>
            )}
          </div>

          {/* Description */}
          {desc ? (
            <p className="text-gray-600 leading-relaxed">{desc}</p>
          ) : (
            <p className="text-gray-400 italic">{t("provider.noDescription")}</p>
          )}

          {/* Categories */}
          {categories.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {t("provider.categories")}
              </h2>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat: { id: string; name_pt: string; name_en: string | null; slug: string; icon: string | null }) => (
                  <Link
                    key={cat.id}
                    href={`/category/${cat.slug}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium hover:bg-emerald-100 transition-colors"
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
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {t("provider.serviceAreas")}
              </h2>
              <div className="flex flex-wrap gap-2">
                {serviceAreas.map((b: { id: string; name: string }) => (
                  <span
                    key={b.id}
                    className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm"
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
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {t("provider.workingHours")}
              </h2>
              <div className="bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                {DAYS.map((day) => (
                  <div
                    key={day}
                    className="flex justify-between px-4 py-2.5 even:bg-white text-sm"
                  >
                    <span className="font-medium text-gray-700">
                      {locale === "en" ? DAY_LABELS[day].en : DAY_LABELS[day].pt}
                    </span>
                    <span className="text-gray-500">
                      {workingHours[day] || t("provider.closed")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom WhatsApp CTA */}
          {provider.whatsapp && (
            <div className="pt-4 border-t border-gray-100">
              <a
                href={`https://wa.me/${provider.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors"
              >
                <WhatsAppIcon />
                {t("provider.contactWhatsApp")}
              </a>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-gray-100 py-6">
        <div className="max-w-3xl mx-auto px-4 text-center text-sm text-gray-400">
          {t("common.appName")} &mdash; {t("common.tagline")}
        </div>
      </footer>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/[locale]/provider/[slug]/page.tsx
git commit -m "feat: add provider profile page (issue #8)"
```

---

### Task 4: Link provider cards to profile page

**Files:**
- Modify: `src/app/[locale]/category/[slug]/page.tsx`

- [ ] **Step 1: Wrap provider name in Link**

Change the `<h3>` tag inside provider cards to be a `<Link>` to `/provider/[slug]`. Do NOT wrap the entire card (WhatsApp link is nested inside).

Replace:
```tsx
<h3 className="font-semibold text-gray-900">{provider.name}</h3>
```

With:
```tsx
<Link
  href={`/provider/${provider.slug}`}
  className="font-semibold text-gray-900 hover:text-emerald-700 transition-colors"
>
  {provider.name}
</Link>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/[locale]/category/[slug]/page.tsx
git commit -m "feat: link provider cards to profile page"
```

---

### Task 5: Build and close issue

- [ ] **Step 1: Run build**

```bash
cd ~/personal/listaviva && npm run build
```

Expected: no TypeScript errors, no build errors.

- [ ] **Step 2: Close issue**

```bash
gh issue close 8
```
