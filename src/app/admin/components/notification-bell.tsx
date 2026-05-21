"use client";

/**
 * R4 redesign — admin notification centre.
 *
 * Layer split:
 *   - NotificationBell           desktop trigger (popover anchor)
 *   - MobileNotificationButton   mobile trigger (icon variant in right rail,
 *                                  full variant in the slide-out drawer)
 *   - NotificationPopoverContent shared body — status tabs, type chips,
 *                                  severity-banded feed, duplicate collapse,
 *                                  per-tab empty states, ⋯ menu, snooze menu.
 *
 * State source of truth is now the server (public.notification_state via
 * server actions); localStorage is only consulted once for the post-deploy
 * legacy migration sweep (notification-state-actions.migrateLegacyNotificationState).
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Bell, BellRing, CheckCheck, Filter, X } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { cn } from "@/lib/utils";
import * as AdminPopover from "./admin-popover";
import { AdminSheet } from "./admin-ui-interactions";
import { AdminStatusBadge } from "./admin-ui";
import type { NotificationItem } from "../reports/reporting";
import type { AdminShellVariant } from "../shell-variant";
import { NotificationCard, type NotificationCardActions } from "./notification-card";
import {
  getActiveItems,
  getHighestUnreadSeverity,
  groupByDuplicate,
  isItemArchived,
  isItemRead,
  isItemSnoozed,
  type GroupedFeedNode,
  type Severity,
} from "./notification-helpers";
import {
  archiveNotification,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
  migrateLegacyNotificationState,
  snoozeNotification,
  unarchiveNotification,
  unsnoozeNotification,
} from "./notification-state-actions";

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Pure data helpers (isItemSnoozed / isItemArchived / isItemRead /
// getActiveItems / getHighestUnreadSeverity / groupByDuplicate) live in
// notification-helpers.ts so they're unit-testable without React.

function getBadgeClasses(severity: Severity | null) {
  switch (severity) {
    case "critical":
      return "bg-[var(--notif-badge-critical-bg)] text-[var(--notif-badge-critical-fg)]";
    case "warning":
      return "bg-[var(--notif-badge-warning-bg)] text-[var(--notif-badge-warning-fg)]";
    case "info":
      return "bg-[var(--notif-badge-info-bg)] text-[var(--notif-badge-info-fg)]";
    default:
      return "bg-[oklch(95%_0.05_65)] text-[oklch(26%_0.13_55)]";
  }
}

function useCriticalArrivalPulse(items: NotificationItem[]): boolean {
  const seenRef = useRef<Set<string> | null>(null);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const currentCritical = new Set(
      items.filter((i) => i.severity === "critical").map((i) => i.id),
    );
    if (seenRef.current === null) {
      seenRef.current = currentCritical;
      return;
    }
    let hasNew = false;
    for (const id of currentCritical) {
      if (!seenRef.current.has(id)) {
        hasNew = true;
        break;
      }
    }
    seenRef.current = currentCritical;
    if (hasNew) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 1900);
      return () => clearTimeout(t);
    }
  }, [items]);

  return pulse;
}

// ─── Tab + chip structure (per-role) ─────────────────────────────────────────

type StatusTab = "all" | "unread" | "critical" | "snoozed" | "archived";
type TypeChip = "bookings" | "emails" | "operations" | "enquiries" | "payments";

const STATUS_TABS_BY_VARIANT: Record<AdminShellVariant, StatusTab[]> = {
  owner_admin: ["all", "unread", "critical", "snoozed", "archived"],
  coordinator: ["all", "unread", "critical", "snoozed", "archived"],
  // Therapist's notifications are info/warning only and few in number — no
  // Critical tab; severity bands inside the feed handle urgency ordering.
  therapist: ["all", "unread", "snoozed", "archived"],
};

const TYPE_CHIPS_BY_VARIANT: Record<AdminShellVariant, TypeChip[]> = {
  owner_admin: ["bookings", "emails", "operations", "enquiries", "payments"],
  coordinator: ["enquiries", "bookings", "emails"],
  therapist: [],
};

const TYPE_CHIP_LABELS: Record<TypeChip, string> = {
  bookings: "Bookings",
  emails: "Emails",
  operations: "Operations",
  enquiries: "Enquiries",
  payments: "Payments",
};

const STATUS_TAB_LABELS: Record<StatusTab, string> = {
  all: "All",
  unread: "Unread",
  critical: "Critical",
  snoozed: "Snoozed",
  archived: "Archived",
};

function itemMatchesTypeChip(item: NotificationItem, chip: TypeChip): boolean {
  switch (chip) {
    case "bookings":
      // The "Bookings" chip covers assignment-driven items (unassigned,
      // reschedule, claimable) but NOT payment items.
      return item.type === "assignment";
    case "emails":
      return item.type === "email";
    case "operations":
      return item.type === "operation";
    case "enquiries":
      return item.type === "enquiry";
    case "payments":
      return item.type === "payment";
  }
}

const FALLBACK_STATUS_TABS: StatusTab[] = ["all", "unread", "snoozed", "archived"];

function getStatusTabsForVariant(v: AdminShellVariant | null | undefined): StatusTab[] {
  if (!v) return FALLBACK_STATUS_TABS;
  return STATUS_TABS_BY_VARIANT[v] ?? FALLBACK_STATUS_TABS;
}

function getTypeChipsForVariant(v: AdminShellVariant | null | undefined): TypeChip[] {
  if (!v) return [];
  return TYPE_CHIPS_BY_VARIANT[v] ?? [];
}

// ─── Legacy localStorage migration (one-time, post-deploy) ───────────────────

const MIGRATION_SENTINEL = "rahmatherapy-notification-state-migrated-v1";

function readLegacyIds(staffId: string): { readIds: string[]; dismissedIds: string[] } {
  if (typeof window === "undefined") return { readIds: [], dismissedIds: [] };
  const readKey = `rahmatherapy-notification-read-${staffId}`;
  const dismKey = `rahmatherapy-notification-dismissed-${staffId}`;
  const readRaw = localStorage.getItem(readKey);
  const dismRaw = localStorage.getItem(dismKey);
  const parse = (raw: string | null): string[] => {
    if (!raw) return [];
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter((v): v is string => typeof v === "string") : [];
    } catch {
      return [];
    }
  };
  return { readIds: parse(readRaw), dismissedIds: parse(dismRaw) };
}

function useLegacyMigration(staffId: string) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(MIGRATION_SENTINEL)) return;
    const { readIds, dismissedIds } = readLegacyIds(staffId);
    // Set sentinel first so a transient failure (e.g. offline) doesn't
    // re-fire infinitely on every render — better to skip than to spam.
    localStorage.setItem(MIGRATION_SENTINEL, "1");
    if (readIds.length === 0 && dismissedIds.length === 0) return;
    void migrateLegacyNotificationState({ readIds, dismissedIds });
  }, [staffId]);
}

// ─── Triggers ────────────────────────────────────────────────────────────────

export function NotificationBell({
  items,
  staffId = "shared",
  variant = "default",
  shellVariant = null,
}: {
  items: NotificationItem[];
  staffId?: string;
  variant?: "default" | "header-rail";
  shellVariant?: AdminShellVariant | null;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Active = not archived, not currently snoozed. The bell badge counts only
  // unread items inside this active set.
  const activeItems = useMemo(() => getActiveItems(items), [items]);
  const unreadCount = activeItems.filter((i) => !isItemRead(i)).length;
  const highestSeverity = useMemo(
    () => getHighestUnreadSeverity(activeItems),
    [activeItems],
  );
  const pulse = useCriticalArrivalPulse(activeItems);
  useLegacyMigration(staffId);

  const isRail = variant === "header-rail";
  const triggerClass = isRail
    ? "inline-flex size-9 appearance-none items-center justify-center rounded-full border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
    : "inline-flex size-11 appearance-none items-center justify-center rounded-[var(--admin-radius-card)] border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35";
  const innerClass = cn(
    isRail
      ? "relative inline-flex size-9 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-panel)] text-[var(--admin-heading)] transition-colors hover:bg-[var(--admin-panel-muted)]"
      : "relative inline-flex size-11 items-center justify-center rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] text-[var(--admin-heading)] transition-colors hover:bg-[var(--admin-panel-muted)] shadow-[var(--admin-shadow-subtle)]",
    pulse && "notif-bell-pulse-once",
  );
  const iconClass = isRail ? "size-[1rem]" : "size-[1.125rem]";

  return (
    <AdminPopover.Root open={open} onOpenChange={setOpen}>
      <AdminPopover.Trigger
        ref={triggerRef}
        aria-label={unreadCount > 0 ? `${unreadCount} need attention` : "Notifications: all caught up"}
        className={triggerClass}
      >
        <span className={innerClass}>
          {unreadCount > 0 ? (
            <BellRing className={iconClass} aria-hidden="true" />
          ) : (
            <Bell className={iconClass} aria-hidden="true" />
          )}
          {unreadCount > 0 ? (
            <span
              className={cn(
                "absolute -right-1 -top-1 inline-flex min-h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[11px] font-bold leading-none shadow-[0_1px_2px_rgba(0,0,0,0.12)]",
                getBadgeClasses(highestSeverity),
              )}
              aria-hidden="true"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </span>
      </AdminPopover.Trigger>
      <AdminPopover.Content
        className="max-h-[min(70vh,40rem)] w-[min(calc(100vw-1rem),28rem)] overflow-y-auto p-0"
      >
        <NotificationPopoverContent
          items={items}
          onClose={() => setOpen(false)}
          shellVariant={shellVariant}
        />
      </AdminPopover.Content>
    </AdminPopover.Root>
  );
}

export function MobileNotificationButton({
  items,
  variant = "full",
  staffId = "shared",
  shellVariant = null,
}: {
  items: NotificationItem[];
  variant?: "full" | "icon";
  staffId?: string;
  shellVariant?: AdminShellVariant | null;
}) {
  const activeItems = useMemo(() => getActiveItems(items), [items]);
  const unreadCount = activeItems.filter((i) => !isItemRead(i)).length;
  const highestSeverity = useMemo(
    () => getHighestUnreadSeverity(activeItems),
    [activeItems],
  );
  const pulse = useCriticalArrivalPulse(activeItems);
  useLegacyMigration(staffId);

  const triggerLabel =
    unreadCount > 0 ? `${unreadCount} need attention` : "Notifications: all caught up";
  const fullVariantTone: "danger" | "warning" | "info" | "muted" =
    highestSeverity === "critical"
      ? "danger"
      : highestSeverity === "warning"
        ? "warning"
        : highestSeverity === "info"
          ? "info"
          : "muted";

  return (
    <AdminSheet
      title="Notifications"
      description={
        unreadCount > 0
          ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
          : "All caught up"
      }
      side="bottom"
      trigger={
        variant === "icon" ? (
          <button
            type="button"
            className={cn(
              "relative inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] text-[var(--admin-heading)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35 shadow-[var(--admin-shadow-subtle)]",
              pulse && "notif-bell-pulse-once",
            )}
            aria-label={triggerLabel}
          >
            {unreadCount > 0 ? (
              <BellRing className="size-[1.125rem] text-[var(--admin-primary)]" aria-hidden="true" />
            ) : (
              <Bell className="size-[1.125rem] text-[var(--admin-primary)]" aria-hidden="true" />
            )}
            {unreadCount > 0 ? (
              <span
                className={cn(
                  "absolute -right-1 -top-1 inline-flex min-h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[11px] font-bold leading-none shadow-[0_1px_2px_rgba(0,0,0,0.12)]",
                  getBadgeClasses(highestSeverity),
                )}
                aria-hidden="true"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </button>
        ) : (
          <button
            type="button"
            className={cn(
              "relative inline-flex min-h-12 w-full items-center justify-between gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 text-sm font-semibold text-[var(--admin-heading)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35 shadow-[var(--admin-shadow-subtle)]",
              pulse && "notif-bell-pulse-once",
            )}
            aria-label={triggerLabel}
          >
            <span className="inline-flex items-center gap-2">
              {unreadCount > 0 ? (
                <BellRing className="size-4 text-[var(--admin-primary)]" aria-hidden="true" />
              ) : (
                <Bell className="size-4 text-[var(--admin-primary)]" aria-hidden="true" />
              )}
              Notification centre
            </span>
            {unreadCount > 0 ? (
              <AdminStatusBadge value={`${unreadCount} unread`} tone={fullVariantTone} />
            ) : (
              <AdminStatusBadge value="All read" tone="muted" />
            )}
          </button>
        )
      }
    >
      <NotificationPopoverContent
        items={items}
        onClose={() => {}}
        shellVariant={shellVariant}
        isMobile
      />
    </AdminSheet>
  );
}

// ─── Centre body ─────────────────────────────────────────────────────────────

function getEmptyCopy(tab: StatusTab): { title: string; message: string } {
  switch (tab) {
    case "all":
      return { title: "All clear", message: "You're caught up — nothing needs your attention." };
    case "unread":
      return { title: "No unread notifications", message: "Everything visible has been seen." };
    case "critical":
      return { title: "Nothing critical right now", message: "Critical items will surface here first." };
    case "snoozed":
      return { title: "Nothing snoozed", message: "Use Snooze on any item to come back to it later." };
    case "archived":
      return { title: "Your archive is empty", message: "Archived items live here in case you need them back." };
  }
}

const SEVERITY_BAND_ORDER: Severity[] = ["critical", "warning", "info"];
const SEVERITY_BAND_LABEL: Record<Severity, string> = {
  critical: "Critical",
  warning: "Warning",
  info: "Info",
};

function NotificationPopoverContent({
  items,
  onClose,
  shellVariant,
  isMobile = false,
}: {
  items: NotificationItem[];
  onClose(): void;
  shellVariant?: AdminShellVariant | null;
  isMobile?: boolean;
}) {
  const statusTabs = getStatusTabsForVariant(shellVariant);
  const typeChips = getTypeChipsForVariant(shellVariant);
  const [tab, setTab] = useState<StatusTab>("all");
  const [chipFilter, setChipFilter] = useState<TypeChip | null>(null);
  const [chipsOpen, setChipsOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  // ── Counts per status tab (raw, before type-chip filter) ──
  const counts = useMemo(() => {
    const active = getActiveItems(items);
    return {
      all: active.length,
      unread: active.filter((i) => !isItemRead(i)).length,
      critical: active.filter((i) => i.severity === "critical").length,
      snoozed: items.filter((i) => isItemSnoozed(i)).length,
      archived: items.filter((i) => isItemArchived(i)).length,
    } satisfies Record<StatusTab, number>;
  }, [items]);

  // ── Filter pipeline: status tab → optional type chip ──
  const filtered = useMemo(() => {
    let pool: NotificationItem[];
    switch (tab) {
      case "unread":
        pool = getActiveItems(items).filter((i) => !isItemRead(i));
        break;
      case "critical":
        pool = getActiveItems(items).filter((i) => i.severity === "critical");
        break;
      case "snoozed":
        pool = items.filter((i) => isItemSnoozed(i));
        break;
      case "archived":
        pool = items.filter((i) => isItemArchived(i));
        break;
      default:
        pool = getActiveItems(items);
    }
    if (chipFilter) {
      pool = pool.filter((i) => itemMatchesTypeChip(i, chipFilter));
    }
    return pool;
  }, [items, tab, chipFilter]);

  // ── Banding: critical → warning → info, with duplicate-collapse inside each ──
  const banded = useMemo(() => {
    return SEVERITY_BAND_ORDER.map((sev) => {
      const inBand = filtered.filter((i) => i.severity === sev);
      // Snoozed/Archived tabs don't need severity banding — they're a flat list.
      if (tab === "snoozed" || tab === "archived") {
        return { severity: sev, nodes: [] as GroupedFeedNode[] };
      }
      return { severity: sev, nodes: groupByDuplicate(inBand) };
    });
  }, [filtered, tab]);

  // Flat node list for snoozed/archived tabs.
  const flatNodes = useMemo(() => groupByDuplicate(filtered), [filtered]);

  // ── Server-action wrapper that wraps each call in a transition and
  // surfaces failure results in the browser console. Network/RLS errors
  // would otherwise be silently swallowed by `void`. ──
  const runAction = useCallback(
    (label: string, fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
      startTransition(async () => {
        const result = await fn();
        if (!result.ok) {
          console.error(`[notification-centre] ${label} failed:`, result.error);
        }
      });
    },
    [],
  );

  const actions: NotificationCardActions = useMemo(
    () => ({
      markRead: (id) => runAction("markRead", () => markNotificationRead(id)),
      markUnread: (id) => runAction("markUnread", () => markNotificationUnread(id)),
      snooze: (id, until) => runAction("snooze", () => snoozeNotification(id, until)),
      unsnooze: (id) => runAction("unsnooze", () => unsnoozeNotification(id)),
      archive: (id) => runAction("archive", () => archiveNotification(id)),
      unarchive: (id) => runAction("unarchive", () => unarchiveNotification(id)),
    }),
    [runAction],
  );

  const handleMarkAllRead = useCallback(() => {
    const ids = getActiveItems(items)
      .filter((i) => !isItemRead(i))
      .map((i) => i.notificationId)
      .filter((id): id is string => typeof id === "string");
    if (ids.length === 0) return;
    startTransition(() => { void markAllNotificationsRead(ids); });
  }, [items]);

  const toggleExpand = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Count breakdown subtitle.
  const summary = useMemo(() => {
    const c = counts.critical;
    const w = getActiveItems(items).filter((i) => i.severity === "warning" && !isItemRead(i)).length;
    const inf = getActiveItems(items).filter((i) => i.severity === "info" && !isItemRead(i)).length;
    const parts: string[] = [];
    if (c) parts.push(`${c} critical`);
    if (w) parts.push(`${w} warning`);
    if (inf) parts.push(`${inf} info`);
    if (parts.length === 0) return "You're all caught up.";
    return parts.join(" · ");
  }, [counts.critical, items]);

  const renderNode = (node: GroupedFeedNode) => {
    if (node.kind === "single") {
      const item = node.items[0];
      return (
        <NotificationCard
          key={node.key}
          item={item}
          actions={actions}
          onPrimaryClick={onClose}
        />
      );
    }
    const expanded = expandedGroups.has(node.key);
    if (!expanded) {
      // Show the most recent item as the leader.
      const leader = node.items[0];
      return (
        <NotificationCard
          key={node.key}
          item={leader}
          actions={actions}
          onPrimaryClick={onClose}
          collapsed
          groupSize={node.items.length}
          onExpandGroup={() => toggleExpand(node.key)}
        />
      );
    }
    return (
      <div key={node.key} className="border-l-2 border-[var(--admin-border)]/40 pl-1">
        {node.items.map((item) => (
          <NotificationCard
            key={item.id}
            item={item}
            actions={actions}
            onPrimaryClick={onClose}
          />
        ))}
        <div className="px-4 pb-2 md:px-5">
          <button
            type="button"
            onClick={() => toggleExpand(node.key)}
            className="inline-flex items-center gap-1 rounded-[var(--admin-radius-control)] px-2 py-1 text-[11px] font-medium text-[var(--admin-text-muted)] outline-none transition-colors hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
          >
            Collapse group
          </button>
        </div>
      </div>
    );
  };

  const emptyCopy = getEmptyCopy(tab);
  const isEmpty = filtered.length === 0;

  return (
    <>
      {/* ── Header ───────────────────────────────────────────── */}
      <div className={cn("flex items-start justify-between gap-3 border-b border-[var(--admin-border)] px-5 py-4", isMobile && "px-4 py-3")}>
        <div className="min-w-0 flex-1">
          {!isMobile ? (
            <h2 className="admin-display text-base font-semibold text-[var(--admin-heading)]">
              Notification centre
            </h2>
          ) : null}
          <p className="mt-0.5 truncate text-xs text-[var(--admin-text-muted)]">{summary}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {counts.unread > 0 ? (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="inline-flex min-h-8 items-center gap-1 rounded-[var(--admin-radius-control)] px-2.5 py-1.5 text-xs font-semibold text-[var(--admin-primary)] outline-none transition-colors hover:bg-[var(--admin-primary)]/8 focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
            >
              <CheckCheck className="size-3.5" aria-hidden="true" />
              Mark all read
            </button>
          ) : null}
          {!isMobile ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex size-8 items-center justify-center rounded-[var(--admin-radius-control)] text-[var(--admin-text-muted)] outline-none hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35 transition-colors"
              aria-label="Close notifications"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* ── Status tabs ──────────────────────────────────────── */}
      <div
        className={cn(
          "flex gap-1 overflow-x-auto border-b border-[var(--admin-border)] px-5 py-2.5",
          isMobile && "px-4",
        )}
        role="tablist"
        aria-label="Notification status filter"
      >
        {statusTabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            role="tab"
            aria-selected={tab === t}
            className={cn(
              "inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-[var(--admin-radius-control)] px-3 py-1.5 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35",
              tab === t
                ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                : "text-[var(--admin-body)] hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)]",
            )}
          >
            {STATUS_TAB_LABELS[t]}
            {counts[t] > 0 ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                  tab === t
                    ? "bg-white/20 text-[var(--admin-on-primary)]"
                    : "bg-[var(--admin-panel-muted)] text-[var(--admin-text-muted)]",
                )}
              >
                {counts[t]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── Type chip row (collapsible) ──────────────────────── */}
      {typeChips.length > 0 ? (
        <div className={cn("border-b border-[var(--admin-border)] px-5 py-2", isMobile && "px-4")}>
          <button
            type="button"
            onClick={() => setChipsOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-[var(--admin-radius-control)] px-1.5 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--admin-text-muted)] outline-none transition-colors hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
            aria-expanded={chipsOpen}
          >
            <Filter className="size-3" aria-hidden="true" />
            Filter by type{chipFilter ? `: ${TYPE_CHIP_LABELS[chipFilter]}` : ""}
            <span aria-hidden="true">{chipsOpen ? "▴" : "▾"}</span>
          </button>
          {chipsOpen ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setChipFilter(null)}
                className={cn(
                  "inline-flex min-h-7 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35",
                  chipFilter === null
                    ? "border-[var(--admin-primary)] bg-[var(--admin-primary)]/10 text-[var(--admin-primary)]"
                    : "border-[var(--admin-border)] bg-[var(--admin-panel)] text-[var(--admin-text-muted)] hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)]",
                )}
              >
                All types
              </button>
              {typeChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setChipFilter((curr) => (curr === chip ? null : chip))}
                  className={cn(
                    "inline-flex min-h-7 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35",
                    chipFilter === chip
                      ? "border-[var(--admin-primary)] bg-[var(--admin-primary)]/10 text-[var(--admin-primary)]"
                      : "border-[var(--admin-border)] bg-[var(--admin-panel)] text-[var(--admin-text-muted)] hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)]",
                  )}
                >
                  {TYPE_CHIP_LABELS[chip]}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── Feed ────────────────────────────────────────────── */}
      <div className="divide-y divide-[var(--admin-border)]/40">
        {isEmpty ? (
          <div className="px-5 py-10">
            <EmptyState
              icon={Bell}
              title={emptyCopy.title}
              message={emptyCopy.message}
              tone="muted"
              compact
            />
          </div>
        ) : tab === "snoozed" || tab === "archived" ? (
          // Flat list for these tabs — no severity banding.
          flatNodes.map(renderNode)
        ) : (
          banded.map((band) =>
            band.nodes.length === 0 ? null : (
              <div key={band.severity}>
                <div className="flex items-center gap-2 bg-[var(--admin-panel-muted)]/60 px-5 py-1.5">
                  <span
                    className={cn(
                      "inline-block size-1.5 rounded-full",
                      band.severity === "critical" && "bg-[var(--admin-danger)]",
                      band.severity === "warning" && "bg-[var(--admin-warning)]",
                      band.severity === "info" && "bg-[var(--admin-info)]",
                    )}
                    aria-hidden="true"
                  />
                  <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--admin-text-muted)]">
                    {SEVERITY_BAND_LABEL[band.severity]} · {band.nodes.reduce((acc, n) => acc + n.items.length, 0)}
                  </span>
                </div>
                {band.nodes.map(renderNode)}
              </div>
            ),
          )
        )}
      </div>
    </>
  );
}
