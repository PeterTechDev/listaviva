import { getCurrentUser } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const user = await getCurrentUser();

  const navItems = [
    { href: "/admin/bairros" as const, label: t("admin.bairros"), icon: "🏘" },
    { href: "/admin/categories" as const, label: t("admin.categories"), icon: "📂" },
    { href: "/admin/providers" as const, label: t("admin.listings"), icon: "👤" },
    { href: "/admin/claims" as const, label: t("admin.claims"), icon: "📋" },
    { href: "/admin/recommendations" as const, label: t("admin.recommendations"), icon: "💡" },
  ];

  return (
    <div className="min-h-screen flex bg-gray-100">
      <aside className="w-56 bg-gray-900 text-white flex-shrink-0 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <Link
            href="/"
            className="text-lg font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            {t("common.appName")}
          </Link>
          <p className="text-xs text-gray-400 mt-0.5">Admin</p>
        </div>

        <nav className="flex-1 py-4 px-2 space-y-1">
          {navItems.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <span>{icon}</span>
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        {user && (
          <div className="p-4 border-t border-gray-700">
            <p className="text-xs text-gray-400 truncate">
              {user.full_name ?? "Admin"}
            </p>
          </div>
        )}
      </aside>

      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
