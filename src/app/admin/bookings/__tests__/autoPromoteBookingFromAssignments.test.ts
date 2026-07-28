import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendAssignedStaffBookingChangeEmails } from "@/lib/email/notifications";
import { getStaffProfile, PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { updateOwnAssignmentStatus } from "../actions";
import { TERMINAL_BOOKING_STATUSES } from "../_helpers";

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

const therapist = staff("Therapist", [PERMISSIONS.MANAGE_BOOKINGS_ASSIGNED]);

/** The assignment the actor is finishing. */
const OWN_ASSIGNMENT = {
  id: "assignment-1",
  booking_id: "booking-1",
  assigned_staff_id: therapist.id,
  required_therapist_gender: "female",
  status: "assigned",
};

/** What `.single()` returns when the race-guarded UPDATE matches nothing. */
const NO_ROWS = {
  code: "PGRST116",
  message: "JSON object requested, multiple (or no) rows returned",
};

interface RecordedOp {
  table: string;
  op: "select" | "update" | "insert";
  payload?: Record<string, unknown>;
  filters: string[];
}

interface StubResult {
  data?: unknown;
  error?: { code?: string; message: string } | null;
}

/**
 * Stand-in for the Supabase admin client covering the chains
 * `updateOwnAssignmentStatus` builds, including the two the auto-promoter adds.
 *
 * `assignments` is the booking's post-update assignment set — both the
 * assignment-status recompute and the auto-promoter read it back by
 * `booking_id`. `promoteMatchesRow: false` models the concurrent-promote race:
 * the WHERE guard finds nothing, so `.single()` comes back empty.
 */
function stubAdminClient({
  bookingStatus = "confirmed",
  assignments = [
    { assigned_staff_id: therapist.id, status: "completed" },
    { assigned_staff_id: "staff-Other", status: "no_show" },
  ] as { assigned_staff_id: string | null; status: string }[],
  promoteMatchesRow = true,
} = {}) {
  const ops: RecordedOp[] = [];

  function resolve(entry: RecordedOp): StubResult {
    if (entry.table === "booking_assignments") {
      if (entry.op === "update") {
        return { data: { ...OWN_ASSIGNMENT, ...entry.payload }, error: null };
      }
      // By `booking_id` = the whole set; by `id` = the actor's own row.
      return entry.filters.some((filter) => filter.startsWith("eq:booking_id="))
        ? { data: assignments, error: null }
        : { data: OWN_ASSIGNMENT, error: null };
    }

    if (entry.table === "bookings") {
      if (entry.op === "select") return { data: { status: bookingStatus }, error: null };
      // The recompute's `assignment_status` write is awaited for its error only.
      if (!Object.hasOwn(entry.payload ?? {}, "status")) {
        return { data: null, error: null };
      }
      return promoteMatchesRow
        ? { data: { status: "completed" }, error: null }
        : { data: null, error: NO_ROWS };
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
      not: (column: string, operator: string, value: unknown) => {
        entry.filters.push(`not:${column}.${operator}.${String(value)}`);
        return chain;
      },
      select: () => chain,
      returns: <T,>() =>
        Promise.resolve(resolve(entry) as unknown as { data: T | null; error: unknown }),
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
      select: () => startOp(table, "select"),
      update: (payload: Record<string, unknown>) => startOp(table, "update", payload),
    };
  });

  const client = { from } as unknown as ReturnType<typeof createSupabaseAdminClient>;
  vi.mocked(createSupabaseAdminClient).mockReturnValue(client);

  /** The booking-status write, as distinct from the `assignment_status` one. */
  const promoteUpdates = () =>
    ops.filter(
      (entry) =>
        entry.table === "bookings" &&
        entry.op === "update" &&
        Object.hasOwn(entry.payload ?? {}, "status")
    );
  const auditRows = (actionType: string) =>
    ops.filter(
      (entry) => entry.table === "audit_logs" && entry.payload?.action_type === actionType
    );

  return { ops, promoteUpdates, auditRows, client };
}

function assignmentFormData(status: string) {
  const formData = new FormData();
  formData.set("assignment_id", OWN_ASSIGNMENT.id);
  formData.set("status", status);
  return formData;
}

/** No booking-status write, no audit row, no email — the assignment write stands. */
function expectNoPromotion(stub: ReturnType<typeof stubAdminClient>) {
  expect(stub.promoteUpdates()).toHaveLength(0);
  expect(stub.auditRows("booking_auto_promoted_completed")).toHaveLength(0);
  expect(sendAssignedStaffBookingChangeEmails).not.toHaveBeenCalled();
  // The practitioner's own update still succeeded and is still recorded.
  expect(stub.auditRows("booking_assignment_completed")).toHaveLength(1);
}

describe("autoPromoteBookingFromAssignments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getStaffProfile).mockResolvedValue(therapist);
    // Awaited with a `.catch` tail, so it has to be thenable.
    vi.mocked(sendAssignedStaffBookingChangeEmails).mockReset().mockResolvedValue();
  });

  it("promotes a live booking once every assignment is terminal", async () => {
    const stub = stubAdminClient({ bookingStatus: "pending" });

    expect(await updateOwnAssignmentStatus(assignmentFormData("completed"))).toEqual({
      success: true,
    });

    const promote = stub.promoteUpdates();
    expect(promote).toHaveLength(1);
    expect(promote[0].payload).toEqual({ status: "completed" });

    const audit = stub.auditRows("booking_auto_promoted_completed");
    expect(audit).toHaveLength(1);
    expect(audit[0].payload).toMatchObject({
      actor_staff_id: therapist.id,
      target_type: "bookings",
      target_id: "booking-1",
      before_state: { status: "pending" },
      after_state: {
        status: "completed",
        trigger: "all_assignments_terminal",
        assignment_statuses: ["completed", "no_show"],
      },
    });

    // Staff awareness only — the client is never emailed on auto-promote.
    expect(sendAssignedStaffBookingChangeEmails).toHaveBeenCalledWith(
      "booking-1",
      stub.client,
      "Booking auto-completed — all assignments are complete."
    );
  });

  // The race guard has to name the same three statuses as the predicate above
  // it. Written out in full rather than derived from the constant so that
  // dropping a status from `TERMINAL_BOOKING_STATUSES` fails here too.
  it("guards the UPDATE with the whole terminal list", async () => {
    const stub = stubAdminClient({ bookingStatus: "pending" });

    await updateOwnAssignmentStatus(assignmentFormData("completed"));

    expect(stub.promoteUpdates()[0].filters).toEqual([
      "eq:id=booking-1",
      'not:status.in.("completed","cancelled","no_show")',
    ]);
  });

  it.each(TERMINAL_BOOKING_STATUSES)(
    "leaves a %s booking alone even when every assignment is terminal",
    async (bookingStatus) => {
      const stub = stubAdminClient({ bookingStatus });

      expect(await updateOwnAssignmentStatus(assignmentFormData("completed"))).toEqual({
        success: true,
      });

      expectNoPromotion(stub);
    }
  );

  // The one the four `quickUpdateBooking` guards cannot see. Nothing cascades a
  // booking-level no-show down to `booking_assignments`, so the practitioner's
  // "Mark complete" stays live on a no-show booking. Promoting it to
  // `completed` would un-do the no-show without `restoreBooking`'s past-moment
  // guard, its `booking_restored` audit action or its client email.
  it("never un-does a no-show", async () => {
    const stub = stubAdminClient({ bookingStatus: "no_show" });

    await updateOwnAssignmentStatus(assignmentFormData("completed"));

    expectNoPromotion(stub);
  });

  it("waits while any assignment is still open", async () => {
    const stub = stubAdminClient({
      assignments: [
        { assigned_staff_id: therapist.id, status: "completed" },
        { assigned_staff_id: "staff-Other", status: "assigned" },
      ],
    });

    await updateOwnAssignmentStatus(assignmentFormData("completed"));

    expectNoPromotion(stub);
  });

  // An assignment nobody holds is not a finished one, whatever its status says.
  it("waits while a terminal assignment has no staff member on it", async () => {
    const stub = stubAdminClient({
      assignments: [
        { assigned_staff_id: therapist.id, status: "completed" },
        { assigned_staff_id: null, status: "completed" },
      ],
    });

    await updateOwnAssignmentStatus(assignmentFormData("completed"));

    expectNoPromotion(stub);
  });

  it("does not promote a booking with no assignments at all", async () => {
    const stub = stubAdminClient({ assignments: [] });

    await updateOwnAssignmentStatus(assignmentFormData("completed"));

    expectNoPromotion(stub);
  });

  // Two practitioners finishing at the same moment: the second UPDATE's WHERE
  // guard matches nothing, so the second promote writes no audit row and sends
  // no second email (brief §5.4).
  it("writes nothing when a concurrent promote got there first", async () => {
    const stub = stubAdminClient({ promoteMatchesRow: false });

    expect(await updateOwnAssignmentStatus(assignmentFormData("completed"))).toEqual({
      success: true,
    });

    expect(stub.promoteUpdates()).toHaveLength(1);
    expect(stub.auditRows("booking_auto_promoted_completed")).toHaveLength(0);
    expect(sendAssignedStaffBookingChangeEmails).not.toHaveBeenCalled();
  });

  // The hook fires on either terminal assignment status, not just `completed`:
  // a visit where every practitioner was stood up is still a finished visit.
  it("also promotes when the last assignment is marked no-show", async () => {
    const stub = stubAdminClient({
      assignments: [{ assigned_staff_id: therapist.id, status: "no_show" }],
    });

    await updateOwnAssignmentStatus(assignmentFormData("no_show"));

    expect(stub.promoteUpdates()).toHaveLength(1);
    expect(stub.auditRows("booking_auto_promoted_completed")).toHaveLength(1);
  });
});
