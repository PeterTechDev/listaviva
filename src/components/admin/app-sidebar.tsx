"use client";

import type { ComponentProps } from "react";
import type { LucideIcon } from "lucide-react";
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
} from "@/components/ui/sidebar";
import type { UserProfile } from "@/lib/auth";

// ── Constants ──────────────────────────────────────────────────────────────

const ADMIN_ACCENT = "#C85C38";

// ── Types ─────────────────────────────────────────────────────────────────

type NavItem = {
  href: ComponentProps<typeof Link>["href"];
  label: string;
  icon: LucideIcon;
};

type NavGroup = {
  label: string;
  items: readonly [NavItem, ...NavItem[]];
};

// ── Props ─────────────────────────────────────────────────────────────────

type AdminSidebarProps = {
  // TODO: pass to useTranslations() when nav labels are i18n'd
  locale: string;
  user: UserProfile | null;
};

// ── Nav config ─────────────────────────────────────────────────────────────

function buildNavGroups(): readonly NavGroup[] {
  return [
    {
      label: "Analytics",
      items: [
        { href: "/admin/dashboard", label: "Dashboard", icon: BarChart3 },
      ],
    },
    {
      label: "Catálogo",
      items: [
        { href: "/admin/providers", label: "Providers", icon: Users },
        { href: "/admin/categories", label: "Categories", icon: Tag },
        { href: "/admin/bairros", label: "Bairros", icon: MapPin },
      ],
    },
    {
      label: "Moderação",
      items: [
        { href: "/admin/claims", label: "Claims", icon: FileCheck },
        { href: "/admin/recommendations", label: "Recommendations", icon: Lightbulb },
      ],
    },
  ] as const;
}

// ── Inner sidebar (client) ─────────────────────────────────────────────────

function SidebarInner({ user }: { user: UserProfile | null }) {
  const pathname = usePathname();
  const navGroups = buildNavGroups();

  return (
    <Sidebar collapsible="icon" className="border-r border-zinc-800 bg-zinc-950">
      {/* Header */}
      <SidebarHeader className="px-4 py-4 border-b border-zinc-800">
        <Link
          href="/admin/dashboard"
          className="flex flex-col gap-0.5 select-none"
        >
          <span
            className="text-base font-bold leading-none tracking-tight"
            style={{ color: ADMIN_ACCENT }}
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
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);

                  return (
                    <SidebarMenuItem key={String(item.href)}>
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={item.label}
                        render={<Link href={item.href} />}
                        className={
                          isActive
                            ? "text-zinc-100 font-medium"
                            : "text-zinc-400 hover:text-zinc-100"
                        }
                        style={
                          isActive
                            ? {
                                backgroundColor: "rgba(200, 92, 56, 0.12)",
                                color: ADMIN_ACCENT,
                              }
                            : undefined
                        }
                      >
                        <Icon
                          className="size-4 shrink-0"
                          style={isActive ? { color: ADMIN_ACCENT } : undefined}
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

export function AdminSidebar({ locale: _locale, user }: AdminSidebarProps) {
  return <SidebarInner user={user} />;
}
