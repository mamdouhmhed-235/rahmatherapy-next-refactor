"use client";

import { Clock3, ShieldCheck } from "lucide-react";
import { TIME_SLOTS, type BookingTimeSlot } from "../data/time-slots";
import styles from "../BookingExperience.module.css";

interface TimeSlotPickerProps {
  selectedTime: string | null;
  error?: string;
  onSelect: (time: BookingTimeSlot) => void;
}

export function TimeSlotPicker({
  selectedTime,
  error,
  onSelect,
}: TimeSlotPickerProps) {
  return (
    <div className={styles.slotCard}>
      <div className={styles.cardHeaderLine}>
        <Clock3 aria-hidden="true" size={18} />
        Preferred time
      </div>
      <div className={styles.slotGrid}>
        {TIME_SLOTS.map((slot) => (
          <button
            type="button"
            key={slot}
            className={selectedTime === slot ? styles.slotActive : styles.slot}
            onClick={() => onSelect(slot)}
          >
            {slot}
          </button>
        ))}
      </div>
      {error && (
        <p className={styles.fieldError} role="alert" aria-live="polite">
          {error}
        </p>
      )}
      <div className={styles.reassurance}>
        <ShieldCheck aria-hidden="true" size={18} />
        <p>
          Preferred dates and times are reviewed by the therapist before an
          appointment is confirmed.
        </p>
      </div>
    </div>
  );
}
