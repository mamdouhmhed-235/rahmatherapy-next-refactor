"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
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
}

interface AvailabilityApiResponse {
  slots?: Array<{ time: string }>;
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
}: ScheduleStepProps) {
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [availabilityError, setAvailabilityError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const selectedDate = preferredDate ? format(preferredDate, "yyyy-MM-dd") : "";
  const serviceIdsKey = useMemo(() => serviceIds.join(","), [serviceIds]);
  const participantGendersKey = useMemo(
    () => participantGenders.join(","),
    [participantGenders]
  );
  const displayedTimes = selectedDate ? availableTimes : [];
  const displayedAvailabilityError = selectedDate ? availabilityError : undefined;

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

  return (
    <section className={styles.stepSection} aria-labelledby="schedule-heading">
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.sectionKicker}>4 of 7</p>
          <h3 id="schedule-heading">Choose a matched time</h3>
          <p>
            These times match the therapist availability needed for your
            booking.
          </p>
        </div>
      </div>

      <div className={styles.schedulerGrid}>
        <DatePickerField selected={preferredDate} onSelect={onDateChange} />
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
