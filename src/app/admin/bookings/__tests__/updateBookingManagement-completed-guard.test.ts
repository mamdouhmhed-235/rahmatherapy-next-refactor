import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  sendAssignedStaffBookingChangeEmails,
  sendBookingCancellationEmails,
} from "@/lib/email/notifications";
import { getStaffProfile, PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { addBusinessDays, getBusinessDate } from "@/lib/time/london";
import { updateBookingManagement } from "../actions";

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

const COMPLETED_BOOKING = {
  id: "booking-1",
  client_id: "client-1",
  status: "completed",
  booking_date: "2026-07-20",
  start_time: "14:00:00",
  payment_status: "unpaid",
  payment_method: null,
  paid_at: null,
  amount_paid: 0,
  total_price: 55,
  admin_notes: "Parking round the back.",
  treatment_notes: "Deep tissue, left shoulder.",
  customer_manage_notes: null,
  payment_note: null,
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

/** Stand-in for the Supabase admin client covering `updateBookingManagement`. */
function stubAdminClient(booking: Record<string, unknown> = COMPLETED_BOOKING) {
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

/** The Status form's payload, minus whatever a test omits. */
function statusFormData(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("booking_id", "booking-1");
  formData.set("status", "confirmed");
  formData.set("payment_status", "unpaid");
  formData.set("amount_paid", "0");
  for (const [key, value] of Object.entries(overrides)) formData.set(key, value);
  return formData;
}

/** What both Notes forms post: `HiddenStatusPayload` re-sends today's status. */
function notesFormData(booking: Record<string, unknown> = COMPLETED_BOOKING) {
  const formData = new FormData();
  formData.set("booking_id", String(booking.id));
  formData.set("status", String(booking.status));
  formData.set("payment_status", String(booking.payment_status));
  formData.set("payment_method", String(booking.payment_method ?? ""));
  formData.set("amount_paid", String(Number(booking.amount_paid ?? 0)));
  formData.set("payment_note", String(booking.payment_note ?? ""));
  formData.set("treatment_notes", "Deep tissue, left shoulder. Booked a follow-up.");
  formData.set("admin_notes", String(booking.admin_notes ?? ""));
  formData.set("customer_manage_notes", String(booking.customer_manage_notes ?? ""));
  return formData;
}

describe("updateBookingManagement — completed-reversal guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getStaffProfile).mockResolvedValue(owner);
    // Both sends are awaited with a `.catch` tail, so they have to be thenable.
    vi.mocked(sendAssignedStaffBookingChangeEmails).mockReset().mockResolvedValue();
    vi.mocked(sendBookingCancellationEmails).mockReset().mockResolvedValue();
  });

  // The guard's whole job: a completed booking cannot leave `completed` just
  // because someone moved the dropdown. Revert the guard and this spec fails —
  // the UPDATE goes through and the count below is 1.
  it.each(["pending", "confirmed", "cancelled", "no_show"])(
    "refuses completed → %s without the force flag",
    async (status) => {
      const stub = stubAdminClient();

      expect(await updateBookingManagement({}, statusFormData({ status }))).toEqual({
        error: "Reopening a completed booking requires confirmation.",
        fieldErrors: {
          status: "Use Restore on the next-action strip — or confirm via the modal.",
        },
      });

      expect(stub.find("bookings", "update")).toHaveLength(0);
      expect(stub.find("audit_logs", "insert")).toHaveLength(0);
      expect(sendAssignedStaffBookingChangeEmails).not.toHaveBeenCalled();
    }
  );

  it("refuses the force flag when the reason is under 5 characters", async () => {
    const stub = stubAdminClient();

    expect(
      await updateBookingManagement(
        {},
        statusFormData({
          force_completed_reversal: "on",
          completed_reversal_reason: "  ok  ",
        })
      )
    ).toEqual({
      error: "Reopening a completed booking requires a reason.",
      fieldErrors: {
        completed_reversal_reason: "Provide a reason (min 5 chars).",
      },
    });

    expect(stub.find("bookings", "update")).toHaveLength(0);
  });

  it("reopens with the force flag and a reason, folding the reason into the audit row", async () => {
    const stub = stubAdminClient();

    expect(
      await updateBookingManagement(
        {},
        statusFormData({
          force_completed_reversal: "on",
          completed_reversal_reason: "  client returned for retreat  ",
        })
      )
    ).toEqual({ success: true });

    const update = stub.find("bookings", "update").at(-1)!;
    expect(update.payload).toMatchObject({ status: "confirmed" });
    expect(update.filters).toEqual(["eq:id=booking-1"]);

    expect(stub.audit()).toMatchObject({
      actor_staff_id: owner.id,
      action_type: "booking_management_updated",
      target_id: "booking-1",
    });
    expect(stub.audit()!.after_state).toMatchObject({
      status: "confirmed",
      completed_reversal_reason: "client returned for retreat",
    });

    expect(sendAssignedStaffBookingChangeEmails).toHaveBeenCalledWith(
      "booking-1",
      stub.client,
      "Booking status changed from completed to confirmed."
    );
  });

  // Both Notes forms re-post the booking's own status through
  // `HiddenStatusPayload`, so a notes save on a completed booking sends
  // `status=completed` and must sail past the guard untouched.
  it("lets a notes save on a completed booking through", async () => {
    const stub = stubAdminClient();

    expect(await updateBookingManagement({}, notesFormData())).toEqual({
      success: true,
    });

    const update = stub.find("bookings", "update").at(-1)!;
    expect(update.payload).toMatchObject({
      status: "completed",
      treatment_notes: "Deep tissue, left shoulder. Booked a follow-up.",
    });
    expect(stub.audit()!.after_state).not.toHaveProperty(
      "completed_reversal_reason"
    );
  });

  it("leaves transitions out of every other status untouched", async () => {
    const stub = stubAdminClient({ ...COMPLETED_BOOKING, status: "confirmed" });

    expect(
      await updateBookingManagement({}, statusFormData({ status: "cancelled" }))
    ).toEqual({ success: true });

    expect(stub.find("bookings", "update").at(-1)!.payload).toMatchObject({
      status: "cancelled",
    });
  });
});

// Derived from London's today, never hardcoded: the guard compares against
// `getBusinessDate()`, so a frozen fixture date would rot.
const TODAY = getBusinessDate();
const YESTERDAY = addBusinessDays(TODAY, -1);
const TOMORROW = addBusinessDays(TODAY, 1);

/** A live booking, dated by the spec that uses it. */
function confirmedBooking(bookingDate: string) {
  return { ...COMPLETED_BOOKING, status: "confirmed", booking_date: bookingDate };
}

describe("updateBookingManagement — future-date guard (W03-E-2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getStaffProfile).mockResolvedValue(owner);
    vi.mocked(sendAssignedStaffBookingChangeEmails).mockReset().mockResolvedValue();
    vi.mocked(sendBookingCancellationEmails).mockReset().mockResolvedValue();
  });

  // The Status dropdown offers both on every booking, so the form was the one
  // door left open after the chips and the auto-promoter were shut. Revert the
  // guard and these two fail: the UPDATE lands and the audit row follows.
  it.each(["completed", "no_show"])(
    "refuses %s on a future-dated booking",
    async (status) => {
      const stub = stubAdminClient(confirmedBooking(TOMORROW));

      expect(await updateBookingManagement({}, statusFormData({ status }))).toEqual({
        error:
          "This booking is in the future. Mark complete or no-show after the appointment time.",
      });

      expect(stub.find("bookings", "update")).toHaveLength(0);
      expect(stub.find("audit_logs", "insert")).toHaveLength(0);
      expect(sendAssignedStaffBookingChangeEmails).not.toHaveBeenCalled();
      expect(sendBookingCancellationEmails).not.toHaveBeenCalled();
    }
  );

  // The over-blocking canary that matters most: cancelling a booking before it
  // happens is the commonest edit this form sees, and it owes the client an
  // email. A guard keyed on the date alone rather than on the status being
  // written would break it.
  it("still cancels a future-dated booking, and still emails the client", async () => {
    const stub = stubAdminClient(confirmedBooking(TOMORROW));

    expect(
      await updateBookingManagement({}, statusFormData({ status: "cancelled" }))
    ).toEqual({ success: true });

    expect(stub.find("bookings", "update").at(-1)!.payload).toMatchObject({
      status: "cancelled",
    });
    // Phase H — the customer leg is queued for 10 seconds rather than sent now.
    // Full coverage of the undo window lives in `quickUpdateBookingCancel.test.ts`.
    expect(sendBookingCancellationEmails).toHaveBeenCalledWith(
      "booking-1",
      stub.client,
      { initiatedBy: "admin", delaySeconds: 10 }
    );
  });

  it("still completes a past-dated booking", async () => {
    const stub = stubAdminClient(confirmedBooking(YESTERDAY));

    expect(
      await updateBookingManagement({}, statusFormData({ status: "completed" }))
    ).toEqual({ success: true });

    expect(stub.find("bookings", "update").at(-1)!.payload).toMatchObject({
      status: "completed",
    });
    expect(stub.find("audit_logs", "insert")).toHaveLength(1);
  });

  // Date-only, like the chip's: today's 18:00 visit is markable at 17:55 when
  // the therapist rings in.
  it("still completes a booking dated today", async () => {
    const stub = stubAdminClient(confirmedBooking(TODAY));

    expect(
      await updateBookingManagement({}, statusFormData({ status: "completed" }))
    ).toEqual({ success: true });

    expect(stub.find("bookings", "update")).toHaveLength(1);
  });
});
