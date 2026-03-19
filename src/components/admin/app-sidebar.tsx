"use client";

import { BarChart3, MapPin, Tag, Users, FileCheck, Lightbulb, User } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { usePathname } from "@/i18n/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar";
import type { UserProfile } from "@/lib/auth";

// ── Types ─────────────────────────────────────────────────────────────────

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

// ── Props ─────────────────────────────────────────────────────────────────

type AdminSidebarProps = {
  locale: string;
  user: UserProfile | null;
};

// ── Nav config ─────────────────────────────────────────────────────────────

function buildNavGroups(locale: string): NavGroup[] {
  return [
    {
      label: "Analytics",
      items: [
        { href: `/${locale}/admin/dashboard`, label: "Dashboard", icon: BarChart3 },
      ],
    },
    {
      label: "Catálogo",
      items: [
        { href: `/${locale}/admin/providers`, label: "Providers", icon: Users },
        { href: `/${locale}/admin/categories`, label: "Categories", icon: Tag },
        { href: `/${locale}/admin/bairros`, label: "Bairros", icon: MapPin },
      ],
    },
    {
      label: "Moderação",
      items: [
        { href: `/${locale}/admin/claims`, label: "Claims", icon: FileCheck },
        { href: `/${locale}/admin/recommendations`, label: "Recommendations", icon: Lightbulb },
      ],
    },
  ];
}

// ── Inner sidebar (client) ─────────────────────────────────────────────────

function SidebarInner({ locale, user }: AdminSidebarProps) {
  const pathname = usePathname();
  const navGroups = buildNavGroups(locale);

  return (
    <Sidebar collapsible="icon" className="border-r border-zinc-800 bg-zinc-950">
      {/* Header */}
      <SidebarHeader className="px-4 py-4 border-b border-zinc-800">
        <Link
          href={`/${locale}/admin/dashboard`}
          className="flex flex-col gap-0.5 select-none"
        >
          <span
            className="text-base font-bold leading-none tracking-tight"
            style={{ color: "#C85C38" }}
          >
            Listaviva
          </span>
          <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">
            Admin
          </span>
        </Link>
      </SidebarHeader>

      {/* Nav groups */}
      <SidebarContent className="py-2">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-zinc-500 text-[10px] uppercase tracking-widest px-3 mb-0.5">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  // Match on the last path segment (locale-agnostic)
                  const isActive = pathname.includes(
                    item.href.replace(`/${locale}`, "")
                  );

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={item.label}
                        render={
                          <Link href={item.href as Parameters<typeof Link>[0]["href"]} />
                        }
                        className={
                          isActive
                            ? "text-zinc-100 font-medium"
                            : "text-zinc-400 hover:text-zinc-100"
                        }
                        style={
                          isActive
                            ? {
                                backgroundColor: "rgba(200, 92, 56, 0.12)",
                                color: "#C85C38",
                              }
                            : undefined
                        }
                      >
                        <Icon
                          className="size-4 shrink-0"
                          style={isActive ? { color: "#C85C38" } : undefined}
                        />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
            <User className="size-3.5 text-zinc-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-zinc-300 font-medium truncate leading-tight">
              {user?.full_name ?? "Admin"}
            </p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

// ── Exported layout wrapper ─────────────────────────────────────────────────

export function AdminSidebar({ locale, user }: AdminSidebarProps) {
  return <SidebarInner locale={locale} user={user} />;
}

export { SidebarProvider, SidebarInset };
