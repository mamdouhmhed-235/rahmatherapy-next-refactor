import { updateTag } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  sendAssignedStaffBookingChangeEmails,
  sendBookingRestoredClientEmail,
} from "@/lib/email/notifications";
import { getStaffProfile, PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { restoreBooking } from "../actions";

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

vi.mock("@/lib/email/notifications", () => ({
  sendBookingCreatedEmails: vi.fn(),
  sendAssignedStaffBookingChangeEmails: vi.fn(),
  sendBookingCancellationEmails: vi.fn(),
  sendBookingRestoredClientEmail: vi.fn(),
  sendStaffAssignmentEmail: vi.fn(),
}));

vi.mock("@/lib/booking/manage-token", () => ({
  ensureBookingManageUrl: vi.fn(),
}));

/** 2026-07-28 10:00Z — 11:00 Europe/London (BST). */
const NOW = new Date("2026-07-28T10:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const daysBeforeNow = (days: number, extraMs = 0) =>
  new Date(NOW.getTime() - days * DAY_MS - extraMs).toISOString();

const BOOKING_ROW = {
  id: "booking-1",
  client_id: "client-1",
  status: "cancelled",
  // Future appointment so S6 passes unless a test says otherwise.
  booking_date: "2026-08-20",
  start_time: "14:00:00",
  total_price: 55,
  customer_cancelled_at: daysBeforeNow(2),
  customer_cancellation_note: "Family emergency.",
  clients: { deleted_at: null } as { deleted_at: string | null } | null,
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
const therapist = staff("Therapist", [PERMISSIONS.MANAGE_BOOKINGS_ASSIGNED]);

const MISSING_CANCELLED_AT = {
  code: "PGRST204",
  message:
    "Could not find the 'cancelled_at' column of 'bookings' in the schema cache",
};

/** Pre-Phase-F: `scheduled_for` does not exist, so the queue sweep 400s. */
const MISSING_SCHEDULED_FOR = {
  code: "42703",
  message: "column email_delivery_events.scheduled_for does not exist",
};

interface RecordedOp {
  table: string;
  op: "select" | "update" | "insert";
  payload?: Record<string, unknown>;
  filters: string[];
  selected?: string;
}

interface StubResult {
  data?: unknown;
  error?: { code?: string; message: string } | null;
  count?: number | null;
}

/**
 * Stand-in for the Supabase admin client covering exactly the chains
 * `restoreBooking` builds.
 *
 * The `bookings` read models PostgREST faithfully in the one way that matters:
 * an embedded relation only comes back when the select NAMES it. Drop
 * `clients(deleted_at)` from the action and the deleted-client guard goes
 * quietly dead — tsc cannot see it, because the admin client is untyped.
 */
function stubAdminClient({
  booking = BOOKING_ROW as Record<string, unknown>,
  bookingsHaveCancelledAt = false,
  queuedEmail = { count: null, error: MISSING_SCHEDULED_FOR } as StubResult,
  /**
   * One queued cancellation row for the sweep to match, and the `scheduled_for`
   * it carries. When set, the count is derived by applying the sweep's OWN
   * filters to that row instead of being handed back verbatim — so a filter that
   * wrongly excludes it shows up here as a real miss.
   */
  queuedRowScheduledFor = null as string | null,
  bookingUpdateError = null as { code?: string; message: string } | null,
} = {}) {
  const ops: RecordedOp[] = [];
  const { clients: embeddedClient, ...bookingColumns } = booking as {
    clients?: unknown;
  };

  function resolve(entry: RecordedOp): StubResult {
    if (entry.table === "bookings") {
      if (entry.op === "select") {
        return {
          data: entry.selected?.includes("clients(")
            ? { ...bookingColumns, clients: embeddedClient }
            : bookingColumns,
          error: null,
        };
      }
      if (bookingUpdateError) return { data: null, error: bookingUpdateError };
      if (
        Object.hasOwn(entry.payload ?? {}, "cancelled_at") &&
        !bookingsHaveCancelledAt
      ) {
        return { data: null, error: MISSING_CANCELLED_AT };
      }
      return { data: { ...bookingColumns, ...entry.payload }, error: null };
    }
    if (entry.table === "email_delivery_events") {
      if (queuedRowScheduledFor === null) return queuedEmail;
      // A `scheduled_for > now` filter excludes a row that is already due, which
      // is precisely the row the cron has not drained yet.
      const missedByTimestampFilter = entry.filters.some(
        (filter) =>
          filter.startsWith("gt:scheduled_for=") &&
          queuedRowScheduledFor <= filter.slice("gt:scheduled_for=".length)
      );
      return { count: missedByTimestampFilter ? 0 : 1, error: null };
    }
    return { data: null, error: null };
  }

  function startOp(
    table: string,
    op: RecordedOp["op"],
    payload?: Record<string, unknown>
  ) {
    const entry: RecordedOp = { table, op, payload, filters: [] };
    ops.push(entry);
    const chain = {
      eq: (column: string, value: unknown) => {
        entry.filters.push(`eq:${column}=${String(value)}`);
        return chain;
      },
      gt: (column: string, value: unknown) => {
        entry.filters.push(`gt:${column}=${String(value)}`);
        return chain;
      },
      select: (columns?: string) => {
        if (columns !== undefined) entry.selected = columns;
        return chain;
      },
      single: <T,>() =>
        Promise.resolve(resolve(entry) as unknown as { data: T | null; error: unknown }),
      then: (
        onFulfilled: (value: StubResult) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => Promise.resolve(resolve(entry)).then(onFulfilled, onRejected),
    };
    return chain;
  }

  const from = vi.fn((table: string) => {
    if (table === "audit_logs") {
      return {
        insert: async (row: Record<string, unknown>) => {
          ops.push({ table, op: "insert", payload: row, filters: [] });
          return { error: null };
        },
      };
    }
    return {
      select: (columns: string) => startOp(table, "select").select(columns),
      update: (payload: Record<string, unknown>) =>
        startOp(table, "update", payload),
    };
  });

  const client = { from } as unknown as ReturnType<typeof createSupabaseAdminClient>;
  vi.mocked(createSupabaseAdminClient).mockReturnValue(client);

  const find = (table: string, op: RecordedOp["op"]) =>
    ops.filter((entry) => entry.table === table && entry.op === op);
  const audit = () => find("audit_logs", "insert")[0]?.payload;

  return { ops, find, audit, client };
}

function restoreFormData(
  overrides: Record<string, string> = {},
  bookingId: string | null = "booking-1"
) {
  const formData = new FormData();
  if (bookingId !== null) formData.set("booking_id", bookingId);
  for (const [key, value] of Object.entries(overrides)) formData.set(key, value);
  return formData;
}

describe("restoreBooking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.mocked(getStaffProfile).mockResolvedValue(owner);
    // Both sends are awaited with a `.catch` tail, so they have to be thenable.
    vi.mocked(sendBookingRestoredClientEmail).mockReset().mockResolvedValue();
    vi.mocked(sendAssignedStaffBookingChangeEmails).mockReset().mockResolvedValue();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("restores a cancelled booking and clears its stale cancellation fields", async () => {
    const stub = stubAdminClient();

    expect(await restoreBooking(restoreFormData())).toEqual({ success: true });

    const update = stub.find("bookings", "update").at(-1)!;
    expect(update.payload).toEqual({
      status: "confirmed",
      customer_cancelled_at: null,
      customer_cancellation_note: null,
    });
    expect(update.filters).toEqual(["eq:id=booking-1"]);

    expect(stub.audit()).toMatchObject({
      actor_staff_id: owner.id,
      action_type: "booking_restored",
      target_type: "bookings",
      target_id: "booking-1",
    });
    expect(stub.audit()!.after_state).toMatchObject({
      status: "confirmed",
      restore_from_status: "cancelled",
      restore_target_status: "confirmed",
      cancelled_queued_email: false,
    });

    expect(sendBookingRestoredClientEmail).toHaveBeenCalledWith(
      "booking-1",
      stub.client,
      { fromStatus: "cancelled" }
    );
    expect(sendAssignedStaffBookingChangeEmails).toHaveBeenCalledWith(
      "booking-1",
      stub.client,
      "Booking restored from cancelled to confirmed."
    );
  });

  // The whole reason `clients(deleted_at)` is named in the select. If someone
  // "simplifies" it back to `select("*")`, PostgREST stops embedding the
  // relation, the guard reads `undefined` forever, and this spec is the only
  // thing standing between that and a silently dead refusal.
  it("names the clients embed in the pre-image select", async () => {
    const stub = stubAdminClient();

    await restoreBooking(restoreFormData());

    expect(stub.find("bookings", "select")[0].selected).toContain(
      "clients(deleted_at)"
    );
  });

  it("refuses a booking whose client has been deleted", async () => {
    const stub = stubAdminClient({
      booking: { ...BOOKING_ROW, clients: { deleted_at: "2026-07-01T09:00:00Z" } },
    });

    expect(await restoreBooking(restoreFormData())).toEqual({
      error:
        "This booking's client has been deleted, so it can no longer be restored.",
    });
    expect(stub.find("bookings", "update")).toHaveLength(0);
    expect(sendBookingRestoredClientEmail).not.toHaveBeenCalled();
  });

  it("keeps the embedded client out of the audit row's before_state", async () => {
    const stub = stubAdminClient();

    await restoreBooking(restoreFormData());

    expect(stub.audit()!.before_state).not.toHaveProperty("clients");
    expect(stub.audit()!.before_state).toMatchObject({ status: "cancelled" });
  });

  it("restores a no_show booking", async () => {
    const stub = stubAdminClient({
      booking: {
        ...BOOKING_ROW,
        status: "no_show",
        customer_cancelled_at: null,
        customer_cancellation_note: null,
      },
    });

    expect(await restoreBooking(restoreFormData())).toEqual({ success: true });

    // Not a cancellation, so nothing to clear.
    expect(stub.find("bookings", "update").at(-1)!.payload).toEqual({
      status: "confirmed",
    });
    expect(stub.audit()!.after_state).toMatchObject({
      restore_from_status: "no_show",
    });
    expect(sendBookingRestoredClientEmail).toHaveBeenCalledWith(
      "booking-1",
      stub.client,
      { fromStatus: "no_show" }
    );
  });

  it("refuses to reopen a completed booking without the force flag", async () => {
    const stub = stubAdminClient({ booking: { ...BOOKING_ROW, status: "completed" } });

    expect(await restoreBooking(restoreFormData())).toEqual({
      error: "Reopening a completed booking requires confirmation and a reason.",
      fieldErrors: { force_completed_reversal: "Confirm via the modal." },
    });
    expect(stub.find("bookings", "update")).toHaveLength(0);
  });

  it("refuses to reopen a completed booking with a too-short reason", async () => {
    const stub = stubAdminClient({ booking: { ...BOOKING_ROW, status: "completed" } });

    expect(
      await restoreBooking(
        restoreFormData({ force_completed_reversal: "on", reason: "oops" })
      )
    ).toEqual({
      error: "Reopening a completed booking requires confirmation and a reason.",
      fieldErrors: { reason: "Provide a reason (min 5 chars)." },
    });
    expect(stub.find("bookings", "update")).toHaveLength(0);
  });

  it("reopens a completed booking with the force flag and a reason", async () => {
    const stub = stubAdminClient({ booking: { ...BOOKING_ROW, status: "completed" } });

    expect(
      await restoreBooking(
        restoreFormData({
          force_completed_reversal: "on",
          reason: "Client returned for the retreat.",
        })
      )
    ).toEqual({ success: true });

    expect(stub.audit()!.after_state).toMatchObject({
      restore_from_status: "completed",
      force_completed: true,
      reason: "Client returned for the retreat.",
    });
  });

  it("refuses a booking that is neither cancelled, no-show nor completed", async () => {
    const stub = stubAdminClient({ booking: { ...BOOKING_ROW, status: "confirmed" } });

    expect(await restoreBooking(restoreFormData())).toEqual({
      error: "Only cancelled, no-show, or completed bookings can be restored.",
    });
    expect(stub.find("bookings", "update")).toHaveLength(0);
  });

  it("refuses an actor who cannot manage all bookings", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(therapist);
    const stub = stubAdminClient();

    expect(await restoreBooking(restoreFormData())).toEqual({
      error: "Insufficient permissions.",
    });
    expect(stub.ops).toHaveLength(0);
  });

  it("rejects an unsupported restore target", async () => {
    const stub = stubAdminClient();

    expect(
      await restoreBooking(restoreFormData({ target_status: "completed" }))
    ).toEqual({ fieldErrors: { target_status: "Choose a valid restore target." } });
    expect(stub.ops).toHaveLength(0);
  });

  it("still succeeds when the client email fails", async () => {
    const stub = stubAdminClient();
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(sendBookingRestoredClientEmail).mockRejectedValueOnce(
      new Error("Booking client has no email address.")
    );

    expect(await restoreBooking(restoreFormData())).toEqual({ success: true });
    // The status flip and the audit row are the source of truth; the email is not.
    expect(stub.find("bookings", "update")).not.toHaveLength(0);
    expect(stub.audit()).toBeDefined();
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });

  it("invalidates the real report and dashboard cache tags", async () => {
    stubAdminClient();

    await restoreBooking(restoreFormData());

    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([
      "report-data",
      "dashboard-data",
    ]);
  });

  describe("S6 — past-datetime guard", () => {
    const PAST_ERROR =
      "This booking's appointment time has already passed and cannot be restored.";

    it("refuses a cancelled booking whose appointment has been and gone", async () => {
      const stub = stubAdminClient({
        booking: { ...BOOKING_ROW, booking_date: "2026-07-20", start_time: "14:00:00" },
      });

      expect(await restoreBooking(restoreFormData())).toEqual({ error: PAST_ERROR });
      expect(stub.find("bookings", "update")).toHaveLength(0);
      expect(sendBookingRestoredClientEmail).not.toHaveBeenCalled();
      expect(sendAssignedStaffBookingChangeEmails).not.toHaveBeenCalled();
    });

    // C-05's date-only lockdown still treats this as active. Restore is stricter.
    it("refuses this morning's booking viewed this afternoon", async () => {
      stubAdminClient({
        booking: { ...BOOKING_ROW, booking_date: "2026-07-28", start_time: "09:00:00" },
      });

      expect(await restoreBooking(restoreFormData())).toEqual({ error: PAST_ERROR });
    });

    it("allows this afternoon's booking viewed this morning", async () => {
      stubAdminClient({
        booking: { ...BOOKING_ROW, booking_date: "2026-07-28", start_time: "14:00:00" },
      });

      expect(await restoreBooking(restoreFormData())).toEqual({ success: true });
    });

    it("does not apply to a completed reopen", async () => {
      stubAdminClient({
        booking: {
          ...BOOKING_ROW,
          status: "completed",
          booking_date: "2026-07-20",
          start_time: "14:00:00",
        },
      });

      expect(
        await restoreBooking(
          restoreFormData({
            force_completed_reversal: "on",
            reason: "Marked complete on the wrong booking.",
          })
        )
      ).toEqual({ success: true });
    });
  });

  describe("S7 — 28-day restore window", () => {
    const EXPIRED_ERROR =
      "This booking was cancelled more than 28 days ago and can no longer be restored.";

    it("allows a cancellation 27 days old", async () => {
      stubAdminClient({
        booking: { ...BOOKING_ROW, customer_cancelled_at: daysBeforeNow(27) },
      });

      expect(await restoreBooking(restoreFormData())).toEqual({ success: true });
    });

    it("refuses a cancellation 29 days old", async () => {
      const stub = stubAdminClient({
        booking: { ...BOOKING_ROW, customer_cancelled_at: daysBeforeNow(29) },
      });

      expect(await restoreBooking(restoreFormData())).toEqual({ error: EXPIRED_ERROR });
      expect(stub.find("bookings", "update")).toHaveLength(0);
      expect(sendBookingRestoredClientEmail).not.toHaveBeenCalled();
    });

    it("allows the exact 28×24h boundary and refuses one millisecond past it", async () => {
      stubAdminClient({
        booking: { ...BOOKING_ROW, customer_cancelled_at: daysBeforeNow(28) },
      });
      expect(await restoreBooking(restoreFormData())).toEqual({ success: true });

      stubAdminClient({
        booking: { ...BOOKING_ROW, customer_cancelled_at: daysBeforeNow(28, 1) },
      });
      expect(await restoreBooking(restoreFormData())).toEqual({ error: EXPIRED_ERROR });
    });

    // Fail-closed: if stamping ever regresses, old cancellations lock rather
    // than staying restorable forever.
    it("treats an unknown cancellation moment as expired", async () => {
      stubAdminClient({
        booking: { ...BOOKING_ROW, cancelled_at: null, customer_cancelled_at: null },
      });

      expect(await restoreBooking(restoreFormData())).toEqual({ error: EXPIRED_ERROR });
    });

    it("prefers cancelled_at over customer_cancelled_at once the column exists", async () => {
      // Customer stamp is ancient; the unified admin stamp is fresh and wins.
      stubAdminClient({
        bookingsHaveCancelledAt: true,
        booking: {
          ...BOOKING_ROW,
          cancelled_at: daysBeforeNow(1),
          customer_cancelled_at: daysBeforeNow(90),
        },
      });

      expect(await restoreBooking(restoreFormData())).toEqual({ success: true });
    });

    it("does not window a completed reopen", async () => {
      stubAdminClient({
        booking: {
          ...BOOKING_ROW,
          status: "completed",
          customer_cancelled_at: daysBeforeNow(40),
        },
      });

      expect(
        await restoreBooking(
          restoreFormData({
            force_completed_reversal: "on",
            reason: "Reopened after a billing correction.",
          })
        )
      ).toEqual({ success: true });
    });
  });

  describe("cancelled_at clearing", () => {
    it("clears cancelled_at once the column exists", async () => {
      const stub = stubAdminClient({ bookingsHaveCancelledAt: true });

      expect(await restoreBooking(restoreFormData())).toEqual({ success: true });

      const updates = stub.find("bookings", "update");
      expect(updates).toHaveLength(1);
      expect(updates[0].payload).toEqual({
        status: "confirmed",
        customer_cancelled_at: null,
        customer_cancellation_note: null,
        cancelled_at: null,
      });
    });

    // Phase A ships before Phase F's migration — the restore has to work anyway.
    it("falls back to an unstamped payload while the column is absent", async () => {
      const stub = stubAdminClient({ bookingsHaveCancelledAt: false });

      expect(await restoreBooking(restoreFormData())).toEqual({ success: true });

      const updates = stub.find("bookings", "update");
      expect(updates).toHaveLength(2);
      expect(updates[0].payload).toHaveProperty("cancelled_at");
      expect(updates[1].payload).not.toHaveProperty("cancelled_at");
    });

    it("surfaces a genuine update failure rather than retrying it", async () => {
      const stub = stubAdminClient({
        bookingUpdateError: { message: "permission denied for table bookings" },
      });

      expect(await restoreBooking(restoreFormData())).toEqual({
        error: "permission denied for table bookings",
      });
      expect(stub.find("bookings", "update")).toHaveLength(1);
      expect(stub.audit()).toBeUndefined();
    });
  });

  describe("queued cancellation email (undo window)", () => {
    it("kills a still-queued cancellation email and suppresses the restore email", async () => {
      const stub = stubAdminClient({ queuedEmail: { count: 1, error: null } });

      expect(await restoreBooking(restoreFormData())).toEqual({ success: true });

      const sweep = stub.find("email_delivery_events", "update")[0];
      expect(sweep.payload).toEqual({ delivery_status: "cancelled_by_restore" });
      expect(sweep.filters).toEqual([
        "eq:booking_id=booking-1",
        "eq:event_type=booking_cancellation_customer",
        "eq:delivery_status=queued",
      ]);

      // The client never saw the cancellation, so there is no round trip to
      // apologise for.
      expect(stub.audit()!.after_state).toMatchObject({
        cancelled_queued_email: true,
      });
      expect(sendBookingRestoredClientEmail).not.toHaveBeenCalled();
      expect(sendAssignedStaffBookingChangeEmails).toHaveBeenCalled();
    });

    // The Phase F regression. The cron only fires on the minute boundary, so a
    // row stays `queued` for up to 60 seconds after it falls due. A sweep that
    // also filtered on `scheduled_for > now` matched none of those rows, so the
    // restore counted as "nothing queued": the client got the restored email,
    // and then the cancellation the cron went on to send anyway. Cancel at
    // 10:00:00 -> queued for 10:00:10 -> restore at 10:00:25 is the concrete case.
    it("suppresses a cancellation that is already due but not yet drained", async () => {
      const stub = stubAdminClient({
        queuedRowScheduledFor: new Date(NOW.getTime() - 15_000).toISOString(),
      });

      expect(await restoreBooking(restoreFormData())).toEqual({ success: true });

      // `delivery_status = 'queued'` is the whole test for "not yet sent": the
      // cron claims a row out of `queued` before it dispatches, so anything still
      // queued is genuinely unsent however old its scheduled_for.
      const sweep = stub.find("email_delivery_events", "update")[0];
      expect(sweep.payload).toEqual({ delivery_status: "cancelled_by_restore" });
      expect(stub.audit()!.after_state).toMatchObject({
        cancelled_queued_email: true,
      });
      expect(sendBookingRestoredClientEmail).not.toHaveBeenCalled();
    });

    it("sends the restore email when the cron already fired the cancellation", async () => {
      const stub = stubAdminClient({ queuedEmail: { count: 0, error: null } });

      expect(await restoreBooking(restoreFormData())).toEqual({ success: true });

      expect(stub.audit()!.after_state).toMatchObject({
        cancelled_queued_email: false,
      });
      expect(sendBookingRestoredClientEmail).toHaveBeenCalled();
    });

    // Pre-Phase-F the queue columns do not exist: the sweep 400s, nothing is
    // suppressed, and the restore proceeds exactly as it always did.
    it("treats the missing queue columns as nothing to cancel", async () => {
      const stub = stubAdminClient();

      expect(await restoreBooking(restoreFormData())).toEqual({ success: true });

      expect(stub.audit()!.after_state).toMatchObject({
        cancelled_queued_email: false,
      });
      expect(sendBookingRestoredClientEmail).toHaveBeenCalled();
    });
  });

  it("requires a booking id", async () => {
    const stub = stubAdminClient();

    expect(await restoreBooking(restoreFormData({}, null))).toEqual({
      error: "Booking is required.",
    });
    expect(stub.ops).toHaveLength(0);
  });
});
