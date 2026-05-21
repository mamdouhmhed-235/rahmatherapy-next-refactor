/**
 * R4 redesign 2026-05-21 — pure helpers extracted from notification-bell.tsx
 * for unit testability. No React, no DOM, no Supabase imports — these run
 * cleanly under vitest without mocks.
 */

import type { NotificationItem } from "../reports/reporting";

export type Severity = NotificationItem["severity"];

export function isItemSnoozed(item: NotificationItem, now: Date = new Date()): boolean {
  if (!item.state?.snoozedUntil) return false;
  const date = new Date(item.state.snoozedUntil);
  return !Number.isNaN(date.getTime()) && date > now;
}

export function isItemArchived(item: NotificationItem): boolean {
  return !!item.state?.archivedAt;
}

export function isItemRead(item: NotificationItem): boolean {
  return !!item.state?.readAt;
}

/** Items currently visible in the active feed (not archived, not snoozed). */
export function getActiveItems(items: NotificationItem[], now: Date = new Date()): NotificationItem[] {
  return items.filter((i) => !isItemArchived(i) && !isItemSnoozed(i, now));
}

/**
 * Returns the loudest unread severity across `items`, or null when every
 * item is read. Order: critical > warning > info.
 */
export function getHighestUnreadSeverity(items: NotificationItem[]): Severity | null {
  let sawWarning = false;
  let sawInfo = false;
  for (const item of items) {
    if (isItemRead(item)) continue;
    if (item.severity === "critical") return "critical";
    if (item.severity === "warning") sawWarning = true;
    else if (item.severity === "info") sawInfo = true;
  }
  if (sawWarning) return "warning";
  if (sawInfo) return "info";
  return null;
}

export interface GroupedFeedNode {
  kind: "single" | "group";
  items: NotificationItem[];
  /** Stable key for React. */
  key: string;
}

/**
 * Within an already-filtered list of items, group by (type, severity, reason).
 * Groups of size 1 stay as singles; groups of size ≥ 2 collapse with the
 * first item (most recent) as the representative.
 *
 * Items without a `reason` discriminator pass through as singles — grouping
 * them would risk merging notifications the system can't safely deduplicate.
 */
export function groupByDuplicate(items: NotificationItem[]): GroupedFeedNode[] {
  const buckets = new Map<string, NotificationItem[]>();
  const order: string[] = [];
  for (const item of items) {
    if (!item.reason) {
      const key = `single:${item.id}`;
      buckets.set(key, [item]);
      order.push(key);
      continue;
    }
    const key = `${item.type}|${item.severity}|${item.reason}`;
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(item);
  }
  return order.map((key) => {
    const bucket = buckets.get(key)!;
    return {
      kind: bucket.length >= 2 ? "group" : "single",
      items: bucket,
      key,
    };
  });
}
