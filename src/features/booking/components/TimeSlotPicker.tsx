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

export function TimeSlotPicker({
  selectedTime,
  availableTimes,
  loading = false,
  error,
  onSelect,
}: TimeSlotPickerProps) {
  return (
    <div className={styles.slotCard}>
      <div className={styles.cardHeaderLine}>
        <Clock3 aria-hidden="true" size={18} />
        Preferred appointment time
      </div>
      {loading ? (
        <p className={styles.slotEmpty}>Checking available times...</p>
      ) : availableTimes.length > 0 ? (
        <div className={styles.slotGrid}>
          {availableTimes.map((slot) => (
            <button
              type="button"
              key={slot}
              className={selectedTime === slot ? styles.slotActive : styles.slot}
              aria-pressed={selectedTime === slot}
              onClick={() => onSelect(slot)}
            >
              {slot}
            </button>
          ))}
        </div>
      ) : (
        <p className={styles.slotEmpty}>No available times for this date.</p>
      )}
      {error && (
        <p className={styles.fieldError} role="alert" aria-live="polite">
          {error}
        </p>
      )}
      <div className={styles.reassurance}>
        <ShieldCheck aria-hidden="true" size={18} />
        <p>
          Preferred dates and times are requests only. Rahma Therapy will confirm
          availability before the appointment is final.
        </p>
      </div>
    </div>
  );
}
