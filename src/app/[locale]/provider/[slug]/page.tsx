import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/header";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import PhotoGallery from "./PhotoGallery";
import type { Metadata } from "next";
import { parseWorkingHours, buildWhatsAppHref } from "@/lib/supabase/utils";

const SECTION_HEADING =
  "text-sm font-semibold text-muted uppercase tracking-wider mb-2";

const WHATSAPP_BASE =
  "items-center gap-2 bg-whatsapp text-white rounded-xl font-medium hover:opacity-90 transition-opacity";

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
  const { data: provider, error: metaError } = await supabase
    .from("providers")
    .select("name, description_pt, description_en")
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  if (metaError) {
    if (metaError.code !== "PGRST116") {
      console.error("[provider-page] generateMetadata Supabase error", {
        slug,
        code: metaError.code,
        message: metaError.message,
      });
    }
    return {};
  }

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

  const workingHours = parseWorkingHours(provider.working_hours);
  const whatsappHref = buildWhatsAppHref(provider.whatsapp);

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
                className={`hidden md:inline-flex ${WHATSAPP_BASE} px-4 py-2 whitespace-nowrap`}
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
              <h2 className={SECTION_HEADING}>
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
              <h2 className={SECTION_HEADING}>
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
              <h2 className={SECTION_HEADING}>
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
                className={`w-full flex justify-center ${WHATSAPP_BASE} px-4 py-3`}
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

      {/* Sticky WhatsApp CTA — mobile only. bottom offset places it above BottomNav (h-16 + safe-area). z-10 keeps it below BottomNav (z-50) so the nav stays on top. */}
      {whatsappHref && (
        <div
          className="fixed left-0 right-0 z-10 md:hidden bg-background/95 backdrop-blur-sm border-t border-border px-4 py-3"
          style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
        >
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className={`w-full flex justify-center ${WHATSAPP_BASE} px-4 py-3`}
          >
            <WhatsAppIcon size={18} />
            {t("provider.contactWhatsApp")}
          </a>
        </div>
      )}
    </div>
  );
}
