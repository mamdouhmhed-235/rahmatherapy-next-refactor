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
  LayoutGrid,
  LogOut,
  MessageSquareText,
  Send,
  Settings,
  ShieldCheck,
  Siren,
  User,
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminTopNavProfile {
  name: string;
  roleName: string;
  staffId: string;
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
}

interface NavGroup {
  label: string;
  keys: string[];
}

// ─── Nav item catalogue ───────────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",              href: "/admin/dashboard",                    icon: LayoutDashboard,   pageKey: "dashboard" },
  { label: "Bookings",               href: "/admin/bookings",                     icon: CalendarCheck,     pageKey: "bookings" },
  { label: "Calendar",               href: "/admin/calendar",                     icon: CalendarDays,      pageKey: "calendar" },
  { label: "Clients",                href: "/admin/clients",                      icon: UserSquare,        pageKey: "clients" },
  { label: "Enquiries",              href: "/admin/enquiries",                    icon: MessageSquareText, pageKey: "enquiries" },
  { label: "Staff",                  href: "/admin/staff",                        icon: Users,             pageKey: "staff" },
  { label: "Reports",                href: "/admin/reports",                      icon: FileText,          pageKey: "reports" },
  { label: "Services",               href: "/admin/services",                     icon: Wrench,            pageKey: "services" },
  { label: "Settings",               href: "/admin/settings",                     icon: Settings,          pageKey: "settings" },
  { label: "Availability",           href: "/admin/availability",                 icon: CalendarDays,      pageKey: "availability",     dataScopes: ["all"] },
  { label: "Roles",                  href: "/admin/roles",                        icon: ShieldCheck,       pageKey: "roles" },
  { label: "Emails",                 href: "/admin/emails",                       icon: Send,              pageKey: "emails" },
  { label: "Operations",             href: "/admin/operations",                   icon: Siren,             pageKey: "operations" },
  { label: "Privacy",                href: "/admin/privacy",                      icon: ShieldCheck,       pageKey: "privacy" },
  { label: "Audit",                  href: "/admin/audit",                        icon: FileText,          pageKey: "audit" },
  { label: "Password requests",      href: "/admin/account-password-requests",    icon: ShieldCheck,       pageKey: "accountRequests" },
];

// ─── Variant configs ──────────────────────────────────────────────────────────

// Primary strip: only genuinely daily-use items. Everything else lives in the user menu.
const OWNER_ADMIN_PRIMARY_KEYS = new Set(["dashboard", "bookings", "clients", "staff", "reports"]);
const COORDINATOR_PRIMARY_KEYS = new Set(["dashboard", "bookings", "clients", "staff", "enquiries"]);
const THERAPIST_NAV_KEYS       = new Set(["dashboard", "bookings", "availability", "staff"]);

// User menu grouped sections — role-dependent
const OWNER_ADMIN_GROUPS: NavGroup[] = [
  { label: "Scheduling & Leads",  keys: ["calendar", "enquiries"] },
  { label: "Communications",      keys: ["emails"] },
  { label: "Clinic Setup",        keys: ["availability", "services"] },
  { label: "Admin & Compliance",  keys: ["settings", "roles", "operations", "privacy", "audit", "accountRequests"] },
];

const COORDINATOR_GROUPS: NavGroup[] = [
  { label: "Scheduling",     keys: ["calendar"] },
  { label: "Communications", keys: ["emails", "availability"] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeAdminPath(path: string) {
  return path.replace(/\/+$/, "") || "/";
}

function hasPageAccess(item: NavItem, pageAccess: Record<string, AdminTopNavPageAccess>) {
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

function getNavGroups(variant: AdminShellVariant): NavGroup[] {
  if (variant === "coordinator") return COORDINATOR_GROUPS;
  if (variant === "therapist") return [];
  return OWNER_ADMIN_GROUPS;
}

function getNavLabel(item: NavItem, variant: AdminShellVariant): string {
  if (variant === "therapist") {
    if (item.pageKey === "dashboard")    return "My day";
    if (item.pageKey === "bookings")     return "My bookings";
    if (item.pageKey === "availability") return "My availability";
    if (item.pageKey === "staff")        return "Team";
  }
  if (variant === "coordinator") {
    if (item.pageKey === "staff") return "Team";
  }
  return item.label;
}

function isActive(href: string, pathname: string): boolean {
  const current = normalizeAdminPath(pathname);
  const target  = normalizeAdminPath(href);
  if (target === "/admin/dashboard") return current === target;
  return current === target || current.startsWith(`${target}/`);
}

function getDesktopBreadcrumb(
  pathname: string,
  allItems: NavItem[],
  variant: AdminShellVariant
): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length <= 2) return null;
  const sectionHref = `/${segments[0]}/${segments[1]}`;
  const match = allItems.find(
    (item) => normalizeAdminPath(item.href) === normalizeAdminPath(sectionHref)
  );
  if (!match) return null;
  return getNavLabel(match, variant);
}

function getUserFirstName(name: string): string {
  const first = (name || "").trim().split(" ")[0];
  return first || name || "";
}

function getInitials(name: string): string {
  const cleaned = (name || "").trim();
  if (!cleaned) return "?";
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => Array.from(p)[0] ?? "")
    .join("")
    .toUpperCase();
}

// ─── AdminTopNav (shell) ──────────────────────────────────────────────────────

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
  const pathname    = usePathname();
  const primaryKeys = getPrimaryKeys(variant);
  const subLabel    = getVariantSubLabel(variant);
  const navGroups   = getNavGroups(variant);

  const accessibleItems  = NAV_ITEMS.filter((item) => hasPageAccess(item, pageAccess));
  const primaryItems     = accessibleItems.filter((item) => primaryKeys.has(item.pageKey));
  const breadcrumb       = getDesktopBreadcrumb(pathname, accessibleItems, variant);

  // Items available in the user menu (grouped, role-filtered)
  const menuItems = accessibleItems.filter(
    (item) => !primaryKeys.has(item.pageKey)
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--admin-canvas)]">
      {/* Skip link — first DOM element, visually hidden until focused */}
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-[var(--admin-radius-control)] focus:bg-[var(--admin-primary)] focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-[var(--admin-shadow-overlay)]"
      >
        Skip to main content
      </a>

      {/* Top nav bar */}
      <header className="sticky top-0 z-40 bg-[var(--admin-primary)]">
        {/* Ghost bell override — notification bell renders with a card surface by default;
            this permanent override makes it match the ghost visual language of all other
            right-rail items on the Clinic Green bar. */}
        <style>{`
          /* Desktop bell: override card surface on Clinic Green bar */
          .nav-rail-bell button > span {
            background: transparent !important;
            border: 1px solid rgba(255,255,255,0.18) !important;
            box-shadow: none !important;
            color: rgba(255,255,255,0.8) !important;
          }
          .nav-rail-bell button > span:hover {
            background: rgba(255,255,255,0.1) !important;
            border-color: rgba(255,255,255,0.32) !important;
            color: white !important;
          }
          /* Mobile bell: same ghost treatment — button is the card element directly */
          .mobile-nav-bell button {
            background: transparent !important;
            border-color: rgba(255,255,255,0.18) !important;
            box-shadow: none !important;
          }
          .mobile-nav-bell button:hover {
            background: rgba(255,255,255,0.1) !important;
            border-color: rgba(255,255,255,0.3) !important;
          }
          .mobile-nav-bell button svg {
            color: rgba(255,255,255,0.8) !important;
          }
          /* Bottom tab bar — landscape mobile: shorter bar, no labels */
          @media (orientation: landscape) and (max-width: 767px) {
            .admin-bottom-tabbar > div { height: 2.75rem !important; }
            .admin-tab-label { display: none !important; }
            #admin-main { padding-bottom: calc(2.75rem + env(safe-area-inset-bottom, 0px)) !important; }
          }
        `}</style>
        <div className="mx-auto flex h-14 max-w-[100rem] items-center gap-0 px-4 md:px-6 lg:px-8">
          {/* Left zone: compact logo tile + wordmark (lg+) */}
          <Link
            href="/admin/dashboard"
            className="flex min-h-11 shrink-0 items-center gap-2 rounded-[var(--admin-radius-control)] pr-2 text-white outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            aria-label="Rahma Therapy admin dashboard"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-[var(--admin-radius-control)] bg-white/16 ring-1 ring-inset ring-white/12">
              <Image src="/images/brand/rahma/logo-mark.svg" alt="" width={18} height={18} className="size-[1.125rem] invert" />
            </div>
            <span className="font-display hidden text-[0.875rem] font-semibold tracking-[-0.01em] text-white/90 lg:block">Rahma</span>
          </Link>

          {/* Separator */}
          <div className="mx-3 hidden h-5 w-px bg-white/15 md:block" aria-hidden="true" />

          {/* Centre zone: primary nav with icon + label items */}
          <nav className="hidden flex-1 items-center gap-0.5 text-white md:flex" aria-label="Admin navigation">
            {primaryItems.map((item) => {
              const active = isActive(item.href, pathname);
              const label  = getNavLabel(item, variant);
              const Icon   = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-[var(--admin-radius-control)] px-2.5 text-[0.8125rem] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/60",
                    active
                      ? "bg-white/20 font-semibold text-white ring-1 ring-inset ring-white/25"
                      : "font-medium text-white hover:bg-white/10"
                  )}
                >
                  <Icon
                    className={cn("size-3.5 shrink-0", active ? "text-white" : "text-white/75")}
                    aria-hidden="true"
                  />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right rail */}
          <div className="ml-auto flex items-center gap-1.5">
            <div className="hidden md:block">
              <AdminCommandSearch
                compact
                triggerClassName="inline-flex h-8 items-center gap-1.5 rounded-[var(--admin-radius-control)] border border-white/20 bg-transparent px-2.5 text-sm font-medium text-white/80 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60"
              />
            </div>
            <div className="nav-rail-bell hidden md:block">
              <NotificationBell items={notifications} staffId={profile.staffId} />
            </div>
            <div className="hidden md:block">
              <UserMenuButton
                profile={profile}
                variant={variant}
                navGroups={navGroups}
                menuItems={menuItems}
                pathname={pathname}
              />
            </div>
            <div className="flex items-center gap-0 md:hidden">
              <MobileSearch />
              <div className="mobile-nav-bell">
                <MobileNotificationButton items={notifications} variant="icon" staffId={profile.staffId} />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content — pb accounts for the mobile bottom tab bar */}
      <main
        id="admin-main"
        tabIndex={-1}
        className="min-w-0 px-4 pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] pt-5 text-[var(--admin-heading)] outline-none sm:px-6 lg:px-8 md:pb-8"
      >
        <div className="mx-auto w-full min-w-0 max-w-[100rem]">
          {children}
        </div>
      </main>

      {/* Bottom tab bar (mobile <768px) */}
      <AdminBottomTabBar
        profile={profile}
        variant={variant}
        primaryItems={primaryItems}
        navGroups={navGroups}
        menuItems={menuItems}
        pathname={pathname}
      />

      {/* Toast host */}
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

// ─── UserMenuButton (desktop) ─────────────────────────────────────────────────
// Named trigger: initials + first name + chevron on ≥1024px
// Initials + chevron only on 768–1023px
// Opens comprehensive dropdown: identity header → grouped nav → divider → account actions

function UserMenuButton({
  profile,
  variant,
  navGroups,
  menuItems,
  pathname,
}: {
  profile: AdminTopNavProfile;
  variant: AdminShellVariant;
  navGroups: NavGroup[];
  menuItems: NavItem[];
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const ref             = useRef<HTMLDivElement>(null);
  const initials        = getInitials(profile.name);
  const firstName       = getUserFirstName(profile.name);

  // Tint trigger when current page is inside one of the overflow groups
  const hasActiveMenuPage = menuItems.some((item) => isActive(item.href, pathname));

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent)   { if (e.key === "Escape") setOpen(false); }
    function onClick(e: MouseEvent)    { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${firstName}'s account menu`}
        className={cn(
          "inline-flex h-8 items-center gap-2 rounded-[var(--admin-radius-control)] px-2 bg-transparent appearance-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/60",
          hasActiveMenuPage || open
            ? "bg-white/20 text-white ring-1 ring-inset ring-white/25"
            : "text-white/85 hover:bg-white/10 hover:text-white"
        )}
      >
        {/* Initials circle */}
        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ring-white/50 text-[10px] font-semibold text-white">
          {initials}
        </span>
        {/* First name — visible on ≥1024px */}
        <span className="hidden max-w-[8rem] truncate text-sm font-medium lg:block">{firstName}</span>
        <ChevronDown
          className={cn(
            "size-3 transition-transform duration-150",
            open && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown */}
      {open ? (
        <div
          role="menu"
          className="u-menu-enter absolute right-0 top-full z-50 mt-2 w-[17.5rem] rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] shadow-[var(--admin-shadow-overlay)]"
          style={{ animation: "menu-enter 160ms cubic-bezier(0.16,1,0.3,1) both" }}
        >
          {/* Identity header — canvas tint (97.8%) separates this zone from the nav items (panel 99.2%) below */}

          <div className="rounded-t-[calc(var(--admin-radius-card)-1px)] border-b border-[var(--admin-border)] bg-[oklch(97.8%_0.006_88)] px-3.5 py-2.5">
            <p className="truncate text-sm font-semibold text-[var(--admin-heading)]">{profile.name}</p>
            <p className="truncate text-xs text-[var(--admin-text-muted)]">{profile.roleName}</p>
          </div>


          {/* Grouped nav sections */}
          {navGroups.length > 0 ? (
            <div className="py-1.5">
              {navGroups.map((group) => {
                // Filter to items the user has access to
                const groupItems = NAV_ITEMS.filter(
                  (item) =>
                    group.keys.includes(item.pageKey) &&
                    menuItems.some((m) => m.pageKey === item.pageKey)
                );
                if (groupItems.length === 0) return null;
                return (
                  <div key={group.label} className="mb-2 last:mb-0">
                    <p
                      className="px-3.5 pb-1 pt-3 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--admin-text-muted)] first:pt-2"
                      role="presentation"
                    >
                      {group.label}
                    </p>
                    {groupItems.map((item) => {
                      const active = isActive(item.href, pathname);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          role="menuitem"
                          aria-current={active ? "page" : undefined}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex min-h-9 items-center gap-2.5 rounded-[var(--admin-radius-control)] mx-1.5 px-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55",
                            active
                              ? "bg-[oklch(92%_0.022_155)] font-semibold text-[var(--admin-heading)]"
                              : "text-[var(--admin-body)] hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)]"
                          )}
                        >
                          <item.icon className="size-4 shrink-0 text-[var(--admin-text-muted)]" aria-hidden="true" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* Divider + account actions */}
          <div className={cn("py-1.5", navGroups.length > 0 && "border-t border-[var(--admin-border)]")}>
            <Link
              href={profile.staffId ? `/admin/staff/${profile.staffId}` : "#"}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex min-h-9 items-center gap-2.5 rounded-[var(--admin-radius-control)] mx-1.5 px-2.5 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              <User className="size-4 shrink-0 text-[var(--admin-text-muted)]" aria-hidden="true" />
              Your profile
            </Link>
            <form action="/admin/signout" method="POST">
              <button
                type="submit"
                role="menuitem"
                className="flex min-h-9 w-full items-center gap-2.5 rounded-[var(--admin-radius-control)] mx-1.5 px-2.5 text-left text-sm font-medium text-[oklch(26%_0.14_25)] outline-none transition-colors hover:bg-[oklch(95.5%_0.028_20)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                style={{ width: "calc(100% - 0.75rem)" }}
              >
                <LogOut className="size-4 shrink-0 text-[oklch(40%_0.12_25)]" aria-hidden="true" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── AdminBottomTabBar (mobile <768px) ────────────────────────────────────────
// Sticky bottom, safe-area-inset-bottom aware.
// 4–5 primary tabs + "More" tab (always last).
// "More" opens UserMenuSheet.

function AdminBottomTabBar({
  profile,
  variant,
  primaryItems,
  navGroups,
  menuItems,
  pathname,
}: {
  profile: AdminTopNavProfile;
  variant: AdminShellVariant;
  primaryItems: NavItem[];
  navGroups: NavGroup[];
  menuItems: NavItem[];
  pathname: string;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const hasActiveMenuPage = menuItems.some((item) => isActive(item.href, pathname));
  const initials = getInitials(profile.name);

  return (
    <>
      <nav
        aria-label="Admin navigation"
        className="admin-bottom-tabbar fixed inset-x-0 bottom-0 z-40 border-t border-[var(--admin-border)] bg-[var(--admin-panel)] md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex h-14 items-stretch">
          {/* Primary tabs */}
          {primaryItems.map((item) => {
            const active = isActive(item.href, pathname);
            const label  = getNavLabel(item, variant);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--admin-focus)]/55",
                  active
                    ? "border-t-2 border-[var(--admin-primary)] bg-[oklch(93.5%_0.038_155)] text-[var(--admin-primary)]"
                    : "border-t-2 border-transparent text-[var(--admin-text-muted)] hover:text-[var(--admin-body)] hover:bg-[oklch(95.5%_0.012_155)]"
                )}
              >
                <item.icon
                  className={cn(
                    "size-5 shrink-0",
                    active ? "text-[var(--admin-primary)]" : "text-[var(--admin-text-muted)]"
                  )}
                  aria-hidden="true"
                />
                <span className="admin-tab-label truncate leading-none text-center">{label}</span>
              </Link>
            );
          })}

          {/* "More" tab */}
          <button
            ref={moreButtonRef}
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="More navigation and account menu"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--admin-focus)]/55",
              hasActiveMenuPage || moreOpen
                ? "border-t-2 border-[var(--admin-primary)] bg-[oklch(93.5%_0.038_155)] text-[var(--admin-primary)]"
                : "border-t-2 border-transparent text-[var(--admin-text-muted)] hover:text-[var(--admin-body)] hover:bg-[oklch(95.5%_0.012_155)]"
            )}
          >
            <span
              className={cn(
                "inline-flex size-6 items-center justify-center rounded-full text-[10px] font-semibold",
                hasActiveMenuPage || moreOpen
                  ? "bg-[var(--admin-primary)] text-white"
                  : "bg-[oklch(93.5%_0.038_155)] text-[var(--admin-heading)]"
              )}
            >
              {initials}
            </span>
            <span className="admin-tab-label leading-none">More</span>
          </button>
        </div>
      </nav>

      {/* "More" sheet — slides up from bottom */}
      {moreOpen ? (
        <UserMenuSheet
          profile={profile}
          variant={variant}
          navGroups={navGroups}
          menuItems={menuItems}
          pathname={pathname}
          onClose={() => setMoreOpen(false)}
          returnFocusRef={moreButtonRef}
        />
      ) : null}
    </>
  );
}

// ─── UserMenuSheet (mobile "More" sheet) ─────────────────────────────────────
// Bottom-anchored sheet with same content as desktop user menu dropdown.

function UserMenuSheet({
  profile,
  variant,
  navGroups,
  menuItems,
  pathname,
  onClose,
  returnFocusRef,
}: {
  profile: AdminTopNavProfile;
  variant: AdminShellVariant;
  navGroups: NavGroup[];
  menuItems: NavItem[];
  pathname: string;
  onClose: () => void;
  /** Ref to the element that should receive focus when the sheet closes (WCAG 2.4.3). */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    // Focus the first focusable element inside the sheet on open
    const first = ref.current?.querySelector<HTMLElement>(
      "a, button, input, [tabindex]:not([tabindex='-1'])"
    );
    first?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      // Restore focus to the trigger that opened the sheet (WCAG 2.4.3)
      returnFocusRef?.current?.focus();
    };
  }, [onClose, returnFocusRef]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-[oklch(12%_0.01_165)]/40 backdrop-blur-sm md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={ref}
        role="dialog"
        aria-label="Navigation and account menu"
        aria-modal="true"
        className="u-sheet-enter fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col overflow-hidden rounded-t-[16px] border-t border-[var(--admin-border)] bg-[var(--admin-panel)] shadow-[var(--admin-shadow-overlay)] md:hidden"
        style={{ animation: "sheet-enter 240ms cubic-bezier(0.16,1,0.3,1) both" }}
      >
        {/* Drag handle */}
        <div className="flex shrink-0 justify-center pt-3 pb-1" aria-hidden="true">
          <div className="h-1 w-8 rounded-full bg-[var(--admin-border)]" />
        </div>

        {/* Identity header — canvas tint creates zone distinction from nav items below */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[oklch(97.8%_0.006_88)] px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[oklch(93.5%_0.038_155)] text-xs font-semibold text-[var(--admin-heading)]">
              {getInitials(profile.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--admin-heading)]">{profile.name}</p>
              <p className="truncate text-xs text-[var(--admin-text-muted)]">{profile.roleName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--admin-radius-control)] text-[var(--admin-text-muted)] outline-none hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            aria-label="Close menu"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-2">

          {/* Grouped nav sections */}
          {navGroups.length > 0 ? (
            <nav aria-label="More navigation">
              {navGroups.map((group) => {
                const groupItems = NAV_ITEMS.filter(
                  (item) =>
                    group.keys.includes(item.pageKey) &&
                    menuItems.some((m) => m.pageKey === item.pageKey)
                );
                if (groupItems.length === 0) return null;
                return (
                  <div key={group.label} className="mb-2">
                    <p className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--admin-text-muted)] first:pt-2">
                      {group.label}
                    </p>
                    {groupItems.map((item) => {
                      const active = isActive(item.href, pathname);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          onClick={onClose}
                          className={cn(
                            "flex min-h-11 items-center gap-3 rounded-[var(--admin-radius-control)] px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55",
                            active
                              ? "bg-[oklch(92%_0.022_155)] font-semibold text-[var(--admin-heading)]"
                              : "text-[var(--admin-body)] hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)]"
                          )}
                        >
                          <item.icon
                            className={cn(
                              "size-5 shrink-0",
                              active ? "text-[var(--admin-primary)]" : "text-[var(--admin-text-muted)]"
                            )}
                            aria-hidden="true"
                          />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                );
              })}
            </nav>
          ) : null}

          {/* Divider before account actions */}
          {navGroups.length > 0 ? (
            <div className="my-2 border-t border-[var(--admin-border)]" />
          ) : null}

          {/* Account actions */}
          <div className="grid gap-1 pb-2">
            <Link
              href={profile.staffId ? `/admin/staff/${profile.staffId}` : "#"}
              onClick={onClose}
              className="flex min-h-11 items-center gap-3 rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              <User className="size-5 shrink-0 text-[var(--admin-text-muted)]" aria-hidden="true" />
              Your profile
            </Link>
            <form action="/admin/signout" method="POST">
              <button
                type="submit"
                className="flex min-h-11 w-full items-center gap-3 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] px-3 text-left text-sm font-medium text-[oklch(26%_0.14_25)] outline-none transition-colors hover:bg-[oklch(95.5%_0.028_20)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                <LogOut className="size-5 shrink-0 text-[oklch(40%_0.12_25)]" aria-hidden="true" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes menu-enter {
          from { opacity: 0; transform: scale(0.96) translateY(-4px); transform-origin: top right; }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes sheet-enter {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .u-menu-enter, .u-sheet-enter { animation: none !important; }
        }
      `}</style>
    </>
  );
}

// ─── MobileSearch ─────────────────────────────────────────────────────────────

function MobileSearch() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search (⌘K)"
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--admin-radius-control)] text-white/80 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60"
      >
        <svg className="size-[1.125rem]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-[oklch(12%_0.01_165)]/35 pt-[8vh] backdrop-blur-sm px-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="relative w-full max-w-[32rem] rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] shadow-[var(--admin-shadow-overlay)]">
            <AdminCommandSearch />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-2 top-2 inline-flex size-11 items-center justify-center rounded-[var(--admin-radius-control)] text-[var(--admin-text-muted)] outline-none hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
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
