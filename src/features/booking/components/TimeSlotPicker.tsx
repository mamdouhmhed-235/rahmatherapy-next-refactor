"use client";

import { Clock3, ShieldCheck } from "lucide-react";
import type { BookingTimeSlot } from "../data/time-slots";
import styles from "../BookingExperience.module.css";

interface TimeSlotPickerProps {
  selectedTime: string | null;
  availableTimes: string[];
  loading?: boolean;
  error?: string;
  onSelect: (time: BookingTimeSlot) => void;
}

const SLOT_GROUPS = [
  { label: "Morning", match: (hour: number) => hour < 12 },
  { label: "Afternoon", match: (hour: number) => hour >= 12 && hour < 17 },
  { label: "Evening", match: (hour: number) => hour >= 17 },
];

function groupSlots(times: string[]) {
  return SLOT_GROUPS.map((group) => ({
    label: group.label,
    times: times.filter((time) => group.match(Number(time.slice(0, 2)))),
  })).filter((group) => group.times.length > 0);
}

export function TimeSlotPicker({
  selectedTime,
  availableTimes,
  loading = false,
  error,
  onSelect,
}: TimeSlotPickerProps) {
  const groups = groupSlots(availableTimes);

  return (
    <div className={styles.slotCard}>
      <div className={styles.cardHeaderLine}>
        <Clock3 aria-hidden="true" size={18} />
        Preferred appointment time
      </div>
      {loading ? (
        <div className={styles.skeletonRow} aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <span key={index} className={styles.skeletonPill} />
          ))}
        </div>
      ) : groups.length > 0 ? (
        <div className={styles.slotGroups}>
          <p className={styles.slotCountLine}>
            {availableTimes.length}{" "}
            {availableTimes.length === 1 ? "time" : "times"} available
          </p>
          {groups.map((group) => (
            <div key={group.label} className={styles.slotGroup}>
              <p className={styles.slotGroupLabel}>{group.label}</p>
              <div className={styles.slotGrid}>
                {group.times.map((slot) => (
                  <button
                    type="button"
                    key={slot}
                    className={
                      selectedTime === slot ? styles.slotActive : styles.slot
                    }
                    aria-pressed={selectedTime === slot}
                    onClick={() => onSelect(slot)}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.slotEmpty}>
          No matched times are available for this date.
        </p>
      )}
      {error && (
        <p className={styles.fieldError} role="alert" aria-live="polite">
          {error}
        </p>
      )}
      <div className={styles.reassurance}>
        <ShieldCheck aria-hidden="true" size={18} />
        <p>
          We only show times that match the therapist availability needed for
          the selected service, location and participant gender.
        </p>
      </div>
    </div>
  );
}
