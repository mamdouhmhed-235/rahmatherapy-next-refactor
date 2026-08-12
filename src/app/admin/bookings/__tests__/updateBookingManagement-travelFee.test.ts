import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  sendAssignedStaffBookingChangeEmails,
  sendBookingCancellationEmails,
} from "@/lib/email/notifications";
import { getStaffProfile, PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { updateBookingManagement } from "../actions";

/**
 * Item 8 Phase 3 — the travel charge, through the real action.
 *
 * The arithmetic itself is unit-tested in src/lib/booking/__tests__/travel-fee.test.ts.
 * What is proved here is the wiring: that the delta is applied to the STORED
 * totals, that amount_paid is never moved, and that the completed/fully-paid
 * lock fires on exactly the right cases and no others.
 *
 * Mirrors updateBookingManagement-completed-guard.test.ts's harness deliberately.
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

vi.mock("@/lib/auth/rbac", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/rbac")>()),
  getStaffProfile: vi.fn(),
}));

vi.mock("@/lib/email/notifications", () => ({
  sendBookingCreatedEmails: vi.fn(),
  sendAssignedStaffBookingChangeEmails: vi.fn(),
  sendBookingCancellationEmails: vi.fn(),
  sendBookingRestoredClientEmail: vi.fn(),
  sendBookingConfirmedClientEmail: vi.fn(),
  sendStaffAssignmentEmail: vi.fn(),
}));

vi.mock("@/lib/booking/manage-token", () => ({
  ensureBookingManageUrl: vi.fn(),
}));

/** A 45.00 service booked for two participants: total_price is already 45 x 2. */
const BASE_BOOKING = {
  id: "booking-1",
  client_id: "client-1",
  status: "pending",
  booking_date: "2026-09-20",
  start_time: "14:00:00",
  payment_status: "unpaid",
  payment_method: null,
  paid_at: null,
  amount_paid: 0,
  amount_due: 90,
  total_price: 90,
  travel_fee: 0,
  service_city: "Manchester",
  admin_notes: null,
  treatment_notes: null,
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

function stubAdminClient(booking: Record<string, unknown> = BASE_BOOKING) {
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
      update: (payload: Record<string, unknown>) => startOp(table, "update", payload),
    };
  });

  const client = { from } as unknown as ReturnType<typeof createSupabaseAdminClient>;
  vi.mocked(createSupabaseAdminClient).mockReturnValue(client);

  const updatePayload = () =>
    ops.find((entry) => entry.table === "bookings" && entry.op === "update")
      ?.payload;

  return { ops, updatePayload };
}

function statusFormData(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("booking_id", "booking-1");
  formData.set("status", "pending");
  formData.set("payment_status", "unpaid");
  formData.set("amount_paid", "0");
  for (const [key, value] of Object.entries(overrides)) formData.set(key, value);
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getStaffProfile).mockResolvedValue(owner);
  vi.mocked(sendAssignedStaffBookingChangeEmails).mockReset().mockResolvedValue();
  vi.mocked(sendBookingCancellationEmails).mockReset().mockResolvedValue();
});

describe("updateBookingManagement — travel fee arithmetic", () => {
  it("folds the fee into total_price using (service x participants) + fee, not (service + fee) x participants", async () => {
    const stub = stubAdminClient();

    await updateBookingManagement({}, statusFormData({ travel_fee: "14" }));

    const payload = stub.updatePayload();
    expect(payload?.travel_fee).toBe(14);
    expect(payload?.total_price).toBe(104);
    expect(payload?.amount_due).toBe(104);
    // The wrong answer a per-participant recompute would produce.
    expect(payload?.total_price).not.toBe(118);
  });

  it("tracks total_price and amount_due through a fee change, and never moves amount_paid", async () => {
    // Already carrying a 14.30 fee: 90 + 14.30.
    const stub = stubAdminClient({
      ...BASE_BOOKING,
      travel_fee: 14.3,
      total_price: 104.3,
      amount_due: 104.3,
      amount_paid: 30,
    });

    await updateBookingManagement(
      {},
      statusFormData({ travel_fee: "20.10", amount_paid: "30" })
    );

    const payload = stub.updatePayload();
    expect(payload?.travel_fee).toBe(20.1);
    // 104.30 - 14.30 + 20.10, exactly — float arithmetic gives 110.09999999999998.
    expect(payload?.total_price).toBe(110.1);
    expect(payload?.amount_due).toBe(110.1);
    expect(payload?.amount_paid).toBe(30);
  });

  it("clears the fee back out without leaving drift behind", async () => {
    const stub = stubAdminClient({
      ...BASE_BOOKING,
      travel_fee: 20.1,
      total_price: 110.1,
      amount_due: 110.1,
    });

    await updateBookingManagement({}, statusFormData({ travel_fee: "0" }));

    const payload = stub.updatePayload();
    expect(payload?.travel_fee).toBe(0);
    expect(payload?.total_price).toBe(90);
    expect(payload?.amount_due).toBe(90);
  });

  it("leaves the totals untouched when the fee is not part of the submitted form", async () => {
    // The notes forms re-post a subset and never carry travel_fee. An absent
    // field must not be read as "set it to zero".
    const stub = stubAdminClient({
      ...BASE_BOOKING,
      travel_fee: 14,
      total_price: 104,
      amount_due: 104,
    });

    await updateBookingManagement({}, statusFormData());

    const payload = stub.updatePayload();
    expect(payload).not.toHaveProperty("travel_fee");
    expect(payload).not.toHaveProperty("total_price");
    expect(payload).not.toHaveProperty("amount_due");
  });

  it("rejects a fee that is not a plain money amount", async () => {
    const stub = stubAdminClient();

    const result = await updateBookingManagement(
      {},
      statusFormData({ travel_fee: "-5" })
    );

    expect(result.fieldErrors?.travel_fee).toBeDefined();
    expect(stub.updatePayload()).toBeUndefined();
  });
});

describe("updateBookingManagement — travel fee lock", () => {
  it("rejects a travel-fee change on a completed booking", async () => {
    const stub = stubAdminClient({ ...BASE_BOOKING, status: "completed" });

    const result = await updateBookingManagement(
      {},
      statusFormData({ status: "completed", travel_fee: "14" })
    );

    expect(result.fieldErrors?.travel_fee).toMatch(/completed/i);
    expect(stub.updatePayload()).toBeUndefined();
  });

  it("rejects a travel-fee change on a fully-paid booking", async () => {
    const stub = stubAdminClient({
      ...BASE_BOOKING,
      amount_due: 90,
      amount_paid: 90,
      payment_status: "paid",
      payment_method: "cash",
    });

    const result = await updateBookingManagement(
      {},
      statusFormData({
        travel_fee: "14",
        payment_status: "paid",
        payment_method: "cash",
        amount_paid: "90",
      })
    );

    expect(result.fieldErrors?.travel_fee).toMatch(/fully paid/i);
    expect(stub.updatePayload()).toBeUndefined();
  });

  it("allows an unchanged travel fee submitted alongside another edit on a completed booking", async () => {
    const stub = stubAdminClient({
      ...BASE_BOOKING,
      status: "completed",
      // Past-dated: a future booking cannot be marked completed at all, which
      // would fail this test for a reason unrelated to the travel fee.
      booking_date: "2026-07-20",
      travel_fee: 14,
      total_price: 104,
      amount_due: 104,
    });

    const result = await updateBookingManagement(
      {},
      statusFormData({
        status: "completed",
        travel_fee: "14",
        admin_notes: "Parking round the back.",
      })
    );

    expect(result.fieldErrors?.travel_fee).toBeUndefined();
    expect(stub.updatePayload()).toBeDefined();
  });

  it("allows setting the fee and marking the booking paid in the same save", async () => {
    // The lock reads the state BEFORE this submit, so a booking becoming fully
    // paid in this very save must not block the fee that is being set with it.
    const stub = stubAdminClient();

    const result = await updateBookingManagement(
      {},
      statusFormData({
        travel_fee: "14",
        payment_status: "paid",
        payment_method: "cash",
        amount_paid: "104",
      })
    );

    expect(result.fieldErrors?.travel_fee).toBeUndefined();
    const payload = stub.updatePayload();
    expect(payload?.travel_fee).toBe(14);
    expect(payload?.total_price).toBe(104);
    expect(payload?.amount_paid).toBe(104);
  });

  it("does not lock the travel fee on a cancelled booking", async () => {
    // Asserted explicitly so a later reader does not "tidy" this into a blanket
    // lock — a cancelled booking is not financial history.
    const stub = stubAdminClient({ ...BASE_BOOKING, status: "cancelled" });

    const result = await updateBookingManagement(
      {},
      statusFormData({ status: "cancelled", travel_fee: "14" })
    );

    expect(result.fieldErrors?.travel_fee).toBeUndefined();
    expect(stub.updatePayload()?.travel_fee).toBe(14);
  });
});
