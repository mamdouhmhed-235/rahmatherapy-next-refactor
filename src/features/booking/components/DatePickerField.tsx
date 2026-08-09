"use client";

import { useMemo } from "react";
import { CalendarDays } from "lucide-react";
import { DayPicker, type Matcher } from "react-day-picker";
import { parseISO, startOfDay } from "date-fns";
import styles from "../BookingExperience.module.css";

interface MonthDaySummary {
  date: string;
  hasSlots: boolean;
  slotCount: number;
}

interface DatePickerFieldProps {
  selected: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  month: Date;
  onMonthChange: (month: Date) => void;
  monthDays: MonthDaySummary[] | null;
  monthLoading: boolean;
  monthEmpty: boolean;
  /**
   * Booking-window guard (C-14 Phase D). Both inclusive: `earliestBookable`
   * and `latestBookable` stay clickable, everything outside them does not.
   * Omitted — settings unavailable — leaves the previous behaviour intact:
   * past days and fully-booked days disabled, no window bound.
   */
  earliestBookable?: Date;
  latestBookable?: Date;
}

export function DatePickerField({
  selected,
  onSelect,
  month,
  onMonthChange,
  monthDays,
  monthLoading,
  monthEmpty,
  earliestBookable,
  latestBookable,
}: DatePickerFieldProps) {
  const today = startOfDay(new Date());

  const { availableDates, fullDates } = useMemo(() => {
    const available: Date[] = [];
    const full: Date[] = [];

    for (const day of monthDays ?? []) {
      const date = parseISO(day.date);
      if (day.hasSlots) {
        available.push(date);
      } else if (date >= today) {
        full.push(date);
      }
    }

    return { availableDates: available, fullDates: full };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthDays]);

  // Two separate matchers rather than react-day-picker's `{ before, after }`
  // interval form: that one flips meaning when `before` sorts after `after`,
  // so a pathological settings combination (notice pushing the first bookable
  // day past the window) would silently enable every date instead of none.
  const disabled: Matcher[] = [
    { before: earliestBookable ?? today },
    ...(latestBookable ? [{ after: latestBookable }] : []),
    ...fullDates,
  ];

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
        month={month}
        onMonthChange={onMonthChange}
        disabled={disabled}
        modifiers={{ hasTimes: availableDates }}
        modifiersClassNames={{ hasTimes: styles.dayHasTimes }}
        weekStartsOn={1}
        className={styles.dayPicker}
      />
      <div className={styles.calendarLegend} aria-hidden="true">
        <span className={styles.legendItem}>
          <span className={styles.legendDot} />
          Times available
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendMuted} />
          Fully booked
        </span>
      </div>
      <p className={styles.calendarHint}>
        Days with a gold dot have appointment times matching your service,
        location and therapists.
      </p>
      {monthLoading ? (
        <p className={styles.monthStatus} role="status">
          Checking this month…
        </p>
      ) : null}
      {monthEmpty ? (
        <p className={styles.monthStatus} role="status">
          No available days this month — try another month.
        </p>
      ) : null}
    </div>
  );
}
