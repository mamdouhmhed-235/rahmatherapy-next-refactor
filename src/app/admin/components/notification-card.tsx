"use client";

/**
 * R4 redesign 2026-05-21 — notification card. Non-interactive container so
 * the explicit "Open" link is the only deep-link affordance (avoids the
 * anchor-in-anchor a11y trap of "card-is-a-link with action buttons inside").
 *
 * Layout per plan:
 *   [icon]  Title              [severity]
 *           Detail line
 *           Timestamp · relative
 *           [Open ›] [Secondary?] [⋯]
 *
 * Unread items get a 3px primary-tinted left accent + bolder title weight.
 * Read items render muted.
 *
 * The ⋯ menu uses AdminPopover (Radix) — same primitive as the centre's
 * outer popover, so behaviour and a11y are consistent.
 */

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  BellOff,
  Check,
  Clock,
  CreditCard,
  Eye,
  Mail,
  MoreHorizontal,
  Siren,
  UserRound,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminStatusBadge } from "./admin-ui";
import * as AdminPopover from "./admin-popover";
import { NotificationSnoozeMenu } from "./notification-snooze-menu";
import type { NotificationItem } from "../reports/reporting";

/**
 * Stable wrapper around the lucide icons keyed by notification type. Declared
 * at module scope so it isn't treated as a component-created-during-render by
 * the react-hooks/static-components lint rule.
 */
function TypeIcon({
  type,
  className,
}: {
  type: NotificationItem["type"];
  className?: string;
}) {
  switch (type) {
    case "email":
      return <Mail className={className} aria-hidden="true" />;
    case "operation":
      return <Siren className={className} aria-hidden="true" />;
    case "assignment":
      return <Users className={className} aria-hidden="true" />;
    case "payment":
      return <CreditCard className={className} aria-hidden="true" />;
    case "enquiry":
      return <UserRound className={className} aria-hidden="true" />;
    case "availability":
      return <Clock className={className} aria-hidden="true" />;
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

function getAgeLabel(timestamp: string) {
  const dateMs = parseNotificationDate(timestamp);
  if (dateMs === null) return null;
  const now = new Date();
  const todayMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((todayMs - dateMs) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff > 0) return `${diff}d old`;
  return `Due in ${Math.abs(diff)}d`;
}

function formatSnoozedUntil(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return (
      "Today " +
      date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    );
  }
  return (
    date.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " +
    date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  );
}

export interface NotificationCardActions {
  markRead(notificationId: string): void;
  markUnread(notificationId: string): void;
  snooze(notificationId: string, untilIso: string): void;
  unsnooze(notificationId: string): void;
  archive(notificationId: string): void;
  unarchive(notificationId: string): void;
}

export function NotificationCard({
  item,
  actions,
  onPrimaryClick,
  collapsed,
  groupSize,
  onExpandGroup,
}: {
  item: NotificationItem;
  actions: NotificationCardActions;
  /** Called whenever the user navigates via the primary or secondary link. */
  onPrimaryClick(): void;
  /** When true, item is the collapsed leader of a (type, severity, reason) group. */
  collapsed?: boolean;
  groupSize?: number;
  onExpandGroup?(): void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [, startTransition] = useTransition();

  const ageLabel = getAgeLabel(item.timestamp);
  const isRead = !!item.state?.readAt;
  const isSnoozed =
    !!item.state?.snoozedUntil && new Date(item.state.snoozedUntil) > new Date();
  const isArchived = !!item.state?.archivedAt;
  const canActOnState = !!item.notificationId;

  const closeMenus = () => {
    setMenuOpen(false);
    setSnoozeOpen(false);
  };

  const runAction = (fn: () => void) => {
    closeMenus();
    startTransition(() => fn());
  };

  return (
    <div
      className={cn(
        "relative grid gap-3 px-4 py-4 transition-colors md:px-5",
        // Severity-tinted background wash for unread items.
        !isRead && item.severity === "critical" && "bg-[var(--admin-status-cancelled-bg)]/40",
        !isRead && item.severity === "warning" && "bg-[var(--admin-status-attention-bg)]/40",
        !isRead && item.severity === "info" && "bg-[var(--admin-primary)]/[0.03]",
      )}
    >
      {/* Unread left accent */}
      {!isRead ? (
        <span
          aria-hidden="true"
          className={cn(
            "absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full",
            item.severity === "critical" && "bg-[var(--admin-danger)]",
            item.severity === "warning" && "bg-[var(--admin-warning)]",
            item.severity === "info" && "bg-[var(--admin-info)]",
          )}
        />
      ) : null}

      <div className="flex items-start gap-3">
        <TypeIcon
          type={item.type}
          className={cn(
            "mt-0.5 size-4 shrink-0",
            item.severity === "critical" && "text-[var(--admin-danger)]",
            item.severity === "warning" && "text-[var(--admin-warning)]",
            item.severity === "info" && "text-[var(--admin-info)]",
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <p
                className={cn(
                  "text-sm leading-snug",
                  isRead
                    ? "font-medium text-[var(--admin-text-muted)]"
                    : "font-semibold text-[var(--admin-heading)]",
                )}
              >
                {item.title}
              </p>
              {collapsed && groupSize && groupSize > 1 ? (
                <span
                  className="inline-flex items-center rounded-full bg-[var(--admin-panel-muted)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--admin-body)]"
                  aria-label={`${groupSize} similar notifications`}
                >
                  {groupSize}
                </span>
              ) : null}
            </div>
            <AdminStatusBadge
              value={item.severity}
              tone={SEVERITY_TONES[item.severity]}
              className="shrink-0 text-[10px]"
            />
          </div>
          <p className="mt-1 break-words text-xs leading-5 text-[var(--admin-text-muted)]">
            {item.detail}
          </p>
          <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--admin-text-muted)]">
            {[item.timestamp, ageLabel].filter(Boolean).join(" · ")}
            {isSnoozed && item.state?.snoozedUntil ? (
              <>
                {" · "}
                <span className="text-[var(--admin-primary)]">
                  Snoozed until {formatSnoozedUntil(item.state.snoozedUntil)}
                </span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      <div className="ml-7 flex flex-wrap items-center gap-1.5 md:ml-7">
        {collapsed && groupSize && groupSize > 1 && onExpandGroup ? (
          <button
            type="button"
            onClick={onExpandGroup}
            className="inline-flex min-h-9 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-2.5 text-[11px] font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
          >
            Expand {groupSize} similar
          </button>
        ) : null}
        {item.href ? (
          <Link
            href={item.href}
            onClick={() => {
              if (item.notificationId) actions.markRead(item.notificationId);
              onPrimaryClick();
            }}
            className="inline-flex min-h-9 items-center rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-2.5 text-[11px] font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
          >
            {item.actionLabel ?? "Open"}
          </Link>
        ) : null}
        {item.secondaryHref ? (
          <Link
            href={item.secondaryHref}
            onClick={() => {
              if (item.notificationId) actions.markRead(item.notificationId);
              onPrimaryClick();
            }}
            className="inline-flex min-h-9 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-2.5 text-[11px] font-medium text-[var(--admin-heading)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
          >
            {item.secondaryLabel ?? "Details"}
          </Link>
        ) : null}
        {canActOnState ? (
          <AdminPopover.Root open={menuOpen} onOpenChange={(o) => { setMenuOpen(o); if (!o) setSnoozeOpen(false); }}>
            <AdminPopover.Trigger
              className="inline-flex size-9 items-center justify-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] text-[var(--admin-text-muted)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
              aria-label={`Notification options: ${item.title}`}
            >
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </AdminPopover.Trigger>
            <AdminPopover.Content
              align="end"
              className="w-56 p-1.5"
            >
              {snoozeOpen ? (
                <NotificationSnoozeMenu
                  onPick={(iso) => runAction(() => actions.snooze(item.notificationId!, iso))}
                />
              ) : (
                <div className="flex flex-col gap-0.5" role="menu">
                  {!isRead ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => runAction(() => actions.markRead(item.notificationId!))}
                      className="flex items-center gap-2 rounded-[var(--admin-radius-control)] px-2.5 py-2 text-left text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
                    >
                      <Check className="size-3.5 text-[var(--admin-text-muted)]" aria-hidden="true" />
                      Mark read
                    </button>
                  ) : (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => runAction(() => actions.markUnread(item.notificationId!))}
                      className="flex items-center gap-2 rounded-[var(--admin-radius-control)] px-2.5 py-2 text-left text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
                    >
                      <Eye className="size-3.5 text-[var(--admin-text-muted)]" aria-hidden="true" />
                      Mark unread
                    </button>
                  )}
                  {isSnoozed ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => runAction(() => actions.unsnooze(item.notificationId!))}
                      className="flex items-center gap-2 rounded-[var(--admin-radius-control)] px-2.5 py-2 text-left text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
                    >
                      <BellOff className="size-3.5 text-[var(--admin-text-muted)]" aria-hidden="true" />
                      Unsnooze
                    </button>
                  ) : (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => setSnoozeOpen(true)}
                      className="flex items-center gap-2 rounded-[var(--admin-radius-control)] px-2.5 py-2 text-left text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
                    >
                      <Clock className="size-3.5 text-[var(--admin-text-muted)]" aria-hidden="true" />
                      Snooze…
                    </button>
                  )}
                  <div className="my-1 h-px bg-[var(--admin-border)]/60" aria-hidden="true" />
                  {isArchived ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => runAction(() => actions.unarchive(item.notificationId!))}
                      className="flex items-center gap-2 rounded-[var(--admin-radius-control)] px-2.5 py-2 text-left text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
                    >
                      <ArchiveRestore className="size-3.5 text-[var(--admin-text-muted)]" aria-hidden="true" />
                      Restore from archive
                    </button>
                  ) : (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => runAction(() => actions.archive(item.notificationId!))}
                      className="flex items-center gap-2 rounded-[var(--admin-radius-control)] px-2.5 py-2 text-left text-sm font-medium text-[var(--admin-danger)] outline-none transition-colors hover:bg-[var(--admin-danger)]/8 focus-visible:bg-[var(--admin-danger)]/8 focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
                    >
                      <Archive className="size-3.5" aria-hidden="true" />
                      Archive
                    </button>
                  )}
                </div>
              )}
            </AdminPopover.Content>
          </AdminPopover.Root>
        ) : null}
      </div>
    </div>
  );
}
