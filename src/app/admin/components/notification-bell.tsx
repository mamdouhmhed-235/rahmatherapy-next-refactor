"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BellRing,
  Clock,
  CreditCard,
  Mail,
  Siren,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { AdminEmptyState } from "./admin-ui";
import Link from "next/link";
import { cn } from "@/lib/utils";
import * as AdminPopover from "./admin-popover";
import { AdminSheet } from "./admin-ui-interactions";
import { AdminStatusBadge } from "./admin-ui";
import type { NotificationItem } from "../reports/reporting";

function getTypeIcon(type: NotificationItem["type"]) {
  switch (type) {
    case "email":
      return Mail;
    case "operation":
      return Siren;
    case "assignment":
      return Users;
    case "payment":
      return CreditCard;
    case "enquiry":
      return UserRound;
    case "availability":
      return Clock;
  }
}

const SEVERITY_TONES = {
  critical: "danger" as const,
  warning: "warning" as const,
  info: "info" as const,
};

function parseNotificationDate(value: string) {
  const [datePart] = value.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  if (!year || !month || !day) return null;
  return Date.UTC(year, month - 1, day);
}

function getNotificationAgeLabel(timestamp: string) {
  const dateMs = parseNotificationDate(timestamp);
  if (dateMs === null) return null;
  const now = new Date();
  const todayMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((todayMs - dateMs) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff > 0) return `${diff}d old`;
  return `Due in ${Math.abs(diff)}d`;
}

const READ_STORAGE_KEY = "rahmatherapy-notification-read";
const DISMISSED_STORAGE_KEY = "rahmatherapy-notification-dismissed";

function useLocalStorageNotificationState(ids: string[]) {
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const rawRead = localStorage.getItem(READ_STORAGE_KEY);
      const rawDismissed = localStorage.getItem(DISMISSED_STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing external localStorage state after hydration
      if (rawRead) setReadIds(new Set(JSON.parse(rawRead)));
      if (rawDismissed) setDismissedIds(new Set(JSON.parse(rawDismissed)));
    } catch {}
  }, []);

  const markRead = (id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const markUnread = (id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const markAllRead = () => {
    setReadIds((prev) => {
      const next = new Set([...prev, ...ids]);
      localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const dismissNotification = (id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
    setReadIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  return { readIds, dismissedIds, markRead, markUnread, markAllRead, dismissNotification };
}

type NotificationTab = "all" | "unread" | "read" | "critical" | "emails" | "operations";

export function NotificationBell({
  items,
}: {
  items: NotificationItem[];
}) {
  const [open, setOpen] = useState(false);
  const ids = useMemo(() => items.map((i) => i.id), [items]);
  const { readIds, dismissedIds, markRead, markUnread, markAllRead, dismissNotification } =
    useLocalStorageNotificationState(ids);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const visibleItems = useMemo(
    () => items.filter((i) => !dismissedIds.has(i.id)),
    [items, dismissedIds]
  );
  const unreadCount = visibleItems.filter((i) => !readIds.has(i.id)).length;

  const closePopover = () => {
    setOpen(false);
  };

  return (
    <>
      <AdminPopover.Root
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
        }}
      >
        <AdminPopover.Trigger
          ref={triggerRef}
          aria-label={unreadCount > 0 ? `${unreadCount} need attention` : "Notifications: all caught up"}
          className="inline-flex size-11 appearance-none items-center justify-center rounded-[var(--admin-radius-card)] border-0 bg-transparent p-0 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
        >
          <span className="relative inline-flex size-11 items-center justify-center rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] text-[var(--admin-heading)] transition-colors hover:bg-[var(--admin-panel-muted)] shadow-[var(--admin-shadow-subtle)]">
            {unreadCount > 0 ? (
              <BellRing className="size-[1.125rem]" aria-hidden="true" />
            ) : (
              <Bell className="size-[1.125rem]" aria-hidden="true" />
            )}
            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex min-h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-full bg-[oklch(95%_0.05_65)] px-1 text-[11px] font-bold leading-none text-[oklch(26%_0.13_55)]" aria-hidden="true">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </span>
        </AdminPopover.Trigger>
        <AdminPopover.Content
          className="w-[26rem] max-h-[min(70vh,40rem)] overflow-y-auto"
        >
          <NotificationPopoverContent
            items={visibleItems}
            readIds={readIds}
            markRead={markRead}
            markUnread={markUnread}
            markAllRead={markAllRead}
            dismissNotification={dismissNotification}
            onClose={closePopover}
          />
        </AdminPopover.Content>
      </AdminPopover.Root>

    </>
  );
}

export function MobileNotificationButton({
  items,
  variant = "full",
}: {
  items: NotificationItem[];
  variant?: "full" | "icon";
}) {
  const ids = useMemo(() => items.map((i) => i.id), [items]);
  const { readIds, dismissedIds, markRead, markUnread, markAllRead, dismissNotification } =
    useLocalStorageNotificationState(ids);
  const visibleItems = useMemo(
    () => items.filter((i) => !dismissedIds.has(i.id)),
    [items, dismissedIds]
  );
  const unreadCount = visibleItems.filter((i) => !readIds.has(i.id)).length;
  const triggerLabel = unreadCount > 0 ? `${unreadCount} need attention` : "Notifications: all caught up";

  return (
    <AdminSheet
      title="Notifications"
      description={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}` : "All caught up"}
      side="bottom"
      trigger={
        variant === "icon" ? (
          <button
            type="button"
            className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] text-[var(--admin-heading)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35 shadow-[var(--admin-shadow-subtle)]"
            aria-label={triggerLabel}
          >
            {unreadCount > 0 ? (
              <BellRing className="size-[1.125rem] text-[var(--admin-primary)]" aria-hidden="true" />
            ) : (
              <Bell className="size-[1.125rem] text-[var(--admin-primary)]" aria-hidden="true" />
            )}
            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex min-h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-full bg-[oklch(95%_0.05_65)] px-1 text-[11px] font-bold leading-none text-[oklch(26%_0.13_55)]" aria-hidden="true">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </button>
        ) : (
          <button
            type="button"
            className="relative inline-flex min-h-12 w-full items-center justify-between gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 text-sm font-semibold text-[var(--admin-heading)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35 shadow-[var(--admin-shadow-subtle)]"
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
              <AdminStatusBadge value={`${unreadCount} unread`} tone="warning" />
            ) : (
              <AdminStatusBadge value="All read" tone="muted" />
            )}
          </button>
        )
      }
    >
      <NotificationPopoverContent
        items={visibleItems}
        readIds={readIds}
        markRead={markRead}
        markUnread={markUnread}
        markAllRead={markAllRead}
        dismissNotification={dismissNotification}
        onClose={() => {}}
        isMobile
      />
    </AdminSheet>
  );
}

function NotificationPopoverContent({
  items,
  readIds,
  markRead,
  markUnread,
  markAllRead,
  dismissNotification,
  onClose,
  isMobile = false,
}: {
  items: NotificationItem[];
  readIds: Set<string>;
  markRead: (id: string) => void;
  markUnread: (id: string) => void;
  markAllRead: () => void;
  dismissNotification: (id: string) => void;
  onClose: () => void;
  isMobile?: boolean;
}) {
  const [tab, setTab] = useState<NotificationTab>("all");

  const filtered = useMemo(() => {
    switch (tab) {
      case "unread":
        return items.filter((i) => !readIds.has(i.id));
      case "read":
        return items.filter((i) => readIds.has(i.id));
      case "critical":
        return items.filter((i) => i.severity === "critical");
      case "emails":
        return items.filter((i) => i.type === "email");
      case "operations":
        return items.filter((i) => i.type === "operation");
      default:
        return items;
    }
  }, [items, readIds, tab]);

  const unreadCount = items.filter((i) => !readIds.has(i.id)).length;

  const tabCounts = useMemo(
    () => ({
      all: items.length,
      unread: items.filter((i) => !readIds.has(i.id)).length,
      read: items.filter((i) => readIds.has(i.id)).length,
      critical: items.filter((i) => i.severity === "critical").length,
      emails: items.filter((i) => i.type === "email").length,
      operations: items.filter((i) => i.type === "operation").length,
    }),
    [items, readIds]
  );

  return (
    <>
      {/* ── Header ── */}
      <div className={cn("flex items-center justify-between gap-3 border-b border-[var(--admin-border)] px-5 py-4", isMobile && "px-4 py-3")}>
        <div>
          {!isMobile ? (
            <h2 className="admin-display text-base font-semibold text-[var(--admin-heading)]">
              Notification centre
            </h2>
          ) : null}
          {unreadCount > 0 ? (
            <p className="mt-0.5 text-xs text-[var(--admin-text-muted)]">
              {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
            </p>
          ) : (
            <p className="text-xs font-medium text-[var(--admin-text-muted)]">All notifications are read.</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={markAllRead}
              className="rounded-[var(--admin-radius-control)] px-2.5 py-1.5 text-xs font-semibold text-[var(--admin-primary)] outline-none hover:bg-[var(--admin-primary)]/8 focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35 transition-colors"
            >
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

      {/* ── Tabs ── */}
      <div
        className={cn(
          "flex gap-1 overflow-x-auto border-b border-[var(--admin-border)] px-5 py-2.5",
          isMobile && "flex-wrap overflow-x-visible px-4"
        )}
        role="tablist"
        aria-label="Notification filters"
      >
        {(["all", "unread", "read", "critical", "emails", "operations"] as NotificationTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            role="tab"
            aria-selected={tab === t}
            className={cn(
              "inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-[var(--admin-radius-control)] px-3 py-1.5 text-xs font-semibold outline-none transition-all focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35",
              tab === t
                ? "bg-[var(--admin-primary)] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                : "text-[var(--admin-body)] hover:text-[var(--admin-heading)] hover:bg-[var(--admin-panel-muted)]"
            )}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {tabCounts[t] > 0 ? (
              <span className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                tab === t ? "bg-white/20 text-white" : "bg-[var(--admin-panel-muted)] text-[var(--admin-text-muted)]"
              )}>
                {tabCounts[t]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── Notification list ── */}
      <div className="divide-y divide-[var(--admin-border)]/60">
        {filtered.slice(0, 30).map((item) => {
          const read = readIds.has(item.id);
          const TypeIcon = getTypeIcon(item.type);
          const ageLabel = getNotificationAgeLabel(item.timestamp);
          return (
            <div
              key={item.id}
              className={cn(
                "grid gap-3 px-5 py-5 transition-colors",
                isMobile && "px-4",
                item.severity === "critical" && "bg-[oklch(95.5%_0.028_20)]/40",
                item.severity === "warning" && "bg-[oklch(95%_0.05_65)]/40",
                item.severity === "info" && !read && "bg-[var(--admin-primary)]/[0.02]"
              )}
            >
              <div className="flex items-start gap-3">
                <TypeIcon
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    item.severity === "critical"
                      ? "text-[var(--admin-danger)]"
                      : item.severity === "warning"
                        ? "text-[var(--admin-warning)]"
                        : "text-[var(--admin-info)]"
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn(
                      "text-sm leading-snug",
                      !read ? "font-semibold text-[var(--admin-heading)]" : "text-[var(--admin-text-muted)]"
                    )}>
                      {item.title}
                    </p>
                    <AdminStatusBadge
                      value={item.severity}
                      tone={SEVERITY_TONES[item.severity]}
                      className="shrink-0 text-[10px]"
                    />
                  </div>
                  <p className="mt-1 break-words text-xs leading-5 text-[var(--admin-text-muted)]">
                    {item.detail}
                  </p>
                  <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--admin-text-muted)]/50">
                    {[item.timestamp, ageLabel].filter(Boolean).join(" \u00b7 ")}
                  </p>
                </div>
              </div>
              <div className={cn("flex flex-wrap items-center gap-1.5", isMobile ? "ml-0" : "ml-[1.75rem]")}>
                {item.href ? (
                  <Link
                    href={item.href}
                    onClick={() => {
                      markRead(item.id);
                      onClose();
                    }}
                    className="inline-flex min-h-7 items-center rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-2.5 text-[11px] font-semibold text-white outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
                  >
                    {item.actionLabel ?? "View"}
                  </Link>
                ) : null}
                {item.secondaryHref ? (
                  <Link
                    href={item.secondaryHref}
                    onClick={() => {
                      markRead(item.id);
                      onClose();
                    }}
                    className="inline-flex min-h-7 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-white px-2.5 text-[11px] font-medium text-[var(--admin-heading)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
                  >
                    {item.secondaryLabel ?? "Details"}
                  </Link>
                ) : null}
                {!read ? (
                  <button
                    type="button"
                    onClick={() => markRead(item.id)}
                    className="inline-flex min-h-7 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-white px-2.5 text-[11px] font-medium text-[var(--admin-text-muted)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
                  >
                    Mark read
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => markUnread(item.id)}
                    className="inline-flex min-h-7 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-white px-2.5 text-[11px] font-medium text-[var(--admin-text-muted)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
                  >
                    Mark unread
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => dismissNotification(item.id)}
                  className="inline-flex min-h-7 items-center gap-1 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-white px-2.5 text-[11px] font-medium text-[var(--admin-text-muted)] outline-none transition-colors hover:border-[var(--admin-danger)]/35 hover:bg-[var(--admin-danger)]/5 hover:text-[var(--admin-danger)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
                  aria-label={`Delete notification: ${item.title}`}
                >
                  <Trash2 className="size-3" aria-hidden="true" />
                  Delete
                </button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 ? (
          <div className="px-5 py-10">
            <AdminEmptyState
              icon={Bell}
              title="All caught up"
              message="When something needs your attention, it'll appear here."
              tone="muted"
            />
          </div>
        ) : null}
      </div>
    </>
  );
}
