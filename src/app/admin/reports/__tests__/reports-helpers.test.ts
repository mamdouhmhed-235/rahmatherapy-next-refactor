// B-4 step 1 specs — pure helpers extracted from page.tsx + the new
// formatRangeLabel derivation used by the upcoming ScopePill.

import { describe, expect, it } from "vitest";
import {
  PAYMENT_OPTIONS,
  RANGE_OPTIONS,
  buildActiveFilterChips,
  buildDailySeries,
  formatRangeLabel,
  getStaffWorkloadWithStatus,
  tilesForScope,
  validateFarFutureDate,
} from "../reports-helpers";
import type { NoShowRate, ReportAssignment, ReportFilters, UtilisationRate } from "../reporting";

const STAFF_FIXTURE = [
  { id: "staff-1", name: "Aisha Hassan" },
  { id: "staff-2", name: "Mariam Yusuf" },
];

const EMPTY_FILTERS = {
  range: "month",
  from: "",
  to: "",
  staffId: "",
  source: "",
  paymentStatus: "",
};

describe("RANGE_OPTIONS", () => {
  it("preserves the 5 pre-B-4 entries verbatim (lifetime, year, month, week, custom)", () => {
    expect(RANGE_OPTIONS.map((opt) => opt.value)).toEqual([
      "lifetime",
      "year",
      "month",
      "week",
      "custom",
    ]);
  });
});

describe("PAYMENT_OPTIONS", () => {
  it("includes the empty-default 'Any payment' option for the select control", () => {
    expect(PAYMENT_OPTIONS[0]).toEqual({ value: "", label: "Any payment" });
  });
  // C-04a: refunded + waived were never in the canonical PAYMENT_STATUSES
  // (["paid", "unpaid"]) — selecting them always returned zero rows. Removed.
  it("covers the 2 real payment statuses (paid, unpaid)", () => {
    expect(PAYMENT_OPTIONS.slice(1).map((opt) => opt.value)).toEqual(["paid", "unpaid"]);
  });
});

describe("validateFarFutureDate", () => {
  it("returns null when both inputs are empty", () => {
    expect(validateFarFutureDate("", "")).toBeNull();
  });

  it("returns null when dates are within the 5-year horizon", () => {
    const today = new Date();
    const next_year = `${today.getFullYear() + 1}-06-15`;
    expect(validateFarFutureDate(next_year, next_year)).toBeNull();
  });

  it("returns the warning string when either date is more than 5 years out", () => {
    const today = new Date();
    const far_future = `${today.getFullYear() + 10}-01-01`;
    expect(validateFarFutureDate(far_future, "")).toContain("outside the supported range");
  });

  it("ignores empty strings on one side and only validates the populated side", () => {
    const today = new Date();
    const far_future = `${today.getFullYear() + 10}-01-01`;
    expect(validateFarFutureDate("", far_future)).toContain("outside the supported range");
  });
});

describe("buildActiveFilterChips", () => {
  it("returns an empty array for the implicit-default monthly view", () => {
    const chips = buildActiveFilterChips({ filters: EMPTY_FILTERS, staff: STAFF_FIXTURE });
    expect(chips).toEqual([]);
  });

  it("emits a Range chip for any non-month range", () => {
    const chips = buildActiveFilterChips({
      filters: { ...EMPTY_FILTERS, range: "week" },
      staff: STAFF_FIXTURE,
    });
    expect(chips).toEqual([{ id: "range", label: "Range", value: "Weekly" }]);
  });

  it("emits both From and To chips when range is custom and both dates are set", () => {
    const chips = buildActiveFilterChips({
      filters: { ...EMPTY_FILTERS, range: "custom", from: "2026-05-01", to: "2026-05-15" },
      staff: STAFF_FIXTURE,
    });
    expect(chips.map((c) => c.id)).toEqual(["range", "from", "to"]);
    expect(chips.find((c) => c.id === "from")?.value).toBe("2026-05-01");
    expect(chips.find((c) => c.id === "to")?.value).toBe("2026-05-15");
  });

  it("resolves staffId to the staff display name when found in the roster", () => {
    const chips = buildActiveFilterChips({
      filters: { ...EMPTY_FILTERS, staffId: "staff-1" },
      staff: STAFF_FIXTURE,
    });
    expect(chips).toEqual([{ id: "staffId", label: "Staff", value: "Aisha Hassan" }]);
  });

  it("falls back to the raw staffId when the roster has no match", () => {
    const chips = buildActiveFilterChips({
      filters: { ...EMPTY_FILTERS, staffId: "unknown-id" },
      staff: STAFF_FIXTURE,
    });
    expect(chips).toEqual([{ id: "staffId", label: "Staff", value: "unknown-id" }]);
  });

  it("emits a paymentStatus chip with the human label from PAYMENT_OPTIONS", () => {
    const chips = buildActiveFilterChips({
      filters: { ...EMPTY_FILTERS, paymentStatus: "unpaid" },
      staff: STAFF_FIXTURE,
    });
    expect(chips).toEqual([{ id: "paymentStatus", label: "Payment", value: "Outstanding" }]);
  });

  it("emits a source chip with the raw source value", () => {
    const chips = buildActiveFilterChips({
      filters: { ...EMPTY_FILTERS, source: "website" },
      staff: STAFF_FIXTURE,
    });
    expect(chips).toEqual([{ id: "source", label: "Source", value: "website" }]);
  });

  it("preserves chip order: range, from, to, staff, source, payment", () => {
    const chips = buildActiveFilterChips({
      filters: {
        range: "custom",
        from: "2026-05-01",
        to: "2026-05-15",
        staffId: "staff-1",
        source: "website",
        paymentStatus: "paid",
      },
      staff: STAFF_FIXTURE,
    });
    expect(chips.map((c) => c.id)).toEqual([
      "range",
      "from",
      "to",
      "staffId",
      "source",
      "paymentStatus",
    ]);
  });
});

describe("formatRangeLabel", () => {
  it("returns the RANGE_OPTIONS label for static ranges (lifetime, year, month, week)", () => {
    expect(formatRangeLabel({ range: "lifetime", from: "", to: "" })).toBe("Lifetime");
    expect(formatRangeLabel({ range: "year", from: "", to: "" })).toBe("Yearly");
    expect(formatRangeLabel({ range: "month", from: "", to: "" })).toBe("Monthly");
    expect(formatRangeLabel({ range: "week", from: "", to: "" })).toBe("Weekly");
  });

  it("formats a custom window with both dates as 'from – to'", () => {
    expect(formatRangeLabel({ range: "custom", from: "2026-05-01", to: "2026-05-15" })).toBe(
      "2026-05-01 – 2026-05-15"
    );
  });

  it("handles a one-sided custom window with 'From {from}'", () => {
    expect(formatRangeLabel({ range: "custom", from: "2026-05-01", to: "" })).toBe(
      "From 2026-05-01"
    );
  });

  it("handles a one-sided custom window with 'Through {to}'", () => {
    expect(formatRangeLabel({ range: "custom", from: "", to: "2026-05-15" })).toBe(
      "Through 2026-05-15"
    );
  });

  it("returns 'Custom' when range=custom with no dates set", () => {
    expect(formatRangeLabel({ range: "custom", from: "", to: "" })).toBe("Custom");
  });

  it("falls back to 'Monthly' for any unknown range value", () => {
    expect(formatRangeLabel({ range: "garbage", from: "", to: "" })).toBe("Monthly");
  });
});

describe("buildDailySeries", () => {
  const ANCHOR = "2026-05-12";
  // Window for days=5 anchored at 2026-05-12:
  //   idx 0 → 2026-05-08, idx 1 → 2026-05-09, idx 2 → 2026-05-10,
  //   idx 3 → 2026-05-11, idx 4 → 2026-05-12 (today).

  it("returns an all-zero array of length `days` when items is empty", () => {
    const series = buildDailySeries<{ date: string }>(
      [],
      (item) => item.date,
      () => 1,
      5,
      ANCHOR
    );
    expect(series).toEqual([0, 0, 0, 0, 0]);
  });

  it("places one count per item at the right index, with index days-1 = anchor day", () => {
    const series = buildDailySeries(
      [{ date: "2026-05-12" }, { date: "2026-05-10" }, { date: "2026-05-08" }],
      (item) => item.date,
      () => 1,
      5,
      ANCHOR
    );
    expect(series).toEqual([1, 0, 1, 0, 1]);
  });

  it("aggregates multiple items in the same bucket via getValue", () => {
    const series = buildDailySeries(
      [
        { date: "2026-05-12", amount: 100 },
        { date: "2026-05-12", amount: 50 },
        { date: "2026-05-11", amount: 25 },
      ],
      (item) => item.date,
      (item) => item.amount,
      5,
      ANCHOR
    );
    expect(series[4]).toBe(150);
    expect(series[3]).toBe(25);
  });

  it("ignores items outside the window (older or future)", () => {
    const series = buildDailySeries(
      [{ date: "2026-04-01" }, { date: "2026-06-01" }, { date: "2026-05-10" }],
      (item) => item.date,
      () => 1,
      5,
      ANCHOR
    );
    expect(series).toEqual([0, 0, 1, 0, 0]);
  });

  it("ignores null / undefined / unparseable date strings", () => {
    const series = buildDailySeries(
      [{ date: null }, { date: undefined }, { date: "garbage" }, { date: "2026-05-12" }],
      (item) => item.date,
      () => 1,
      5,
      ANCHOR
    );
    expect(series).toEqual([0, 0, 0, 0, 1]);
  });

  it("trims long ISO timestamps to the date prefix (slice(0, 10))", () => {
    const series = buildDailySeries(
      [{ date: "2026-05-12T18:30:00.000Z" }],
      (item) => item.date,
      () => 1,
      5,
      ANCHOR
    );
    expect(series[4]).toBe(1);
  });
});

describe("tilesForScope", () => {
  const BASE_FILTERS: ReportFilters = {
    range: "month",
    from: "2026-05-01",
    to: "2026-05-31",
    staffId: "",
    service: "",
    source: "",
    status: "",
    paymentStatus: "",
    city: "",
  };

  const UTIL: UtilisationRate = { rate: 0.65, bookedHours: 26, availableHours: 40 };
  const PRIOR_UTIL: UtilisationRate = { rate: 0.5, bookedHours: 20, availableHours: 40 };
  const NO_SHOW: NoShowRate = { rate: 0.08, total: 50, noShows: 2, cancelled: 2, lostRevenue: 200 };
  const PRIOR_NO_SHOW: NoShowRate = { rate: 0.05, total: 40, noShows: 1, cancelled: 1, lostRevenue: 80 };

  const SUMMARY = { bookingCount: 50, collectedRevenue: 5000, outstandingRevenue: 1200 };
  const PRIOR_SUMMARY = { bookingCount: 40, collectedRevenue: 4000, outstandingRevenue: 800 };

  it("emits 6 tiles for owner_admin (Bookings, Revenue, Outstanding, New clients, Utilisation, No-show)", () => {
    const tiles = tilesForScope({
      scope: "owner_admin",
      filters: BASE_FILTERS,
      summary: SUMMARY,
      priorSummary: PRIOR_SUMMARY,
      utilisation: UTIL,
      priorUtilisation: PRIOR_UTIL,
      noShow: NO_SHOW,
      priorNoShow: PRIOR_NO_SHOW,
      newClients: 8,
      priorNewClients: 5,
      query: "range=month",
    });
    expect(tiles.map((t) => t.key)).toEqual([
      "bookings",
      "collected_revenue",
      "outstanding",
      "new_clients",
      "utilisation",
      "no_show",
    ]);
  });

  it("emits 4 tiles for coordinator (no Revenue / no Outstanding)", () => {
    const tiles = tilesForScope({
      scope: "coordinator",
      filters: BASE_FILTERS,
      summary: SUMMARY,
      utilisation: UTIL,
      noShow: NO_SHOW,
      newClients: 8,
      query: "",
    });
    expect(tiles.map((t) => t.key)).toEqual(["bookings", "new_clients", "utilisation", "no_show"]);
  });

  it("emits 4 tiles for therapist (same set as coordinator — scoped data passed by caller)", () => {
    const tiles = tilesForScope({
      scope: "therapist",
      filters: BASE_FILTERS,
      summary: SUMMARY,
      utilisation: UTIL,
      noShow: NO_SHOW,
      newClients: 8,
      query: "",
    });
    expect(tiles.map((t) => t.key)).toEqual(["bookings", "new_clients", "utilisation", "no_show"]);
  });

  it("computes pct delta on Bookings tile from priorSummary.bookingCount", () => {
    const tiles = tilesForScope({
      scope: "owner_admin",
      filters: BASE_FILTERS,
      summary: SUMMARY,
      priorSummary: PRIOR_SUMMARY,
      utilisation: UTIL,
      noShow: NO_SHOW,
      newClients: 8,
      query: "",
    });
    const bookings = tiles.find((t) => t.key === "bookings")!;
    // (50 - 40) / 40 * 100 = 25
    expect(bookings.delta).toBe(25);
  });

  it("omits delta entirely when prior values are absent (lifetime path)", () => {
    const tiles = tilesForScope({
      scope: "owner_admin",
      filters: { ...BASE_FILTERS, range: "lifetime" },
      summary: SUMMARY,
      utilisation: UTIL,
      noShow: NO_SHOW,
      newClients: 8,
      query: "",
    });
    for (const tile of tiles) {
      expect(tile.delta).toBeUndefined();
    }
  });

  it("computes percentage-point delta on Utilisation (0.65 → 0.50 ⇒ +15pp)", () => {
    const tiles = tilesForScope({
      scope: "owner_admin",
      filters: BASE_FILTERS,
      summary: SUMMARY,
      priorSummary: PRIOR_SUMMARY,
      utilisation: UTIL,
      priorUtilisation: PRIOR_UTIL,
      noShow: NO_SHOW,
      newClients: 8,
      query: "",
    });
    const util = tiles.find((t) => t.key === "utilisation")!;
    expect(util.delta).toBeCloseTo(15, 5);
    expect(util.value).toBe("65%");
  });

  it("marks the No-show tile with deltaTone='invert' (smaller = better)", () => {
    const tiles = tilesForScope({
      scope: "owner_admin",
      filters: BASE_FILTERS,
      summary: SUMMARY,
      utilisation: UTIL,
      noShow: NO_SHOW,
      newClients: 8,
      query: "",
    });
    const noShow = tiles.find((t) => t.key === "no_show")!;
    expect(noShow.deltaTone).toBe("invert");
    expect(noShow.value).toBe("8%");
  });

  it("attaches drill href to Bookings, Outstanding, New clients, and No-show tiles", () => {
    const tiles = tilesForScope({
      scope: "owner_admin",
      filters: BASE_FILTERS,
      summary: SUMMARY,
      utilisation: UTIL,
      noShow: NO_SHOW,
      newClients: 8,
      query: "range=month",
    });
    expect(tiles.find((t) => t.key === "bookings")?.href).toBe("/admin/bookings?range=month");
    expect(tiles.find((t) => t.key === "outstanding")?.href).toBe(
      "/admin/bookings?range=month&payment_status=unpaid"
    );
    expect(tiles.find((t) => t.key === "new_clients")?.href).toBe(
      "/admin/clients?range=month&sort=created_desc"
    );
    expect(tiles.find((t) => t.key === "no_show")?.href).toBe(
      "/admin/bookings?range=month&status=no_show"
    );
    expect(tiles.find((t) => t.key === "collected_revenue")?.href).toBeUndefined();
    expect(tiles.find((t) => t.key === "utilisation")?.href).toBeUndefined();
  });

  it("provides Utilisation hint with smart-precision hours (≥10h drops decimal)", () => {
    const tiles = tilesForScope({
      scope: "owner_admin",
      filters: BASE_FILTERS,
      summary: SUMMARY,
      utilisation: UTIL,
      noShow: NO_SHOW,
      newClients: 8,
      query: "",
    });
    // UTIL.bookedHours=26 → "26h"; availableHours=40 → "40h"
    expect(tiles.find((t) => t.key === "utilisation")?.hint).toBe("26h of 40h available");
  });

  it("provides Utilisation hint with one-decimal precision when under 10h", () => {
    const tiles = tilesForScope({
      scope: "owner_admin",
      filters: BASE_FILTERS,
      summary: SUMMARY,
      utilisation: { rate: 0.3, bookedHours: 2.4, availableHours: 8 },
      noShow: NO_SHOW,
      newClients: 8,
      query: "",
    });
    expect(tiles.find((t) => t.key === "utilisation")?.hint).toBe("2.4h of 8.0h available");
  });

  it("falls back to a stub Utilisation hint when availableHours is 0 (no rules set)", () => {
    const tiles = tilesForScope({
      scope: "owner_admin",
      filters: BASE_FILTERS,
      summary: SUMMARY,
      utilisation: { rate: 0, bookedHours: 0, availableHours: 0 },
      noShow: NO_SHOW,
      newClients: 8,
      query: "",
    });
    expect(tiles.find((t) => t.key === "utilisation")?.hint).toBe(
      "Set availability rules to track utilisation"
    );
  });

  it("passes through pre-built sparkline series to Bookings / Collected / New clients tiles", () => {
    const series = {
      bookings: [1, 2, 3, 4, 5],
      collected: [10, 20, 30, 40, 50],
      newClients: [0, 1, 0, 1, 1],
    };
    const tiles = tilesForScope({
      scope: "owner_admin",
      filters: BASE_FILTERS,
      summary: SUMMARY,
      utilisation: UTIL,
      noShow: NO_SHOW,
      newClients: 8,
      series,
      query: "",
    });
    expect(tiles.find((t) => t.key === "bookings")?.series).toEqual([1, 2, 3, 4, 5]);
    expect(tiles.find((t) => t.key === "collected_revenue")?.series).toEqual([10, 20, 30, 40, 50]);
    expect(tiles.find((t) => t.key === "new_clients")?.series).toEqual([0, 1, 0, 1, 1]);
  });
});

describe("getStaffWorkloadWithStatus", () => {
  function mkAssignment(
    staffId: string | null,
    staffName: string | null,
    status: string
  ): ReportAssignment {
    return {
      id: `a-${Math.random()}`,
      booking_id: "b-1",
      participant_id: null,
      assigned_staff_id: staffId,
      required_therapist_gender: "any",
      status,
      staff_profiles: staffName ? { name: staffName } : null,
    };
  }

  it("returns an empty array when there are no assignments", () => {
    expect(getStaffWorkloadWithStatus({ assignments: [] })).toEqual([]);
  });

  it("skips assignments with no assigned_staff_id (unassigned bucket)", () => {
    const rows = getStaffWorkloadWithStatus({
      assignments: [mkAssignment(null, null, "unassigned")],
    });
    expect(rows).toEqual([]);
  });

  it("maps assignment.status into assigned/completed/cancelled segments", () => {
    const rows = getStaffWorkloadWithStatus({
      assignments: [
        mkAssignment("s1", "Aisha", "completed"),
        mkAssignment("s1", "Aisha", "completed"),
        mkAssignment("s1", "Aisha", "assigned"),
        mkAssignment("s1", "Aisha", "no_show"),
        mkAssignment("s1", "Aisha", "declined"),
      ],
    });
    expect(rows.length).toBe(1);
    expect(rows[0]).toMatchObject({
      staffId: "s1",
      staffName: "Aisha",
      assigned: 1,
      completed: 2,
      cancelled: 2,
      total: 5,
    });
  });

  it("falls back to 'Unknown staff' when staff_profiles is null", () => {
    const rows = getStaffWorkloadWithStatus({
      assignments: [mkAssignment("s1", null, "completed")],
    });
    expect(rows[0].staffName).toBe("Unknown staff");
  });

  it("sorts rows by total descending (busiest first)", () => {
    const rows = getStaffWorkloadWithStatus({
      assignments: [
        mkAssignment("s1", "One", "completed"),
        mkAssignment("s2", "Two", "completed"),
        mkAssignment("s2", "Two", "completed"),
        mkAssignment("s2", "Two", "assigned"),
        mkAssignment("s3", "Three", "completed"),
        mkAssignment("s3", "Three", "completed"),
      ],
    });
    expect(rows.map((r) => r.staffId)).toEqual(["s2", "s3", "s1"]);
  });
});
