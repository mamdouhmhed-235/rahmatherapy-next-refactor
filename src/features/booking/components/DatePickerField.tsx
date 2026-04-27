"use client";

import { CalendarDays } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { startOfDay } from "date-fns";
import styles from "../BookingExperience.module.css";

interface DatePickerFieldProps {
  selected: Date | undefined;
  onSelect: (date: Date | undefined) => void;
}

export function DatePickerField({ selected, onSelect }: DatePickerFieldProps) {
  const today = startOfDay(new Date());

  return (
    <div className={styles.calendarCard}>
      <div className={styles.cardHeaderLine}>
        <CalendarDays aria-hidden="true" size={18} />
        Preferred appointment date
      </div>
      <DayPicker
        mode="single"
        selected={selected}
        onSelect={onSelect}
        disabled={{ before: today }}
        weekStartsOn={1}
        className={styles.dayPicker}
      />
    </div>
  );
}
