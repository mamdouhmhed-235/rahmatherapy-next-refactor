"use client";

// C-23 Phase C, Step 5 — the admin-only availability calendar.
//
// Presentational only: fetching lives in the Step 6 hook (use-month-availability),
// wiring both together into ManualBookingForm's three date branches is Phase D
// (out of scope here — see the C-23 plan). This component never reaches the
// network itself.
//
// Styling precedent gap (recorded per dispatch): src/app/admin/calendar/
// CalendarDatePopover.tsx is the file this component must match stylistically,
// but it uses react-day-picker with none of `disabled`, `modifiers` or
// `modifiersClassNames` — it's a plain, fully-selectable range picker. The only
// in-repo example combining those three props is the PUBLIC
// src/features/booking/components/DatePickerField.tsx, which does the two
// things this component must never do: disable whole days
// (`disabled={[{ before: today }, ...fullDates]}`) and style via a public CSS
// module (`styles.dayHasTimes`). So there is no admin-idiom precedent to copy
// for marker styling — this file builds one from `--admin-*` tokens directly:
//   - `disabled` is limited to `{ before: min }` ONLY (brief finding 3 — the
//     calendar informs, never blocks).
//   - Day colouring uses `modifiersClassNames` with Tailwind arbitrary-value
//     classes reading the same `--admin-status-*` tokens AdminStatusBadge uses
//     for "success" (confirmed/green) and "warning" (attention/amber) tones,
//     rather than a new CSS module.
//   - Non-colour encoding (gate §3.9) is two independent things: (a) a shape
//     glyph — filled circle for "available", rotated square for "partial" —
//     rendered via a custom `components.DayButton` that otherwise reproduces
//     react-day-picker's own default DayButton verbatim (including the
//     roving-focus effect; overriding the component loses that if it isn't
//     reproduced) and (b) a distinct suffix on the day's `aria-label`, added
//     by wrapping the library's own default `labelDayButton` rather than
//     reimplementing its date formatting.
//   - The calendar body itself keeps react-day-picker's default look (as
//     CalendarDatePopover does) with only `--rdp-*` custom properties nudged
//     via Tailwind arbitrary properties to line up with admin's `h-11` touch
//     target and accent colour — never a `--rahma-*` token, never a module.

import { useEffect, useId, useMemo, useRef } from "react";
import {
  DayPicker,
  labelDayButton as defaultLabelDayButton,
  type DayButtonProps,
} from "react-day-picker";
import { cn } from "@/lib/utils";

export interface CohortMarkers {
  /** "Female participants" | "Male participants" | "" (single-cohort case). */
  label: string;
  /** yyyy-MM-dd → hasSlots, for the currently-displayed month(s). */
  days: Map<string, boolean>;
}

export interface AvailabilityCalendarFieldProps {
  /** The shared bookingDate — ManualBookingForm stays the owner (Phase D). */
  value: string;
  onChange: (date: string) => void;
  /** 1 entry normally, 2 for mixed-gender. */
  cohorts: CohortMarkers[];
  loading: boolean;
  /** today, preserved as the only disabled boundary. */
  min: string;
  /**
   * Displayed month as `yyyy-MM`, passed straight through to react-day-picker's
   * own `month`. Omit (or pass an unparseable value) and month navigation stays
   * uncontrolled, exactly as before this prop existed.
   */
  month?: string;
  /**
   * Fires with the newly-displayed `yyyy-MM` when the operator pages the
   * calendar. Paging NEVER changes the selected date — only `onChange` does.
   */
  onMonthChange?: (month: string) => void;
}

type MarkerState = "available" | "partial" | "none";

// Local yyyy-MM-dd <-> Date helpers, deliberately not date-fns' parseISO/format
// (which read/write UTC and can shift a day near a timezone boundary). Mirrors
// the parseISODate/toISODate pair already in CalendarDatePopover.tsx.
function parseLocalDate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
}

function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseLocalMonth(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [, y, m] = match;
  return new Date(Number(y), Number(m) - 1, 1);
}

function toLocalMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function resolveMarkerState(dateKey: string, cohorts: CohortMarkers[]): MarkerState {
  if (cohorts.length === 0) return "none";
  let servable = 0;
  for (const cohort of cohorts) {
    if (cohort.days.get(dateKey) === true) servable += 1;
  }
  if (servable === cohorts.length) return "available";
  if (servable > 0) return "partial";
  return "none";
}

// Extends the library's own default label rather than reimplementing its date
// formatting (today/selected suffixes stay exactly as react-day-picker renders
// them); only appends the availability suffix AT users need (gate §3.9).
const labelDayButtonWithAvailability: typeof defaultLabelDayButton = (
  date,
  modifiers,
  options,
  dateLib
) => {
  const base = defaultLabelDayButton(date, modifiers, options, dateLib);
  if (modifiers.available) return `${base} — availability confirmed`;
  if (modifiers.partial) return `${base} — availability for one participant group only`;
  return base;
};

// Reproduces react-day-picker's own default DayButton (including the
// roving-focus effect that keyboard navigation depends on — losing it would
// break arrow-key movement) and adds a shape glyph so the marker isn't
// colour-only (gate §3.9).
function MarkerDayButton(props: DayButtonProps) {
  // `day` must not reach the native <button> spread below — it's a
  // CalendarDay instance, not a DOM attribute.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { day, modifiers, className, children, ...buttonProps } = props;
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  const isAvailable = modifiers.available === true;
  const isPartial = modifiers.partial === true;

  return (
    <button ref={ref} className={cn("relative", className)} {...buttonProps}>
      {children}
      {isAvailable ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[3px] left-1/2 size-[6px] -translate-x-1/2 rounded-full bg-[var(--admin-status-confirmed-text)]"
        />
      ) : null}
      {isPartial ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[3px] left-1/2 size-[6px] -translate-x-1/2 rotate-45 bg-[var(--admin-status-attention-text)]"
        />
      ) : null}
    </button>
  );
}

const dayPickerClassName = cn(
  "[--rdp-accent-color:var(--admin-primary)]",
  "[--rdp-today-color:var(--admin-primary)]",
  "[--rdp-day_button-width:2.75rem] [--rdp-day_button-height:2.75rem]",
  "[--rdp-day-width:2.75rem] [--rdp-day-height:2.75rem]"
);

export function AvailabilityCalendarField({
  value,
  onChange,
  cohorts,
  loading,
  min,
  month,
  onMonthChange,
}: AvailabilityCalendarFieldProps) {
  const legendId = useId();
  const hintId = useId();
  const minDate = parseLocalDate(min) ?? new Date();
  const selected = parseLocalDate(value);
  // undefined ⇒ react-day-picker falls back to its uncontrolled month state and
  // `defaultMonth` below, i.e. exactly the behaviour before these props existed.
  const displayedMonth = month ? parseLocalMonth(month) : undefined;

  const { availableDays, partialDays } = useMemo(() => {
    // Loading (or no data yet) means every day renders unmarked, not broken —
    // never show a previous month's stale markers while a new fetch is in
    // flight, and never invent a marker from an empty cohorts array.
    const effectiveCohorts = loading ? [] : cohorts;
    const available: Date[] = [];
    const partial: Date[] = [];
    if (effectiveCohorts.length === 0) {
      return { availableDays: available, partialDays: partial };
    }
    const allKeys = new Set<string>();
    for (const cohort of effectiveCohorts) {
      for (const key of cohort.days.keys()) allKeys.add(key);
    }
    for (const key of allKeys) {
      const date = parseLocalDate(key);
      if (!date) continue;
      const state = resolveMarkerState(key, effectiveCohorts);
      if (state === "available") available.push(date);
      else if (state === "partial") partial.push(date);
    }
    return { availableDays: available, partialDays: partial };
  }, [cohorts, loading]);

  const showPartialLegend = cohorts.length >= 2;

  return (
    <div className="grid gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-3">
      <DayPicker
        mode="single"
        selected={selected}
        onSelect={(date) => onChange(date ? toLocalDateKey(date) : "")}
        month={displayedMonth}
        onMonthChange={
          onMonthChange ? (next) => onMonthChange(toLocalMonthKey(next)) : undefined
        }
        defaultMonth={selected ?? minDate}
        weekStartsOn={1}
        disabled={[{ before: minDate }]}
        modifiers={{ available: availableDays, partial: partialDays }}
        modifiersClassNames={{
          available:
            "bg-[var(--admin-status-confirmed-bg)] text-[var(--admin-status-confirmed-text)]",
          partial:
            "bg-[var(--admin-status-attention-bg)] text-[var(--admin-status-attention-text)]",
        }}
        labels={{ labelDayButton: labelDayButtonWithAvailability }}
        components={{ DayButton: MarkerDayButton }}
        className={dayPickerClassName}
        aria-describedby={`${legendId} ${hintId}`}
      />

      {loading ? (
        <p role="status" className="text-[0.6875rem] text-[var(--admin-text-muted)]">
          Checking availability for this month…
        </p>
      ) : null}

      <div
        id={legendId}
        className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[var(--admin-border)] pt-2"
      >
        <span className="inline-flex items-center gap-1.5 text-[0.6875rem] text-[var(--admin-text-muted)]">
          <span
            aria-hidden="true"
            className="size-[6px] rounded-full bg-[var(--admin-status-confirmed-text)]"
          />
          Available
        </span>
        {showPartialLegend ? (
          <span className="inline-flex items-center gap-1.5 text-[0.6875rem] text-[var(--admin-text-muted)]">
            <span
              aria-hidden="true"
              className="size-[6px] rotate-45 bg-[var(--admin-status-attention-text)]"
            />
            Partial — only one group
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5 text-[0.6875rem] text-[var(--admin-text-muted)]">
          <span
            aria-hidden="true"
            className="size-[6px] rounded-full border border-[var(--admin-border)]"
          />
          No confirmed availability
        </span>
      </div>
      <p id={hintId} className="text-[0.6875rem] text-[var(--admin-text-muted)]">
        Every date can still be picked — marked days already have a matching
        therapist; unmarked days can be booked and claimed, or overridden.
      </p>
    </div>
  );
}
