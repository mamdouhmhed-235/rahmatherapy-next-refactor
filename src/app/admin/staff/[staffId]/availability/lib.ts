export function formatDateLong(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateFull(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatTime(value: string): string {
  return value.slice(0, 5);
}

export const DAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Cancelled-family text colour token (replaces repeated raw oklch literals). */
export const CANCELLED_TEXT = "text-[oklch(26%_0.14_25)]";
export const CANCELLED_BORDER = "border-[oklch(26%_0.14_25)]";
export const CANCELLED_BG_SOFT = "bg-[oklch(95.5%_0.028_20)]";

/** Pending-family tokens (overrides soft warning). */
export const PENDING_TEXT = "text-[oklch(28%_0.120_55)]";
export const PENDING_BORDER = "border-[oklch(80%_0.07_75)]";
export const PENDING_BG_SOFT = "bg-[oklch(96.0%_0.038_75)]";

/** Restricted-family tokens (inactive banner). */
export const RESTRICTED_TEXT = "text-[oklch(30%_0.020_280)]";
export const RESTRICTED_BG_SOFT = "bg-[oklch(94.0%_0.008_280)]";

/** Confirmed-family soft tint (new-row highlight). */
export const CONFIRMED_BG_SOFT = "bg-[oklch(93.5%_0.038_155)]";

// C-16 Phase E Step 14 (finding N4 — Owner-approved extension,
// per-page-progress §1 row 3 / §2). `StaffBlockedDatesManager` and
// `StaffAvailabilityOverridesManager` already split upcoming/past with a
// closed-by-default `<details>` for past (the restructure half of this
// finding was already in place) — but the query behind `blockedDates` /
// `overrides` had NO bound at all (`.eq("staff_id", staffId)`, no
// `.limit()`, no date filter): the disclosure only ever hid page-level
// sprawl, never bounded the list itself once opened. This adds the missing
// cap+view-all half: `past` is now a capped/counted window, not the full
// unbounded fetch.
//
// Duplicated (not imported) from `src/app/admin/availability/availability-data.ts`,
// which solves the identical shape for the clinic-wide `blocked_dates` /
// `availability_overrides` tables — the two directory trees already keep
// independent Manager components (this step doesn't introduce new
// cross-tree coupling).
/**
 * Counts DATES, not rows. C-14 Phase C dropped the unique constraint on
 * (staff_id, override_date), so an adjusted date is now 1+ rows. Staff
 * blocked-dates consumers are unaffected — that table still has one row per date.
 */
export const STAFF_AVAILABILITY_PAST_CAP = 25;
/** See STAFF_AVAILABILITY_PAST_CAP above — same DATES-not-rows distinction. */
export const STAFF_AVAILABILITY_PAST_VIEW_ALL_CAP = 200;
/** Defensive-only — see comment above. Never paginated. */
export const STAFF_AVAILABILITY_UPCOMING_DEFENSIVE_CAP = 500;
/**
 * Row-fetch ceiling for the past-overrides query — NOT a displayed cap.
 * STAFF_AVAILABILITY_PAST_VIEW_ALL_CAP (200 dates) x 4 segments-per-date = 800.
 * The per-staff filter (.eq("staff_id", ...)) narrows the row set further, so
 * this is if anything more generous here than in the clinic-wide tree.
 * Saturation, not this number, is what makes the design safe — see
 * groupAndCapStaffOverridesByDate.
 */
export const STAFF_AVAILABILITY_PAST_ROW_FETCH_CEILING = 800;

export type StaffDateTotal =
  | { kind: "exact"; value: number }
  | { kind: "atLeast"; value: number };

/**
 * Staff-tree twin of availability-data.ts's groupAndCapOverridesByDate.
 *
 * ⚠️ DELIBERATELY DUPLICATED, NOT IMPORTED. This file's header records that the
 * two directory trees keep independent Managers and helpers on purpose; sharing
 * this would introduce exactly the cross-tree coupling that choice avoids.
 *
 * Groups rows by `override_date`, keeps the first `dateCap` distinct dates
 * (whole dates only — the flatten is a set-membership filter, so a date is never
 * split across the cap boundary), and flattens back to rows. Omit `dateCap` to
 * keep every date. If `rowTotal` exceeds `rows.length` the fetch was truncated
 * by its row ceiling, so `dateTotal` is a LOWER BOUND and callers must render it
 * as "N+", never as an exact figure.
 */
export function groupAndCapStaffOverridesByDate<T extends { override_date: string }>(
  rows: T[],
  opts: { dateCap?: number; rowTotal: number }
): { flattenedRows: T[]; dateTotal: StaffDateTotal } {
  const { dateCap, rowTotal } = opts;
  const saturated = rowTotal > rows.length;

  const datesInOrder: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!seen.has(row.override_date)) {
      seen.add(row.override_date);
      datesInOrder.push(row.override_date);
    }
  }

  const keptDates = new Set(
    dateCap === undefined ? datesInOrder : datesInOrder.slice(0, dateCap)
  );
  const flattenedRows = rows.filter((row) => keptDates.has(row.override_date));

  return {
    flattenedRows,
    dateTotal: saturated
      ? { kind: "atLeast", value: datesInOrder.length }
      : { kind: "exact", value: datesInOrder.length },
  };
}

export type StaffAvailabilityBannerState =
  | { kind: "none" }
  | { kind: "hidden"; total: number }
  | { kind: "cappedOut"; total: number }
  | { kind: "viewingAll"; total: number };

/**
 * Mirrors `resolveAvailabilityBannerState`
 * (admin/availability/availability-data.ts) and privacy's `cappedOut`
 * distinction (commit 6faf895): `cappedOut` is evaluated BEFORE `hidden` so
 * "view all N" never promises a link that can't deliver once the true total
 * exceeds the view-all cap itself — the bug that shipped twice already on
 * this plan.
 */
export function resolveStaffAvailabilityBannerState(params: {
  pastTotal: number;
  pastShown: number;
  viewAll: boolean;
}): StaffAvailabilityBannerState {
  const { pastTotal, pastShown, viewAll } = params;
  if (viewAll && pastTotal > STAFF_AVAILABILITY_PAST_VIEW_ALL_CAP) {
    return { kind: "cappedOut", total: pastTotal };
  }
  if (pastTotal > pastShown) {
    return { kind: "hidden", total: pastTotal };
  }
  if (viewAll && pastTotal > STAFF_AVAILABILITY_PAST_CAP) {
    return { kind: "viewingAll", total: pastTotal };
  }
  return { kind: "none" };
}
