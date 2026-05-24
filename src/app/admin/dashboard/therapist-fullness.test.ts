// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  getRecentClientsForTherapist,
  getTherapistHighlightOrTip,
  listTipLibraryForTests,
  quickHelpLinksForTherapist,
} from "./therapist-fullness";
import type {
  ReportBooking,
  ReportBookingItem,
  ReportData,
  StaffScorecard,
} from "../reports/reporting";

function makeScorecard(
  overrides: Partial<StaffScorecard["clinical"]> & {
    deltas?: StaffScorecard["deltas"];
  } = {}
): StaffScorecard {
  return {
    clinical: {
      assignmentsTotal: 0,
      assignmentsCompleted: 0,
      hoursWorked: 0,
      clientsTouched: 0,
      revenueAttributed: 0,
      utilisation: { rate: 0, bookedHours: 0, availableHours: 0 },
      retention: { rate: 0, retainedClients: 0, totalClients: 0 },
      noShowRate: {
        rate: 0,
        total: 0,
        noShows: 0,
        cancelled: 0,
        lostRevenue: 0,
      },
      sameGenderFulfilled: 0,
      ...overrides,
    },
    admin: {
      enquiriesContactedCount: 0,
      enquiryConversionRate: 0,
      avgMinutesToFirstContact: 0,
      bookingsAssignedCount: 0,
      opsEventsResolvedCount: 0,
    },
    deltas: overrides.deltas,
  };
}

describe("getTherapistHighlightOrTip — priority order", () => {
  it("first visit ever — sole completion in sole assignment", () => {
    const h = getTherapistHighlightOrTip(
      makeScorecard({ assignmentsTotal: 1, assignmentsCompleted: 1 }),
      null,
      { id: "staff-1" }
    );
    expect(h.kind).toBe("highlight");
    expect(h.icon).toBe("Sparkles");
    expect(h.message).toBe("First visit completed — welcome to the rota.");
  });

  it("same-gender requests fulfilled (singular form for n=1)", () => {
    const h = getTherapistHighlightOrTip(
      makeScorecard({
        assignmentsTotal: 4,
        assignmentsCompleted: 4,
        sameGenderFulfilled: 1,
      }),
      null,
      { id: "staff-1" },
      "this_week"
    );
    expect(h.kind).toBe("highlight");
    expect(h.message).toBe("1 same-gender request fulfilled this week.");
  });

  it("same-gender requests fulfilled (plural for n=3)", () => {
    const h = getTherapistHighlightOrTip(
      makeScorecard({
        assignmentsTotal: 6,
        assignmentsCompleted: 6,
        sameGenderFulfilled: 3,
      }),
      null,
      { id: "staff-1" },
      "this_month"
    );
    expect(h.message).toBe("3 same-gender requests fulfilled this month.");
  });

  it("visits up vs prior period — formatted with period words", () => {
    const h = getTherapistHighlightOrTip(
      makeScorecard({
        assignmentsTotal: 8,
        assignmentsCompleted: 8,
      }),
      makeScorecard({ assignmentsCompleted: 5 }),
      { id: "staff-1" },
      "this_week"
    );
    expect(h.kind).toBe("highlight");
    expect(h.message).toBe(
      "8 visits completed this week — up from 5 last week."
    );
  });

  it("visits up does NOT fire when prior was zero (don't fake a streak)", () => {
    const h = getTherapistHighlightOrTip(
      makeScorecard({
        assignmentsTotal: 4,
        assignmentsCompleted: 4,
        noShowRate: { rate: 0, total: 4, noShows: 0, cancelled: 0, lostRevenue: 0 },
      }),
      makeScorecard({ assignmentsCompleted: 0 }),
      { id: "staff-1" }
    );
    // Falls through to "steady period" check (4 ≥ 3 + zero cancellations).
    expect(h.kind).toBe("highlight");
    expect(h.message).toContain("Steady this week");
  });

  it("utilisation up — fires only with ≥10pp gain", () => {
    const small = getTherapistHighlightOrTip(
      makeScorecard({
        utilisation: { rate: 0.65, bookedHours: 26, availableHours: 40 },
      }),
      makeScorecard({
        utilisation: { rate: 0.6, bookedHours: 24, availableHours: 40 },
      }),
      { id: "staff-1" }
    );
    // 5pp gain — does NOT fire utilisation highlight, falls through to tip.
    expect(small.kind).toBe("tip");

    const big = getTherapistHighlightOrTip(
      makeScorecard({
        utilisation: { rate: 0.75, bookedHours: 30, availableHours: 40 },
      }),
      makeScorecard({
        utilisation: { rate: 0.5, bookedHours: 20, availableHours: 40 },
      }),
      { id: "staff-1" },
      "this_week"
    );
    expect(big.kind).toBe("highlight");
    expect(big.message).toBe(
      "Utilisation at 75% — up from 50% last week."
    );
  });

  it("steady period — ≥3 completions + zero cancellations + zero no-shows", () => {
    const h = getTherapistHighlightOrTip(
      makeScorecard({
        assignmentsTotal: 4,
        assignmentsCompleted: 4,
        noShowRate: {
          rate: 0,
          total: 4,
          noShows: 0,
          cancelled: 0,
          lostRevenue: 0,
        },
      }),
      null,
      { id: "staff-1" },
      "this_month"
    );
    expect(h.kind).toBe("highlight");
    expect(h.message).toBe(
      "Steady this month: 4 visits completed with no cancellations."
    );
  });

  it("steady period does NOT fire with even a single no-show", () => {
    const h = getTherapistHighlightOrTip(
      makeScorecard({
        assignmentsCompleted: 5,
        noShowRate: {
          rate: 0.1,
          total: 5,
          noShows: 1,
          cancelled: 0,
          lostRevenue: 0,
        },
      }),
      null,
      { id: "staff-1" }
    );
    expect(h.kind).toBe("tip");
  });

  it("tip fallback — deterministic per profile id", () => {
    const tipA = getTherapistHighlightOrTip(
      makeScorecard(),
      null,
      { id: "staff-deterministic-a" }
    );
    const tipB = getTherapistHighlightOrTip(
      makeScorecard(),
      null,
      { id: "staff-deterministic-a" }
    );
    expect(tipA.message).toBe(tipB.message);
    expect(tipA.kind).toBe("tip");
    expect(tipA.icon).toBe("Lightbulb");
    expect(listTipLibraryForTests()).toContain(tipA.message);
  });

  it("zero state produces a tip (never blank screen — AUDIT M1)", () => {
    const h = getTherapistHighlightOrTip(
      makeScorecard(),
      makeScorecard(),
      { id: "fresh-staff" }
    );
    expect(h.kind).toBe("tip");
    expect(h.message.length).toBeGreaterThan(0);
  });
});

// ── Recent clients ──────────────────────────────────────────────────────────

function makeBooking(overrides: Partial<ReportBooking> = {}): ReportBooking {
  return {
    id: "b-1",
    client_id: "c-1",
    booking_date: "2026-05-20",
    start_time: "11:45:00",
    end_time: "12:45:00",
    status: "completed",
    payment_status: "paid",
    assignment_status: "assigned",
    reschedule_status: "none",
    customer_cancelled_at: null,
    total_price: null,
    amount_due: null,
    amount_paid: null,
    booking_source: "website",
    contact_full_name: "Aisha Khan",
    contact_email: null,
    contact_phone: null,
    service_city: "Luton",
    service_postcode: null,
    service_address_line1: null,
    health_notes: null,
    created_at: "2026-05-19T10:00:00Z",
    ...overrides,
  };
}

function makeItem(overrides: Partial<ReportBookingItem> = {}): ReportBookingItem {
  return {
    id: "i-1",
    booking_id: "b-1",
    booking_participant_id: null,
    service_name_snapshot: "Deep tissue massage",
    service_price_snapshot: 0,
    service_duration_snapshot: 60,
    ...overrides,
  };
}

function makeData(overrides: Partial<ReportData> = {}): ReportData {
  return {
    filters: {
      range: "this_month",
      from: "2026-05-01",
      to: "2026-05-25",
      staffId: "",
      service: "",
      source: "",
      status: "",
      paymentStatus: "",
      city: "",
    },
    bookings: [],
    cityOptions: [],
    assignments: [],
    bookingItems: [],
    clients: [],
    staff: [],
    enquiries: [],
    emailEvents: [],
    operationalEvents: [],
    staffAvailabilityRuleStaffIds: [],
    ...overrides,
  };
}

describe("getRecentClientsForTherapist", () => {
  const TODAY = "2026-05-25";

  it("returns empty for empty data", () => {
    expect(getRecentClientsForTherapist(makeData(), TODAY)).toEqual([]);
  });

  it("filters to completed bookings within the 30-day window", () => {
    const data = makeData({
      bookings: [
        makeBooking({ id: "b-1", client_id: "c-1", booking_date: "2026-05-20" }),
        makeBooking({ id: "b-2", client_id: "c-2", booking_date: "2026-05-22", status: "confirmed" }),
        makeBooking({ id: "b-3", client_id: "c-3", booking_date: "2026-04-20" }), // > 30 days
        makeBooking({ id: "b-4", client_id: null, booking_date: "2026-05-21" }), // no client
      ],
      bookingItems: [
        makeItem({ booking_id: "b-1", service_name_snapshot: "Massage" }),
      ],
    });
    const out = getRecentClientsForTherapist(data, TODAY);
    expect(out.map((c) => c.clientId)).toEqual(["c-1"]);
    expect(out[0].lastService).toBe("Massage");
  });

  it("deduplicates by client_id, keeping the most recent booking", () => {
    const data = makeData({
      bookings: [
        makeBooking({
          id: "b-old",
          client_id: "c-1",
          booking_date: "2026-05-10",
        }),
        makeBooking({
          id: "b-new",
          client_id: "c-1",
          booking_date: "2026-05-20",
        }),
        makeBooking({
          id: "b-other",
          client_id: "c-2",
          booking_date: "2026-05-15",
        }),
      ],
    });
    const out = getRecentClientsForTherapist(data, TODAY);
    expect(out).toHaveLength(2);
    expect(out[0].clientId).toBe("c-1");
    expect(out[0].lastBookingId).toBe("b-new");
    expect(out[1].clientId).toBe("c-2");
  });

  it("sorts most-recent first", () => {
    const data = makeData({
      bookings: [
        makeBooking({ id: "b-a", client_id: "c-a", booking_date: "2026-05-05" }),
        makeBooking({ id: "b-b", client_id: "c-b", booking_date: "2026-05-22" }),
        makeBooking({ id: "b-c", client_id: "c-c", booking_date: "2026-05-15" }),
      ],
    });
    const out = getRecentClientsForTherapist(data, TODAY);
    expect(out.map((c) => c.clientId)).toEqual(["c-b", "c-c", "c-a"]);
  });

  it("caps at max=6 by default", () => {
    const bookings = Array.from({ length: 10 }, (_, i) =>
      makeBooking({
        id: `b-${i}`,
        client_id: `c-${i}`,
        booking_date: `2026-05-${String(15 + (i % 10)).padStart(2, "0")}`,
      })
    );
    const out = getRecentClientsForTherapist(makeData({ bookings }), TODAY);
    expect(out).toHaveLength(6);
  });

  it("respects custom max + windowDays", () => {
    const data = makeData({
      bookings: [
        makeBooking({ id: "b-1", client_id: "c-1", booking_date: "2026-05-22" }),
        makeBooking({ id: "b-2", client_id: "c-2", booking_date: "2026-05-20" }),
        makeBooking({ id: "b-3", client_id: "c-3", booking_date: "2026-05-10" }),
      ],
    });
    expect(
      getRecentClientsForTherapist(data, TODAY, 7, 2)
    ).toHaveLength(2);
    // 7-day window cuts off c-3 (booking 15 days ago)
    expect(
      getRecentClientsForTherapist(data, TODAY, 7).map((c) => c.clientId)
    ).toEqual(["c-1", "c-2"]);
  });

  it("computes daysSinceLast correctly", () => {
    const data = makeData({
      bookings: [
        makeBooking({ id: "b-1", client_id: "c-1", booking_date: "2026-05-22" }),
      ],
    });
    const out = getRecentClientsForTherapist(data, TODAY);
    expect(out[0].daysSinceLast).toBe(3);
  });

  it("picks first-name from contact_full_name", () => {
    const data = makeData({
      bookings: [
        makeBooking({
          id: "b-1",
          client_id: "c-1",
          contact_full_name: "Fatimah Al-Husseini",
        }),
      ],
    });
    const out = getRecentClientsForTherapist(data, TODAY);
    expect(out[0].firstName).toBe("Fatimah");
    expect(out[0].fullName).toBe("Fatimah Al-Husseini");
  });

  it("falls back to 'Visit' when service-name snapshot is missing", () => {
    const data = makeData({
      bookings: [
        makeBooking({ id: "b-1", client_id: "c-1" }),
      ],
      bookingItems: [],
    });
    const out = getRecentClientsForTherapist(data, TODAY);
    expect(out[0].lastService).toBe("Visit");
  });
});

// ── Quick-help links ────────────────────────────────────────────────────────

describe("quickHelpLinksForTherapist", () => {
  it("returns all 4 links when every permission granted", () => {
    const links = quickHelpLinksForTherapist("staff-1", {
      canEditProfile: true,
      canEditAvailability: true,
      canBrowseClaimable: true,
      canViewOwnBookings: true,
    });
    expect(links.map((l) => l.key)).toEqual([
      "profile",
      "availability",
      "claimable",
      "completed",
    ]);
  });

  it("filters out denied links", () => {
    const links = quickHelpLinksForTherapist("staff-1", {
      canEditProfile: false,
      canEditAvailability: true,
      canBrowseClaimable: false,
      canViewOwnBookings: true,
    });
    expect(links.map((l) => l.key)).toEqual(["availability", "completed"]);
  });

  it("returns empty array when every link is denied", () => {
    const links = quickHelpLinksForTherapist("staff-1", {
      canEditProfile: false,
      canEditAvailability: false,
      canBrowseClaimable: false,
      canViewOwnBookings: false,
    });
    expect(links).toEqual([]);
  });

  it("hrefs interpolate the staffId correctly", () => {
    const links = quickHelpLinksForTherapist("therapist-uuid-42", {
      canEditProfile: true,
      canEditAvailability: true,
      canBrowseClaimable: true,
      canViewOwnBookings: true,
    });
    expect(links.find((l) => l.key === "profile")?.href).toBe(
      "/admin/staff/therapist-uuid-42"
    );
    expect(links.find((l) => l.key === "availability")?.href).toBe(
      "/admin/staff/therapist-uuid-42/availability"
    );
    expect(links.find((l) => l.key === "claimable")?.href).toBe(
      "/admin/bookings?view=claimable"
    );
    expect(links.find((l) => l.key === "completed")?.href).toBe(
      "/admin/bookings?view=completed&staffId=therapist-uuid-42"
    );
  });
});
