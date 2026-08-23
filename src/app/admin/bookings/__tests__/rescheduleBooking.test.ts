import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStaffProfile, PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkSeriesSlots } from "@/lib/booking/availability";
import { rescheduleBooking } from "../actions";

/**
 * ⛔ D-051 — moving a booking to a new date and time.
 *
 * Owner ruling 2026-08-23: build it, surgically, and have it reviewed and
 * tested. This spec covers the GUARDS, because a booking-mover that writes when
 * it should refuse is the one that costs the clinic money — a visit moved on
 * top of another, or moved by somebody who should not be able to.
 *
 * ⛔ THE PERMISSION HELPERS ARE NOT MOCKED. Only the profile LOOKUP is stubbed,
 * so `canManageAllBookings` runs for real against a real permission set. That
 * is deliberate and load-bearing: gate 07 case 18 found `createService`
 * unguarded precisely because the only test driving it mocked
 * `requirePermission` away. ⛔ A test that mocks the permission check proves
 * nothing about permissions.
 *
 * ⛔ EVERY REFUSAL ALSO ASSERTS THAT NOTHING WAS WRITTEN. An action that
 * returns an error and updates the row anyway would pass a message-only
 * assertion while moving a real customer's appointment.
 */

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/auth/rbac", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/rbac")>()),
  getStaffProfile: vi.fn(),
}));

vi.mock("@/lib/email/notifications", () => ({
  sendBookingCreatedEmails: vi.fn(),
  sendAssignedStaffBookingChangeEmails: vi.fn(),
  sendBookingCancellationEmails: vi.fn(),
  sendBookingConfirmedClientEmail: vi.fn().mockResolvedValue(undefined),
  sendBookingMovedClientEmail: vi.fn().mockResolvedValue({ sent: true }),
  sendBookingRestoredClientEmail: vi.fn(),
  sendClaimNotificationEmail: vi.fn(),
  sendClientAssignedTherapistEmail: vi.fn(),
  sendStaffAssignmentEmail: vi.fn(),
  sendStaffUnassignmentEmail: vi.fn(),
}));

vi.mock("@/lib/booking/manage-token", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/booking/manage-token")>()),
  ensureBookingManageUrl: vi.fn(),
}));

// ⛔ The availability ENGINE is stubbed, not the action's use of it: these
// cases are about what `rescheduleBooking` DOES with a verdict, not about
// re-testing the engine (which has its own suite).
vi.mock("@/lib/booking/availability", () => ({
  checkSeriesSlots: vi.fn(),
}));

function staff(name: string, permissions: string[]): StaffProfile {
  return {
    id: `staff-${name}`,
    auth_user_id: `auth-${name}`,
    name,
    email: `${name}@rahmatherapy.example.test`,
    role_id: `role-${name}`,
    role_name: name,
    gender: "female",
    active: true,
    can_take_bookings: false,
    availability_mode: "use_global",
    permissions: new Set(permissions),
  };
}

const admin = staff("Admin", [PERMISSIONS.MANAGE_BOOKINGS_ALL]);
/** ⛔ A real Therapist's grants — they hold MANAGE_BOOKINGS_ASSIGNED, not _ALL. */
const therapist = staff("Therapist", [PERMISSIONS.MANAGE_BOOKINGS_ASSIGNED]);

// ⛔ THE CLOCK IS FROZEN. Two guards read the real time - the past-DATE
// check and the past-MOMENT check - so cases about "earlier today" and
// "later today" are otherwise a coin toss that lands differently depending
// on when the suite runs. ⚠️ A test that passes in the morning and fails
// after lunch is worse than no test.
const NOW = new Date("2026-08-23T09:00:00.000Z");
const TODAY = "2026-08-23";
const FUTURE = "2026-09-12";
const FURTHER = "2026-09-19";

function baseBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: "booking-1",
    status: "confirmed",
    booking_date: FUTURE,
    start_time: "10:00:00",
    end_time: "11:00:00",
    total_duration_mins: 60,
    reschedule_status: "none",
    manage_token_hash: null,
    service_city: "Luton",
    recurring_template_id: null,
    recurring_occurrence_date: null,
    ...overrides,
  };
}

interface RecordedOp {
  table: string;
  op: "select" | "update" | "insert";
  payload?: unknown;
}

function stubAdminClient(booking: Record<string, unknown> | null) {
  const ops: RecordedOp[] = [];

  function resolve(entry: RecordedOp) {
    if (entry.table === "bookings" && entry.op === "select") {
      return { data: booking, error: null };
    }
    if (entry.table === "bookings" && entry.op === "update") {
      // The race guard returns the updated row.
      return { data: { ...booking, ...(entry.payload as object) }, error: null };
    }
    if (entry.table === "booking_items") {
      return { data: [{ services: { slug: "hijama-package" } }], error: null };
    }
    if (entry.table === "booking_participants") {
      return { data: [{ required_therapist_gender: "female" }], error: null };
    }
    if (entry.table === "booking_assignments") {
      return { data: [{ assigned_staff_id: null, status: "unassigned" }], error: null };
    }
    if (entry.table === "email_delivery_events") {
      return { data: null, error: null };
    }
    return { data: null, error: null };
  }

  function startOp(table: string, op: RecordedOp["op"], payload?: unknown) {
    const entry: RecordedOp = { table, op, payload };
    ops.push(entry);
    const settle = () => Promise.resolve(resolve(entry));
    const chain: Record<string, unknown> = {
      eq: () => chain,
      not: () => chain,
      in: () => chain,
      select: () => chain,
      single: settle,
      maybeSingle: settle,
      returns: settle,
      then: (resolveFn: (value: unknown) => unknown) => Promise.resolve(resolve(entry)).then(resolveFn),
    };
    return chain;
  }

  const from = vi.fn((table: string) => ({
    select: () => startOp(table, "select"),
    update: (payload: unknown) => startOp(table, "update", payload),
    insert: (payload: unknown) => startOp(table, "insert", payload),
  }));

  const client = { from } as unknown as ReturnType<typeof createSupabaseAdminClient>;
  vi.mocked(createSupabaseAdminClient).mockReturnValue(client);

  return {
    ops,
    writes: () => ops.filter((entry) => entry.op !== "select"),
    bookingUpdates: () =>
      ops.filter((entry) => entry.table === "bookings" && entry.op === "update"),
  };
}

function moveForm(fields: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("booking_id", "booking-1");
  formData.set("booking_date", FURTHER);
  formData.set("start_time", "14:00");
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

function slotIs(available: boolean, extra: Record<string, unknown> = {}) {
  vi.mocked(checkSeriesSlots).mockResolvedValue({
    verdicts: [{ date: FURTHER, available, ...extra }],
    durationMins: 60,
  } as Awaited<ReturnType<typeof checkSeriesSlots>>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  vi.mocked(getStaffProfile).mockResolvedValue(admin);
  slotIs(true);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("rescheduleBooking — who may move a booking", () => {
  it("⛔ refuses a Therapist, and writes nothing", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(therapist);
    const stub = stubAdminClient(baseBooking());

    const result = await rescheduleBooking(moveForm());

    expect(result).toEqual({ error: "Insufficient permissions." });
    expect(
      stub.writes(),
      "a refused move must not touch the database at all",
    ).toHaveLength(0);
  });

  it("⛔ refuses a deactivated Admin", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue({ ...admin, active: false });
    const stub = stubAdminClient(baseBooking());

    const result = await rescheduleBooking(moveForm());

    expect(result).toEqual({ error: "Insufficient permissions." });
    expect(stub.writes()).toHaveLength(0);
  });

  it("allows an Admin holding manage_bookings_all", async () => {
    const stub = stubAdminClient(baseBooking());

    const result = await rescheduleBooking(moveForm());

    expect(result).toMatchObject({ success: true });
    expect(stub.bookingUpdates(), "the move must actually be written").toHaveLength(1);
  });
});

describe("rescheduleBooking — what it refuses", () => {
  it("⛔ refuses a date in the past", async () => {
    const stub = stubAdminClient(baseBooking());

    const result = await rescheduleBooking(
      moveForm({ booking_date: "2026-08-22" }),
    );

    expect(result).toMatchObject({ fieldErrors: { booking_date: expect.any(String) } });
    expect(
      stub.bookingUpdates(),
      "an appointment cannot be moved into the past",
    ).toHaveLength(0);
  });

  it("allows a move to LATER today — the ordinary 'come this afternoon instead' case", async () => {
    const stub = stubAdminClient(baseBooking());
    vi.mocked(checkSeriesSlots).mockResolvedValue({
      verdicts: [{ date: TODAY, available: true }],
      durationMins: 60,
    } as Awaited<ReturnType<typeof checkSeriesSlots>>);

    // Frozen at 09:00 UTC, so 16:00 today is still ahead.
    const result = await rescheduleBooking(moveForm({ booking_date: TODAY, start_time: "16:00" }));

    expect(
      result,
      "⛔ same-day moves are the ordinary case and must not be blocked",
    ).toMatchObject({ success: true });
    expect(stub.bookingUpdates()).toHaveLength(1);
  });

  it("⛔ refuses a time EARLIER today that has already gone", async () => {
    const stub = stubAdminClient(baseBooking());
    vi.mocked(checkSeriesSlots).mockResolvedValue({
      verdicts: [{ date: TODAY, available: true }],
      durationMins: 60,
    } as Awaited<ReturnType<typeof checkSeriesSlots>>);

    // Frozen at 09:00 UTC (10:00 London). 07:00 has gone.
    const result = await rescheduleBooking(moveForm({ booking_date: TODAY, start_time: "07:00" }));

    expect(
      result,
      "⛔ the date guard alone let an operator move a booking to 09:00 at four in the afternoon, and email the customer a time that had already passed",
    ).toMatchObject({ fieldErrors: { start_time: expect.stringContaining("already passed") } });
    expect(stub.bookingUpdates()).toHaveLength(0);
  });

  it.each([
    ["cancelled"],
    ["completed"],
    ["no_show"],
  ])("⛔ refuses a %s booking, and writes nothing", async (status) => {
    const stub = stubAdminClient(baseBooking({ status }));

    const result = await rescheduleBooking(moveForm());

    expect(result).toMatchObject({ error: expect.stringContaining("cannot be moved") });
    expect(stub.bookingUpdates()).toHaveLength(0);
  });

  it("⛔ refuses a move to where the booking already is", async () => {
    const stub = stubAdminClient(baseBooking());

    const result = await rescheduleBooking(
      moveForm({ booking_date: FUTURE, start_time: "10:00" }),
    );

    expect(result).toMatchObject({ error: expect.stringContaining("already when") });
    expect(stub.bookingUpdates()).toHaveLength(0);
  });

  it("⛔ refuses a malformed date or time before reading anything", async () => {
    const stub = stubAdminClient(baseBooking());

    expect(await rescheduleBooking(moveForm({ booking_date: "next tuesday" }))).toMatchObject({
      fieldErrors: { booking_date: expect.any(String) },
    });
    expect(await rescheduleBooking(moveForm({ start_time: "25:99" }))).toMatchObject({
      fieldErrors: { start_time: expect.any(String) },
    });
    expect(stub.writes()).toHaveLength(0);
  });

  it("⛔ refuses when the clinic cannot staff the new slot", async () => {
    const stub = stubAdminClient(baseBooking());
    slotIs(false, { reason: "Fully booked." });

    const result = await rescheduleBooking(moveForm());

    expect(result).toMatchObject({ fieldErrors: { start_time: "Fully booked." } });
    expect(
      stub.bookingUpdates(),
      "⛔ moving a visit into a slot nobody can cover is the double-booking this guard exists to stop",
    ).toHaveLength(0);
  });

  it("⛔ refuses when the therapist already on the booking is busy then", async () => {
    const stub = stubAdminClient(baseBooking());
    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        const chain: Record<string, unknown> = {
          eq: () => chain,
          not: () => chain,
          in: () => chain,
          select: () => chain,
          single: () => Promise.resolve({ data: baseBooking(), error: null }),
          maybeSingle: () => Promise.resolve({ data: baseBooking(), error: null }),
          then: (fn: (value: unknown) => unknown) => {
            if (table === "booking_items") {
              return Promise.resolve({ data: [{ services: { slug: "hijama-package" } }], error: null }).then(fn);
            }
            if (table === "booking_participants") {
              return Promise.resolve({ data: [{ required_therapist_gender: "female" }], error: null }).then(fn);
            }
            if (table === "booking_assignments") {
              return Promise.resolve({ data: [{ assigned_staff_id: "staff-bound", status: "assigned" }], error: null }).then(fn);
            }
            return Promise.resolve({ data: null, error: null }).then(fn);
          },
        };
        return { select: () => chain, update: () => chain, insert: () => chain };
      }),
    } as unknown as ReturnType<typeof createSupabaseAdminClient>);

    slotIs(true, { boundStaffFree: false });

    const result = await rescheduleBooking(moveForm());

    expect(result).toMatchObject({
      fieldErrors: { start_time: expect.stringContaining("already busy") },
    });
    void stub;
  });

  it("skips the availability check when the operator overrides it", async () => {
    const stub = stubAdminClient(baseBooking());
    slotIs(false, { reason: "Fully booked." });

    const result = await rescheduleBooking(moveForm({ override_availability: "on" }));

    expect(
      result,
      "an operator who has arranged cover themselves must be able to say so",
    ).toMatchObject({ success: true });
    expect(checkSeriesSlots, "and the check is not even run").not.toHaveBeenCalled();
    expect(stub.bookingUpdates()).toHaveLength(1);
  });
});

describe("rescheduleBooking — the holes an independent review found", () => {
  it("moves a visit inside a repeat booking, and NEVER touches its slot", async () => {
    const stub = stubAdminClient(
      baseBooking({ recurring_template_id: "template-1", recurring_occurrence_date: FUTURE }),
    );

    const result = await rescheduleBooking(moveForm());

    // ⚠️ D-051 REFUSED this, and had to: a repeat booking had no list of its
    // occurrences, so "does a visit exist for this slot?" was answered entirely
    // from `booking_date`. Moving one made the nightly job materialise a
    // duplicate on the old date.
    //
    // ✅ D-052 gave every occurrence a stable slot —
    // `recurring_occurrence_date`, stamped once on INSERT by a trigger and
    // never touched by an UPDATE — and the job now keys on the slot.
    expect(result, "a repeat booking's visit is movable since D-052").toMatchObject({
      success: true,
    });

    const payload = stub.bookingUpdates()[0].payload as Record<string, unknown>;
    expect(
      payload,
      "⛔ THE WHOLE FIX RESTS ON THIS. If this action ever writes recurring_occurrence_date, the slot moves with the visit, the nightly job sees an empty slot on the old date, and it materialises a duplicate the client never asked for.",
    ).not.toHaveProperty("recurring_occurrence_date");

    // And it really did move the visit.
    expect(payload.booking_date).toBe(FURTHER);
    expect(payload.start_time).toBe("14:00:00");
  });

  it("⛔ refuses a booking with no recorded length rather than leaving a stale end time", async () => {
    const stub = stubAdminClient(baseBooking({ total_duration_mins: null }));

    const result = await rescheduleBooking(moveForm());

    expect(result).toMatchObject({ error: expect.stringContaining("no recorded length") });
    expect(
      stub.bookingUpdates(),
      "⛔ skipping the end_time write leaves the OLD end against the new start - a wrong diary window, or an end_time <= start_time the database rejects in the operator's face",
    ).toHaveLength(0);
  });

  it("⛔ refuses a move whose visit would run past midnight", async () => {
    const stub = stubAdminClient(baseBooking({ total_duration_mins: 90 }));

    // Override, because availability would otherwise refuse out-of-hours -
    // and the override path is the one with no other backstop.
    const result = await rescheduleBooking(
      moveForm({ start_time: "23:00", override_availability: "on" }),
    );

    expect(
      result,
      "⛔ addMinutesToTime does not guard midnight: 23:00 + 90 gives 24:30, which Postgres refuses for a time column, surfacing a raw driver error",
    ).toMatchObject({ fieldErrors: { start_time: expect.stringContaining("same day") } });
    expect(stub.bookingUpdates()).toHaveLength(0);
  });

  it("closes a request that was ACCEPTED before being moved", async () => {
    const stub = stubAdminClient(baseBooking({ reschedule_status: "reviewed" }));

    await rescheduleBooking(moveForm());

    const payload = stub.bookingUpdates()[0].payload as Record<string, unknown>;
    expect(
      payload.reschedule_status,
      "⛔ the natural flow is Accept-then-Move, which leaves the status at reviewed. Without this it never reaches completed and sits in the queue for ever.",
    ).toBe("completed");
  });

  it("⛔ stops the old reminder suppressing the one for the new date", async () => {
    const stub = stubAdminClient(baseBooking());

    await rescheduleBooking(moveForm());

    const sweep = stub.ops.find(
      (entry) => entry.table === "email_delivery_events" && entry.op === "update",
    );
    expect(
      sweep,
      "⛔ booking-reminders dedupes on (booking_id, event_type) with NO date. Move a booking after its reminder went out and the customer gets a reminder naming the OLD day and nothing for the new one.",
    ).toBeTruthy();
    expect((sweep?.payload as Record<string, unknown>).delivery_status).toBe("cancelled_manual");
  });
});

describe("rescheduleBooking — what it writes", () => {
  it("moves the date and time, and RECOMPUTES the end time", async () => {
    const stub = stubAdminClient(baseBooking({ total_duration_mins: 90 }));

    await rescheduleBooking(moveForm({ start_time: "14:00" }));

    const payload = stub.bookingUpdates()[0].payload as Record<string, unknown>;
    expect(payload.booking_date).toBe(FURTHER);
    expect(payload.start_time).toBe("14:00:00");
    expect(
      payload.end_time,
      "⛔ a stale end time under-books the diary and lets the next customer be booked on top of this one",
    ).toBe("15:30:00");
  });

  it("⛔ changes NOTHING else about the booking", async () => {
    const stub = stubAdminClient(baseBooking());

    await rescheduleBooking(moveForm());

    const payload = stub.bookingUpdates()[0].payload as Record<string, unknown>;
    expect(
      Object.keys(payload).sort(),
      "⛔ this action moves a booking. It is not a second booking editor — price, service, people and therapist all have their own paths",
    ).toEqual(["booking_date", "end_time", "start_time"]);
  });

  it("closes an outstanding customer request when the move answers it", async () => {
    const stub = stubAdminClient(baseBooking({ reschedule_status: "requested" }));

    await rescheduleBooking(moveForm());

    const payload = stub.bookingUpdates()[0].payload as Record<string, unknown>;
    expect(
      payload.reschedule_status,
      "⛔ otherwise the request sits 'requested' for ever and the booking keeps showing in the attention queue after the very thing it asked for has happened",
    ).toBe("completed");
  });

  it("leaves the reschedule status alone when there was no request", async () => {
    const stub = stubAdminClient(baseBooking({ reschedule_status: "none" }));

    await rescheduleBooking(moveForm());

    const payload = stub.bookingUpdates()[0].payload as Record<string, unknown>;
    expect(payload).not.toHaveProperty("reschedule_status");
  });

  it("⛔ moves the manage link's expiry with the booking", async () => {
    const stub = stubAdminClient(baseBooking({ manage_token_hash: "a-hash" }));

    await rescheduleBooking(moveForm());

    const payload = stub.bookingUpdates()[0].payload as Record<string, unknown>;
    expect(
      payload.manage_token_expires_at,
      "⛔ the expiry is derived from the booking date. Moving a booking LATER without this leaves the customer's own manage link dead before the appointment it belongs to",
    ).toBe(new Date(`${FURTHER}T23:59:59.000Z`).toISOString());
  });

  it("does not invent an expiry for a booking that has no manage link", async () => {
    const stub = stubAdminClient(baseBooking({ manage_token_hash: null }));

    await rescheduleBooking(moveForm());

    const payload = stub.bookingUpdates()[0].payload as Record<string, unknown>;
    expect(payload).not.toHaveProperty("manage_token_expires_at");
  });

  it("records the move in the audit trail", async () => {
    const stub = stubAdminClient(baseBooking());

    await rescheduleBooking(moveForm());

    const audit = stub.ops.find((entry) => entry.table === "audit_logs" && entry.op === "insert");
    expect(audit, "moving a customer's appointment is a real decision").toBeTruthy();
    expect((audit?.payload as Record<string, unknown>).action_type).toBe("booking_rescheduled");
  });
});

describe("rescheduleBooking — the availability call itself", () => {
  it("⛔ excludes the booking being moved, so it cannot block itself", async () => {
    stubAdminClient(baseBooking());

    await rescheduleBooking(moveForm());

    expect(checkSeriesSlots).toHaveBeenCalledWith(
      expect.objectContaining({
        excludeBookingId: "booking-1",
        dates: [FURTHER],
        startTime: "14:00",
      }),
      expect.anything(),
      // ⛔ D-033's principle: hiding a service must not make an existing
      // booking immovable.
      expect.objectContaining({ includeHiddenServices: true }),
    );
  });

  it("⛔ fails CLOSED when the booking cannot be described", async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => {
        const chain: Record<string, unknown> = {
          eq: () => chain,
          not: () => chain,
          select: () => chain,
          single: () => Promise.resolve({ data: baseBooking(), error: null }),
          maybeSingle: () => Promise.resolve({ data: baseBooking(), error: null }),
          // Every list read comes back empty — no services, no participants.
          then: (fn: (value: unknown) => unknown) =>
            Promise.resolve({ data: [], error: null }).then(fn),
        };
        return { select: () => chain, update: () => chain, insert: () => chain };
      }),
    } as unknown as ReturnType<typeof createSupabaseAdminClient>);

    const result = await rescheduleBooking(moveForm());

    expect(
      result,
      "⛔ not being able to CHECK is not the same as the slot being free. An empty participant list would ask the engine for nobody, which every slot satisfies",
    ).toMatchObject({ error: expect.stringContaining("cannot be checked") });
    expect(checkSeriesSlots).not.toHaveBeenCalled();
  });
});
