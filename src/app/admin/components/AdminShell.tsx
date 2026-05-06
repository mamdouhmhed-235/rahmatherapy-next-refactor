"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  CalendarCheck,
  CalendarDays,
  ChevronLeft,
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
  UserRoundCog,
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
    icon: CalendarDays,
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
    icon: UserRoundCog,
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

const SYSTEM_NAV_HREFS = new Set([
  "/admin/roles",
  "/admin/audit",
  "/admin/privacy",
  "/admin/emails",
  "/admin/operations",
  "/admin/settings",
]);

export function AdminShell({
  profile,
  children,
}: {
  profile: AdminShellProfile;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
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

      <DesktopNav
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((current) => !current)}
        profile={profile}
        items={visibleItems}
      />
      <MobileTopBar profile={profile} items={visibleItems} />

      <main
        id="admin-main"
        tabIndex={-1}
        className={cn(
          "min-w-0 px-4 pb-8 pt-20 outline-none transition-[margin] duration-200 sm:px-5 lg:px-6 lg:pt-6 xl:px-8",
          collapsed ? "lg:ml-20" : "lg:ml-64"
        )}
      >
        <div className="mx-auto w-full max-w-[88rem] min-w-0">{children}</div>
      </main>
    </div>
  );
}

function DesktopNav({
  profile,
  items,
  collapsed,
  onToggleCollapsed,
}: {
  profile: AdminShellProfile;
  items: NavItem[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden border-r border-emerald-100/20 bg-[#2d4038] text-white transition-[width] duration-200 lg:flex lg:flex-col",
        collapsed ? "w-20" : "w-64"
      )}
    >
      <Brand collapsed={collapsed} onToggleCollapsed={onToggleCollapsed} />
      <NavList collapsed={collapsed} items={items} />
      <ShellFooter collapsed={collapsed} profile={profile} />
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
    <header className="fixed inset-x-0 top-0 z-40 border-b border-[var(--rahma-border)] bg-white/95 px-3 py-2.5 backdrop-blur lg:hidden">
      <div className="flex items-center justify-between gap-2">
        <MobileDrawer profile={profile} items={items} />
        <Link href="/admin/dashboard" className="min-w-0 truncate text-sm font-semibold text-[var(--rahma-charcoal)]">
          Rahma Therapy
        </Link>
        <AdminCommandSearch compact triggerClassName="inline-flex h-10 max-w-[8.25rem] items-center gap-2 rounded-lg border border-[var(--rahma-border)] bg-white px-3 text-sm font-medium text-[var(--rahma-muted)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30" />
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const triggerButton = triggerRef.current;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      triggerButton?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
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
        <div className="fixed left-0 top-0 z-50 h-dvh w-dvw lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-mobile-navigation-title"
            className="relative z-10 flex h-dvh w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-r-xl border-r border-emerald-100/20 bg-[#2d4038] shadow-elevated outline-none"
          >
            <div className="flex items-start justify-between gap-3 border-b border-emerald-100/10 px-4 py-4">
              <div className="min-w-0">
                <h2
                  id="admin-mobile-navigation-title"
                  className="text-sm font-semibold text-white"
                >
                  Rahma Therapy
                </h2>
                <p className="mt-0.5 text-xs text-emerald-100/55">Admin navigation</p>
              </div>
              <button
                ref={closeRef}
                type="button"
                aria-label="Close navigation"
                className="inline-flex size-9 items-center justify-center rounded-lg border border-emerald-100/15 bg-white/7 text-white/75 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/40"
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

function Brand({
  collapsed,
  onToggleCollapsed,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center border-b border-emerald-100/10 px-4 py-4",
        collapsed ? "justify-center" : "justify-between gap-3"
      )}
    >
      <Link
        href="/admin/dashboard"
        className={cn(
          "flex min-w-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-white/35",
          collapsed && "justify-center"
        )}
        aria-label="Rahma Therapy admin dashboard"
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/8">
          <span className="text-sm font-bold text-white">R</span>
        </div>
        {!collapsed ? (
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold leading-4 text-white">
              Rahma Therapy
            </span>
            <span className="mt-0.5 block truncate text-[11px] leading-4 text-emerald-100/55">
              Admin
            </span>
          </span>
        ) : null}
      </Link>
      {!collapsed ? (
        <button
          type="button"
          aria-label="Collapse admin sidebar"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-emerald-100/20 bg-white/7 text-emerald-100 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/35"
          onClick={onToggleCollapsed}
        >
          <ChevronLeft className="size-4" />
        </button>
      ) : (
        <button
          type="button"
          aria-label="Expand admin sidebar"
          className="absolute left-[3.9rem] top-4 inline-flex size-7 items-center justify-center rounded-lg border border-emerald-100/20 bg-[#2d4038] text-emerald-100 shadow-soft outline-none transition-colors hover:bg-[#365046] hover:text-white focus-visible:ring-2 focus-visible:ring-white/35"
          onClick={onToggleCollapsed}
        >
          <ChevronLeft className="size-3.5 rotate-180" />
        </button>
      )}
    </div>
  );
}

function NavList({
  items,
  collapsed = false,
  onNavigate,
}: {
  items: NavItem[];
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const primaryItems = items.filter((item) => !SYSTEM_NAV_HREFS.has(item.href));
  const systemItems = items.filter((item) => SYSTEM_NAV_HREFS.has(item.href));

  return (
    <nav
      className={cn(
        "admin-nav-scrollbar min-h-0 flex-1 overflow-y-auto py-5",
        collapsed ? "px-3" : "px-3"
      )}
      aria-label="Admin navigation"
    >
      <NavSection
        collapsed={collapsed}
        items={primaryItems}
        pathname={pathname}
        onNavigate={onNavigate}
      />
      {systemItems.length > 0 ? (
        <NavSection
          collapsed={collapsed}
          items={systemItems}
          label="System"
          pathname={pathname}
          onNavigate={onNavigate}
        />
      ) : null}
    </nav>
  );
}

function NavSection({
  items,
  pathname,
  label,
  collapsed,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  label?: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className={cn(label && "mt-7 border-t border-emerald-100/10 pt-5")}>
      {label && !collapsed ? (
        <p className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wide text-emerald-100/60">
          {label}
        </p>
      ) : null}
      <ul className="m-0 grid list-none gap-1 p-0">
        {items.map((item) => (
          <NavItemLink
            key={item.href}
            collapsed={collapsed}
            item={item}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
    </div>
  );
}

function NavItemLink({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const currentPath = normalizeAdminPath(pathname);
  const itemPath = normalizeAdminPath(item.href);
  const isActive =
    itemPath === "/admin/dashboard"
      ? currentPath === itemPath
      : currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);

  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={isActive ? "page" : undefined}
        title={collapsed ? item.label : undefined}
        className={cn(
          "group relative flex min-h-11 items-center rounded-lg text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/35",
          collapsed ? "justify-center px-0" : "gap-3 px-3",
          isActive
            ? "bg-white/12 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
            : "text-emerald-100/75 hover:bg-white/8 hover:text-white"
        )}
      >
        {isActive && !collapsed ? (
          <span
            aria-hidden="true"
            className="absolute left-1 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-emerald-100"
          />
        ) : null}
        <Icon
          className={cn(
            "size-4 shrink-0",
            isActive ? "text-white" : "text-emerald-100/70 group-hover:text-white"
          )}
        />
        {!collapsed ? <span className="truncate">{item.label}</span> : null}
        {collapsed ? <span className="sr-only">{item.label}</span> : null}
      </Link>
    </li>
  );
}

function normalizeAdminPath(path: string) {
  return path.replace(/\/+$/, "") || "/";
}

function ShellFooter({
  profile,
  collapsed = false,
}: {
  profile: AdminShellProfile;
  collapsed?: boolean;
}) {
  return (
    <div className="border-t border-emerald-100/10 px-4 py-4">
      {!collapsed ? (
        <div className="mb-3 rounded-lg bg-white/8 px-3 py-3">
          <p className="truncate text-sm font-semibold text-white">{profile.name}</p>
          <p className="truncate text-xs text-emerald-100/55">{profile.roleName}</p>
        </div>
      ) : (
        <div className="mb-3 flex justify-center">
          <div className="flex size-10 items-center justify-center rounded-lg bg-white/8 text-sm font-semibold text-white">
            {profile.name.trim().charAt(0).toUpperCase() || "R"}
          </div>
        </div>
      )}
      <form action="/admin/signout" method="POST">
        <button
          type="submit"
          className={cn(
            "flex min-h-10 w-full items-center rounded-lg text-sm text-emerald-100/75 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/35",
            collapsed ? "justify-center px-0" : "gap-2 px-3"
          )}
        >
          <LogOut className="size-4" />
          {!collapsed ? "Sign out" : <span className="sr-only">Sign out</span>}
        </button>
      </form>
    </div>
  );
}
