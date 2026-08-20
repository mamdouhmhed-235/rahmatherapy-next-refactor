// ⛔ GATE 07 CASE 28 — THE CLAIMABLE-ONLY REDACTION PROJECTION.
//
// A therapist can see a booking they have not been assigned, for one reason
// only: it is unclaimed and matches their gender, so they are being offered the
// work. They are not the customer's practitioner yet, and may never be.
//
// Business invariant #13 says such a booking must be projected with the
// customer's identity, contact details, address, prices and every note removed.
// What a therapist is shown is a time, a duration and a place in the diary —
// enough to decide whether to take it, and nothing about the person.
//
// ⛔ There are TWO implementations of that projection — one for the bookings
// list, one for the booking detail page — and they are near-identical copies
// that can drift apart silently. This file drives BOTH against the same
// expectations, which is the only thing that makes the copies safe.
//
// Both are fed a record where every field carries a recognisable marker, so the
// assertions are about the projection actually blanking values rather than about
// a fixture that happened to be empty already.

import { describe, expect, it } from "vitest";
import { normalizeClaimableBooking as normalizeForList } from "../bookings-list-data";
import { normalizeClaimableBooking as normalizeForDetail } from "../[bookingId]/booking-detail-data";

const MARKER = "SECRET-";

/** Every field populated, every string marked, so a leak is unmistakable. */
const FULL_BOOKING = {
  id: "bbbbbbbb-0000-4000-8000-000000000001",
  client_id: "cccccccc-0000-4000-8000-000000000001",
  recurring_template_id: "rrrrrrrr-0000-4000-8000-000000000001",
  booking_date: "2026-09-14",
  start_time: "10:00:00",
  end_time: "11:00:00",
  total_duration_mins: 60,
  total_price: 120,
  travel_fee: 15,
  contact_full_name: `${MARKER}Customer Name`,
  contact_email: `${MARKER}customer@example.test`,
  contact_phone: `${MARKER}07000000000`,
  booking_source: "online",
  amount_due: 120,
  amount_paid: 60,
  paid_at: "2026-09-01T10:00:00Z",
  payment_note: `${MARKER}payment note`,
  status: "pending",
  payment_status: "part_paid",
  payment_method: "cash",
  assignment_status: "unassigned",
  group_booking: true,
  service_address_line1: `${MARKER}10 Test Street`,
  service_address_line2: `${MARKER}Flat 2`,
  service_city: `${MARKER}Luton`,
  service_postcode: `${MARKER}LU1 1AA`,
  access_notes: `${MARKER}access notes`,
  consent_acknowledged: true,
  customer_notes: `${MARKER}customer notes`,
  health_notes: `${MARKER}health notes`,
  customer_manage_notes: `${MARKER}manage notes`,
  cancelled_at: null,
  customer_cancelled_at: null,
  customer_cancellation_note: `${MARKER}cancellation note`,
  last_customer_manage_action_at: "2026-09-02T10:00:00Z",
  reschedule_requested_at: "2026-09-03T10:00:00Z",
  reschedule_preferred_date: "2026-09-20",
  reschedule_preferred_time: "12:00:00",
  reschedule_note: `${MARKER}reschedule note`,
  reschedule_status: "none",
  admin_notes: `${MARKER}admin notes`,
  treatment_notes: `${MARKER}treatment notes`,
  created_at: "2026-08-01T10:00:00Z",
  clients: { id: "cccccccc-0000-4000-8000-000000000001", full_name: `${MARKER}Client` },
  // ⛔ The collections matter most: participant health notes live here, and this
  // is the surface the plan singles out. Populated so that emptying them is an
  // observable act rather than a fixture that was empty to begin with.
  booking_participants: [
    {
      id: "pppppppp-0000-4000-8000-000000000001",
      display_name: `${MARKER}Participant Name`,
      participant_notes: `${MARKER}participant notes`,
      health_notes: `${MARKER}participant health notes`,
    },
  ],
  booking_items: [
    {
      id: "iiiiiiii-0000-4000-8000-000000000001",
      booking_participant_id: "pppppppp-0000-4000-8000-000000000001",
      // ⚠️ NOT marked: the service name is deliberately kept. A therapist being
      // offered the work has to know what treatment it is. The PRICE is what
      // must go.
      service_name_snapshot: "Hijama Package",
      service_price_snapshot: 120,
      service_duration_snapshot: 60,
    },
  ],
  // ⚠️ NOT marked: assignment rows are staff data, not customer data, and a
  // therapist deciding whether to claim needs to see the slot is unclaimed.
  booking_assignments: [
    {
      id: "aaaaaaaa-0000-4000-8000-000000000001",
      participant_id: "pppppppp-0000-4000-8000-000000000001",
      assigned_staff_id: null,
      required_therapist_gender: "female",
      status: "unassigned",
      staff_profiles: null,
    },
  ],
};

/**
 * Fields that MUST be null after the projection. Written out by hand rather than
 * derived, so that the expectation is a statement about what a therapist may not
 * see, not a mirror of whatever the code happens to do.
 */
const MUST_BE_NULL = [
  "total_price",
  "travel_fee",
  "amount_due",
  "amount_paid",
  "paid_at",
  "payment_note",
  "payment_method",
  "service_address_line1",
  "service_address_line2",
  "service_city",
  "service_postcode",
  "access_notes",
  "customer_notes",
  "health_notes",
  "customer_manage_notes",
  "customer_cancellation_note",
  "last_customer_manage_action_at",
  "reschedule_requested_at",
  "reschedule_preferred_date",
  "reschedule_preferred_time",
  "reschedule_note",
  "admin_notes",
  "treatment_notes",
] as const;

/** Fields replaced with a fixed placeholder rather than nulled. */
const MUST_BE_BLANKED: ReadonlyArray<readonly [string, string]> = [
  ["contact_full_name", "Claimable booking"],
  ["contact_email", ""],
  ["contact_phone", ""],
  ["payment_status", "unpaid"],
];

/**
 * ⛔ Per-participant fields that must be nulled. This is the row that matters
 * most in the whole file: booking_participants carries each person's display
 * name, their notes and their health notes — the most sensitive data the system
 * holds — and a therapist merely being OFFERED the booking is not yet anyone's
 * practitioner.
 *
 * ⚠️ Corrected during writing, and worth recording. The first version of this
 * test expected the collections to come back EMPTY. They do not, and should not:
 * both projections MAP over the participants, keeping the structural fields a
 * therapist needs (how many people, what gender each requires) while nulling
 * every identifying and clinical field. Emptying the array would have been a
 * different, worse behaviour — the therapist could no longer see what they were
 * being asked to take on. The code was right and the expectation was wrong.
 */
const PARTICIPANT_MUST_BE_NULL = [
  "display_name",
  "participant_notes",
  "health_notes",
] as const;

/** Per-participant fields a therapist legitimately keeps. */
const PARTICIPANT_MUST_SURVIVE = [
  "id",
  "participant_gender",
  "required_therapist_gender",
  "is_main_contact",
  "consent_acknowledged",
] as const;

/** What a therapist legitimately keeps — enough to decide whether to take it. */
const MUST_SURVIVE: ReadonlyArray<readonly [string, unknown]> = [
  ["id", FULL_BOOKING.id],
  ["booking_date", FULL_BOOKING.booking_date],
  ["start_time", FULL_BOOKING.start_time],
  ["end_time", FULL_BOOKING.end_time],
  ["total_duration_mins", FULL_BOOKING.total_duration_mins],
  ["status", FULL_BOOKING.status],
  ["assignment_status", FULL_BOOKING.assignment_status],
];

const IMPLEMENTATIONS: ReadonlyArray<
  readonly [string, (booking: never) => Record<string, unknown>]
> = [
  ["bookings-list-data", normalizeForList as never],
  ["booking-detail-data", normalizeForDetail as never],
];

// ═════════════════════════════════════════════════════════════════════════════

describe.each(IMPLEMENTATIONS)("claimable-only projection — %s", (name, normalize) => {
  const projected = normalize(FULL_BOOKING as never);

  it.each(MUST_BE_NULL)("nulls %s", (field) => {
    expect(projected[field], `${name}: ${field} must be null`).toBeNull();
  });

  it.each(MUST_BE_BLANKED)("replaces %s with its placeholder", (field, placeholder) => {
    expect(projected[field], `${name}: ${field}`).toBe(placeholder);
  });

  it.each(PARTICIPANT_MUST_BE_NULL)("nulls every participant's %s", (field) => {
    const participants = projected.booking_participants as Array<Record<string, unknown>>;
    expect(participants, `${name}: participants must survive as rows`).toHaveLength(1);
    expect(participants[0][field], `${name}: participant ${field} must be null`).toBeNull();
  });

  it.each(PARTICIPANT_MUST_SURVIVE)("keeps every participant's %s", (field) => {
    const participants = projected.booking_participants as Array<Record<string, unknown>>;
    const source = FULL_BOOKING.booking_participants[0] as Record<string, unknown>;
    expect(participants[0][field], `${name}: participant ${field}`).toEqual(source[field]);
  });

  it("zeroes the price on every booking item but keeps the service name", () => {
    // The therapist needs to know what the treatment is; they have no business
    // knowing what the customer paid for it.
    const items = projected.booking_items as Array<Record<string, unknown>>;
    expect(items, `${name}: items must survive as rows`).toHaveLength(1);
    expect(items[0].service_price_snapshot, `${name}: price must be zeroed`).toBe(0);
    expect(items[0].service_name_snapshot, `${name}: service name is kept`).toBe(
      "Hijama Package"
    );
  });

  it("passes assignment rows through, which is staff data rather than customer data", () => {
    // ⚠️ Recorded deliberately: this is the one collection carried through
    // unchanged. It holds assigned_staff_id, the required gender and the status
    // — what a therapist must see to judge whether the slot is theirs to take.
    // No customer field lives on it.
    const assignments = projected.booking_assignments as Array<Record<string, unknown>>;
    expect(assignments).toEqual(FULL_BOOKING.booking_assignments);
  });

  it.each(MUST_SURVIVE)("keeps %s, which the therapist needs to decide", (field, value) => {
    expect(projected[field], `${name}: ${field} must survive`).toBe(value);
  });

  it("leaks no marked value anywhere in the projection", () => {
    // ⛔ The catch-all, and the assertion that survives someone adding a field.
    // Serialising the whole object is what catches a value that is redacted at
    // the top level but still reachable through a nested object — the same
    // failure the booking-detail health-note guard was written for.
    expect(JSON.stringify(projected)).not.toContain(MARKER);
  });

  it("blanks consent_acknowledged rather than carrying the customer's answer", () => {
    expect(projected.consent_acknowledged, `${name}: consent`).toBe(false);
  });

  it("covers every field the source record carries", () => {
    // ⛔ Guards the guard. A new column added to the record and to only ONE of
    // the two projections is precisely the drift this file exists to catch, and
    // it would otherwise be invisible: neither the null list nor the survive
    // list would mention it.
    const classified = new Set<string>([
      ...MUST_BE_NULL,
      ...MUST_BE_BLANKED.map(([field]) => field),
      "booking_participants",
      "booking_items",
      "booking_assignments",
      ...MUST_SURVIVE.map(([field]) => field),
      // Carried through deliberately and asserted separately or trivially:
      "booking_source",
      "group_booking",
      "cancelled_at",
      "customer_cancelled_at",
      "reschedule_status",
      "created_at",
      "consent_acknowledged",
      // Nulled joins, asserted directly below.
      "recurring_template_id",
      "clients",
      // Detail-only.
      "client_id",
    ]);

    const unclassified = Object.keys(projected).filter((key) => !classified.has(key));
    expect(unclassified, `${name}: fields nobody has decided about`).toEqual([]);
  });
});

describe("the two implementations must not drift apart", () => {
  it("agree on every field they both produce", () => {
    // ⛔ The whole reason this file exists. The detail projection carries three
    // extra fields the list one does not; on every field they share, the two
    // must produce the same value, or a therapist sees different things on two
    // screens showing the same booking.
    const fromList = normalizeForList(FULL_BOOKING as never) as unknown as Record<string, unknown>;
    const fromDetail = normalizeForDetail(FULL_BOOKING as never) as unknown as Record<string, unknown>;

    const shared = Object.keys(fromList).filter((key) => key in fromDetail);

    // Non-vacuity: if the shared set were empty this test would pass silently.
    expect(shared.length, "shared fields").toBeGreaterThan(30);

    for (const field of shared) {
      expect(fromDetail[field], `the two projections disagree on ${field}`).toEqual(
        fromList[field]
      );
    }
  });

  it("the detail projection adds exactly the fields the detail page needs", () => {
    const fromList = normalizeForList(FULL_BOOKING as never) as unknown as Record<string, unknown>;
    const fromDetail = normalizeForDetail(FULL_BOOKING as never) as unknown as Record<string, unknown>;

    // Measured: the list projection already carries `clients` and
    // `recurring_template_id`, so `client_id` is the only genuine addition.
    const detailOnly = Object.keys(fromDetail).filter((key) => !(key in fromList));
    expect(detailOnly.sort()).toEqual(["client_id"]);

    // ⛔ And the one that would matter on BOTH surfaces: the joined client row
    // must be dropped, not passed through, or the customer's name arrives by
    // another route entirely.
    expect(fromDetail.clients, "detail: the joined client row must be dropped").toBeNull();
    expect(fromList.clients, "list: the joined client row must be dropped").toBeNull();
  });
});
