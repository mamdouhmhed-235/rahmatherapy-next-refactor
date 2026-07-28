import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  sendAssignedStaffBookingChangeEmails,
  sendBookingCancellationEmails,
} from "@/lib/email/notifications";
import { getStaffProfile, PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { addBusinessDays, getBusinessDate } from "@/lib/time/london";
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

  // The new action must not inherit the completed-source gap the existing
  // one-click actions carry: leaving `completed` needs the Status form's force
  // flag plus a reason, and a chip can capture neither.
  it("refuses to take a completed booking to no-show", async () => {
    const stub = stubAdminClient({
      ...CONFIRMED_BOOKING,
      status: "completed",
    });

    expect(await quickUpdateBooking(quickFormData("no_show"))).toEqual({
      error:
        "This booking is completed. Reopen it from the Status & payment form, which records a reason.",
    });

    expect(stub.find("bookings", "update")).toHaveLength(0);
    expect(stub.find("audit_logs", "insert")).toHaveLength(0);
  });

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
    expect(stub.find("bookings", "update").at(-1)!.payload).toEqual({
      status: "cancelled",
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
