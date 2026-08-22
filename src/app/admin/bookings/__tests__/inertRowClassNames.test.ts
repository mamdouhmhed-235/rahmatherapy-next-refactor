// ⛔ G-08-01 REGRESSION. This file exists because `opacity-75` is not a
// cosmetic choice — it decides whether the row's own actions menu is clickable.
//
// The defect: `opacity < 1` makes the row a CSS **stacking context**, which
// traps its own menu's `z-30` inside it and demotes the whole `<article>` to a
// z-0 group. A neighbouring faded row is another z-0 group and, being later in
// the DOM, paints over it — so "Mark paid" and "Cancel booking" silently
// swallowed the click, and a click could even land on the next card's `<Link>`
// and open a DIFFERENT booking.
//
// Measured on real production rows with `document.elementFromPoint`:
// 2 of 3 menu items blocked before the fix, 0 of 9 after it.
//
// ⛔ The fix is a CONDITIONAL LIFT in `BookingCard.tsx`
// (`relative [&:has([role=menu])]:z-40`), which only bites while a menu is
// open — verified: rows read `z-index: auto` closed, `40` open, `auto` again
// after Escape.
//
// ⚠️ THIS TEST DOES NOT PIN THE FIX — it pins the HAZARD. If someone reintroduces
// or changes the dimming, they should be made to read the comment above and
// re-check the menu. The repo already learned this lesson once for `transform`
// (see `globals.css`'s `.rahma-row-enter` comment) and then reopened the same
// hole through `opacity`. This is the guard that was missing both times.

import { describe, expect, it } from "vitest";
import { inertRowClassNames } from "../_helpers";

const TODAY = "2026-08-22";

describe("inertRowClassNames", () => {
  it("dims cancelled, no-show and PAST-DATED rows — all three, not just the first two", () => {
    // ⛔ The past-dated arm is the one that makes this common: every booking
    // becomes past-dated eventually, so faded rows accumulate and cluster.
    for (const booking of [
      { status: "cancelled", booking_date: TODAY },
      { status: "no_show", booking_date: TODAY },
      { status: "confirmed", booking_date: "2026-08-21" },
    ]) {
      const result = inertRowClassNames(booking, TODAY);
      expect(result.isInert, `${booking.status} @ ${booking.booking_date}`).toBe(true);
      expect(result.rowClass, `${booking.status} @ ${booking.booking_date}`).toBe(
        "opacity-75"
      );
    }
  });

  it("leaves a live booking undimmed, with no row class at all", () => {
    // ⛔ NON-VACUITY. Without this the assertions above would also pass if
    // `inertRowClassNames` simply returned `opacity-75` for everything.
    const result = inertRowClassNames(
      { status: "confirmed", booking_date: "2026-08-23" },
      TODAY
    );
    expect(result.isInert).toBe(false);
    expect(result.rowClass).toBeUndefined();
  });

  it("treats TODAY as live, not past — the boundary the whole rule turns on", () => {
    const result = inertRowClassNames({ status: "confirmed", booking_date: TODAY }, TODAY);
    expect(result.isInert, "today's booking has not happened yet").toBe(false);
  });

  it("⛔ pins the dimming to OPACITY, because that is what breaks the menu", () => {
    // ⛔ If this fails, the dimming has been changed. That may be an improvement
    // — a muted colour would remove the stacking context entirely — but it MUST
    // be re-checked against the row action menu before the string is updated
    // here. Do not simply retype the expected value.
    const result = inertRowClassNames({ status: "cancelled", booking_date: TODAY }, TODAY);
    expect(result.rowClass).toMatch(/^opacity-/);
  });

  it("strikes through the title on an inert row, and only then", () => {
    expect(
      inertRowClassNames({ status: "cancelled", booking_date: TODAY }, TODAY).titleClass
    ).toContain("line-through");
    expect(
      inertRowClassNames({ status: "confirmed", booking_date: "2026-08-23" }, TODAY)
        .titleClass
    ).toBeUndefined();
  });
});
