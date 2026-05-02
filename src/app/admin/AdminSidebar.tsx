"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarCheck,
  Users,
  Wrench,
  ShieldCheck,
  Clock,
  Settings,
  UserSquare,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StaffProfile } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/auth/rbac";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  permissions?: string[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Bookings",
    href: "/admin/bookings",
    icon: CalendarCheck,
    permissions: [PERMISSIONS.VIEW_ALL_BOOKINGS, PERMISSIONS.MANAGE_BOOKINGS_ALL],
  },
  {
    label: "Staff",
    href: "/admin/staff",
    icon: Users,
    permissions: [PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_STAFF],
  },
  {
    label: "Services",
    href: "/admin/services",
    icon: Wrench,
    permissions: [PERMISSIONS.MANAGE_SERVICES],
  },
  {
    label: "Roles & Permissions",
    href: "/admin/roles",
    icon: ShieldCheck,
    permissions: [PERMISSIONS.MANAGE_ROLES],
  },
  {
    label: "Availability",
    href: "/admin/availability",
    icon: Clock,
    permissions: [PERMISSIONS.MANAGE_AVAILABILITY_GLOBAL],
  },
  {
    label: "Clients",
    href: "/admin/clients",
    icon: UserSquare,
    permissions: [PERMISSIONS.VIEW_CLIENTS, PERMISSIONS.MANAGE_CLIENTS],
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
    permissions: [PERMISSIONS.MANAGE_SETTINGS],
  },
];

interface AdminSidebarProps {
  profile: StaffProfile;
}

export function AdminSidebar({ profile }: AdminSidebarProps) {
  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter(
    (item) =>
      !item.permissions ||
      item.permissions.some((permission) => profile.permissions.has(permission))
  );

  return (
    <aside
      className="flex h-screen w-64 shrink-0 flex-col border-r"
      style={{
        background: "var(--rahma-green)",
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3C7 3 3 7 3 12s4 9 9 9 9-4 9-9-4-9-9-9Z" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M12 8v8M8 12h8" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
        <span className="text-sm font-semibold text-white">Rahma Therapy</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-0.5">
          {visibleItems.map((item) => {
            const isActive =
              item.href === "/admin/dashboard"
                ? pathname === item.href
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                    isActive
                      ? "bg-white/15 text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Staff info + sign out */}
      <div className="border-t border-white/10 px-4 py-4">
        <div className="mb-3 px-1">
          <p className="truncate text-sm font-medium text-white">
            {profile.name}
          </p>
          <p className="text-xs text-white/55">{profile.role_name}</p>
        </div>
        <form action="/admin/signout" method="POST">
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/65 transition-colors duration-150 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
