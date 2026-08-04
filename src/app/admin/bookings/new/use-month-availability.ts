"use client";

// C-23 Phase C, Step 6 — month-fetching cache hook for the admin availability
// calendar. Shape lifted from src/features/booking/components/ScheduleStep.tsx
// (:77-130), pointed at the new authenticated admin route instead of the
// public one — the whole reason that route exists (Phase B) is so staff see
// availability beyond the customer booking window and while public booking is
// paused (brief §3).
//
// Not wired into ManualBookingForm here — that is Phase D. This file has no
// caller yet.

import { useEffect, useMemo, useRef, useState } from "react";
import type { TherapistGender } from "@/lib/booking/availability";

interface MonthAvailabilityApiResponse {
  days?: Array<{ date: string; hasSlots: boolean; slotCount: number }>;
  reason?: string;
  error?: string;
}

export interface UseMonthAvailabilityResult {
  /** yyyy-MM-dd → hasSlots for the requested month, or null while unknown/failed. */
  days: Map<string, boolean> | null;
  loading: boolean;
}

/**
 * Fetches POST /api/admin/availability/month for one cohort and caches the
 * result per `month|services|genders|city`. For a mixed-gender booking, call
 * this hook twice — once per cohort's gender subset — same as the per-day
 * `checkAvailability` already does with two `/api/availability` calls.
 *
 * `enabled` gates fetching outright; it introduces no preconditions of its
 * own (brief finding 4) — the caller (Phase D) wires it straight to the
 * existing `canCheckAvailability`.
 *
 * A failed or aborted request resolves to `days: null` — the calendar renders
 * unmarked, silently. The per-day check on selection remains the source of
 * truth; this is a hint, never a gate (brief §5.3).
 */
export function useMonthAvailability(
  monthKey: string,
  serviceIds: string[],
  genders: TherapistGender[],
  city: string,
  enabled: boolean
): UseMonthAvailabilityResult {
  const [days, setDays] = useState<Map<string, boolean> | null>(null);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef(new Map<string, Map<string, boolean>>());

  const serviceIdsKey = useMemo(() => serviceIds.join(","), [serviceIds]);
  const gendersKey = useMemo(() => genders.join(","), [genders]);
  const cacheKey = [monthKey, serviceIdsKey, gendersKey, city.trim().toLowerCase()].join("|");

  useEffect(() => {
    const controller = new AbortController();

    async function loadMonthAvailability() {
      try {
        await Promise.resolve();
        if (controller.signal.aborted) return;

        if (!enabled) {
          setDays(null);
          setLoading(false);
          return;
        }

        const cached = cacheRef.current.get(cacheKey);
        if (cached) {
          setDays(cached);
          setLoading(false);
          return;
        }

        setLoading(true);
        setDays(null);

        const response = await fetch("/api/admin/availability/month", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            month: monthKey,
            serviceIds,
            participantGenders: genders,
            city,
          }),
          signal: controller.signal,
        });
        const data = (await response.json()) as MonthAvailabilityApiResponse;

        if (!response.ok || !data.days) {
          setDays(null);
          return;
        }

        const map = new Map(data.days.map((day) => [day.date, day.hasSlots] as const));
        cacheRef.current.set(cacheKey, map);
        setDays(map);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setDays(null);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadMonthAvailability();

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, enabled]);

  return { days, loading };
}
