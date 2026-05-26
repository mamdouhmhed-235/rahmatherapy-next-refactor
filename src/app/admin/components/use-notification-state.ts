"use client";

/**
 * R4 redesign 2026-05-21 — notification centre freshness model.
 *
 * Three timers + one realtime channel run alongside the bell trigger:
 *   1. Supabase realtime subscription on `notification_state` filtered to the
 *      current staff. Cross-device sync of read/snooze/archive state in ~200ms.
 *      RLS narrows the broadcast payload to own rows.
 *   2. Visibility refetch — when the tab regains focus, router.refresh() so
 *      a user returning to a stale tab sees current state.
 *   3. 60-second poll — covers source-table changes (new unassigned booking,
 *      new failed email, etc) that are NOT in notification_state. Lighter than
 *      subscribing to every source table.
 *   4. Snooze-expiry timer — when a snoozed item's snoozed_until passes, the
 *      item should reappear at the top of Unread. We schedule a single
 *      router.refresh() at the nearest expiry time (clamped to 24h max).
 *
 * Critical-arrival announcement is also produced here as a string the caller
 * mounts inside an aria-live region. Throttled to one announcement per 5s
 * with coalescing — "1 new critical notification" or
 * "N new critical notifications".
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { NotificationItem } from "../reports/reporting";

const POLL_INTERVAL_MS = 60_000;
const SNOOZE_TIMER_MAX_MS = 24 * 60 * 60 * 1000;
const ANNOUNCE_THROTTLE_MS = 5_000;

export function useNotificationFreshness({
  items,
  staffId,
}: {
  items: NotificationItem[];
  staffId: string | null | undefined;
}) {
  const router = useRouter();

  // ── 1. Realtime subscription ────────────────────────────────────────────
  useEffect(() => {
    if (!staffId || staffId === "shared") return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`notif-state-${staffId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notification_state",
          filter: `staff_id=eq.${staffId}`,
        },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [staffId, router]);

  // ── 2. Visibility refetch ───────────────────────────────────────────────
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [router]);

  // ── 3. 60s poll ─────────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => router.refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [router]);

  // ── 4. Snooze-expiry timer ──────────────────────────────────────────────
  useEffect(() => {
    const now = Date.now();
    let nearestExpiry = Infinity;
    for (const item of items) {
      if (!item.state?.snoozedUntil) continue;
      const ms = new Date(item.state.snoozedUntil).getTime();
      if (Number.isFinite(ms) && ms > now && ms < nearestExpiry) {
        nearestExpiry = ms;
      }
    }
    if (!Number.isFinite(nearestExpiry)) return;
    const delay = Math.min(nearestExpiry - now + 1000, SNOOZE_TIMER_MAX_MS);
    if (delay <= 0) return;
    const t = setTimeout(() => router.refresh(), delay);
    return () => clearTimeout(t);
  }, [items, router]);
}

/**
 * Returns a throttled aria-live announcement string that updates when a new
 * critical notification ID appears in `items`. Empty string on mount / when
 * nothing has arrived.
 */
export function useCriticalAnnouncer(items: NotificationItem[]): string {
  const seenRef = useRef<Set<string> | null>(null);
  const lastAnnounceRef = useRef(0);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const currentCritical = new Set(
      items.filter((i) => i.severity === "critical").map((i) => i.id),
    );
    if (seenRef.current === null) {
      seenRef.current = currentCritical;
      return;
    }
    const newIds: string[] = [];
    for (const id of currentCritical) {
      if (!seenRef.current.has(id)) newIds.push(id);
    }
    seenRef.current = currentCritical;
    if (newIds.length === 0) return;

    const now = Date.now();
    if (now - lastAnnounceRef.current < ANNOUNCE_THROTTLE_MS) return;
    lastAnnounceRef.current = now;
    setAnnouncement(
      newIds.length === 1
        ? "1 new critical notification"
        : `${newIds.length} new critical notifications`,
    );
  }, [items]);

  return announcement;
}
