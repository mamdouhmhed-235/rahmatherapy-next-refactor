"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  CalendarCheck,
  ClipboardList,
  Clock,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Send,
  Settings,
  ShieldCheck,
  Siren,
  UserSquare,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { AdminCommandSearch } from "./AdminCommandSearch";

interface AdminShellProfile {
  name: string;
  roleName: string;
  permissions: string[];
}

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
    permissions: [PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_REPORTS],
  },
  {
    label: "Bookings",
    href: "/admin/bookings",
    icon: CalendarCheck,
    permissions: [
      PERMISSIONS.VIEW_ALL_BOOKINGS,
      PERMISSIONS.MANAGE_BOOKINGS_ALL,
      PERMISSIONS.MANAGE_BOOKINGS_OWN,
    ],
  },
  {
    label: "Calendar",
    href: "/admin/calendar",
    icon: CalendarCheck,
    permissions: [
      PERMISSIONS.VIEW_ALL_BOOKINGS,
      PERMISSIONS.VIEW_OWN_BOOKINGS,
      PERMISSIONS.MANAGE_BOOKINGS_ALL,
      PERMISSIONS.MANAGE_BOOKINGS_OWN,
    ],
  },
  {
    label: "Reports",
    href: "/admin/reports",
    icon: FileText,
    permissions: [
      PERMISSIONS.VIEW_REPORTS,
      PERMISSIONS.VIEW_OWN_BOOKINGS,
      PERMISSIONS.MANAGE_BOOKINGS_OWN,
    ],
  },
  {
    label: "Clients",
    href: "/admin/clients",
    icon: UserSquare,
    permissions: [PERMISSIONS.MANAGE_CLIENTS, PERMISSIONS.VIEW_CLIENTS],
  },
  {
    label: "Enquiries",
    href: "/admin/enquiries",
    icon: MessageSquareText,
    permissions: [PERMISSIONS.MANAGE_CLIENTS],
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
    label: "Availability",
    href: "/admin/availability",
    icon: Clock,
    permissions: [PERMISSIONS.MANAGE_AVAILABILITY_GLOBAL],
  },
  {
    label: "Roles",
    href: "/admin/roles",
    icon: ShieldCheck,
    permissions: [PERMISSIONS.MANAGE_ROLES],
  },
  {
    label: "Audit",
    href: "/admin/audit",
    icon: ClipboardList,
    permissions: [PERMISSIONS.MANAGE_AUDIT_LOGS],
  },
  {
    label: "Privacy",
    href: "/admin/privacy",
    icon: ShieldCheck,
    permissions: [PERMISSIONS.MANAGE_PRIVACY_OPERATIONS],
  },
  {
    label: "Emails",
    href: "/admin/emails",
    icon: Send,
    permissions: [PERMISSIONS.MANAGE_EMAILS, PERMISSIONS.MANAGE_BOOKINGS_ALL],
  },
  {
    label: "Operations",
    href: "/admin/operations",
    icon: Siren,
    permissions: [
      PERMISSIONS.MANAGE_SETTINGS,
      PERMISSIONS.MANAGE_EMAILS,
      PERMISSIONS.MANAGE_BOOKINGS_ALL,
    ],
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
    permissions: [PERMISSIONS.MANAGE_SETTINGS],
  },
];

export function AdminShell({
  profile,
  children,
}: {
  profile: AdminShellProfile;
  children: React.ReactNode;
}) {
  const visibleItems = NAV_ITEMS.filter(
    (item) =>
      !item.permissions ||
      item.permissions.some((permission) => profile.permissions.includes(permission))
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--rahma-ivory)] text-[var(--rahma-charcoal)]">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--rahma-charcoal)] focus:shadow-elevated"
      >
        Skip to admin content
      </a>

      <DesktopNav profile={profile} items={visibleItems} />
      <MobileTopBar profile={profile} items={visibleItems} />

      <main
        id="admin-main"
        tabIndex={-1}
        className="min-w-0 px-4 pb-8 pt-20 outline-none sm:px-5 lg:ml-64 lg:px-6 lg:pt-6 xl:px-8"
      >
        <div className="mx-auto w-full max-w-[88rem] min-w-0">{children}</div>
      </main>
    </div>
  );
}

function DesktopNav({
  profile,
  items,
}: {
  profile: AdminShellProfile;
  items: NavItem[];
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-white/10 bg-[var(--rahma-green)] lg:flex lg:flex-col">
      <Brand />
      <NavList items={items} />
      <ShellFooter profile={profile} />
    </aside>
  );
}

function MobileTopBar({
  profile,
  items,
}: {
  profile: AdminShellProfile;
  items: NavItem[];
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-[var(--rahma-border)] bg-white/95 px-3 py-3 backdrop-blur lg:hidden">
      <div className="flex items-center justify-between gap-2">
        <MobileDrawer profile={profile} items={items} />
        <Link href="/admin/dashboard" className="min-w-0 text-sm font-semibold text-[var(--rahma-charcoal)]">
          Rahma Therapy
        </Link>
        <AdminCommandSearch compact triggerClassName="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--rahma-border)] bg-white px-3 text-sm font-medium text-[var(--rahma-muted)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30" />
      </div>
    </header>
  );
}

function MobileDrawer({
  profile,
  items,
}: {
  profile: AdminShellProfile;
  items: NavItem[];
}) {
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <>
      <button
        type="button"
        aria-label="Open admin navigation"
        aria-expanded={open}
        disabled={!hydrated}
        className="inline-flex size-10 items-center justify-center rounded-lg border border-[var(--rahma-border)] bg-white text-[var(--rahma-charcoal)] outline-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30"
        onClick={() => setOpen(true)}
      >
        <Menu className="size-5" />
        <span className="sr-only">Open admin navigation</span>
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-950/35"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-mobile-navigation-title"
            className="relative z-10 flex h-full w-[min(20rem,calc(100vw-2.5rem))] flex-col bg-[var(--rahma-green)] shadow-elevated outline-none"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <h2
                id="admin-mobile-navigation-title"
                className="text-sm font-semibold text-white"
              >
                Admin navigation
              </h2>
              <button
                type="button"
                className="inline-flex size-9 items-center justify-center rounded-lg text-white/75 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/40"
                onClick={() => setOpen(false)}
              >
                <X className="size-4" />
                <span className="sr-only">Close navigation</span>
              </button>
            </div>
            <NavList items={items} onNavigate={() => setOpen(false)} />
            <ShellFooter profile={profile} />
          </div>
        </div>
      ) : null}
    </>
  );
}

function Brand() {
  return (
    <Link href="/admin/dashboard" className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
        <span className="text-sm font-bold text-white">R</span>
      </div>
      <span className="text-sm font-semibold text-white">Rahma Therapy</span>
    </Link>
  );
}

function NavList({
  items,
  onNavigate,
}: {
  items: NavItem[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-label="Admin navigation">
      <ul className="grid gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/admin/dashboard"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          const link = (
            <Link
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/35",
                isActive
                  ? "bg-white/16 text-white"
                  : "text-white/72 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );

          return (
            <li key={item.href}>{link}</li>
          );
        })}
      </ul>
    </nav>
  );
}

function ShellFooter({ profile }: { profile: AdminShellProfile }) {
  return (
    <div className="border-t border-white/10 px-4 py-4">
      <div className="mb-3 rounded-lg bg-white/8 px-3 py-3">
        <p className="truncate text-sm font-medium text-white">{profile.name}</p>
        <p className="truncate text-xs text-white/60">{profile.roleName}</p>
      </div>
      <div className="mb-3 hidden lg:block">
        <AdminCommandSearch />
      </div>
      <form action="/admin/signout" method="POST">
        <button
          type="submit"
          className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-sm text-white/72 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/35"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </form>
    </div>
  );
}
