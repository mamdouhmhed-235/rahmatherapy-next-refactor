// SERVER + CLIENT — pure constants/helpers only (no I/O), for
// /admin/availability (C-16 Phase E Step 14, findings N3/N4 — Owner-approved
// extension, per-page-progress §1 row 3 / §2).
//
// FINDING: `BlockedDatesManager` and `AvailabilityOverridesManager` each read
// their whole table (`availability/page.tsx:124-131`, pre-Step-14) — no
// `.limit()`/`.range()` of any kind — and rendered every row in one unbroken
// list. 0 rows in production today is what masked this; the inventory
// projects ~50-150 blocked dates and ~25-100 overrides over 5 years (bank
// holidays, Eid, staff training, ad hoc closures/adjustments — brief §1.1
// methodology).
//
// VERDICT — restructure AND cap+view-all, applied together:
//  - RESTRUCTURE: an upcoming/past split (upcoming always rendered in full;
//    past behind a closed-by-default `<details>`), matching the pattern
//    staff/[staffId]/availability's Manager pair already used for the
//    equivalent per-staff tables (N4) — that pattern's OWN gap (the query
//    behind it had no bound at all, so the disclosure only ever hid
//    page-level sprawl, never bounded the list itself once opened) is what
//    this step also closes, on both trees.
//  - CAP+VIEW-ALL: `upcoming` gets a DEFENSIVE cap only, never a pager —
//    business reality bounds it (a clinic doesn't pre-schedule hundreds of
//    future closures; a defensive ceiling here is the SCOPED_BRANCH_ROW_CAP /
//    PRIVACY_NOTES_VIEW_ALL_CAP precedent: "a defensive ceiling, not a truly
//    unbounded read"). `past` gets a REAL cap+view-all: `PAST_CAP` by
//    default, `PAST_VIEW_ALL_CAP` once the operator asks to see more, with
//    the true past total always surfaced — same shape as privacy's
//    sensitive-notes rail (C-16 Step 10, commit 6faf895).
//
// The current-week capacity grid (`CapacityPreview` in page.tsx) needs every
// closure/adjustment falling inside the CURRENT Mon-Sun week regardless of
// this split — that week can start up to 6 days before "today", which could
// otherwise fall inside the capped `past` bucket. page.tsx runs a THIRD,
// dedicated query scoped to exactly `[weekStart, weekEnd]` for that grid
// (naturally ≤7 rows, no cap needed) rather than trying to derive weekly
// coverage from the upcoming/past split.
//
// Same shape duplicated (not shared) in
// staff/[staffId]/availability/lib.ts for the per-staff tables — the two
// directory trees already keep independent Manager components (BlockedDatesManager
// vs StaffBlockedDatesManager), and this step doesn't introduce new
// cross-tree coupling.

/**
 * For hour-adjustment ("override") consumers this counts DATES, not rows.
 * C-14 Phase C dropped the unique constraint on `override_date`, so an
 * adjusted date is now 1+ rows (one per bookable segment). For blocked-dates
 * consumers (BlockedDatesManager) rows and dates are still identical —
 * `blocked_dates` was not touched by that migration — so the same value and
 * meaning continues to apply there unchanged.
 */
export const AVAILABILITY_PAST_CAP = 25;
/** See AVAILABILITY_PAST_CAP above — same DATES-not-rows distinction. */
export const AVAILABILITY_PAST_VIEW_ALL_CAP = 200;
/** Defensive-only — see file header. Never paginated. */
export const AVAILABILITY_UPCOMING_DEFENSIVE_CAP = 500;
/**
 * Row-fetch ceiling for the past-overrides query — NOT a displayed cap.
 * The caps above count DATES; a date is now 1+ rows, so the query must fetch
 * more ROWS than the largest date cap needs for grouping-then-slicing in code
 * to still find that many distinct dates.
 *
 * Arithmetic: AVAILABILITY_PAST_VIEW_ALL_CAP (200 dates) x 4 segments-per-date
 * = 800. Four is already generous — most adjusted dates are one segment and a
 * handful have a single lunch break, i.e. two.
 *
 * Note this leaves zero slack at exactly 200x4. That is acceptable BECAUSE the
 * saturation flag, not this number, is what makes the design safe: if the
 * ceiling truncates, groupAndCapOverridesByDate reports `atLeast` and the UI
 * renders a lower bound rather than a wrong exact figure. If this ever fires
 * at real volume it is a signal to re-evaluate with the Owner, not to silently
 * raise the number.
 */
export const AVAILABILITY_PAST_ROW_FETCH_CEILING = 800;

export type DateTotal =
  | { kind: "exact"; value: number }
  | { kind: "atLeast"; value: number };

/**
 * Groups override rows by `override_date`, keeps only the first `dateCap`
 * distinct dates, and flattens back to rows in their original order. Omit
 * `dateCap` to keep every date found (the upcoming bucket has no date cap).
 *
 * A date is kept or dropped WHOLE: `keptDates` is a set of dates and the
 * flatten is a membership filter, so there is no code path that keeps some
 * but not all of one date's rows. That is the "never split a date across the
 * cap boundary" guarantee, structural rather than incidental.
 *
 * `rowTotal` must be the exact `count: "exact", head: true` row count for the
 * SAME filter `rows` was fetched under. If it exceeds `rows.length` the fetch
 * was truncated by its row ceiling, so more dates may exist among rows that
 * were never read — `dateTotal` is then a LOWER BOUND and callers must render
 * it as one, never as a plain number.
 *
 * `rows` must already be ordered by `override_date` (ties broken by
 * `start_time` — see item 3). Both callers provide that.
 *
 * Distinct from, and NOT to be merged with:
 *  - AvailabilityOverridesManager's private `groupByDate`, which builds
 *    OverrideDay[] for RENDERING and runs after this, on `flattenedRows`;
 *  - page.tsx's `groupOverridesByDate`, which feeds only the current-week
 *    capacity chip and has no capping or saturation concept.
 */
export function groupAndCapOverridesByDate<T extends { override_date: string }>(
  rows: T[],
  opts: { dateCap?: number; rowTotal: number }
): { flattenedRows: T[]; dateTotal: DateTotal } {
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

export type AvailabilityBannerState =
  | { kind: "none" }
  | { kind: "hidden"; total: number }
  | { kind: "cappedOut"; total: number }
  | { kind: "viewingAll"; total: number };

/**
 * Mirrors `resolvePasswordRequestsBannerState`
 * (account-password-requests/page.tsx, commit 6fa19ce) and privacy's
 * `cappedOut` distinction (commit 6faf895): `cappedOut` is evaluated BEFORE
 * `hidden` so "view all N" never promises a link that can't deliver once the
 * true total exceeds the view-all cap itself — the bug that shipped twice
 * already on this plan.
 */
export function resolveAvailabilityBannerState(params: {
  pastTotal: number;
  pastShown: number;
  viewAll: boolean;
}): AvailabilityBannerState {
  const { pastTotal, pastShown, viewAll } = params;
  if (viewAll && pastTotal > AVAILABILITY_PAST_VIEW_ALL_CAP) {
    return { kind: "cappedOut", total: pastTotal };
  }
  if (pastTotal > pastShown) {
    return { kind: "hidden", total: pastTotal };
  }
  if (viewAll && pastTotal > AVAILABILITY_PAST_CAP) {
    return { kind: "viewingAll", total: pastTotal };
  }
  return { kind: "none" };
}
