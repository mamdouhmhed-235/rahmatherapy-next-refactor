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

export const AVAILABILITY_PAST_CAP = 25;
export const AVAILABILITY_PAST_VIEW_ALL_CAP = 200;
/** Defensive-only — see file header. Never paginated. */
export const AVAILABILITY_UPCOMING_DEFENSIVE_CAP = 500;

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
