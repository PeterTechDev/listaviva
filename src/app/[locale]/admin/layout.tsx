import { getCurrentUser } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/app-sidebar";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Load translations (keeps next-intl working for child pages)
  await getTranslations({ locale });
  const user = await getCurrentUser();

  return (
    <SidebarProvider className="admin-sidebar-carbon">
      <AdminSidebar locale={locale} user={user} />
      <SidebarInset className="bg-zinc-950 min-h-screen">
        <main className="flex-1 overflow-auto p-6 text-zinc-100">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
