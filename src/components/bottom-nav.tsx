"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Home, Search, Compass, CircleUser } from "lucide-react";

const tabs = [
  { key: "home",       href: "/",           Icon: Home,        labelKey: "nav.home" },
  { key: "search",     href: "/search",      Icon: Search,      labelKey: "nav.search" },
  { key: "categories", href: "/categories",  Icon: Compass,     labelKey: "nav.categories" },
  { key: "account",    href: "/account",     Icon: CircleUser,  labelKey: "nav.account" },
] as const;

export function BottomNav() {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 bg-background border-t border-border md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-4 h-16">
        {tabs.map(({ key, href, Icon, labelKey }) => {
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
              <Icon size={22} strokeWidth={active ? 2.5 : 1.75} />
              <span>{t(labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
