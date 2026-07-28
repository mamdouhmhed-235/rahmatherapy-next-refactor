import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  sendAssignedStaffBookingChangeEmails,
  sendBookingCancellationEmails,
  sendBookingRestoredClientEmail,
} from "@/lib/email/notifications";
import { getStaffProfile, PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { quickUpdateBooking } from "../actions";

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

// Every send site is mocked. Nothing in this file may reach Resend.
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
const daysBeforeNow = (days: number) =>
  new Date(NOW.getTime() - days * DAY_MS).toISOString();

const CANCELLED_BOOKING = {
  id: "booking-1",
  client_id: "client-1",
  status: "cancelled",
  // Future appointment so S6 passes unless a test says otherwise.
  booking_date: "2026-08-20",
  start_time: "14:00:00",
  total_price: 55,
  amount_due: 55,
  amount_paid: 0,
  payment_status: "unpaid",
  payment_method: null,
  paid_at: null,
  cancelled_at: daysBeforeNow(2),
  customer_cancelled_at: null,
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

interface RecordedOp {
  table: string;
  op: "select" | "update" | "insert";
  payload?: Record<string, unknown>;
  filters: string[];
  selected?: string;
}

/**
 * Stand-in for the Supabase admin client covering the chains `restoreBooking`
 * builds, since `quickUpdateBooking`'s `restore` branch is nothing but a
 * delegation to it. Modelled on `restoreBooking.test.ts`'s stub, including the
 * one PostgREST behaviour that matters here: an embedded relation only comes
 * back when the select NAMES it.
 */
function stubAdminClient(booking: Record<string, unknown> = CANCELLED_BOOKING) {
  const ops: RecordedOp[] = [];
  const { clients: embeddedClient, ...bookingColumns } = booking as {
    clients?: unknown;
  };

  function resolve(entry: RecordedOp) {
    if (entry.table === "bookings") {
      if (entry.op === "select") {
        return {
          data: entry.selected?.includes("clients(")
            ? { ...bookingColumns, clients: embeddedClient }
            : bookingColumns,
          error: null,
        };
      }
      return { data: { ...bookingColumns, ...entry.payload }, error: null };
    }
    // The queued-cancellation sweep: ran, matched nothing.
    if (entry.table === "email_delivery_events") return { count: 0, error: null };
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
      select: (columns?: string) => {
        if (columns !== undefined) entry.selected = columns;
        return chain;
      },
      single: <T,>() =>
        Promise.resolve(resolve(entry) as unknown as { data: T | null; error: unknown }),
      then: (
        onFulfilled: (value: unknown) => unknown,
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
      update: (payload: Record<string, unknown>) => startOp(table, "update", payload),
    };
  });

  const client = { from } as unknown as ReturnType<typeof createSupabaseAdminClient>;
  vi.mocked(createSupabaseAdminClient).mockReturnValue(client);

  const find = (table: string, op: RecordedOp["op"]) =>
    ops.filter((entry) => entry.table === table && entry.op === op);
  const audit = () => find("audit_logs", "insert")[0]?.payload;

  return { ops, find, audit, client };
}

function restoreFormData(bookingId: string | null = "booking-1") {
  const formData = new FormData();
  if (bookingId !== null) formData.set("booking_id", bookingId);
  formData.set("action", "restore");
  return formData;
}

// C-04a Phase G, Change 11. The row menu dispatches through `quickUpdateBooking`
// like every other row action, but `restore` must NOT become another entry in
// that action's payload switch: the switch has no S6/S7 guard, no deleted-client
// refusal, no `booking_restored` audit action, no queued-email sweep and no
// "your booking is back on" client email. It would be a second, weaker way out
// of a terminal status — the exact hole Phase C's four guards closed.
describe("quickUpdateBooking — action=restore delegates to restoreBooking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.mocked(getStaffProfile).mockResolvedValue(owner);
    // Every send is awaited with a `.catch` tail, so they have to be thenable.
    vi.mocked(sendBookingRestoredClientEmail).mockReset().mockResolvedValue();
    vi.mocked(sendAssignedStaffBookingChangeEmails).mockReset().mockResolvedValue();
    vi.mocked(sendBookingCancellationEmails).mockReset().mockResolvedValue();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("restores a cancelled booking with the full restore semantics", async () => {
    const stub = stubAdminClient();

    expect(await quickUpdateBooking(restoreFormData())).toEqual({ success: true });

    // `clients(deleted_at)` is `restoreBooking`'s pre-image select;
    // `quickUpdateBooking`'s own is a bare `*`. Naming it is how this spec knows
    // which code path answered.
    expect(stub.find("bookings", "select")[0].selected).toContain(
      "clients(deleted_at)"
    );

    const update = stub.find("bookings", "update").at(-1)!;
    expect(update.payload).toEqual({
      status: "confirmed",
      cancelled_at: null,
      customer_cancelled_at: null,
      customer_cancellation_note: null,
    });
    expect(update.filters).toEqual(["eq:id=booking-1"]);

    // `booking_restored`, never `booking_quick_restore`: the audit action is the
    // durable record that restore semantics ran.
    expect(stub.audit()).toMatchObject({
      actor_staff_id: owner.id,
      action_type: "booking_restored",
      target_type: "bookings",
      target_id: "booking-1",
    });
    expect(stub.audit()!.after_state).toMatchObject({
      restore_from_status: "cancelled",
      restore_target_status: "confirmed",
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

  // S6 — the appointment moment has been and gone. The row menu hides Restore
  // and `runQuickAction` short-circuits, but the server is the authority: a
  // crafted POST, or a menu rendered before the moment passed, still lands here.
  it("refuses a cancelled booking whose appointment time has passed", async () => {
    const stub = stubAdminClient({
      ...CANCELLED_BOOKING,
      booking_date: "2026-07-20",
      start_time: "14:00:00",
    });

    expect(await quickUpdateBooking(restoreFormData())).toEqual({
      error:
        "This booking's appointment time has already passed and cannot be restored.",
    });

    expect(stub.find("bookings", "update")).toHaveLength(0);
    expect(stub.find("audit_logs", "insert")).toHaveLength(0);
    expect(sendBookingRestoredClientEmail).not.toHaveBeenCalled();
    expect(sendAssignedStaffBookingChangeEmails).not.toHaveBeenCalled();
  });

  // S7 — the cancellation is older than the 28-day window.
  it("refuses a booking cancelled outside the restore window", async () => {
    const stub = stubAdminClient({
      ...CANCELLED_BOOKING,
      cancelled_at: daysBeforeNow(29),
    });

    expect(await quickUpdateBooking(restoreFormData())).toEqual({
      error:
        "This booking was cancelled more than 28 days ago and can no longer be restored.",
    });

    expect(stub.find("bookings", "update")).toHaveLength(0);
    expect(stub.find("audit_logs", "insert")).toHaveLength(0);
    expect(sendBookingRestoredClientEmail).not.toHaveBeenCalled();
  });

  // The delegation has to happen BEFORE `quickUpdateBooking`'s payload switch.
  // If it did not, `restore` would fall off the end of that switch and come back
  // as "Unsupported booking action." — a message that tells the operator nothing
  // about why a confirmed booking cannot be restored.
  it("refuses a booking that is not cancelled, no-show or completed", async () => {
    const stub = stubAdminClient({ ...CANCELLED_BOOKING, status: "confirmed" });

    expect(await quickUpdateBooking(restoreFormData())).toEqual({
      error: "Only cancelled, no-show, or completed bookings can be restored.",
    });

    expect(stub.find("bookings", "update")).toHaveLength(0);
    expect(sendBookingRestoredClientEmail).not.toHaveBeenCalled();
  });

  it("requires a booking id before touching the database", async () => {
    const stub = stubAdminClient();

    expect(await quickUpdateBooking(restoreFormData(null))).toEqual({
      error: "Booking is required.",
    });
    expect(stub.ops).toHaveLength(0);
  });
});
