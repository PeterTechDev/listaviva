# Frontend Redesign Phase 5 — Login, Account & ProviderForm

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the warm terracotta design system to every remaining surface with legacy tokens: the login page, all account pages (hub, edit, create, claim, recommend), and the shared `ProviderForm` used by both admin and provider self-service.

**Architecture:** Six focused tasks. Task 1 adds missing translation keys and sweeps `ProviderForm` (the biggest shared component — used by admin and both account forms). Tasks 2–5 cover the remaining pages in user journey order: login → account hub → sub-page shells → ClaimSearch client component → Recommend flow. Task 6 is the final build verification. Every change is a token substitution or hardcoded-string extraction — no behavior changes.

**Tech Stack:** Next.js 16 App Router (mix of Server and Client Components), Tailwind v4 CSS-first (`@theme` tokens in `globals.css`), next-intl for i18n.

---

## Design Tokens Reference

| Legacy class | Design token |
|---|---|
| `text-gray-400`, `text-gray-500`, `text-gray-600` | `text-muted` |
| `text-gray-700`, `text-gray-800`, `text-gray-900` | `text-primary` |
| `bg-white` (elevated card/section) | `bg-surface` |
| `bg-white`, `bg-gray-50` (page background) | `bg-background` |
| `bg-gray-100` | `bg-surface` |
| `border-gray-100`, `border-gray-200`, `border-gray-300` | `border-border` |
| `text-emerald-600`, `text-emerald-700` | `text-accent` |
| `bg-emerald-600`, `hover:bg-emerald-700` | `bg-accent hover:bg-accent-hover` |
| `bg-emerald-50 border-emerald-300 text-emerald-700` (selected pill) | `bg-surface border-accent text-accent` |
| `bg-blue-50 border-blue-300 text-blue-700` (selected pill) | `bg-surface border-accent text-accent` |
| `bg-blue-600 hover:bg-blue-700` | `bg-accent hover:bg-accent-hover` |
| `border-emerald-200 hover:border-emerald-400` | `border-border hover:border-accent` |
| `border-blue-200 hover:border-blue-400` | `border-border hover:border-accent` |
| `focus:ring-emerald-500`, `focus:ring-blue-500` | `focus:ring-accent` |
| `bg-gray-100 text-gray-700 hover:bg-gray-200` (cancel btn) | `bg-surface border border-border text-muted hover:border-accent hover:text-accent` |

**Do not change:** `bg-red-*` / `text-red-*` (semantic error colors), `bg-red-500` (photo delete button), Google OAuth icon SVG (brand colors).

---

## File Map

| Status | File | Change |
|--------|------|--------|
| Modify | `messages/pt-BR.json` | Add 8 keys to `account`; add `basicInfo` to `adminProviders` |
| Modify | `messages/en.json` | Same new keys in English |
| Modify | `src/app/[locale]/admin/providers/ProviderForm.tsx` | Full token sweep; `basicInfo` translation key |
| Modify | `src/app/[locale]/login/page.tsx` | Full token sweep; app name → `text-accent font-display` |
| Modify | `src/app/[locale]/account/page.tsx` | Token sweep; hardcoded strings → t(); status badge |
| Modify | `src/app/[locale]/account/edit/page.tsx` | Back link + h1 token sweep |
| Modify | `src/app/[locale]/account/create/page.tsx` | Back link + h1 token sweep |
| Modify | `src/app/[locale]/account/claim/page.tsx` | Back link + h1 token sweep |
| Modify | `src/app/[locale]/account/claim/ClaimSearch.tsx` | Full token sweep; hardcoded strings → t() |
| Modify | `src/app/[locale]/account/recommend/page.tsx` | Add Header + footer layout; token sweep |
| Modify | `src/app/[locale]/account/recommend/RecommendForm.tsx` | Token sweep (blue → accent) |

---

## Task 1: Translation keys + ProviderForm

**Files:**
- Modify: `messages/pt-BR.json`
- Modify: `messages/en.json`
- Modify: `src/app/[locale]/admin/providers/ProviderForm.tsx`

ProviderForm is the highest-leverage target: it's shared by `/admin/providers/new`, `/admin/providers/[id]/edit`, `/account/create`, and `/account/edit`. One sweep fixes all four pages.

- [ ] **Step 1: Add translation keys to pt-BR.json**

In `messages/pt-BR.json`, merge into the `"account"` object:
```json
"statusActive": "Ativo",
"viewPublicProfile": "Ver perfil público →",
"createListingDesc": "Crie um novo perfil para o seu negócio",
"claimListingDesc": "Reivindique um perfil já existente",
"recommendCardDesc": "Recomende um novo fornecedor",
"claimSearchButton": "Buscar",
"claimNoResults": "Nenhum resultado encontrado"
```

In `messages/pt-BR.json`, merge into the `"adminProviders"` object:
```json
"basicInfo": "Informações básicas"
```

- [ ] **Step 2: Add translation keys to en.json**

In `messages/en.json`, merge into `"account"`:
```json
"statusActive": "Active",
"viewPublicProfile": "View public profile →",
"createListingDesc": "Create a new profile for your business",
"claimListingDesc": "Claim an existing listing",
"recommendCardDesc": "Recommend a new provider",
"claimSearchButton": "Search",
"claimNoResults": "No results found"
```

In `messages/en.json`, merge into `"adminProviders"`:
```json
"basicInfo": "Basic information"
```

- [ ] **Step 3: Rewrite ProviderForm.tsx**

Full replacement of `src/app/[locale]/admin/providers/ProviderForm.tsx`:

```tsx
"use client";

import { useState, useTransition, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { toSlug } from "@/lib/slug";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type Day = (typeof DAYS)[number];

interface Bairro {
  id: string;
  name: string;
}
interface Category {
  id: string;
  name_pt: string;
  name_en: string | null;
  icon: string | null;
}
interface Photo {
  url: string;
}

interface ProviderData {
  id?: string;
  name?: string;
  slug?: string;
  description_pt?: string | null;
  description_en?: string | null;
  whatsapp?: string | null;
  phone?: string | null;
  home_bairro_id?: string | null;
  status?: string;
  tier?: string;
  working_hours?: Record<string, string>;
  categoryIds?: string[];
  serviceAreaIds?: string[];
  photos?: Photo[];
}

interface ProviderFormProps {
  bairros: Bairro[];
  categories: Category[];
  initialData?: ProviderData;
  mode: "create" | "edit";
  action: (formData: FormData) => Promise<{ error?: string } | unknown>;
  redirectTo: string;
  selfService?: boolean;
}

export default function ProviderForm({
  bairros,
  categories,
  initialData = {},
  mode,
  action,
  redirectTo,
  selfService = false,
}: ProviderFormProps) {
  const t = useTranslations("adminProviders");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const wh = (initialData.working_hours ?? {}) as Record<Day, string>;

  const [name, setName] = useState(initialData.name ?? "");
  const [slug, setSlug] = useState(initialData.slug ?? "");
  const [descPt, setDescPt] = useState(initialData.description_pt ?? "");
  const [descEn, setDescEn] = useState(initialData.description_en ?? "");
  const [whatsapp, setWhatsapp] = useState(initialData.whatsapp ?? "");
  const [phone, setPhone] = useState(initialData.phone ?? "");
  const [homeBairroId, setHomeBairroId] = useState(
    initialData.home_bairro_id ?? ""
  );
  const [status, setStatus] = useState(initialData.status ?? "active");
  const [tier, setTier] = useState(initialData.tier ?? "free");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    initialData.categoryIds ?? []
  );
  const [selectedAreas, setSelectedAreas] = useState<string[]>(
    initialData.serviceAreaIds ?? []
  );
  const [hours, setHours] = useState<Record<Day, string>>(
    Object.fromEntries(DAYS.map((d) => [d, wh[d] ?? ""])) as Record<Day, string>
  );
  const [photos, setPhotos] = useState<string[]>(
    initialData.photos?.map((p) => p.url) ?? []
  );

  async function handlePhotoUpload(file: File) {
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    setUploading(true);
    const { data, error: uploadError } = await supabase.storage
      .from("provider-photos")
      .upload(path, file, { upsert: false });
    setUploading(false);
    if (uploadError || !data) {
      setError(`Upload failed: ${uploadError?.message}`);
      return;
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from("provider-photos").getPublicUrl(data.path);
    setPhotos((prev) => [...prev, publicUrl]);
  }

  function toggleCategory(id: string) {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleArea(id: string) {
    setSelectedAreas((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function removePhoto(url: string) {
    setPhotos((prev) => prev.filter((p) => p !== url));
  }

  function buildFormData() {
    const fd = new FormData();
    fd.set("name", name);
    fd.set("slug", slug || toSlug(name));
    fd.set("description_pt", descPt);
    fd.set("description_en", descEn);
    fd.set("whatsapp", whatsapp);
    fd.set("phone", phone);
    fd.set("home_bairro_id", homeBairroId);
    fd.set("status", status);
    fd.set("tier", tier);
    selectedCategories.forEach((id) => fd.append("category_ids", id));
    selectedAreas.forEach((id) => fd.append("service_area_ids", id));
    photos.forEach((url) => fd.append("photo_urls", url));
    DAYS.forEach((d) => fd.set(`hours_${d}`, hours[d]));
    return fd;
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await action(buildFormData());
      if (result && typeof result === "object" && "error" in result && (result as { error?: string }).error) {
        setError((result as { error?: string }).error!);
        return;
      }
      router.push(redirectTo);
    });
  }

  const inputClass =
    "w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-background text-primary";
  const labelClass = "block text-sm font-medium text-primary mb-1";

  return (
    <div className="max-w-3xl space-y-8">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Basic info */}
      <section className="bg-surface rounded-xl border border-border p-5 space-y-4">
        <h2 className="font-semibold text-primary">{t("basicInfo")}</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>{t("name")} *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!initialData.id) setSlug(toSlug(e.target.value));
              }}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t("slug")} *</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className={`${inputClass} font-mono`}
            />
          </div>
        </div>
        <div>
          <label className={labelClass}>{t("descriptionPt")}</label>
          <textarea
            value={descPt}
            onChange={(e) => setDescPt(e.target.value)}
            rows={3}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>{t("descriptionEn")}</label>
          <textarea
            value={descEn}
            onChange={(e) => setDescEn(e.target.value)}
            rows={3}
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>{t("whatsapp")}</label>
            <input
              type="text"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+55 27 99999-9999"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t("phone")}</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        {selfService && (
          <div>
            <label className={labelClass}>{t("homeBairro")}</label>
            <select
              value={homeBairroId}
              onChange={(e) => setHomeBairroId(e.target.value)}
              className={inputClass}
            >
              <option value="">—</option>
              {bairros.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {!selfService && (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>{t("homeBairro")}</label>
              <select
                value={homeBairroId}
                onChange={(e) => setHomeBairroId(e.target.value)}
                className={inputClass}
              >
                <option value="">—</option>
                {bairros.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("status")}</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={inputClass}
              >
                <option value="active">{t("statusActive")}</option>
                <option value="pending">{t("statusPending")}</option>
                <option value="inactive">{t("statusInactive")}</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("tier")}</label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value)}
                className={inputClass}
              >
                <option value="free">{t("tierFree")}</option>
                <option value="premium">{t("tierPremium")}</option>
              </select>
            </div>
          </div>
        )}
      </section>

      {/* Categories */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="font-semibold text-primary mb-4">{t("categories")}</h2>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <label
              key={cat.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                selectedCategories.includes(cat.id)
                  ? "bg-surface border-accent text-accent"
                  : "bg-background border-border text-muted hover:border-accent"
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={selectedCategories.includes(cat.id)}
                onChange={() => toggleCategory(cat.id)}
              />
              {cat.icon && <span>{cat.icon}</span>}
              <span>{locale === "en" ? (cat.name_en ?? cat.name_pt) : cat.name_pt}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Service areas */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="font-semibold text-primary mb-4">{t("serviceAreas")}</h2>
        <div className="flex flex-wrap gap-2">
          {bairros.map((b) => (
            <label
              key={b.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                selectedAreas.includes(b.id)
                  ? "bg-surface border-accent text-accent"
                  : "bg-background border-border text-muted hover:border-accent"
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={selectedAreas.includes(b.id)}
                onChange={() => toggleArea(b.id)}
              />
              {b.name}
            </label>
          ))}
        </div>
      </section>

      {/* Working hours */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="font-semibold text-primary mb-4">{t("workingHours")}</h2>
        <div className="space-y-2">
          {DAYS.map((day) => (
            <div key={day} className="flex items-center gap-4">
              <span className="w-24 text-sm text-muted font-medium">
                {t(day)}
              </span>
              <input
                type="text"
                value={hours[day]}
                onChange={(e) =>
                  setHours((h) => ({ ...h, [day]: e.target.value }))
                }
                placeholder={t("closed")}
                className="flex-1 px-3 py-1.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-background text-primary"
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          Ex: 08:00–18:00 · {t("closed")}: deixe em branco
        </p>
      </section>

      {/* Photos */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="font-semibold text-primary mb-4">{t("photos")}</h2>
        <div className="flex flex-wrap gap-3">
          {photos.map((url) => (
            <div key={url} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="w-24 h-24 object-cover rounded-lg border border-border"
              />
              <button
                type="button"
                onClick={() => removePhoto(url)}
                className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs hidden group-hover:flex items-center justify-center"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg text-muted hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
          >
            <span className="text-2xl">+</span>
            <span className="text-xs mt-1">
              {uploading ? t("uploadingPhoto") : t("addPhoto")}
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handlePhotoUpload(file);
              e.target.value = "";
            }}
          />
        </div>
      </section>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={!name || isPending}
          className="px-6 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
        >
          {isPending ? t("uploadingPhoto") : t("save")}
        </button>
        <button
          onClick={() => router.push(redirectTo)}
          className="px-6 py-2.5 bg-surface border border-border text-muted rounded-lg text-sm font-medium hover:border-accent hover:text-accent transition-colors"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify no legacy classes remain in ProviderForm**

Run: `grep -E "emerald|text-gray|bg-gray|border-gray|bg-white|blue-[0-9]" "src/app/[locale]/admin/providers/ProviderForm.tsx"`
Expected: no output

- [ ] **Step 5: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: zero errors

- [ ] **Step 6: Commit**

```bash
git add "src/app/[locale]/admin/providers/ProviderForm.tsx" messages/pt-BR.json messages/en.json
git commit -m "feat: apply design tokens to ProviderForm, add missing translation keys (issue #14)"
```

---

## Task 2: Login page

**Files:**
- Modify: `src/app/[locale]/login/page.tsx`

The login page is the first impression for new users. The app name gets `text-accent font-display` to match the homepage branding. The card gets `bg-surface` + `border-border`. The Google button gets the neutral treatment with `bg-background border-border text-primary hover:bg-surface`.

- [ ] **Step 1: Rewrite login/page.tsx**

Full replacement of `src/app/[locale]/login/page.tsx`:

```tsx
"use client";

import { useTranslations, useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  const t = useTranslations();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? `/${locale}`;
  const error = searchParams.get("error");

  async function signInWithGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}&locale=${locale}`,
      },
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-accent font-display">
            {t("common.appName")}
          </h1>
          <p className="mt-2 text-muted text-sm">{t("common.tagline")}</p>
        </div>

        {/* Card */}
        <div className="bg-surface rounded-2xl border border-border p-8">
          <h2 className="text-xl font-semibold text-primary mb-6">
            {t("auth.loginTitle")}
          </h2>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">
              {t("common.error")}
            </div>
          )}

          {/* Google sign in */}
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 h-11 px-4 bg-background border border-border rounded-xl text-sm font-medium text-primary hover:bg-surface transition-colors"
          >
            <GoogleIcon />
            {t("auth.loginWithGoogle")}
          </button>

          <p className="mt-6 text-center text-xs text-muted">
            {t("auth.signupProvider")}
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}
```

- [ ] **Step 2: Verify no legacy classes remain**

Run: `grep -E "emerald|text-gray|bg-gray|border-gray|bg-white" "src/app/[locale]/login/page.tsx"`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add "src/app/[locale]/login/page.tsx"
git commit -m "feat: apply design tokens to login page (issue #14)"
```

---

## Task 3: Account hub

**Files:**
- Modify: `src/app/[locale]/account/page.tsx`

Key decisions: active status badge → `border border-border text-accent` (terracotta inline pill, no filled background needed). All three action cards → `border-border hover:border-accent`. The blue recommend card loses its blue entirely — same `border-border hover:border-accent` treatment as the others, keeping the design consistent.

- [ ] **Step 1: Rewrite account/page.tsx**

Full replacement of `src/app/[locale]/account/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth";

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const user = await getCurrentUser();

  if (!user) redirect(`/${locale}/login`);

  const supabase = await createClient();
  const { data: provider } = await supabase
    .from("providers")
    .select("id, name, slug, status")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto px-4 py-12 w-full">
        <h1 className="text-2xl font-bold text-primary mb-8">
          {t("account.title")}
        </h1>

        {provider ? (
          <div className="bg-surface rounded-xl border border-border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-primary">{provider.name}</h2>
                <span
                  className={`inline-flex mt-1 px-2 py-0.5 rounded text-xs font-medium border ${
                    provider.status === "active"
                      ? "border-border text-accent"
                      : "border-border text-muted"
                  }`}
                >
                  {provider.status === "active"
                    ? t("account.statusActive")
                    : t("account.listingPending")}
                </span>
              </div>
              <Link
                href="/account/edit"
                className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
              >
                {t("account.editListing")}
              </Link>
            </div>
            <div className="flex gap-3 pt-2">
              <Link
                href={`/provider/${provider.slug}`}
                className="text-sm text-accent hover:text-accent-hover transition-colors"
              >
                {t("account.viewPublicProfile")}
              </Link>
              <Link
                href="/account/recommend"
                className="text-sm text-accent hover:text-accent-hover transition-colors"
              >
                {t("recommendations.recommend")}
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/account/create"
              className="flex flex-col items-center gap-3 p-8 bg-surface rounded-xl border-2 border-border hover:border-accent hover:shadow-sm transition-all text-center"
            >
              <span className="text-4xl">✨</span>
              <span className="font-semibold text-primary">
                {t("account.createListing")}
              </span>
              <span className="text-sm text-muted">
                {t("account.createListingDesc")}
              </span>
            </Link>
            <Link
              href="/account/claim"
              className="flex flex-col items-center gap-3 p-8 bg-surface rounded-xl border-2 border-border hover:border-accent hover:shadow-sm transition-all text-center"
            >
              <span className="text-4xl">🔍</span>
              <span className="font-semibold text-primary">
                {t("account.claimListing")}
              </span>
              <span className="text-sm text-muted">
                {t("account.claimListingDesc")}
              </span>
            </Link>
            <Link
              href="/account/recommend"
              className="flex flex-col items-center gap-3 p-8 bg-surface rounded-xl border-2 border-border hover:border-accent hover:shadow-sm transition-all text-center"
            >
              <span className="text-4xl">💡</span>
              <span className="font-semibold text-primary">
                {t("recommendations.recommend")}
              </span>
              <span className="text-sm text-muted">
                {t("account.recommendCardDesc")}
              </span>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify no legacy classes remain**

Run: `grep -E "emerald|text-gray|bg-gray|border-gray|bg-white|blue-[0-9]" "src/app/[locale]/account/page.tsx"`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add "src/app/[locale]/account/page.tsx"
git commit -m "feat: apply design tokens to account hub page (issue #14)"
```

---

## Task 4: Account sub-page shells (edit, create, claim)

**Files:**
- Modify: `src/app/[locale]/account/edit/page.tsx`
- Modify: `src/app/[locale]/account/create/page.tsx`
- Modify: `src/app/[locale]/account/claim/page.tsx`

All three share the identical shell pattern: a back link + h1 header, then delegate to a child component. Only the shell header tokens change; the child components are handled in other tasks.

- [ ] **Step 1: Rewrite account/edit/page.tsx**

Full replacement of `src/app/[locale]/account/edit/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth";
import ProviderForm from "../../admin/providers/ProviderForm";
import { updateOwnProvider } from "../actions";

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const user = await getCurrentUser();

  if (!user) redirect(`/${locale}/login`);

  const supabase = await createClient();

  const { data: provider } = await supabase
    .from("providers")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!provider) notFound();

  const [
    { data: bairros },
    { data: categories },
    { data: providerCategories },
    { data: serviceAreas },
    { data: photos },
  ] = await Promise.all([
    supabase.from("bairros").select("id, name").order("name"),
    supabase.from("categories").select("id, name_pt, name_en, icon").order("sort_order"),
    supabase.from("provider_categories").select("category_id").eq("provider_id", provider.id),
    supabase.from("provider_service_areas").select("bairro_id").eq("provider_id", provider.id),
    supabase.from("provider_photos").select("url, sort_order").eq("provider_id", provider.id).order("sort_order"),
  ]);

  const initialData = {
    id: provider.id,
    name: provider.name,
    slug: provider.slug,
    description_pt: provider.description_pt,
    description_en: provider.description_en,
    whatsapp: provider.whatsapp,
    phone: provider.phone,
    home_bairro_id: provider.home_bairro_id,
    status: provider.status,
    tier: provider.tier,
    working_hours: (provider.working_hours as Record<string, string>) ?? {},
    categoryIds: providerCategories?.map((pc) => pc.category_id) ?? [],
    serviceAreaIds: serviceAreas?.map((sa) => sa.bairro_id) ?? [],
    photos: photos?.map((p) => ({ url: p.url })) ?? [],
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-8 w-full">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/account"
            className="text-sm text-muted hover:text-primary transition-colors"
          >
            ← {t("common.back")}
          </Link>
          <h1 className="text-2xl font-bold text-primary">
            {t("account.editListing")}
          </h1>
        </div>
        <ProviderForm
          bairros={bairros ?? []}
          categories={categories ?? []}
          initialData={initialData}
          mode="edit"
          action={(fd) => updateOwnProvider(provider.id, fd)}
          redirectTo="/account"
          selfService
        />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite account/create/page.tsx**

Full replacement of `src/app/[locale]/account/create/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth";
import ProviderForm from "../../admin/providers/ProviderForm";
import { createOwnProvider } from "../actions";

export default async function CreateListingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const user = await getCurrentUser();

  if (!user) redirect(`/${locale}/login`);

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("providers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) redirect(`/${locale}/account`);

  const [{ data: bairros }, { data: categories }] = await Promise.all([
    supabase.from("bairros").select("id, name").order("name"),
    supabase.from("categories").select("id, name_pt, name_en, icon").order("sort_order"),
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-8 w-full">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/account"
            className="text-sm text-muted hover:text-primary transition-colors"
          >
            ← {t("common.back")}
          </Link>
          <h1 className="text-2xl font-bold text-primary">
            {t("account.createListing")}
          </h1>
        </div>
        <ProviderForm
          bairros={bairros ?? []}
          categories={categories ?? []}
          initialData={{}}
          mode="create"
          action={createOwnProvider}
          redirectTo="/account"
          selfService
        />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite account/claim/page.tsx**

Full replacement of `src/app/[locale]/account/claim/page.tsx`:

```tsx
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ClaimSearch from "./ClaimSearch";

export default async function ClaimListingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const user = await getCurrentUser();

  if (!user) redirect(`/${locale}/login`);

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("providers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) redirect(`/${locale}/account`);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto px-4 py-8 w-full">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/account"
            className="text-sm text-muted hover:text-primary transition-colors"
          >
            ← {t("common.back")}
          </Link>
          <h1 className="text-2xl font-bold text-primary">
            {t("account.claimListing")}
          </h1>
        </div>
        <ClaimSearch />
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Verify no legacy classes remain in all three shells**

Run: `grep -E "emerald|text-gray|bg-gray|border-gray|bg-white" "src/app/[locale]/account/edit/page.tsx" "src/app/[locale]/account/create/page.tsx" "src/app/[locale]/account/claim/page.tsx"`
Expected: no output

- [ ] **Step 5: Commit**

```bash
git add "src/app/[locale]/account/edit/page.tsx" "src/app/[locale]/account/create/page.tsx" "src/app/[locale]/account/claim/page.tsx"
git commit -m "feat: apply design tokens to account sub-page shells (issue #14)"
```

---

## Task 5: ClaimSearch client component

**Files:**
- Modify: `src/app/[locale]/account/claim/ClaimSearch.tsx`

Two hardcoded strings become translation keys (`claimSearchButton`, `claimNoResults`). The success state drops emerald for the neutral surface treatment. The search button becomes `bg-accent` (primary action). The claim button is also `bg-accent`. Result cards get `bg-surface border-border`.

- [ ] **Step 1: Rewrite ClaimSearch.tsx**

Full replacement of `src/app/[locale]/account/claim/ClaimSearch.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { searchUnownedProviders, submitClaim } from "../actions";

type ProviderResult = {
  id: string;
  name: string;
  whatsapp: string | null;
  home_bairro: { name: string } | { name: string }[] | null;
};

export default function ClaimSearch() {
  const t = useTranslations("account");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProviderResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [claimedId, setClaimedId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSearch() {
    startTransition(async () => {
      const data = await searchUnownedProviders(query);
      setResults(data as ProviderResult[]);
      setSearched(true);
    });
  }

  function handleClaim(providerId: string) {
    setClaimError(null);
    startTransition(async () => {
      const result = await submitClaim(providerId);
      if (result.error === "duplicate") {
        setClaimError(t("claimDuplicate"));
      } else if (result.error === "owned") {
        setClaimError(t("claimOwned"));
      } else if (result.error) {
        setClaimError(result.error);
      } else {
        setClaimedId(providerId);
      }
    });
  }

  if (claimedId) {
    return (
      <div className="p-6 bg-surface border border-border rounded-xl text-primary">
        {t("claimSent")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder={t("claimSearch")}
          className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-background text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          onClick={handleSearch}
          disabled={!query.trim() || isPending}
          className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
        >
          {t("claimSearchButton")}
        </button>
      </div>

      {claimError && (
        <p className="text-sm text-red-600">{claimError}</p>
      )}

      {searched && results.length === 0 && (
        <p className="text-sm text-muted py-4 text-center">
          {t("claimNoResults")}
        </p>
      )}

      {results.map((p) => {
        const bairroRaw = p.home_bairro;
        const bairroName = Array.isArray(bairroRaw)
          ? bairroRaw[0]?.name
          : bairroRaw?.name;

        return (
          <div
            key={p.id}
            className="flex items-center justify-between p-4 bg-surface rounded-xl border border-border"
          >
            <div>
              <p className="font-medium text-primary">{p.name}</p>
              {bairroName && (
                <p className="text-sm text-muted">📍 {bairroName}</p>
              )}
            </div>
            <button
              onClick={() => handleClaim(p.id)}
              disabled={isPending}
              className="px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              {t("claimSubmit")}
            </button>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify no legacy classes remain**

Run: `grep -E "emerald|text-gray|bg-gray|border-gray|bg-white|blue-[0-9]" "src/app/[locale]/account/claim/ClaimSearch.tsx"`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add "src/app/[locale]/account/claim/ClaimSearch.tsx"
git commit -m "feat: apply design tokens to ClaimSearch, extract hardcoded strings (issue #14)"
```

---

## Task 6: Recommend page + RecommendForm

**Files:**
- Modify: `src/app/[locale]/account/recommend/page.tsx`
- Modify: `src/app/[locale]/account/recommend/RecommendForm.tsx`

The recommend page is currently missing its `Header` and footer entirely — it just has a bare `max-w-lg mx-auto p-6` wrapper. It gets the full page layout treatment. RecommendForm's blue accent color (`bg-blue-600`, `focus:ring-blue-500`) — a completely off-brand choice — gets replaced with `bg-accent` / `focus:ring-accent`.

- [ ] **Step 1: Rewrite recommend/page.tsx**

Full replacement of `src/app/[locale]/account/recommend/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import RecommendForm from "./RecommendForm";

export default async function RecommendPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "recommendations" });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const [{ data: categories }, { data: bairros }] = await Promise.all([
    supabase.from("categories").select("id, name_pt").order("sort_order"),
    supabase.from("bairros").select("id, name").order("name"),
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-lg mx-auto px-4 py-8 w-full">
        <h1 className="text-2xl font-bold text-primary mb-2">{t("recommend")}</h1>
        <p className="text-muted mb-6">{t("recommendDesc")}</p>
        <RecommendForm
          categories={categories ?? []}
          bairros={bairros ?? []}
        />
      </main>

      <footer className="border-t border-border py-6">
        <div className="max-w-lg mx-auto px-4 text-center text-sm text-muted">
          {t("recommend")}
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite recommend/RecommendForm.tsx**

Full replacement of `src/app/[locale]/account/recommend/RecommendForm.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { submitRecommendation } from "./actions";

function SubmitButton() {
  const t = useTranslations("recommendations");
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-accent text-white py-2 px-4 rounded-lg hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
    >
      {pending ? "..." : t("submit")}
    </button>
  );
}

type Category = { id: string; name_pt: string };
type Bairro = { id: string; name: string };

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2 bg-background text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent";
const labelClass = "block text-sm font-medium text-primary mb-1";

export default function RecommendForm({
  categories,
  bairros,
}: {
  categories: Category[];
  bairros: Bairro[];
}) {
  const t = useTranslations("recommendations");
  const [state, formAction] = useActionState(submitRecommendation, { error: null });

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="text-red-600 text-sm">{state.error}</p>
      )}

      <div>
        <label className={labelClass}>{t("providerName")} *</label>
        <input
          name="provider_name"
          type="text"
          required
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>{t("category")}</label>
        <select
          name="category_id"
          required
          defaultValue=""
          className={inputClass}
        >
          <option value="" disabled>—</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name_pt}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>{t("whatsapp")}</label>
        <input
          name="whatsapp"
          type="text"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>{t("bairro")}</label>
        <select
          name="bairro_id"
          className={inputClass}
        >
          <option value="">—</option>
          {bairros.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>{t("description")}</label>
        <textarea
          name="description"
          rows={3}
          className={inputClass}
        />
      </div>

      <SubmitButton />
    </form>
  );
}
```

- [ ] **Step 3: Verify no legacy classes remain**

Run: `grep -E "emerald|text-gray|bg-gray|border-gray|bg-white|blue-[0-9]" "src/app/[locale]/account/recommend/page.tsx" "src/app/[locale]/account/recommend/RecommendForm.tsx"`
Expected: no output

- [ ] **Step 4: Commit**

```bash
git add "src/app/[locale]/account/recommend/page.tsx" "src/app/[locale]/account/recommend/RecommendForm.tsx"
git commit -m "feat: apply design tokens to Recommend page and form, add Header layout (issue #14)"
```

---

## Final Verification

- [ ] Full legacy class sweep across all touched surfaces:

```bash
grep -rE "emerald|text-gray|bg-gray|border-gray|bg-white|blue-[0-9]" \
  "src/app/[locale]/login/" \
  "src/app/[locale]/account/" \
  "src/app/[locale]/admin/providers/ProviderForm.tsx"
```
Expected: no output

- [ ] TypeScript: `npx tsc --noEmit` — zero errors
- [ ] Tests: `npx vitest run` — all pass
- [ ] Build: `npm run build` — clean, zero errors
