// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanupLegacyDisclosureKey,
  getPriorStripeDateRange,
  getStripeDateRange,
  LEGACY_DISCLOSURE_KEY_PREFIX,
  mobileStickyActionForVariant,
  tilesForVariant,
  type PersonalStripeContext,
} from "./dashboard-helpers-b5";
import type {
  ReportBooking,
  StaffScorecard,
} from "../reports/reporting";

function makeScorecard(overrides?: {
  clinical?: Partial<StaffScorecard["clinical"]>;
  admin?: Partial<StaffScorecard["admin"]>;
  deltas?: StaffScorecard["deltas"];
}): StaffScorecard {
  return {
    clinical: {
      assignmentsTotal: 0,
      assignmentsCompleted: 0,
      hoursWorked: 0,
      clientsTouched: 0,
      revenueAttributed: 0,
      utilisation: { rate: 0, bookedHours: 0, availableHours: 0 },
      retention: { rate: 0, retainedClients: 0, totalClients: 0 },
      noShowRate: { rate: 0, total: 0, noShows: 0, cancelled: 0, lostRevenue: 0 },
      sameGenderFulfilled: 0,
      ...overrides?.clinical,
    },
    admin: {
      enquiriesContactedCount: 0,
      enquiryConversionRate: 0,
      avgMinutesToFirstContact: 0,
      bookingsAssignedCount: 0,
      opsEventsResolvedCount: 0,
      ...overrides?.admin,
    },
    deltas: overrides?.deltas,
  };
}

function makeContext(
  overrides?: Partial<PersonalStripeContext>
): PersonalStripeContext {
  return {
    staffId: "staff-1",
    todayKey: "2026-05-25",
    attentionCount: 0,
    nextAppointment: null,
    todayVisitsCount: 0,
    unassignedTodayCount: 0,
    ...overrides,
  };
}

function makeBooking(overrides?: Partial<ReportBooking>): ReportBooking {
  return {
    id: "b-1",
    client_id: "c-1",
    booking_date: "2026-05-25",
    start_time: "11:45:00",
    end_time: "12:45:00",
    status: "confirmed",
    payment_status: "unpaid",
    assignment_status: "assigned",
    reschedule_status: "none",
    customer_cancelled_at: null,
    total_price: null,
    amount_due: null,
    amount_paid: null,
    booking_source: "website",
    contact_full_name: "Aisha Khan",
    contact_email: "aisha@example.test",
    contact_phone: "07700900000",
    service_city: "Luton",
    service_postcode: "LU1 1AA",
    service_address_line1: "1 Park Street",
    health_notes: null,
    created_at: "2026-05-24T10:00:00Z",
    ...overrides,
  };
}

describe("tilesForVariant — business", () => {
  it("emits 4 tiles with labels per brief §5.1", () => {
    const tiles = tilesForVariant(
      "business",
      makeScorecard(),
      makeContext()
    );
    expect(tiles).toHaveLength(4);
    expect(tiles.map((t) => t.label)).toEqual([
      "Bookings today",
      "My contribution",
      "Revenue this week",
      "Open attention",
    ]);
  });

  it("tile 2 sums clinical + admin contribution (AUDIT Q4)", () => {
    const tiles = tilesForVariant(
      "business",
      makeScorecard({
        clinical: { assignmentsCompleted: 3 },
        admin: { bookingsAssignedCount: 5 },
      }),
      makeContext()
    );
    expect(tiles[1].value).toBe("8");
  });

  it("Owner who doesn't treat shows 0 clinical + N admin (AUDIT Q4)", () => {
    const tiles = tilesForVariant(
      "business",
      makeScorecard({
        clinical: { assignmentsCompleted: 0 },
        admin: { bookingsAssignedCount: 12 },
      }),
      makeContext()
    );
    expect(tiles[1].value).toBe("12");
  });

  it("tile 3 formats revenue as GBP currency", () => {
    const tiles = tilesForVariant(
      "business",
      makeScorecard({ clinical: { revenueAttributed: 540 } }),
      makeContext()
    );
    expect(tiles[2].value).toBe("£540.00");
  });

  it("tile 4 (Open attention) uses invert tone so fewer is better", () => {
    const tiles = tilesForVariant(
      "business",
      makeScorecard(),
      makeContext({ attentionCount: 3 })
    );
    expect(tiles[3].value).toBe("3");
    expect(tiles[3].tone).toBe("invert");
  });

  it("tile 2 delta combines clinical + admin deltas when present", () => {
    const tiles = tilesForVariant(
      "business",
      makeScorecard({
        deltas: {
          clinical: {
            assignmentsCompleted: 2,
            hoursWorked: 0,
            clientsTouched: 0,
            revenueAttributed: 0,
            utilisationRate: 0,
            retentionRate: 0,
            noShowRate: 0,
          },
          admin: {
            enquiriesContactedCount: 0,
            enquiryConversionRate: 0,
            avgMinutesToFirstContact: 0,
            bookingsAssignedCount: 4,
            opsEventsResolvedCount: 0,
          },
        },
      }),
      makeContext()
    );
    expect(tiles[1].delta).toBe(6);
  });
});

describe("tilesForVariant — coordinator", () => {
  it("emits the Coord tile set", () => {
    const tiles = tilesForVariant(
      "coordinator",
      makeScorecard(),
      makeContext()
    );
    expect(tiles.map((t) => t.label)).toEqual([
      "Unassigned today",
      "Enquiries handled",
      "Conversion rate",
      "Active attention",
    ]);
  });

  it("formats conversion rate as integer percent", () => {
    const tiles = tilesForVariant(
      "coordinator",
      makeScorecard({ admin: { enquiryConversionRate: 0.428 } }),
      makeContext()
    );
    expect(tiles[2].value).toBe("43%");
  });

  it("Unassigned today and Active attention invert tone (fewer = better)", () => {
    const tiles = tilesForVariant(
      "coordinator",
      makeScorecard(),
      makeContext({ unassignedTodayCount: 2, attentionCount: 5 })
    );
    expect(tiles[0].tone).toBe("invert");
    expect(tiles[3].tone).toBe("invert");
    expect(tiles[0].value).toBe("2");
    expect(tiles[3].value).toBe("5");
  });
});

describe("tilesForVariant — therapist", () => {
  it("emits the Therapist tile set", () => {
    const tiles = tilesForVariant(
      "therapist",
      makeScorecard(),
      makeContext()
    );
    expect(tiles.map((t) => t.label)).toEqual([
      "Next visit",
      "Today's visits",
      "Hours this week",
      "Clients this month",
    ]);
  });

  it("renders next-visit value as 'HH:MM · First' when appointment present", () => {
    const tiles = tilesForVariant(
      "therapist",
      makeScorecard(),
      makeContext({ nextAppointment: makeBooking() })
    );
    expect(tiles[0].value).toBe("11:45 · Aisha");
  });

  it("renders 'Nothing scheduled' when next appointment is null", () => {
    const tiles = tilesForVariant("therapist", makeScorecard(), makeContext());
    expect(tiles[0].value).toBe("Nothing scheduled");
  });

  it("formats hours: <10 keeps one decimal (no trailing .0); ≥10 rounds", () => {
    const six = tilesForVariant(
      "therapist",
      makeScorecard({ clinical: { hoursWorked: 6.3 } }),
      makeContext()
    );
    expect(six[2].value).toBe("6.3h");

    const ten = tilesForVariant(
      "therapist",
      makeScorecard({ clinical: { hoursWorked: 6 } }),
      makeContext()
    );
    expect(ten[2].value).toBe("6h");

    const twentyTwo = tilesForVariant(
      "therapist",
      makeScorecard({ clinical: { hoursWorked: 22.3 } }),
      makeContext()
    );
    expect(twentyTwo[2].value).toBe("22h");
  });

  it("zero hours renders as '0h' (never blank)", () => {
    const tiles = tilesForVariant(
      "therapist",
      makeScorecard({ clinical: { hoursWorked: 0 } }),
      makeContext()
    );
    expect(tiles[2].value).toBe("0h");
  });
});

describe("mobileStickyActionForVariant", () => {
  it("business with N unassigned returns Assign action", () => {
    const action = mobileStickyActionForVariant({
      variant: "business",
      staffId: "owner",
      unassignedCount: 3,
      claimableCount: 0,
      nextAppointment: null,
    });
    expect(action?.primary.label).toBe("Assign 3 unassigned →");
    expect(action?.primary.href).toBe("/admin/bookings?view=unassigned");
    expect(action?.secondary).toBeUndefined();
  });

  it("business with 0 unassigned returns null", () => {
    const action = mobileStickyActionForVariant({
      variant: "business",
      staffId: "owner",
      unassignedCount: 0,
      claimableCount: 0,
      nextAppointment: null,
    });
    expect(action).toBeNull();
  });

  it("coordinator with N unassigned returns Assign action (same as business)", () => {
    const action = mobileStickyActionForVariant({
      variant: "coordinator",
      staffId: "coord",
      unassignedCount: 5,
      claimableCount: 0,
      nextAppointment: null,
    });
    expect(action?.primary.label).toBe("Assign 5 unassigned →");
  });

  it("therapist with Next Visit returns Maps + Call side-by-side (AUDIT Q5 rung 1)", () => {
    const action = mobileStickyActionForVariant({
      variant: "therapist",
      staffId: "therapist-1",
      unassignedCount: 0,
      claimableCount: 0,
      nextAppointment: makeBooking(),
    });
    expect(action?.primary.label).toBe("Open in Maps");
    expect(action?.primary.href).toContain(
      "google.com/maps/search/?api=1&query="
    );
    expect(action?.primary.external).toBe(true);
    expect(action?.secondary?.label).toBe("Call client");
    expect(action?.secondary?.href).toBe("tel:07700900000");
  });

  it("therapist without phone returns Maps-only", () => {
    const action = mobileStickyActionForVariant({
      variant: "therapist",
      staffId: "therapist-1",
      unassignedCount: 0,
      claimableCount: 0,
      nextAppointment: makeBooking({ contact_phone: null }),
    });
    expect(action?.primary.label).toBe("Open in Maps");
    expect(action?.secondary).toBeUndefined();
  });

  it("therapist without address but with phone returns Call-only", () => {
    const action = mobileStickyActionForVariant({
      variant: "therapist",
      staffId: "therapist-1",
      unassignedCount: 0,
      claimableCount: 0,
      nextAppointment: makeBooking({
        service_address_line1: null,
        service_postcode: null,
        service_city: null,
      }),
    });
    expect(action?.primary.label).toBe("Call client");
    expect(action?.secondary).toBeUndefined();
  });

  it("therapist with no Next Visit but claimable > 0 returns Browse claimable (AUDIT Q5 rung 2)", () => {
    const action = mobileStickyActionForVariant({
      variant: "therapist",
      staffId: "therapist-1",
      unassignedCount: 0,
      claimableCount: 4,
      nextAppointment: null,
    });
    expect(action?.primary.label).toBe("Browse claimable →");
    expect(action?.primary.href).toBe("/admin/bookings?view=claimable");
  });

  it("therapist with no Next Visit and no claimable returns Set my availability (AUDIT Q5 rung 3)", () => {
    const action = mobileStickyActionForVariant({
      variant: "therapist",
      staffId: "therapist-xyz",
      unassignedCount: 0,
      claimableCount: 0,
      nextAppointment: null,
    });
    expect(action?.primary.label).toBe("Set my availability →");
    expect(action?.primary.href).toBe(
      "/admin/staff/therapist-xyz/availability"
    );
  });

  it("therapist with appointment lacking address AND phone falls through to claimable rung", () => {
    const action = mobileStickyActionForVariant({
      variant: "therapist",
      staffId: "therapist-1",
      unassignedCount: 0,
      claimableCount: 2,
      nextAppointment: makeBooking({
        service_address_line1: null,
        service_postcode: null,
        service_city: null,
        contact_phone: null,
      }),
    });
    expect(action?.primary.label).toBe("Browse claimable →");
  });
});

describe("cleanupLegacyDisclosureKey", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("removes the orphan key for the given staffId", () => {
    const key = `${LEGACY_DISCLOSURE_KEY_PREFIX}staff-42`;
    window.localStorage.setItem(key, "1");
    cleanupLegacyDisclosureKey("staff-42");
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it("is idempotent when the key is already absent", () => {
    expect(() => cleanupLegacyDisclosureKey("never-set")).not.toThrow();
  });

  it("does not touch the Coordinator-variant key (still in active use)", () => {
    const coordKey = `${LEGACY_DISCLOSURE_KEY_PREFIX}coordinator-staff-42`;
    window.localStorage.setItem(coordKey, "1");
    cleanupLegacyDisclosureKey("staff-42");
    expect(window.localStorage.getItem(coordKey)).toBe("1");
  });

  it("does not touch the Therapist-variant My Week key", () => {
    const therapistKey = `${LEGACY_DISCLOSURE_KEY_PREFIX}therapist-week-staff-42`;
    window.localStorage.setItem(therapistKey, "1");
    cleanupLegacyDisclosureKey("staff-42");
    expect(window.localStorage.getItem(therapistKey)).toBe("1");
  });

  it("survives a localStorage that throws on removeItem (private mode)", () => {
    const spy = vi
      .spyOn(window.localStorage, "removeItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
    expect(() => cleanupLegacyDisclosureKey("staff-99")).not.toThrow();
    spy.mockRestore();
  });
});

describe("getStripeDateRange", () => {
  it("today maps to a single-day window", () => {
    expect(getStripeDateRange("today", "2026-05-25")).toEqual({
      from: "2026-05-25",
      to: "2026-05-25",
    });
  });

  it("this_week maps to Monday-through-today", () => {
    // 2026-05-25 is a Monday (verify via JS):
    // new Date('2026-05-25T00:00:00Z').getUTCDay() → 1 (Mon)
    expect(getStripeDateRange("this_week", "2026-05-25")).toEqual({
      from: "2026-05-25",
      to: "2026-05-25",
    });
    // 2026-05-28 is a Thursday → start is Mon 2026-05-25
    expect(getStripeDateRange("this_week", "2026-05-28")).toEqual({
      from: "2026-05-25",
      to: "2026-05-28",
    });
    // 2026-05-31 is a Sunday → start is Mon 2026-05-25
    expect(getStripeDateRange("this_week", "2026-05-31")).toEqual({
      from: "2026-05-25",
      to: "2026-05-31",
    });
  });

  it("this_month maps to first-of-month through today", () => {
    expect(getStripeDateRange("this_month", "2026-05-25")).toEqual({
      from: "2026-05-01",
      to: "2026-05-25",
    });
  });
});

describe("getPriorStripeDateRange", () => {
  it("prior of today is yesterday", () => {
    expect(getPriorStripeDateRange("today", "2026-05-25")).toEqual({
      from: "2026-05-24",
      to: "2026-05-24",
    });
  });

  it("prior of this_week is the previous Mon-Sun (full 7 days)", () => {
    expect(getPriorStripeDateRange("this_week", "2026-05-28")).toEqual({
      from: "2026-05-18",
      to: "2026-05-24",
    });
  });

  it("prior of this_month is the full previous calendar month", () => {
    expect(getPriorStripeDateRange("this_month", "2026-05-25")).toEqual({
      from: "2026-04-01",
      to: "2026-04-30",
    });
  });

  it("prior of this_month handles February correctly (28-day month)", () => {
    expect(getPriorStripeDateRange("this_month", "2026-03-15")).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
  });

  it("prior of this_month at start of year wraps to December prior year", () => {
    expect(getPriorStripeDateRange("this_month", "2026-01-10")).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });
});
