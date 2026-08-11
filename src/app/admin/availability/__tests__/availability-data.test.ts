// C-16 Phase E Step 14 (N3) — pure banner-state resolver for the
// availability page's blocked-dates / hour-adjustments cap+view-all.
import { describe, it, expect } from "vitest";
import {
  AVAILABILITY_PAST_CAP,
  AVAILABILITY_PAST_VIEW_ALL_CAP,
  resolveAvailabilityBannerState,
  groupAndCapOverridesByDate,
} from "../availability-data";

describe("resolveAvailabilityBannerState", () => {
  it("is 'none' when nothing is hidden and not viewing all", () => {
    expect(
      resolveAvailabilityBannerState({ pastTotal: 5, pastShown: 5, viewAll: false })
    ).toEqual({ kind: "none" });
  });

  it("is 'hidden' when the default cap is truncating", () => {
    expect(
      resolveAvailabilityBannerState({
        pastTotal: AVAILABILITY_PAST_CAP + 10,
        pastShown: AVAILABILITY_PAST_CAP,
        viewAll: false,
      })
    ).toEqual({ kind: "hidden", total: AVAILABILITY_PAST_CAP + 10 });
  });

  it("is 'viewingAll' when the view-all cap covers everything", () => {
    expect(
      resolveAvailabilityBannerState({
        pastTotal: AVAILABILITY_PAST_CAP + 10,
        pastShown: AVAILABILITY_PAST_CAP + 10,
        viewAll: true,
      })
    ).toEqual({ kind: "viewingAll", total: AVAILABILITY_PAST_CAP + 10 });
  });

  it("SABOTAGE TARGET — is 'cappedOut', not 'hidden', once view-all itself is truncating", () => {
    // The exact bug shape that shipped twice before this plan (privacy's
    // notes rail, then password-requests): already viewing all AND the true
    // total exceeds the view-all cap. If `hidden` were checked first, this
    // would return `hidden` pointing back at the same already-active
    // view-all state — a dead "view all" link.
    const result = resolveAvailabilityBannerState({
      pastTotal: AVAILABILITY_PAST_VIEW_ALL_CAP + 30,
      pastShown: AVAILABILITY_PAST_VIEW_ALL_CAP,
      viewAll: true,
    });
    expect(result).toEqual({
      kind: "cappedOut",
      total: AVAILABILITY_PAST_VIEW_ALL_CAP + 30,
    });
  });

  it("cappedOut takes priority even when hidden's condition also holds", () => {
    // pastTotal > pastShown is ALSO true in the cappedOut case above —
    // proving branch ORDER (cappedOut before hidden), not just that each
    // condition independently exists.
    const result = resolveAvailabilityBannerState({
      pastTotal: AVAILABILITY_PAST_VIEW_ALL_CAP + 1,
      pastShown: AVAILABILITY_PAST_VIEW_ALL_CAP,
      viewAll: true,
    });
    expect(result.kind).toBe("cappedOut");
  });
});


// ---------------------------------------------------------------------------
// Item 6 — adjustment lists count and cap by DATE, not by segment row.
//
// C-14 Phase C dropped the unique constraint on `override_date`, so an adjusted
// date is now 1+ rows. Before this, "25 past adjustments" could mean as few as
// ~8 actual dates, and a .limit() boundary could fall MID-DATE, rendering a day
// with only some of its hours.
// ---------------------------------------------------------------------------

/** Two segments on 03 Jan, one on 02 Jan, three on 01 Jan — 3 dates, 6 rows. */
const ROWS = [
  { id: "a", override_date: "2099-01-03", start_time: "08:00:00" },
  { id: "b", override_date: "2099-01-03", start_time: "15:00:00" },
  { id: "c", override_date: "2099-01-02", start_time: "09:00:00" },
  { id: "d", override_date: "2099-01-01", start_time: "08:00:00" },
  { id: "e", override_date: "2099-01-01", start_time: "12:00:00" },
  { id: "f", override_date: "2099-01-01", start_time: "17:00:00" },
];

describe("groupAndCapOverridesByDate", () => {
  it("counts a date with three segments as ONE toward the total, not three", () => {
    const { dateTotal } = groupAndCapOverridesByDate(ROWS, { rowTotal: ROWS.length });

    expect(dateTotal).toEqual({ kind: "exact", value: 3 });
  });

  it("caps by DATE, keeping every row of each kept date", () => {
    const { flattenedRows, dateTotal } = groupAndCapOverridesByDate(ROWS, {
      dateCap: 2,
      rowTotal: ROWS.length,
    });

    // 2 dates kept = 3 rows (03 Jan's two + 02 Jan's one), not 2 rows.
    expect(flattenedRows.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(dateTotal).toEqual({ kind: "exact", value: 3 });
  });

  it("never splits a date's segments across the cap boundary", () => {
    // A row-based cap of 1 would have returned only "a", orphaning "b" and
    // rendering 03 Jan as if 08:00 were the whole day.
    const { flattenedRows } = groupAndCapOverridesByDate(ROWS, { dateCap: 1, rowTotal: ROWS.length });

    expect(flattenedRows.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("keeps every date when no dateCap is given", () => {
    const { flattenedRows, dateTotal } = groupAndCapOverridesByDate(ROWS, { rowTotal: ROWS.length });

    expect(flattenedRows).toHaveLength(6);
    expect(dateTotal.value).toBe(3);
  });

  it("reports an EXACT total when the fetch was complete", () => {
    const { dateTotal } = groupAndCapOverridesByDate(ROWS, { rowTotal: ROWS.length });

    expect(dateTotal.kind).toBe("exact");
  });

  it("reports a LOWER BOUND when the row ceiling truncated the fetch", () => {
    // The exact row count says 9 rows match the filter; only 6 came back, so
    // the ceiling truncated and there may be dates we never saw. Reporting 3 as
    // exact here is the invisible undercount this whole item exists to prevent.
    const { dateTotal } = groupAndCapOverridesByDate(ROWS, { rowTotal: 9 });

    expect(dateTotal).toEqual({ kind: "atLeast", value: 3 });
  });

  it("does not claim saturation when the row count merely equals what came back", () => {
    // Guards the boundary: `>` not `>=`. A complete fetch must never be
    // downgraded to a lower bound, or every list would render "N+" forever.
    const { dateTotal } = groupAndCapOverridesByDate(ROWS, { rowTotal: ROWS.length });

    expect(dateTotal.kind).toBe("exact");
  });

  it("saturates independently of the date cap", () => {
    const { dateTotal } = groupAndCapOverridesByDate(ROWS, { dateCap: 1, rowTotal: 9 });

    // Capping to 1 date does not make the total exact — the truncation is a
    // property of the FETCH, not of how many dates we chose to display.
    expect(dateTotal).toEqual({ kind: "atLeast", value: 3 });
  });
});
