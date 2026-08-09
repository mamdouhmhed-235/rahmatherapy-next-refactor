"use client";

// C-14 Phase A, Step 7 — the shared Opens / Break(s) / Closes editor for ONE
// day (brief §4.1). Purely presentational: it owns no server state, does no
// I/O, and never saves — the parent holds the `DaySchedule` and decides what to
// do with `onChange`. Phases A, B and C all mount this same component.

import { useId } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  minutesToTime,
  scheduleToRows,
  timeToMinutes,
  validateSchedule,
  type DayBreak,
  type DaySchedule,
} from "@/lib/booking/working-hours-segments";

interface WorkingHoursDayEditorProps {
  schedule: DaySchedule;
  onChange: (next: DaySchedule) => void;
  /** Parent-level lock (e.g. a save in flight). */
  disabled?: boolean;
}

const timeInputClass =
  "h-11 w-full min-w-0 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:opacity-50 motion-reduce:transition-none";

const fieldLabelClass = "text-xs font-medium text-[var(--admin-text-muted)]";

/**
 * A new break lands in the middle of the day's last bookable stretch, so it is
 * always inside [opens, closes] and never overlaps an existing break.
 */
function nextBreak(schedule: DaySchedule): DayBreak {
  const segments = scheduleToRows(schedule).filter((row) => row.is_working_day);
  const last = segments[segments.length - 1];
  const start = last ? timeToMinutes(last.start_time) : null;
  const end = last ? timeToMinutes(last.end_time) : null;

  if (start === null || end === null) {
    return { start: schedule.opens, end: schedule.closes };
  }

  const middle = start + Math.floor((end - start) / 2);
  return {
    start: minutesToTime(Math.max(start, middle - 30)),
    end: minutesToTime(Math.min(end, middle + 30)),
  };
}

export function WorkingHoursDayEditor({
  schedule,
  onChange,
  disabled = false,
}: WorkingHoursDayEditorProps) {
  const opensId = useId();
  const closesId = useId();
  const messageId = useId();

  // A closed day keeps its hours on screen as a memo, but nothing is editable
  // until the parent toggles it back on.
  const locked = disabled || !schedule.isWorkingDay;
  const { errors, warnings } = validateSchedule(schedule);
  const segments = scheduleToRows(schedule).filter((row) => row.is_working_day);

  function patch(next: Partial<DaySchedule>) {
    onChange({ ...schedule, ...next });
  }

  function updateBreak(index: number, next: Partial<DayBreak>) {
    patch({
      breaks: schedule.breaks.map((entry, position) =>
        position === index ? { ...entry, ...next } : entry
      ),
    });
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end sm:gap-3">
        <div className="grid gap-1">
          <label htmlFor={opensId} className={fieldLabelClass}>
            Opens
          </label>
          <input
            id={opensId}
            type="time"
            value={schedule.opens}
            disabled={locked}
            aria-invalid={errors.length > 0 ? "true" : undefined}
            aria-describedby={errors.length > 0 ? messageId : undefined}
            onChange={(event) => patch({ opens: event.target.value })}
            className={timeInputClass}
          />
        </div>
        <span
          aria-hidden="true"
          className="hidden self-center pb-3 text-sm text-[var(--admin-text-muted)] sm:block"
        >
          –
        </span>
        <div className="grid gap-1">
          <label htmlFor={closesId} className={fieldLabelClass}>
            Closes
          </label>
          <input
            id={closesId}
            type="time"
            value={schedule.closes}
            disabled={locked}
            aria-invalid={errors.length > 0 ? "true" : undefined}
            aria-describedby={errors.length > 0 ? messageId : undefined}
            onChange={(event) => patch({ closes: event.target.value })}
            className={timeInputClass}
          />
        </div>
      </div>

      {schedule.breaks.length > 0 ? (
        <ul className="grid gap-2">
          {schedule.breaks.map((entry, index) => (
            <li
              // Breaks have no stable identity; the row's position is the key.
              key={index}
              className="grid gap-2 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] p-2.5 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-3"
            >
              <span className={fieldLabelClass}>Break {index + 1}</span>
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                <input
                  type="time"
                  value={entry.start}
                  disabled={locked}
                  aria-label={`Break ${index + 1} starts`}
                  onChange={(event) => updateBreak(index, { start: event.target.value })}
                  className={timeInputClass}
                />
                <span aria-hidden="true" className="text-sm text-[var(--admin-text-muted)]">
                  –
                </span>
                <input
                  type="time"
                  value={entry.end}
                  disabled={locked}
                  aria-label={`Break ${index + 1} ends`}
                  onChange={(event) => updateBreak(index, { end: event.target.value })}
                  className={timeInputClass}
                />
              </div>
              <button
                type="button"
                disabled={locked}
                aria-label={`Remove break ${index + 1}`}
                onClick={() =>
                  patch({
                    breaks: schedule.breaks.filter((_, position) => position !== index),
                  })
                }
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] px-3 text-xs font-medium text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[var(--admin-canvas)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-50 motion-reduce:transition-none"
              >
                <Trash2 className="size-3.5 shrink-0" aria-hidden="true" />
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div>
        <button
          type="button"
          disabled={locked}
          onClick={() => patch({ breaks: [...schedule.breaks, nextBreak(schedule)] })}
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] border border-dashed border-[var(--admin-border-form)] px-3 text-xs font-medium text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[var(--admin-canvas)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-50 motion-reduce:transition-none"
        >
          <Plus className="size-3.5 shrink-0" aria-hidden="true" />
          Add break
        </button>
      </div>

      {schedule.isWorkingDay ? (
        <p className="text-xs text-[var(--admin-text-muted)]">
          <span className="font-medium text-[var(--admin-body)]">Bookable:</span>{" "}
          {segments.length > 0
            ? segments
                .map((segment) => `${segment.start_time}–${segment.end_time}`)
                .join(" · ")
            : "nothing — this day has no bookable time."}
        </p>
      ) : null}

      {schedule.isWorkingDay && schedule.breaks.length > 0 ? (
        <p className="text-xs text-[var(--admin-text-muted)]">
          Existing bookings in a break window aren&rsquo;t affected.
        </p>
      ) : null}

      {errors.length > 0 ? (
        <ul
          id={messageId}
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          className={cn(
            "grid gap-1 rounded-[var(--admin-radius-control)] border border-[var(--admin-danger)]/35",
            "bg-[var(--admin-danger-bg)] px-3 py-2 text-xs text-[var(--admin-danger)]"
          )}
        >
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}

      {warnings.length > 0 ? (
        <ul
          role="status"
          aria-live="polite"
          className={cn(
            "grid gap-1 rounded-[var(--admin-radius-control)] border border-[var(--admin-warning)]/35",
            "bg-[var(--admin-warning-bg)] px-3 py-2 text-xs text-[var(--admin-warning)]"
          )}
        >
          {warnings.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
