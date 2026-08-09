// C-14 Phase A, Step 6 — the segments storage model for granular working hours.
//
// A break is NOT a column and NOT a new table: it is the GAP BETWEEN two
// bookable segment rows in the existing `availability_rules` /
// `staff_availability_rules` tables (and, from Phase C, the override tables).
//
//   working day, no breaks  -> 1 row,  is_working_day: true
//   working day, one break  -> 2 rows, is_working_day: true
//   working day, two breaks -> 3 rows, is_working_day: true
//   closed day              -> 1 row,  is_working_day: false (keeps the hours)
//
// Why this needs no slot-engine change: `getRuleWindowsForDay` in
// `src/lib/booking/availability.ts` filters a day's rows by `day_of_week` +
// `is_working_day` and returns an ARRAY of windows via `normalizeWindows`, and
// `containsWindow` only offers a slot that fits inside ONE window — so a slot
// spanning the gap fits none of them. The rows built here are exactly the
// `{ start_time, end_time, is_working_day }` shape those functions already
// consume; the caller adds the row's `day_of_week` (or `override_date`) key.
//
// Pure functions only: no I/O, no React, no `Date`. Times are wall-clock
// "HH:MM" strings, never instants.

export interface DayBreak {
  start: string;
  end: string;
}

export interface DaySchedule {
  isWorkingDay: boolean;
  /** "08:00" — the first bookable minute of the day. */
  opens: string;
  /** "20:00" — the last bookable minute of the day. */
  closes: string;
  breaks: DayBreak[];
}

/** One stored segment. `day_of_week` / `override_date` belong to the caller. */
export interface SegmentRow {
  start_time: string;
  end_time: string;
  is_working_day: boolean;
}

export interface ScheduleValidation {
  errors: string[];
  warnings: string[];
}

/** Mirrors `availability.ts`'s TIME_PATTERN — "HH:MM" or "HH:MM:SS". */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

/** Fallback hours, matching `AvailabilityRulesManager`'s existing defaults. */
export const DEFAULT_OPENS = "09:00";
export const DEFAULT_CLOSES = "18:00";

/**
 * Bookable stretches shorter than this warn (not block) — it is the engine's
 * SLOT_STEP_MINS, so nothing shorter can ever hold a slot. Plan Q9.6.
 */
export const MIN_BOOKABLE_SEGMENT_MINS = 30;

/** "08:30" | "08:30:00" -> 510. Anything else -> null. */
export function timeToMinutes(value: string): number | null {
  if (typeof value !== "string" || !TIME_PATTERN.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

/** 510 -> "08:30". */
export function minutesToTime(value: number): string {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

interface Span {
  start: number;
  end: number;
}

/**
 * Rows -> sorted positive-length spans, dropping exactly what
 * `normalizeWindows` drops (unparseable times, `end <= start`) so the editor
 * can never show a window the slot engine would not honour.
 */
function toSpans(rows: Array<{ start_time: string; end_time: string }>): Span[] {
  return rows
    .flatMap((row): Span[] => {
      const start = timeToMinutes(row.start_time);
      const end = timeToMinutes(row.end_time);
      return start !== null && end !== null && end > start ? [{ start, end }] : [];
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

/**
 * Stored segment rows for ONE day -> the schedule the editor renders.
 *
 * Overlapping or adjacent segments collapse into a single stretch, so only
 * genuine gaps become breaks.
 */
export function rowsToSchedule(rows: SegmentRow[]): DaySchedule {
  const working = toSpans(rows.filter((row) => row.is_working_day));

  if (working.length > 0) {
    const breaks: DayBreak[] = [];
    let cursor = working[0].end;

    for (const span of working.slice(1)) {
      if (span.start > cursor) {
        breaks.push({
          start: minutesToTime(cursor),
          end: minutesToTime(span.start),
        });
      }
      cursor = Math.max(cursor, span.end);
    }

    return {
      isWorkingDay: true,
      opens: minutesToTime(working[0].start),
      closes: minutesToTime(cursor),
      breaks,
    };
  }

  // Closed: the `is_working_day: false` row preserves the last-used hours so
  // toggling the day back on restores them (brief §5.2).
  const closed = toSpans(rows);
  if (closed.length > 0) {
    return {
      isWorkingDay: false,
      opens: minutesToTime(closed[0].start),
      closes: minutesToTime(Math.max(...closed.map((span) => span.end))),
      breaks: [],
    };
  }

  return {
    isWorkingDay: false,
    opens: DEFAULT_OPENS,
    closes: DEFAULT_CLOSES,
    breaks: [],
  };
}

/**
 * The editor's schedule -> the rows to persist for that day, in ascending time
 * order.
 *
 * Zero-length segments are dropped (a break butting against `opens`, `closes`
 * or another break does not produce a row), which also means a working day
 * whose breaks swallow the whole day yields NO rows — `validateSchedule`
 * reports that as an error so a save can never reach here.
 */
export function scheduleToRows(schedule: DaySchedule): SegmentRow[] {
  const opens = timeToMinutes(schedule.opens);
  const closes = timeToMinutes(schedule.closes);

  if (!schedule.isWorkingDay) {
    return [
      {
        start_time: opens === null ? DEFAULT_OPENS : minutesToTime(opens),
        end_time: closes === null ? DEFAULT_CLOSES : minutesToTime(closes),
        is_working_day: false,
      },
    ];
  }

  if (opens === null || closes === null || closes <= opens) return [];

  const gaps = schedule.breaks
    .flatMap((entry): Span[] => {
      const start = timeToMinutes(entry.start);
      const end = timeToMinutes(entry.end);
      if (start === null || end === null || end <= start) return [];
      // Clamped so an out-of-range break still yields a sane preview while
      // validateSchedule flags it.
      const clamped = {
        start: Math.min(Math.max(start, opens), closes),
        end: Math.min(Math.max(end, opens), closes),
      };
      return clamped.end > clamped.start ? [clamped] : [];
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const rows: SegmentRow[] = [];
  let cursor = opens;

  for (const gap of gaps) {
    if (gap.start > cursor) {
      rows.push({
        start_time: minutesToTime(cursor),
        end_time: minutesToTime(gap.start),
        is_working_day: true,
      });
    }
    cursor = Math.max(cursor, gap.end);
  }

  if (closes > cursor) {
    rows.push({
      start_time: minutesToTime(cursor),
      end_time: minutesToTime(closes),
      is_working_day: true,
    });
  }

  return rows;
}

/**
 * Hard errors block a save; warnings do not (brief §4.2). A closed day has
 * nothing to validate — its stored hours are only a memo for re-opening.
 */
export function validateSchedule(schedule: DaySchedule): ScheduleValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!schedule.isWorkingDay) return { errors, warnings };

  const opens = timeToMinutes(schedule.opens);
  const closes = timeToMinutes(schedule.closes);

  if (opens === null || closes === null) {
    errors.push("Set an opening and a closing time, or close the day.");
    return { errors, warnings };
  }

  if (closes <= opens) {
    errors.push("The closing time has to be after the opening time.");
    return { errors, warnings };
  }

  const parsed = schedule.breaks.map((entry, index) => ({
    label: `Break ${index + 1}`,
    start: timeToMinutes(entry.start),
    end: timeToMinutes(entry.end),
  }));

  for (const entry of parsed) {
    if (entry.start === null || entry.end === null) {
      errors.push(`${entry.label} needs a start and an end time.`);
      continue;
    }
    if (entry.end <= entry.start) {
      errors.push(`${entry.label} has to end after it starts.`);
      continue;
    }
    if (entry.start < opens || entry.end > closes) {
      errors.push(
        `${entry.label} has to sit between ${minutesToTime(opens)} and ${minutesToTime(closes)}.`
      );
    }
  }

  const usable = parsed
    .flatMap((entry) =>
      entry.start !== null && entry.end !== null && entry.end > entry.start
        ? [{ label: entry.label, start: entry.start, end: entry.end }]
        : []
    )
    .sort((a, b) => a.start - b.start || a.end - b.end);

  for (let index = 1; index < usable.length; index += 1) {
    if (usable[index].start < usable[index - 1].end) {
      errors.push(`${usable[index - 1].label} and ${usable[index].label} overlap.`);
    }
  }

  if (errors.length > 0) return { errors, warnings };

  const segments = scheduleToRows(schedule).filter((row) => row.is_working_day);

  if (segments.length === 0) {
    errors.push("The breaks cover the whole day — there is no bookable time left.");
    return { errors, warnings };
  }

  for (const segment of segments) {
    const start = timeToMinutes(segment.start_time) ?? 0;
    const end = timeToMinutes(segment.end_time) ?? 0;
    const span = end - start;
    if (span < MIN_BOOKABLE_SEGMENT_MINS) {
      warnings.push(
        `The ${span}-minute stretch from ${segment.start_time} to ${segment.end_time} is too short for most services to book.`
      );
    }
  }

  return { errors, warnings };
}
