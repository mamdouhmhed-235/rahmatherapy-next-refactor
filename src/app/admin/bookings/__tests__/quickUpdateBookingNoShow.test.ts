import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  sendAssignedStaffBookingChangeEmails,
  sendBookingCancellationEmails,
  sendBookingConfirmedClientEmail,
} from "@/lib/email/notifications";
import { getStaffProfile, PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { addBusinessDays, getBusinessDate } from "@/lib/time/london";
import { quickUpdateBooking } from "../actions";
import { isBookingDateFutureLondon } from "../_helpers";

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
  sendBookingConfirmedClientEmail: vi.fn(),
  sendBookingRestoredClientEmail: vi.fn(),
  sendStaffAssignmentEmail: vi.fn(),
}));

vi.mock("@/lib/booking/manage-token", () => ({
  ensureBookingManageUrl: vi.fn(),
}));

// Dates are derived from London's today, never hardcoded: the guard compares
// against `getBusinessDate()`, so a frozen fixture date would rot.
const TODAY = getBusinessDate();
const YESTERDAY = addBusinessDays(TODAY, -1);
const TOMORROW = addBusinessDays(TODAY, 1);

const CONFIRMED_BOOKING = {
  id: "booking-1",
  client_id: "client-1",
  status: "confirmed",
  booking_date: YESTERDAY,
  start_time: "14:00:00",
  payment_status: "unpaid",
  payment_method: null,
  paid_at: null,
  amount_paid: 0,
  amount_due: 55,
  total_price: 55,
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
}

/** Stand-in for the Supabase admin client covering `quickUpdateBooking`. */
function stubAdminClient(booking: Record<string, unknown> = CONFIRMED_BOOKING) {
  const ops: RecordedOp[] = [];

  function resolve(entry: RecordedOp) {
    if (entry.op === "select") return { data: booking, error: null };
    return { data: { ...booking, ...entry.payload }, error: null };
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
      select: () => chain,
      single: <T,>() =>
        Promise.resolve(resolve(entry) as unknown as { data: T | null; error: unknown }),
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
      select: () => startOp(table, "select"),
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

function quickFormData(action: string) {
  const formData = new FormData();
  formData.set("booking_id", "booking-1");
  formData.set("action", action);
  return formData;
}

describe("quickUpdateBooking — no-show quick action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getStaffProfile).mockResolvedValue(owner);
    // Both sends are awaited with a `.catch` tail, so they have to be thenable.
    vi.mocked(sendAssignedStaffBookingChangeEmails).mockReset().mockResolvedValue();
    vi.mocked(sendBookingCancellationEmails).mockReset().mockResolvedValue();
    vi.mocked(sendBookingConfirmedClientEmail).mockReset().mockResolvedValue();
  });

  it("marks a past-dated confirmed booking as no-show", async () => {
    const stub = stubAdminClient();

    expect(await quickUpdateBooking(quickFormData("no_show"))).toEqual({
      success: true,
    });

    const update = stub.find("bookings", "update").at(-1)!;
    expect(update.payload).toEqual({ status: "no_show" });
    expect(update.filters).toEqual(["eq:id=booking-1"]);

    expect(stub.audit()).toMatchObject({
      actor_staff_id: owner.id,
      action_type: "booking_quick_no_show",
      target_type: "bookings",
      target_id: "booking-1",
    });
    expect(stub.audit()!.after_state).toMatchObject({ status: "no_show" });
  });

  // A no-show is not a customer-facing event (brief §4.2): assigned staff hear
  // about it, the client does not.
  it("notifies assigned staff and never emails the client", async () => {
    const stub = stubAdminClient();

    await quickUpdateBooking(quickFormData("no_show"));

    expect(sendAssignedStaffBookingChangeEmails).toHaveBeenCalledWith(
      "booking-1",
      stub.client,
      "Booking status changed from confirmed to no_show."
    );
    expect(sendBookingCancellationEmails).not.toHaveBeenCalled();
  });

  // The guard is date-only, not moment-based: the therapist rings in at 17:55
  // about an 18:00 visit and the admin has to be able to record it.
  it("allows a no-show on the booking's own day, whatever the time", async () => {
    const stub = stubAdminClient({
      ...CONFIRMED_BOOKING,
      booking_date: TODAY,
      start_time: "23:30:00",
    });

    expect(await quickUpdateBooking(quickFormData("no_show"))).toEqual({
      success: true,
    });
    expect(stub.find("bookings", "update").at(-1)!.payload).toEqual({
      status: "no_show",
    });
  });

  // W03-E-2 — an outcome cannot be recorded before the day it happens on.
  it.each(["no_show", "complete"])(
    "refuses %s on a future-dated booking",
    async (action) => {
      const stub = stubAdminClient({
        ...CONFIRMED_BOOKING,
        booking_date: TOMORROW,
      });

      expect(await quickUpdateBooking(quickFormData(action))).toEqual({
        error:
          "This booking is in the future. Mark complete or no-show after the appointment time.",
      });

      expect(stub.find("bookings", "update")).toHaveLength(0);
      expect(stub.find("audit_logs", "insert")).toHaveLength(0);
      expect(sendAssignedStaffBookingChangeEmails).not.toHaveBeenCalled();
    }
  );

  // Regression canary for plan §2's UNCHANGED list: the temporal guard is
  // scoped to the two outcome actions and must not leak into the frozen ones.
  it("leaves the frozen actions' reach unchanged on a future-dated booking", async () => {
    const stub = stubAdminClient({
      ...CONFIRMED_BOOKING,
      booking_date: TOMORROW,
    });

    expect(await quickUpdateBooking(quickFormData("cancel"))).toEqual({
      success: true,
    });
    // `cancelled_at` joined this payload in Phase H (S7). Still `toEqual`, so a
    // stray column would fail — only the stamp is admitted, and only as a value
    // the clock decides.
    expect(stub.find("bookings", "update").at(-1)!.payload).toEqual({
      status: "cancelled",
      cancelled_at: expect.any(String),
    });
  });

  it("still rejects an action it does not know", async () => {
    const stub = stubAdminClient();

    expect(await quickUpdateBooking(quickFormData("teleport"))).toEqual({
      error: "Unsupported booking action.",
    });
    expect(stub.find("bookings", "update")).toHaveLength(0);
  });
});

// C-04a fix round — Owner-approved 2026-07-28 as a deviation from plan §2's
// UNCHANGED list. `completed` and `cancelled` are terminal for the one-click
// chips: `cancel` on a completed booking was live and fired a real customer
// cancellation email, and `complete` on a cancelled one resurrected it in one
// click, past Phase B's Status-form guard. Subsumes Phase C's narrower
// completed → no-show spec.
describe("quickUpdateBooking — terminal-state guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getStaffProfile).mockResolvedValue(owner);
    vi.mocked(sendAssignedStaffBookingChangeEmails).mockReset().mockResolvedValue();
    vi.mocked(sendBookingCancellationEmails).mockReset().mockResolvedValue();
    vi.mocked(sendBookingConfirmedClientEmail).mockReset().mockResolvedValue();
  });

  it.each(["no_show", "cancel", "confirm"])(
    "refuses %s on a completed booking without writing or sending anything",
    async (action) => {
      const stub = stubAdminClient({
        ...CONFIRMED_BOOKING,
        status: "completed",
      });

      expect(await quickUpdateBooking(quickFormData(action))).toEqual({
        error:
          "This booking is completed. Reopen it from the Status & payment form, which records a reason.",
      });

      expect(stub.find("bookings", "update")).toHaveLength(0);
      expect(stub.find("audit_logs", "insert")).toHaveLength(0);
      expect(sendBookingCancellationEmails).not.toHaveBeenCalled();
      expect(sendAssignedStaffBookingChangeEmails).not.toHaveBeenCalled();
    }
  );

  it("refuses complete on a cancelled booking without writing or sending anything", async () => {
    const stub = stubAdminClient({
      ...CONFIRMED_BOOKING,
      status: "cancelled",
    });

    expect(await quickUpdateBooking(quickFormData("complete"))).toEqual({
      error:
        "This booking is cancelled. Reopen it from the Status & payment form before marking it complete.",
    });

    expect(stub.find("bookings", "update")).toHaveLength(0);
    expect(stub.find("audit_logs", "insert")).toHaveLength(0);
    expect(sendBookingCancellationEmails).not.toHaveBeenCalled();
    expect(sendAssignedStaffBookingChangeEmails).not.toHaveBeenCalled();
  });

  // The third source status, closed in the same shape as `completed`: every
  // move out of it is refused. `cancel` fired a real customer cancellation
  // email from a live chip; `confirm` silently un-did the no-show, bypassing
  // `restoreBooking` — its past-moment guard, its `booking_restored` audit
  // action and its "your booking is back on" client email.
  it.each(["cancel", "complete", "confirm"])(
    "refuses %s on a no-show booking without writing or sending anything",
    async (action) => {
      const stub = stubAdminClient({
        ...CONFIRMED_BOOKING,
        status: "no_show",
      });

      expect(await quickUpdateBooking(quickFormData(action))).toEqual({
        error:
          "This booking is marked no-show. Use Restore on the next-action strip to put it back, or the Status & payment form to change it any other way.",
      });

      expect(stub.find("bookings", "update")).toHaveLength(0);
      expect(stub.find("audit_logs", "insert")).toHaveLength(0);
      expect(sendBookingCancellationEmails).not.toHaveBeenCalled();
      expect(sendAssignedStaffBookingChangeEmails).not.toHaveBeenCalled();
    }
  );

  // Canary: the guards key on the source status, so the legal cancel path has
  // to survive intact — write, audit row and the customer email.
  it("still cancels a confirmed booking and emails the client", async () => {
    const stub = stubAdminClient();

    expect(await quickUpdateBooking(quickFormData("cancel"))).toEqual({
      success: true,
    });

    expect(stub.find("bookings", "update").at(-1)!.payload).toEqual({
      status: "cancelled",
      cancelled_at: expect.any(String),
    });
    expect(stub.audit()).toMatchObject({ action_type: "booking_quick_cancel" });
    // Phase H — the customer leg is queued for 10 seconds rather than sent now.
    // Full coverage of the undo window lives in `quickUpdateBookingCancel.test.ts`.
    expect(sendBookingCancellationEmails).toHaveBeenCalledWith(
      "booking-1",
      stub.client,
      { initiatedBy: "admin", delaySeconds: 10 }
    );
  });

  // Canary: the completed-reversal guard is scoped to a `completed` SOURCE.
  // Lose that conjunct and it reads as "any move to a status other than
  // completed", which refuses the commonest chip on the board — the confirm of
  // a pending booking — with the rest of this file still green. Future-dated on
  // purpose: a booking awaiting confirmation normally is, and the W03-E-2
  // temporal guard must not reach `confirm`.
  it("still confirms a pending booking and notifies assigned staff", async () => {
    const stub = stubAdminClient({
      ...CONFIRMED_BOOKING,
      status: "pending",
      booking_date: TOMORROW,
    });

    expect(await quickUpdateBooking(quickFormData("confirm"))).toEqual({
      success: true,
    });

    expect(stub.find("bookings", "update").at(-1)!.payload).toEqual({
      status: "confirmed",
    });
    expect(stub.audit()).toMatchObject({
      action_type: "booking_quick_confirm",
      target_id: "booking-1",
    });
    expect(stub.audit()!.after_state).toMatchObject({ status: "confirmed" });

    // The assigned staff hear about it via the generic status-change email...
    expect(sendAssignedStaffBookingChangeEmails).toHaveBeenCalledWith(
      "booking-1",
      stub.client,
      "Booking status changed from pending to confirmed."
    );
    // ...and, since C-08, so does the client — this is the one status change
    // with a dedicated client-facing template (the pending→confirmed moment).
    expect(sendBookingConfirmedClientEmail).toHaveBeenCalledWith(
      "booking-1",
      stub.client
    );
    expect(sendBookingCancellationEmails).not.toHaveBeenCalled();
  });

  // Canary: the cancelled-source guard is `nextStatus === "completed" &&
  // beforeState.status === "cancelled"`. Lose the second conjunct and EVERY
  // "Mark complete" refuses — the whole point of the chip — again with the rest
  // of this file still green.
  it("still completes a past-dated confirmed booking and notifies assigned staff", async () => {
    const stub = stubAdminClient();

    expect(await quickUpdateBooking(quickFormData("complete"))).toEqual({
      success: true,
    });

    expect(stub.find("bookings", "update").at(-1)!.payload).toEqual({
      status: "completed",
    });
    expect(stub.audit()).toMatchObject({
      action_type: "booking_quick_complete",
      target_id: "booking-1",
    });
    expect(stub.audit()!.after_state).toMatchObject({ status: "completed" });

    expect(sendAssignedStaffBookingChangeEmails).toHaveBeenCalledWith(
      "booking-1",
      stub.client,
      "Booking status changed from confirmed to completed."
    );
    expect(sendBookingCancellationEmails).not.toHaveBeenCalled();
  });

  // `mark_paid` sets no status, so it must stay reachable from every terminal
  // status — the guards read the payload's status and have nothing to catch.
  it.each(["completed", "no_show"])(
    "still marks a %s booking paid",
    async (status) => {
      const stub = stubAdminClient({ ...CONFIRMED_BOOKING, status });

      expect(await quickUpdateBooking(quickFormData("mark_paid"))).toEqual({
        success: true,
      });
      expect(stub.find("bookings", "update").at(-1)!.payload).toMatchObject({
        payment_status: "paid",
        amount_paid: 55,
      });
    }
  );
});

// The one hour a day the guard's date source actually matters. 23:30 UTC on
// 27 July is 00:30 on the 28th in London (BST, UTC+1), so UTC's calendar date
// is still yesterday: `new Date().toISOString().slice(0, 10)` — the shape this
// guard replaced — reads a booking dated today as future-dated and refuses
// "Mark complete" / "Mark no-show" for the first hour of every BST day. Every
// other fixture in this file derives from `getBusinessDate()` itself, so only a
// named instant can pin this. The system clock is moved alongside the injected
// `now` so an implementation that reads the ambient clock is caught too.
const BST_FIRST_HOUR = new Date("2026-07-27T23:30:00Z");

describe("isBookingDateFutureLondon — London's date, not UTC's", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BST_FIRST_HOUR);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not call today future-dated in the first BST hour of the day", () => {
    expect(
      isBookingDateFutureLondon({ booking_date: "2026-07-28" }, BST_FIRST_HOUR)
    ).toBe(false);
  });

  it("still calls tomorrow future-dated at that same instant", () => {
    expect(
      isBookingDateFutureLondon({ booking_date: "2026-07-29" }, BST_FIRST_HOUR)
    ).toBe(true);
  });
});
