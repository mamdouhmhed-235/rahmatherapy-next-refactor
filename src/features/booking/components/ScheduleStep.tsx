"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addMonths, format, parseISO, startOfMonth } from "date-fns";
import { getBookingDateBounds } from "@/lib/time/london";
import type { BookingTimeSlot } from "../data/time-slots";
import { DatePickerField } from "./DatePickerField";
import { TimeSlotPicker } from "./TimeSlotPicker";
import styles from "../BookingExperience.module.css";

interface ScheduleStepProps {
  serviceIds: string[];
  participantGenders: string[];
  city: string;
  preferredDate: Date | undefined;
  preferredTime: string | null;
  scheduleError?: string;
  onDateChange: (date: Date | undefined) => void;
  onTimeClear: () => void;
  onTimeChange: (time: BookingTimeSlot) => void;
  /**
   * business_settings, threaded from the public layout (C-14 Phase D). Absent
   * when the settings read failed; the picker then keeps its previous, purely
   * availability-driven bounds.
   */
  bookingWindowDays?: number;
  minimumNoticeHours?: number;
}

interface AvailabilityApiResponse {
  slots?: Array<{ time: string }>;
  reason?: string;
  error?: string;
}

interface MonthDaySummary {
  date: string;
  hasSlots: boolean;
  slotCount: number;
}

interface MonthAvailabilityApiResponse {
  days?: MonthDaySummary[];
  reason?: string;
  error?: string;
}

export function ScheduleStep({
  serviceIds,
  participantGenders,
  city,
  preferredDate,
  preferredTime,
  scheduleError,
  onDateChange,
  onTimeClear,
  onTimeChange,
  bookingWindowDays,
  minimumNoticeHours,
}: ScheduleStepProps) {
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [availabilityError, setAvailabilityError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState<Date>(() =>
    startOfMonth(preferredDate ?? new Date())
  );
  const [monthDays, setMonthDays] = useState<MonthDaySummary[] | null>(null);
  const [monthLoading, setMonthLoading] = useState(false);
  const monthCacheRef = useRef(new Map<string, MonthDaySummary[]>());
  const autoJumpedRef = useRef(false);
  const selectedDate = preferredDate ? format(preferredDate, "yyyy-MM-dd") : "";
  const serviceIdsKey = useMemo(() => serviceIds.join(","), [serviceIds]);
  const participantGendersKey = useMemo(
    () => participantGenders.join(","),
    [participantGenders]
  );
  const monthKey = format(month, "yyyy-MM");
  const monthCacheKey = [
    monthKey,
    serviceIdsKey,
    participantGendersKey,
    city.trim().toLowerCase(),
  ].join("|");
  const displayedTimes = selectedDate ? availableTimes : [];
  const displayedAvailabilityError = selectedDate ? availabilityError : undefined;

  useEffect(() => {
    const cached = monthCacheRef.current.get(monthCacheKey);
    if (cached) {
      setMonthDays(cached);
      return;
    }

    const controller = new AbortController();

    async function loadMonthAvailability() {
      try {
        await Promise.resolve();
        if (controller.signal.aborted) return;

        setMonthLoading(true);
        setMonthDays(null);

        const response = await fetch("/api/availability/month", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            month: monthKey,
            serviceIds,
            participantGenders,
            city,
          }),
          signal: controller.signal,
        });
        const data = (await response.json()) as MonthAvailabilityApiResponse;

        if (!response.ok || !data.days) {
          setMonthDays(null);
          return;
        }

        monthCacheRef.current.set(monthCacheKey, data.days);
        setMonthDays(data.days);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setMonthDays(null);
      } finally {
        if (!controller.signal.aborted) {
          setMonthLoading(false);
        }
      }
    }

    loadMonthAvailability();

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthCacheKey]);

  // Auto-select the earliest available day once a month's summary arrives.
  // If the visible month has nothing, hop forward one month (once only) so
  // the customer never lands on an empty calendar without help.
  useEffect(() => {
    if (preferredDate || !monthDays || monthLoading) {
      return;
    }

    const firstAvailable = monthDays.find((day) => day.hasSlots);
    if (firstAvailable) {
      onDateChange(parseISO(firstAvailable.date));
      return;
    }

    if (!autoJumpedRef.current) {
      autoJumpedRef.current = true;
      setMonth((current) => startOfMonth(addMonths(current, 1)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthDays, monthLoading, preferredDate]);

  useEffect(() => {
    if (!selectedDate) {
      return;
    }

    const controller = new AbortController();

    async function loadAvailability() {
      try {
        await Promise.resolve();
        if (controller.signal.aborted) return;

        setLoading(true);
        setAvailabilityError(undefined);

        const response = await fetch("/api/availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: selectedDate,
            serviceIds,
            participantGenders,
            city,
          }),
          signal: controller.signal,
        });
        const data = (await response.json()) as AvailabilityApiResponse;

        if (!response.ok) {
          throw new Error(data.error ?? "Availability could not be checked.");
        }

        const times = (data.slots ?? []).map((slot) => slot.time);
        setAvailableTimes(times);
        setAvailabilityError(times.length === 0 ? data.reason : undefined);

        if (preferredTime && !times.includes(preferredTime)) {
          onTimeClear();
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setAvailableTimes([]);
        setAvailabilityError(
          error instanceof Error
            ? error.message
            : "Availability could not be checked."
        );
      } finally {
        setLoading(false);
      }
    }

    loadAvailability();

    return () => controller.abort();
  }, [
    city,
    onTimeClear,
    participantGenders,
    participantGendersKey,
    preferredTime,
    selectedDate,
    serviceIds,
    serviceIdsKey,
  ]);

  const monthHasNoDays =
    !monthLoading && monthDays !== null && !monthDays.some((day) => day.hasSlots);

  // Same helper the server's isDateInBusinessWindow uses, so the last clickable
  // day is exactly the last day /api/availability accepts. Computed on the
  // visitor's clock (not the server's) so a cached page can never bake in a
  // stale "today"; parseISO reads a date-only string as local midnight, which
  // is what DatePickerField compares against.
  const bounds =
    bookingWindowDays === undefined
      ? null
      : getBookingDateBounds({
          bookingWindowDays,
          minimumNoticeHours: minimumNoticeHours ?? 0,
        });

  return (
    <section className={styles.stepSection} aria-labelledby="schedule-heading">
      <div className={styles.stepHeader}>
        <p className={styles.stepKicker}>Step 3 of 4</p>
        <h2 id="schedule-heading" className={styles.stepTitle} tabIndex={-1}>
          Choose a matched time
        </h2>
        <p className={styles.stepSubtitle}>
          These times match the therapist availability needed for your booking.
        </p>
      </div>

      <div className={styles.schedulerGrid}>
        <DatePickerField
          selected={preferredDate}
          onSelect={onDateChange}
          month={month}
          onMonthChange={(nextMonth) => setMonth(startOfMonth(nextMonth))}
          monthDays={monthDays}
          monthLoading={monthLoading}
          monthEmpty={monthHasNoDays}
          earliestBookable={bounds ? parseISO(bounds.earliest) : undefined}
          latestBookable={bounds ? parseISO(bounds.latest) : undefined}
        />
        <TimeSlotPicker
          selectedTime={preferredTime}
          availableTimes={displayedTimes}
          loading={loading}
          error={scheduleError ?? displayedAvailabilityError}
          onSelect={onTimeChange}
        />
      </div>
    </section>
  );
}
