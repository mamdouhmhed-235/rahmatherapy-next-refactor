import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStaffProfile, PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { claimBookingAssignment } from "../actions";

/**
 * C-05 Phase B (Step 4) — claimBookingAssignment is gated by ensureBookingActive
 * before the claim-eligibility check or any DB write. These specs cover the
 * three inert reasons the gate can return; the active-booking claim path is
 * exercised elsewhere and is unchanged by this gate.
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
    can_take_bookings: true,
    availability_mode: "use_global",
    permissions: new Set(permissions),
  };
}

const therapist = staff("Therapist", [PERMISSIONS.CLAIM_ASSIGNMENTS]);

const UNCLAIMED_ASSIGNMENT = {
  id: "assignment-1",
  booking_id: "booking-1",
  assigned_staff_id: null,
  required_therapist_gender: "female",
  status: "unassigned",
};

interface RecordedOp {
  table: string;
  op: "select" | "update" | "insert";
}

/**
 * Minimal admin-client stand-in for the gate specs: only the assignment SELECT
 * (to find `booking_id`) and the booking SELECT (`ensureBookingActive`'s own
 * query) ever run when the gate blocks. Any `update`/`insert` reaching this
 * stub means a blocked claim wrote to the DB regardless — a bug these specs
 * catch via `writes()`.
 */
function stubAdminClient(booking: Record<string, unknown>) {
  const ops: RecordedOp[] = [];

  function resolve(entry: RecordedOp) {
    if (entry.table === "booking_assignments" && entry.op === "select") {
      return { data: UNCLAIMED_ASSIGNMENT, error: null };
    }
    if (entry.table === "bookings" && entry.op === "select") {
      return { data: booking, error: null };
    }
    return { data: null, error: null };
  }

  function startOp(table: string, op: RecordedOp["op"]) {
    const entry: RecordedOp = { table, op };
    ops.push(entry);
    const settle = () => Promise.resolve(resolve(entry));
    const chain = {
      eq: () => chain,
      select: () => chain,
      single: settle,
      maybeSingle: settle,
      returns: settle,
    };
    return chain;
  }

  const from = vi.fn((table: string) => ({
    select: () => startOp(table, "select"),
    update: () => startOp(table, "update"),
    insert: () => startOp(table, "insert"),
  }));

  const client = { from } as unknown as ReturnType<typeof createSupabaseAdminClient>;
  vi.mocked(createSupabaseAdminClient).mockReturnValue(client);

  return {
    writes: () => ops.filter((entry) => entry.op !== "select"),
  };
}

function claimFormData() {
  const formData = new FormData();
  formData.set("assignment_id", UNCLAIMED_ASSIGNMENT.id);
  return formData;
}

function activeishBooking(overrides: Record<string, unknown>) {
  return {
    id: "booking-1",
    status: "confirmed",
    booking_date: "2026-08-01",
    start_time: "14:00:00",
    end_time: "15:00:00",
    deleted_at: null,
    clients: { deleted_at: null },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getStaffProfile).mockResolvedValue(therapist);
});

describe("claimBookingAssignment — C-05 ensureBookingActive gate", () => {
  it("blocks a claim on a cancelled booking with no DB write", async () => {
    const stub = stubAdminClient(activeishBooking({ status: "cancelled" }));

    expect(await claimBookingAssignment(claimFormData())).toEqual({
      error: "This booking is cancelled. Restore it from the booking detail page first.",
    });
    expect(stub.writes()).toHaveLength(0);
  });

  it("blocks a claim on a no_show booking with no DB write", async () => {
    const stub = stubAdminClient(activeishBooking({ status: "no_show" }));

    expect(await claimBookingAssignment(claimFormData())).toEqual({
      error: "This booking is marked no-show. Restore it from the booking detail page first.",
    });
    expect(stub.writes()).toHaveLength(0);
  });

  it("blocks a claim on a past-dated booking with no DB write", async () => {
    const stub = stubAdminClient(activeishBooking({ booking_date: "2020-01-01" }));

    expect(await claimBookingAssignment(claimFormData())).toEqual({
      error: "This booking is in the past. Actions are no longer available.",
    });
    expect(stub.writes()).toHaveLength(0);
  });
});
