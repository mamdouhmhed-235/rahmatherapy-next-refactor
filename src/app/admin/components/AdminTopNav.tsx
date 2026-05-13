"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { Toaster } from "sonner";
import {
  Bell,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  MoreHorizontal,
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
import { NotificationBell, MobileNotificationButton } from "./notification-bell";
import type { AdminShellVariant } from "../shell-variant";
import type { NotificationItem } from "../reports/reporting";

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
  pageKey: string;
  dataScopes?: string[];
  overflowOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard, pageKey: "dashboard" },
  { label: "Bookings", href: "/admin/bookings", icon: CalendarCheck, pageKey: "bookings" },
  { label: "Calendar", href: "/admin/calendar", icon: CalendarDays, pageKey: "calendar" },
  { label: "Clients", href: "/admin/clients", icon: UserSquare, pageKey: "clients" },
  { label: "Enquiries", href: "/admin/enquiries", icon: MessageSquareText, pageKey: "enquiries" },
  { label: "Staff", href: "/admin/staff", icon: Users, pageKey: "staff" },
  { label: "Reports", href: "/admin/reports", icon: FileText, pageKey: "reports" },
  { label: "Services", href: "/admin/services", icon: Wrench, pageKey: "services", overflowOnly: true },
  { label: "Settings", href: "/admin/settings", icon: Settings, pageKey: "settings", overflowOnly: true },
  { label: "Availability", href: "/admin/availability", icon: CalendarDays, pageKey: "availability", dataScopes: ["all"], overflowOnly: true },
  { label: "Roles", href: "/admin/roles", icon: ShieldCheck, pageKey: "roles", overflowOnly: true },
  { label: "Emails", href: "/admin/emails", icon: Send, pageKey: "emails", overflowOnly: true },
  { label: "Operations", href: "/admin/operations", icon: Siren, pageKey: "operations", overflowOnly: true },
  { label: "Privacy", href: "/admin/privacy", icon: ShieldCheck, pageKey: "privacy", overflowOnly: true },
  { label: "Audit", href: "/admin/audit", icon: FileText, pageKey: "audit", overflowOnly: true },
  { label: "Password requests", href: "/admin/account-password-requests", icon: ShieldCheck, pageKey: "account-password-requests", overflowOnly: true },
];

const OWNER_ADMIN_PRIMARY_KEYS = new Set([
  "dashboard", "bookings", "calendar", "clients", "enquiries", "staff", "reports",
]);

const COORDINATOR_PRIMARY_KEYS = new Set([
  "dashboard", "bookings", "calendar", "clients", "enquiries", "staff",
]);

const THERAPIST_NAV_KEYS = new Set([
  "dashboard", "bookings", "availability",
]);

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

function getVariantSubLabel(variant: AdminShellVariant): string {
  if (variant === "coordinator") return "Coordinator";
  if (variant === "therapist") return "Therapist";
  return "Owner";
}

function getPrimaryKeys(variant: AdminShellVariant): Set<string> {
  if (variant === "coordinator") return COORDINATOR_PRIMARY_KEYS;
  if (variant === "therapist") return THERAPIST_NAV_KEYS;
  return OWNER_ADMIN_PRIMARY_KEYS;
}

function getNavLabel(item: NavItem, variant: AdminShellVariant): string {
  if (variant === "therapist") {
    if (item.pageKey === "dashboard") return "My day";
    if (item.pageKey === "bookings") return "My bookings";
    if (item.pageKey === "availability") return "My availability";
  }
  if (variant === "coordinator") {
    if (item.pageKey === "staff") return "Team";
  }
  return item.label;
}

function isActive(href: string, pathname: string): boolean {
  const current = normalizeAdminPath(pathname);
  const target = normalizeAdminPath(href);
  if (target === "/admin/dashboard") return current === target;
  return current === target || current.startsWith(`${target}/`);
}

function getDesktopBreadcrumb(
  pathname: string,
  allItems: NavItem[],
  variant: AdminShellVariant
): string | null {
  const segments = pathname.split("/").filter(Boolean);
  // Only show breadcrumb for routes deeper than /admin/{section}
  if (segments.length <= 2) return null;
  const sectionHref = `/${segments[0]}/${segments[1]}`;
  const match = allItems.find(
    (item) => normalizeAdminPath(item.href) === normalizeAdminPath(sectionHref)
  );
  if (!match) return null;
  return getNavLabel(match, variant);
}

export function AdminTopNav({
  profile,
  variant,
  pageAccess,
  notifications = [],
  children,
}: {
  profile: AdminTopNavProfile;
  variant: AdminShellVariant;
  pageAccess: Record<string, AdminTopNavPageAccess>;
  notifications?: NotificationItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const primaryKeys = getPrimaryKeys(variant);
  const subLabel = getVariantSubLabel(variant);

  const accessibleItems = NAV_ITEMS.filter((item) => hasPageAccess(item, pageAccess));
  const primaryItems = accessibleItems.filter((item) => primaryKeys.has(item.pageKey) && !item.overflowOnly);
  const overflowItems = accessibleItems.filter((item) => !primaryKeys.has(item.pageKey) || item.overflowOnly);
  const breadcrumb = getDesktopBreadcrumb(pathname, accessibleItems, variant);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--admin-canvas)] text-[var(--admin-heading)]">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-[var(--admin-radius-control)] focus:bg-[var(--admin-primary)] focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-[var(--admin-shadow-overlay)]"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-40 bg-[var(--admin-primary)]">
        <div className="mx-auto flex h-14 max-w-[100rem] items-center gap-0 px-4 sm:px-6 lg:px-8">

          {/* Left zone: brand tile + wordmark + role sub-label */}
          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/admin/dashboard"
              className="flex shrink-0 items-center gap-2.5 rounded-[var(--admin-radius-control)] outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              aria-label="Rahma Therapy admin dashboard"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-[var(--admin-radius-control)] bg-white/12">
                <Image
                  src="/images/brand/rahma/logo-mark.svg"
                  alt=""
                  width={20}
                  height={20}
                  className="size-5 invert"
                />
              </div>
              <span className="hidden text-sm font-semibold tracking-tight text-white sm:block">
                Rahma Therapy
              </span>
            </Link>
            <span className="hidden text-[11px] font-medium text-white/60 sm:block" aria-hidden="true">
              {subLabel}
            </span>
            {breadcrumb ? (
              <span className="hidden items-center gap-1.5 lg:flex" aria-label={`Section: ${breadcrumb}`}>
                <span className="text-white/30 text-sm" aria-hidden="true">›</span>
                <span className="text-sm font-medium text-white/90">{breadcrumb}</span>
              </span>
            ) : null}
          </div>

          {/* Separator */}
          <div className="mx-4 hidden h-5 w-px bg-white/15 lg:block" aria-hidden="true" />

          {/* Centre zone: primary nav items (desktop) */}
          <nav
            className="hidden flex-1 items-center gap-0.5 lg:flex"
            aria-label="Admin navigation"
          >
            {primaryItems.map((item) => {
              const active = isActive(item.href, pathname);
              const label = getNavLabel(item, variant);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-[var(--admin-radius-control)] px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/60",
                    active
                      ? "bg-[oklch(92%_0.022_155)] font-semibold text-[var(--admin-heading)]"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <span>{label}</span>
                </Link>
              );
            })}

            {/* Overflow "More…" menu for owner_admin / coordinator */}
            {overflowItems.length > 0 && variant !== "therapist" ? (
              <OverflowMenu items={overflowItems} variant={variant} pathname={pathname} />
            ) : null}
          </nav>

          {/* Right rail: cmd-K + NotificationBell + avatar */}
          <div className="ml-auto flex items-center gap-1.5">
            {/* cmd-K trigger (desktop) */}
            <div className="hidden lg:block">
              <AdminCommandSearch
                compact
                triggerClassName="inline-flex h-8 items-center gap-2 rounded-[var(--admin-radius-control)] border border-white/20 bg-white/10 px-3 text-sm font-medium text-white/80 outline-none transition-colors hover:bg-white/15 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60"
              />
            </div>

            {/* Notification bell (desktop) */}
            <div className="hidden lg:block">
              <NotificationBell items={notifications} />
            </div>

            {/* User avatar menu (desktop) */}
            <div className="hidden lg:block">
              <UserAvatarMenu profile={profile} />
            </div>

            {/* Mobile: search icon + notification icon + hamburger */}
            <div className="flex items-center gap-1.5 lg:hidden">
              <MobileSearch />
              <MobileNotificationButton items={notifications} variant="icon" />
              <MobileMenuButton
                profile={profile}
                items={accessibleItems}
                variant={variant}
                pathname={pathname}
                subLabel={subLabel}
              />
            </div>
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

      {/* Toast host — outside <main>, per brief §5 */}
      <Toaster
        position="top-right"
        visibleToasts={3}
        toastOptions={{
          classNames: {
            toast:
              "rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] text-[var(--admin-body)] shadow-[var(--admin-shadow-overlay)] text-sm font-medium",
            title: "font-semibold text-[var(--admin-heading)]",
            description: "text-[var(--admin-text-muted)]",
            success:
              "border-[oklch(88%_0.055_155)] bg-[oklch(93.5%_0.038_155)] text-[oklch(22%_0.085_155)]",
            error:
              "border-[oklch(88%_0.045_20)] bg-[oklch(95.5%_0.028_20)] text-[oklch(26%_0.14_25)]",
            warning:
              "border-[oklch(88%_0.06_65)] bg-[oklch(95%_0.05_65)] text-[oklch(26%_0.13_55)]",
            info:
              "border-[oklch(88%_0.055_75)] bg-[oklch(96%_0.038_75)] text-[oklch(28%_0.12_55)]",
          },
        }}
      />
    </div>
  );
}

function OverflowMenu({
  items,
  variant,
  pathname,
}: {
  items: NavItem[];
  variant: AdminShellVariant;
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hasActive = items.some((item) => isActive(item.href, pathname));

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-[var(--admin-radius-control)] px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/60",
          hasActive
            ? "bg-[oklch(92%_0.022_155)] font-semibold text-[var(--admin-heading)]"
            : "text-white/80 hover:bg-white/10 hover:text-white"
        )}
      >
        More
        <MoreHorizontal className="size-3.5" aria-hidden="true" />
      </button>

      {open ? (
        <div
          className="absolute left-0 top-full z-50 mt-1.5 grid min-w-[13rem] gap-0.5 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-1.5 shadow-[var(--admin-shadow-overlay)]"
          role="menu"
        >
          {items.map((item) => {
            const active = isActive(item.href, pathname);
            const label = getNavLabel(item, variant);
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex min-h-9 items-center gap-2.5 rounded-[var(--admin-radius-control)] px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55",
                  active
                    ? "bg-[oklch(92%_0.022_155)] font-semibold text-[var(--admin-heading)]"
                    : "text-[var(--admin-body)] hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)]"
                )}
              >
                <item.icon className="size-4 shrink-0 text-[var(--admin-text-muted)]" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function UserAvatarMenu({ profile }: { profile: AdminTopNavProfile }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initials = profile.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${profile.name.split(" ")[0]}'s account menu`}
        className="inline-flex size-8 items-center justify-center rounded-full bg-[oklch(95.5%_0.012_155)] text-xs font-semibold text-[var(--admin-heading)] outline-none transition-colors hover:bg-[oklch(92%_0.022_155)] focus-visible:ring-2 focus-visible:ring-white/60"
      >
        {initials}
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-52 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-1.5 shadow-[var(--admin-shadow-overlay)]"
          role="menu"
        >
          <div className="border-b border-[var(--admin-border)] px-3 py-2.5 mb-1">
            <p className="text-sm font-semibold text-[var(--admin-heading)]">{profile.name}</p>
            <p className="text-xs text-[var(--admin-text-muted)]">{profile.roleName}</p>
          </div>
          <Link
            href="/admin/staff"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex min-h-9 items-center gap-2 rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            Your profile
          </Link>
          <form action="/admin/signout" method="POST">
            <button
              type="submit"
              role="menuitem"
              className="flex min-h-9 w-full items-center gap-2 rounded-[var(--admin-radius-control)] px-3 text-left text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              <LogOut className="size-4 shrink-0 text-[var(--admin-text-muted)]" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
      ) : null}
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
        aria-label="Search (⌘K)"
        className="inline-flex size-9 items-center justify-center rounded-[var(--admin-radius-control)] text-white/80 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60"
      >
        <svg className="size-[1.125rem]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-[oklch(12%_0.01_165)]/35 pt-[10vh] backdrop-blur-sm">
          <div className="w-[min(calc(100vw-2rem),32rem)] rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] shadow-[var(--admin-shadow-overlay)]">
            <AdminCommandSearch />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-[var(--admin-radius-control)] text-[var(--admin-text-muted)] outline-none hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              aria-label="Close search"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function MobileMenuButton({
  profile,
  items,
  variant,
  pathname,
  subLabel,
}: {
  profile: AdminTopNavProfile;
  items: NavItem[];
  variant: AdminShellVariant;
  pathname: string;
  subLabel: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <BaseDialog.Root open={open} onOpenChange={setOpen}>
      <BaseDialog.Trigger
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--admin-radius-control)] text-white/80 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60"
        aria-label="Open menu"
      >
        <Menu className="size-5" aria-hidden="true" />
      </BaseDialog.Trigger>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-[oklch(12%_0.01_165)]/40 backdrop-blur-sm lg:hidden" />
        <BaseDialog.Popup className="fixed left-0 top-0 z-50 flex h-dvh w-[min(20rem,calc(100vw-3rem))] flex-col overflow-hidden rounded-r-[var(--admin-radius-card)] border-r border-[var(--admin-border-form)] bg-[var(--admin-panel)] shadow-[var(--admin-shadow-overlay)] outline-none lg:hidden">

          {/* Sheet header — mirrors desktop brand block */}
          <div className="flex items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-primary)] px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-[var(--admin-radius-control)] bg-white/12">
                <Image
                  src="/images/brand/rahma/logo-mark.svg"
                  alt=""
                  width={16}
                  height={16}
                  className="size-4 invert"
                />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white leading-none">Rahma Therapy</p>
                <p className="mt-0.5 text-[11px] text-white/60 leading-none">{subLabel}</p>
              </div>
            </div>
            <BaseDialog.Close className="inline-flex size-8 items-center justify-center rounded-[var(--admin-radius-control)] text-white/70 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60">
              <X className="size-4" aria-hidden="true" />
              <span className="sr-only">Close navigation</span>
            </BaseDialog.Close>
          </div>

          {/* Nav items */}
          <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Admin navigation">
            <ul className="m-0 grid list-none gap-0.5 p-0">
              {items.map((item) => {
                const active = isActive(item.href, pathname);
                const label = getNavLabel(item, variant);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-[var(--admin-radius-control)] px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55",
                        active
                          ? "bg-[oklch(92%_0.022_155)] font-semibold text-[var(--admin-heading)]"
                          : "text-[var(--admin-body)] hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)]"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "size-4 shrink-0",
                          active ? "text-[var(--admin-primary)]" : "text-[var(--admin-text-muted)]"
                        )}
                        aria-hidden="true"
                      />
                      <span className="truncate">{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Sheet footer */}
          <div className="border-t border-[var(--admin-border)] px-3 py-3 grid gap-1.5">
            {/* cmd-K row */}
            <BaseDialog.Close
              render={
                <button
                  type="button"
                  className="flex min-h-10 w-full items-center justify-between gap-2.5 rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                  onClick={() => {
                    const input = document.getElementById("admin-command-search") as HTMLInputElement | null;
                    if (input) { input.focus(); }
                    else {
                      const event = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
                      document.dispatchEvent(event);
                    }
                  }}
                >
                  <span className="flex items-center gap-2">
                    <svg className="size-4 text-[var(--admin-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                    Search…
                  </span>
                  <kbd className="rounded border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--admin-text-muted)]">⌘K</kbd>
                </button>
              }
            />

            {/* Profile info */}
            <div className="flex items-center gap-2.5 px-3 py-1.5">
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[oklch(95.5%_0.012_155)] text-xs font-semibold text-[var(--admin-heading)]">
                {profile.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--admin-heading)]">{profile.name}</p>
                <p className="truncate text-xs text-[var(--admin-text-muted)]">{profile.roleName}</p>
              </div>
            </div>

            {/* Your profile + Sign out */}
            <Link
              href="/admin/staff"
              onClick={() => setOpen(false)}
              className="flex min-h-10 items-center gap-2.5 rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              Your profile
            </Link>
            <form action="/admin/signout" method="POST">
              <button
                type="submit"
                className="flex min-h-10 w-full items-center gap-2.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-white px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                <LogOut className="size-4 shrink-0 text-[var(--admin-text-muted)]" aria-hidden="true" />
                Sign out
              </button>
            </form>
          </div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
