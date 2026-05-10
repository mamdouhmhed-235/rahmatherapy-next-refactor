"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import {
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Search,
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
import { AdminCommandSearch } from "./AdminCommandSearch";

interface AdminTopNavProfile {
  name: string;
  roleName: string;
}

interface AdminTopNavPageAccess {
  access: boolean;
  dataScope: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  section: string;
  pageKey: string;
  dataScopes?: string[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
    section: "Operations",
    pageKey: "dashboard",
  },
  {
    label: "Bookings",
    href: "/admin/bookings",
    icon: CalendarCheck,
    section: "Operations",
    pageKey: "bookings",
  },
  {
    label: "Calendar",
    href: "/admin/calendar",
    icon: CalendarDays,
    section: "Operations",
    pageKey: "calendar",
  },
  {
    label: "Reports",
    href: "/admin/reports",
    icon: FileText,
    section: "Operations",
    pageKey: "reports",
  },
  {
    label: "Clients",
    href: "/admin/clients",
    icon: UserSquare,
    section: "Clients",
    pageKey: "clients",
  },
  {
    label: "Enquiries",
    href: "/admin/enquiries",
    icon: MessageSquareText,
    section: "Clients",
    pageKey: "enquiries",
  },
  {
    label: "Staff",
    href: "/admin/staff",
    icon: Users,
    section: "Staff & Services",
    pageKey: "staff",
  },
  {
    label: "Roles",
    href: "/admin/roles",
    icon: ShieldCheck,
    section: "Staff & Services",
    pageKey: "roles",
  },
  {
    label: "Services",
    href: "/admin/services",
    icon: Wrench,
    section: "Staff & Services",
    pageKey: "services",
  },
  {
    label: "Availability",
    href: "/admin/availability",
    icon: CalendarDays,
    section: "Staff & Services",
    pageKey: "availability",
    dataScopes: ["all"],
  },
  {
    label: "Emails",
    href: "/admin/emails",
    icon: Send,
    section: "System",
    pageKey: "emails",
  },
  {
    label: "Operations",
    href: "/admin/operations",
    icon: Siren,
    section: "System",
    pageKey: "operations",
  },
  {
    label: "Audit",
    href: "/admin/audit",
    icon: FileText,
    section: "System",
    pageKey: "audit",
  },
  {
    label: "Privacy",
    href: "/admin/privacy",
    icon: ShieldCheck,
    section: "System",
    pageKey: "privacy",
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
    section: "System",
    pageKey: "settings",
  },
];

function normalizeAdminPath(path: string) {
  return path.replace(/\/+$/, "") || "/";
}

function hasPageAccess(
  item: NavItem,
  pageAccess: Record<string, AdminTopNavPageAccess>
) {
  const access = pageAccess[item.pageKey];
  if (!access?.access) return false;
  if (item.dataScopes && !item.dataScopes.includes(access.dataScope)) return false;
  return true;
}

export function AdminTopNav({
  profile,
  pageAccess,
  children,
}: {
  profile: AdminTopNavProfile;
  pageAccess: Record<string, AdminTopNavPageAccess>;
  children: React.ReactNode;
}) {
  const [scrolled, setScrolled] = useState(false);
  const visibleItems = NAV_ITEMS.filter((item) =>
    hasPageAccess(item, pageAccess)
  );

  const sections = [...new Set(visibleItems.map((i) => i.section))];

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--admin-canvas)] text-[var(--admin-heading)]">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--admin-heading)] focus:shadow-elevated"
      >
        Skip to admin content
      </a>

      <header
        className={cn(
          "sticky top-0 z-40 border-b border-[var(--admin-border)] bg-[var(--admin-panel)]/95 backdrop-blur transition-shadow",
          scrolled && "shadow-[var(--admin-shadow-subtle)]"
        )}
      >
        <div className="mx-auto flex h-14 max-w-[100rem] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Brand />

          {/* Desktop center: search */}
          <div className="hidden flex-1 items-center justify-center md:flex">
            <AdminCommandSearch
              compact
              triggerClassName="inline-flex h-9 w-full max-w-[16rem] shrink items-center gap-2 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)]/60 px-3 text-sm font-medium text-[var(--admin-text-muted)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
            />
          </div>

          {/* Desktop right: actions */}
          <div className="hidden items-center gap-2 lg:flex">
            {hasPageAccess(NAV_ITEMS.find((i) => i.href === "/admin/reports")!, pageAccess) && (
              <Link
                href="/admin/reports"
                className="inline-flex h-9 items-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-white px-3 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
              >
                <FileText className="size-4" />
                Reports
              </Link>
            )}
            {hasPageAccess(NAV_ITEMS.find((i) => i.href === "/admin/calendar")!, pageAccess) && (
              <Link
                href="/admin/calendar"
                className="inline-flex h-9 items-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-white px-3 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
              >
                <CalendarDays className="size-4" />
                Calendar
              </Link>
            )}
            <SettingsButton pageAccess={pageAccess} />
            <UserMenu profile={profile} />
          </div>

          {/* Mobile right */}
          <div className="flex flex-1 items-center justify-end gap-2 lg:hidden">
            <MobileSearch />
            <MobileMenu profile={profile} items={visibleItems} sections={sections} />
          </div>
        </div>
      </header>

      <main
        id="admin-main"
        tabIndex={-1}
        className="min-w-0 px-4 pb-8 pt-5 outline-none sm:px-6 lg:px-8"
      >
        <div className="mx-auto w-full min-w-0 max-w-[100rem]">
          {children}
        </div>
      </main>
    </div>
  );
}

function Brand() {
  return (
    <Link
      href="/admin/dashboard"
      className="flex shrink-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
      aria-label="Rahma Therapy admin dashboard"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)]">
        <Image
          src="/images/brand/rahma/logo-mark.svg"
          alt=""
          width={24}
          height={24}
          className="size-5 invert"
        />
      </div>
      <span className="admin-display hidden text-sm font-bold uppercase tracking-[0.08em] text-[var(--admin-heading)] sm:block">
        Rahma Therapy
      </span>
    </Link>
  );
}

function SettingsButton({
  pageAccess,
}: {
  pageAccess: Record<string, AdminTopNavPageAccess>;
}) {
  const settingsItem = NAV_ITEMS.find((i) => i.href === "/admin/settings");
  if (!settingsItem || !hasPageAccess(settingsItem, pageAccess)) return null;

  return (
    <Link
      href="/admin/settings"
      className="inline-flex size-9 items-center justify-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-white text-[var(--admin-text-muted)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
      aria-label="Settings"
    >
      <Settings className="size-4" />
    </Link>
  );
}

function UserMenu({ profile }: { profile: AdminTopNavProfile }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-white px-2.5 py-1.5 text-sm font-semibold text-[var(--admin-heading)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-panel-muted)]">
          <ShieldCheck className="size-4 text-[var(--admin-primary)]" />
        </span>
        <span className="hidden max-w-[8rem] truncate xl:block">{profile.name}</span>
        <ChevronDown className="size-4 text-[var(--admin-text-muted)]" />
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 mt-2 w-56 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-2 shadow-elevated"
          role="menu"
        >
          <div className="px-3 py-2">
            <p className="text-sm font-semibold text-[var(--admin-heading)]">{profile.name}</p>
            <p className="text-xs text-[var(--admin-text-muted)]">{profile.roleName}</p>
          </div>
          <div className="my-1 border-t border-[var(--admin-border)]" />
          <form action="/admin/signout" method="POST">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-[var(--admin-radius-control)] px-3 py-2 text-left text-sm font-medium text-[var(--admin-heading)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
              role="menuitem"
            >
              <LogOut className="size-4" />
              Sign out / switch account
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function MobileSearch() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex size-9 items-center justify-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-white text-[var(--admin-text-muted)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
        aria-label="Search"
      >
        <Search className="size-4" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/25 pt-20 backdrop-blur-sm">
          <div className="w-[min(calc(100vw-2rem),28rem)] rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-4 shadow-elevated">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[var(--admin-heading)]">Search</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex size-8 items-center justify-center rounded-[var(--admin-radius-control)] text-[var(--admin-text-muted)] outline-none hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-2 text-sm text-[var(--admin-text-muted)]">
              Press{" "}
              <kbd className="rounded border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--admin-text-muted)]">
                Ctrl K
              </kbd>{" "}
              from anywhere to search.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function MobileMenu({
  profile,
  items,
  sections,
}: {
  profile: AdminTopNavProfile;
  items: NavItem[];
  sections: string[];
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <BaseDialog.Root open={open} onOpenChange={setOpen}>
      <BaseDialog.Trigger
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-white text-[var(--admin-heading)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
        aria-label="Open admin navigation"
      >
        <Menu className="size-5" />
      </BaseDialog.Trigger>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm lg:hidden" />
        <BaseDialog.Popup className="fixed right-0 top-0 z-50 flex h-dvh w-[min(20rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-l-[var(--admin-radius-card)] border-l border-[var(--admin-border)] bg-[var(--admin-panel)] shadow-elevated outline-none lg:hidden">
          <div className="flex items-start justify-between gap-3 border-b border-[var(--admin-border)] px-4 py-4">
            <div className="min-w-0">
              <BaseDialog.Title className="admin-display text-base font-bold text-[var(--admin-heading)]">
                Menu
              </BaseDialog.Title>
              <BaseDialog.Description className="mt-0.5 text-xs text-[var(--admin-text-muted)]">
                {profile.name} / {profile.roleName}
              </BaseDialog.Description>
            </div>
            <BaseDialog.Close className="inline-flex size-9 items-center justify-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-white text-[var(--admin-text-muted)] outline-none hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35">
              <X className="size-4" />
              <span className="sr-only">Close navigation</span>
            </BaseDialog.Close>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-4" aria-label="Admin navigation">
            <ul className="m-0 grid list-none gap-4 p-0">
              {sections.map((section) => (
                <li key={section}>
                  <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-text-muted)]">
                    {section}
                  </p>
                  <ul className="m-0 grid list-none gap-0.5 p-0">
                    {items
                      .filter((item) => item.section === section)
                      .map((item) => {
                        const currentPath = normalizeAdminPath(pathname);
                        const itemPath = normalizeAdminPath(item.href);
                        const isActive =
                          itemPath === "/admin/dashboard"
                            ? currentPath === itemPath
                            : currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);

                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              onClick={() => setOpen(false)}
                              aria-current={isActive ? "page" : undefined}
                              className={cn(
                                "group flex min-h-[2.5rem] items-center gap-3 rounded-[var(--admin-radius-control)] px-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35",
                                isActive
                                  ? "bg-[var(--admin-primary)] text-white"
                                  : "text-[var(--admin-body)] hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)]"
                              )}
                            >
                              <item.icon
                                className={cn(
                                  "size-4 shrink-0",
                                  isActive
                                    ? "text-white"
                                    : "text-[var(--admin-text-muted)] group-hover:text-[var(--admin-heading)]"
                                )}
                              />
                              <span className="truncate">{item.label}</span>
                            </Link>
                          </li>
                        );
                      })}
                  </ul>
                </li>
              ))}
            </ul>
          </nav>

          <div className="border-t border-[var(--admin-border)] px-4 py-4">
            <form action="/admin/signout" method="POST">
              <button
                type="submit"
                className="flex min-h-10 w-full appearance-none items-center gap-2 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-white px-3 text-sm font-semibold text-[var(--admin-heading)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
              >
                <LogOut className="size-4" />
                Sign out / switch account
              </button>
            </form>
          </div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
