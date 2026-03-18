"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/auth";

export function HeaderClient({
  initialRole,
  avatarUrl,
  fullName,
}: {
  initialRole: UserRole | null;
  avatarUrl: string | null;
  fullName: string | null;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const otherLocale = locale === "pt-BR" ? "en" : "pt-BR";
  const [isSignedIn, setIsSignedIn] = useState(initialRole !== null);

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      setIsSignedIn(!!session?.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-emerald-600">
          {t("common.appName")}
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href={pathname}
            locale={otherLocale}
            className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            {t("common.switchLanguage")}
          </Link>

          {isSignedIn ? (
            <div className="flex items-center gap-3">
              {/* Role-aware link */}
              {initialRole === "admin" ? (
                <Link
                  href="/admin/bairros"
                  className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
                >
                  Admin
                </Link>
              ) : initialRole === "provider" ? (
                <Link
                  href="/account"
                  className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
                >
                  {t("account.myListing")}
                </Link>
              ) : (
                <Link
                  href="/account"
                  className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
                >
                  {t("account.becomeProvider")}
                </Link>
              )}
              {avatarUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={fullName ?? ""}
                  className="w-7 h-7 rounded-full"
                />
              )}
              <button
                onClick={handleSignOut}
                className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
              >
                {t("common.logout")}
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              {t("common.login")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
