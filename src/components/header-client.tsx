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
