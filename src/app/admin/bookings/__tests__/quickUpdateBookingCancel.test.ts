import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendEmail } from "@/lib/email/client";
import { getStaffProfile, PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { quickUpdateBooking, updateBookingManagement } from "../actions";

/**
 * C-04a Phase H (Change 14) — the 10-second undo window on an admin
 * cancellation.
 *
 * Unlike the sibling action specs, `@/lib/email/notifications` is deliberately
 * REAL here. The thing this phase changed is one option — `delaySeconds: 10` —
 * and its whole effect happens inside `sendTrackedEmail`: instead of calling
 * Resend it parks a fully rendered `email_delivery_events` row as `queued` with
 * a `scheduled_for` in the future, for the scheduled-emails cron to drain. With
 * the notifications module stubbed, none of that is observable and the only
 * assertable fact is "an option object was passed" — which cannot tell a working
 * undo window from a broken one.
 *
 * Resend is unreachable regardless: `@/lib/email/client` is mocked in its
 * entirety and `sendEmail` is the only function in the codebase that talks to
 * the provider. Every address in this file ends `.example.test`.
 */

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({}),
}));

// Only the profile lookup is stubbed — the permission helpers stay real so the
// action is gated exactly as it is in production.
vi.mock("@/lib/auth/rbac", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/rbac")>()),
  getStaffProfile: vi.fn(),
}));

// The provider boundary, closed. Nothing below this line can reach Resend.
vi.mock("@/lib/email/client", () => ({
  sendEmail: vi.fn().mockResolvedValue({ id: "resend-stub-id" }),
  getFromEmail: vi.fn(() => "Rahma Therapy <no-reply@rahmatherapy.example.test>"),
  getSiteUrl: vi.fn(() => "https://rahmatherapy.example.test"),
  extractEmailAddress: vi.fn((value: string) => value),
}));

vi.mock("@/lib/ops/operational-events", () => ({
  recordOperationalEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/booking/manage-token", () => ({
  ensureBookingManageUrl: vi.fn().mockResolvedValue(null),
}));

/**
 * A named instant, not `getBusinessDate()`-derived: `scheduled_for` and
 * `cancelled_at` are only assertable to the millisecond if the clock is pinned.
 * The booking is dated the following day so it stays restorable — S6 refuses a
 * restore once the appointment moment has gone, which the undo path needs.
 */
const NOW = new Date("2026-07-28T10:00:00.000Z");
const UNDO_WINDOW_SECONDS = 10;
const CUSTOMER_EMAIL = "aisha@client.example.test";
const ADMIN_EMAIL = "bookings@rahmatherapy.example.test";

const SETTINGS = {
  company_name: "Rahma Therapy Test",
  contact_email: ADMIN_EMAIL,
  contact_phone: "01582 000000",
};

const FUTURE_CONFIRMED_BOOKING: Record<string, unknown> = {
  id: "booking-1",
  client_id: "client-1",
  status: "confirmed",
  booking_date: "2026-07-29",
  start_time: "14:00:00",
  end_time: "15:00:00",
  total_price: 55,
  amount_due: 55,
  amount_paid: 0,
  paid_at: null,
  payment_status: "unpaid",
  payment_method: null,
  payment_note: null,
  admin_notes: null,
  treatment_notes: null,
  customer_manage_notes: null,
  cancelled_at: null,
  customer_cancelled_at: null,
  customer_cancellation_note: null,
  contact_full_name: "Aisha Khan",
  contact_email: CUSTOMER_EMAIL,
  contact_phone: "07123456789",
  group_booking: false,
  service_address_line1: "10 Test Street",
  service_address_line2: null,
  service_city: "Luton",
  service_postcode: "LU1 1AA",
  access_notes: null,
  customer_notes: null,
  clients: {
    full_name: "Aisha Khan",
    phone: "07123456789",
    email: CUSTOMER_EMAIL,
    deleted_at: null,
  },
  booking_participants: [],
  booking_items: [],
  booking_assignments: [],
};

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

const owner = staff("Owner", [PERMISSIONS.MANAGE_BOOKINGS_ALL]);

interface RecordedOp {
  table: string;
  op: "select" | "update" | "insert";
  payload?: Record<string, unknown>;
  filters: string[];
  eq: [string, unknown][];
}

/**
 * Stand-in for the Supabase admin client, wide enough for the whole cancel →
 * restore → cancel round trip: the booking row, business settings, the assigned
 * staff lookup, the audit trail, and `email_delivery_events` as a real little
 * table so a queued row can be inserted, swept and read back.
 */
function stubAdminClient(overrides: Record<string, unknown> = {}) {
  const booking: Record<string, unknown> = {
    ...FUTURE_CONFIRMED_BOOKING,
    ...overrides,
  };
  const emailEvents: Record<string, unknown>[] = [];
  const ops: RecordedOp[] = [];

  function resolve(entry: RecordedOp) {
    if (entry.table === "bookings") {
      if (entry.op === "update") Object.assign(booking, entry.payload);
      return { data: { ...booking }, error: null };
    }
    if (entry.table === "business_settings") {
      return { data: SETTINGS, error: null };
    }
    if (entry.table === "booking_assignments") {
      return { data: [], error: null };
    }
    if (entry.table === "email_delivery_events") {
      if (entry.op === "insert") {
        emailEvents.push({ ...entry.payload });
        return { data: null, error: null };
      }
      // The restore sweep: `update(...).eq(...).eq(...).eq(...)` with an exact
      // count. Applying the filters for real is what makes
      // `delivery_status = 'queued'` a load-bearing predicate here.
      const matches = emailEvents.filter((row) =>
        entry.eq.every(([column, value]) => row[column] === value)
      );
      for (const row of matches) Object.assign(row, entry.payload);
      return { data: null, count: matches.length, error: null };
    }
    return { data: null, error: null };
  }

  function startOp(
    table: string,
    op: RecordedOp["op"],
    payload?: Record<string, unknown>
  ) {
    const entry: RecordedOp = { table, op, payload, filters: [], eq: [] };
    ops.push(entry);
    const settle = () => Promise.resolve(resolve(entry));
    const chain = {
      eq: (column: string, value: unknown) => {
        entry.filters.push(`eq:${column}=${String(value)}`);
        entry.eq.push([column, value]);
        return chain;
      },
      not: (column: string, operator: string, value: unknown) => {
        entry.filters.push(`not:${column}.${operator}.${String(value)}`);
        return chain;
      },
      select: () => chain,
      returns: () => settle(),
      single: () => settle(),
      maybeSingle: () => settle(),
      then: (
        onFulfilled?: ((value: unknown) => unknown) | null,
        onRejected?: ((reason: unknown) => unknown) | null
      ) => settle().then(onFulfilled, onRejected),
    };
    return chain;
  }

  const from = vi.fn((table: string) => ({
    select: () => startOp(table, "select"),
    update: (payload: Record<string, unknown>) => startOp(table, "update", payload),
    insert: (payload: Record<string, unknown>) => startOp(table, "insert", payload),
  }));

  const client = { from } as unknown as ReturnType<typeof createSupabaseAdminClient>;
  vi.mocked(createSupabaseAdminClient).mockReturnValue(client);

  const find = (table: string, op: RecordedOp["op"]) =>
    ops.filter((entry) => entry.table === table && entry.op === op);
  const queuedCustomerEmails = () =>
    emailEvents.filter(
      (row) =>
        row.event_type === "booking_cancellation_customer" &&
        row.delivery_status === "queued"
    );

  return { ops, find, booking, emailEvents, queuedCustomerEmails, client };
}

function quickFormData(action: string) {
  const formData = new FormData();
  formData.set("booking_id", "booking-1");
  formData.set("action", action);
  return formData;
}

/** The Status & payment form's payload, minus whatever a test overrides. */
function statusFormData(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("booking_id", "booking-1");
  formData.set("status", "cancelled");
  formData.set("payment_status", "unpaid");
  formData.set("amount_paid", "0");
  for (const [key, value] of Object.entries(overrides)) formData.set(key, value);
  return formData;
}

function sentAddresses() {
  return vi.mocked(sendEmail).mock.calls.map((call) => call[0].to);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.mocked(getStaffProfile).mockResolvedValue(owner);
  vi.mocked(sendEmail).mockResolvedValue({ id: "resend-stub-id" } as never);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("quickUpdateBooking — cancel opens a 10-second undo window", () => {
  // Fails in production if `delaySeconds` stops reaching
  // `sendBookingCancellationEmails`, or if `sendTrackedEmail`'s queue branch
  // stops writing a row the cron can find: the customer's cancellation would go
  // out at once and the Undo button would be offering something it cannot do.
  it("parks the customer email as a queued row instead of sending it", async () => {
    const stub = stubAdminClient();

    expect(await quickUpdateBooking(quickFormData("cancel"))).toEqual({
      success: true,
    });

    const queued = stub.queuedCustomerEmails();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      booking_id: "booking-1",
      event_type: "booking_cancellation_customer",
      recipient_email: CUSTOMER_EMAIL,
      recipient_role: "customer",
      to_email: CUSTOMER_EMAIL,
      staff_id: null,
      subject: "Rahma Therapy Test booking cancelled",
      delivery_status: "queued",
      // Exactly the undo window, to the millisecond — the whole point of the
      // pinned clock. A drifting delay would still "look" queued.
      scheduled_for: new Date(
        NOW.getTime() + UNDO_WINDOW_SECONDS * 1000
      ).toISOString(),
    });
    // The rendered email travels with the row: the cron sends this payload
    // verbatim and never re-renders, so an empty body here is an empty email.
    expect(String(queued[0].html_payload)).toContain("Aisha Khan");
    expect(String(queued[0].text_payload).length).toBeGreaterThan(0);
  });

  // The delay is scoped to the customer leg. Fails if someone "simplifies" it
  // onto the whole broadcast — the client's cancellation is the only leg an
  // admin can undo; the internal ones want real-time notice.
  it("still sends the internal legs immediately", async () => {
    stubAdminClient();

    await quickUpdateBooking(quickFormData("cancel"));

    expect(sentAddresses()).toContain(ADMIN_EMAIL);
    expect(sentAddresses()).not.toContain(CUSTOMER_EMAIL);
  });

  // S7. Fails if the stamp is dropped or moved to its own round trip: a
  // cancelled booking with no cancellation moment makes
  // `isRestoreWindowExpired` fail closed, so Restore disappears from a booking
  // cancelled a second ago — on the row menu, the detail strip and the server.
  it("stamps cancelled_at in the same UPDATE that writes the status", async () => {
    const stub = stubAdminClient();

    await quickUpdateBooking(quickFormData("cancel"));

    const update = stub.find("bookings", "update").at(-1)!;
    expect(update.payload).toEqual({
      status: "cancelled",
      cancelled_at: NOW.toISOString(),
    });
    expect(update.filters).toEqual(["eq:id=booking-1"]);
  });

  // The window restarts, it does not run from the first cancellation. Fails if
  // the stamp is written only when `cancelled_at` is empty, which would leave a
  // re-cancelled booking un-restorable 28 days after a cancellation the admin
  // has already undone.
  it("re-stamps cancelled_at when a restored booking is cancelled again", async () => {
    const stub = stubAdminClient();

    await quickUpdateBooking(quickFormData("cancel"));
    expect(stub.find("bookings", "update").at(-1)!.payload).toMatchObject({
      cancelled_at: NOW.toISOString(),
    });

    // Undo, exactly as the toast does it.
    const undo = quickFormData("restore");
    undo.set("target_status", "confirmed");
    expect(await quickUpdateBooking(undo)).toEqual({ success: true });

    const later = new Date(NOW.getTime() + 5 * 60 * 1000);
    vi.setSystemTime(later);

    expect(await quickUpdateBooking(quickFormData("cancel"))).toEqual({
      success: true,
    });
    expect(stub.find("bookings", "update").at(-1)!.payload).toEqual({
      status: "cancelled",
      cancelled_at: later.toISOString(),
    });
  });

  // The undo window's other half: the restore has to kill the row before the
  // cron finds it. Fails if the sweep's predicate or its target status drifts —
  // the client would then receive a cancellation for a booking that is back on.
  it("lets the Undo restore sweep the queued row to cancelled_by_restore", async () => {
    const stub = stubAdminClient();

    await quickUpdateBooking(quickFormData("cancel"));
    expect(stub.queuedCustomerEmails()).toHaveLength(1);

    const undo = quickFormData("restore");
    undo.set("target_status", "confirmed");
    expect(await quickUpdateBooking(undo)).toEqual({ success: true });

    expect(stub.queuedCustomerEmails()).toHaveLength(0);
    expect(
      stub.emailEvents.filter(
        (row) => row.delivery_status === "cancelled_by_restore"
      )
    ).toHaveLength(1);
    // The client heard nothing, so there is nothing to apologise for: the
    // "your booking is back on" email is suppressed (brief §5.9).
    expect(sentAddresses()).not.toContain(CUSTOMER_EMAIL);
  });
});

describe("updateBookingManagement — the Status form opens the same window", () => {
  // The second admin cancel path. Fails if only the row menu is wired: the
  // detail page's Status form would send the client's cancellation instantly
  // while its toast promised ten seconds and an Undo.
  it("queues the customer email and stamps cancelled_at", async () => {
    const stub = stubAdminClient();

    expect(await updateBookingManagement({}, statusFormData())).toEqual({
      success: true,
    });

    expect(stub.queuedCustomerEmails()).toHaveLength(1);
    expect(stub.queuedCustomerEmails()[0]).toMatchObject({
      delivery_status: "queued",
      scheduled_for: new Date(
        NOW.getTime() + UNDO_WINDOW_SECONDS * 1000
      ).toISOString(),
    });
    expect(stub.find("bookings", "update").at(-1)!.payload).toMatchObject({
      status: "cancelled",
      cancelled_at: NOW.toISOString(),
    });
    expect(sentAddresses()).not.toContain(CUSTOMER_EMAIL);
  });

  // Both Notes forms re-post the booking's own status through
  // `HiddenStatusPayload`. Fails if the stamp keys on the status being written
  // rather than on the transition: saving a note on a booking cancelled three
  // weeks ago would silently restart its 28-day window and re-queue a second
  // cancellation email to a client who was told once already.
  it("neither re-stamps nor re-queues when a notes save re-posts cancelled", async () => {
    const cancelledAt = "2026-07-08T09:00:00.000Z";
    const stub = stubAdminClient({ status: "cancelled", cancelled_at: cancelledAt });

    expect(
      await updateBookingManagement(
        {},
        statusFormData({ treatment_notes: "Left a voicemail." })
      )
    ).toEqual({ success: true });

    const update = stub.find("bookings", "update").at(-1)!;
    expect(update.payload).not.toHaveProperty("cancelled_at");
    expect(stub.booking.cancelled_at).toBe(cancelledAt);
    expect(stub.emailEvents).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("updateBookingManagement — leaving cancelled kills the queued email", () => {
  // The blocker this round was opened to close. The Status form is a second way
  // OUT of `cancelled`, and it had no cancellation logic at all on that
  // direction: `isCancellationTransition` is false when the booking is already
  // cancelled, so the queued row was left for the cron. Concrete failure — admin
  // cancels here, the toast expires, admin changes their mind at T+90s and drives
  // the same dropdown back to Confirmed; without the sweep the cron then sends
  // the client a cancellation for a booking that is live.
  //
  // Delete the sweep from `updateBookingManagement` and this fails: the queued
  // row survives.
  it("sweeps the queued cancellation and clears the cancellation columns", async () => {
    const stub = stubAdminClient();

    expect(await updateBookingManagement({}, statusFormData())).toEqual({
      success: true,
    });
    expect(stub.queuedCustomerEmails()).toHaveLength(1);

    // Long past the undo window — there is no toast left to press Undo on.
    vi.setSystemTime(new Date(NOW.getTime() + 90_000));

    expect(
      await updateBookingManagement({}, statusFormData({ status: "confirmed" }))
    ).toEqual({ success: true });

    expect(stub.queuedCustomerEmails()).toHaveLength(0);
    expect(
      stub.emailEvents.filter(
        (row) => row.delivery_status === "cancelled_by_restore"
      )
    ).toHaveLength(1);
    expect(sentAddresses()).not.toContain(CUSTOMER_EMAIL);

    // The same three filters `restoreBooking` sweeps with, and no fourth on
    // `scheduled_for`: a row that is already due but not yet drained is exactly
    // the one that must still be caught.
    const sweep = stub.find("email_delivery_events", "update").at(-1)!;
    expect(sweep.payload).toEqual({ delivery_status: "cancelled_by_restore" });
    expect(sweep.filters).toEqual([
      "eq:booking_id=booking-1",
      "eq:event_type=booking_cancellation_customer",
      "eq:delivery_status=queued",
    ]);

    // A live booking must not keep a cancellation moment: `getCancellationMoment`
    // reads all three columns.
    expect(stub.find("bookings", "update").at(-1)!.payload).toMatchObject({
      status: "confirmed",
      cancelled_at: null,
      customer_cancelled_at: null,
      customer_cancellation_note: null,
    });

    // The audit does not go silent on a path that suppressed a client email.
    expect(
      stub.find("audit_logs", "insert").at(-1)!.payload!.after_state
    ).toMatchObject({ cancelled_queued_email: true });
  });

  // Over-blocking canary: every other save through this form — including both
  // Notes forms, which re-post the booking's own status — must leave the queue
  // and the cancellation columns alone.
  it("touches neither the queue nor the cancellation columns on an ordinary save", async () => {
    const stub = stubAdminClient();

    expect(
      await updateBookingManagement({}, statusFormData({ status: "confirmed" }))
    ).toEqual({ success: true });

    expect(stub.find("email_delivery_events", "update")).toHaveLength(0);
    const update = stub.find("bookings", "update").at(-1)!;
    expect(update.payload).not.toHaveProperty("cancelled_at");
    expect(update.payload).not.toHaveProperty("customer_cancelled_at");
    expect(
      stub.find("audit_logs", "insert").at(-1)!.payload!.after_state
    ).not.toHaveProperty("cancelled_queued_email");
  });
});
