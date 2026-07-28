import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sendAssignedStaffBookingChangeEmails } from "@/lib/email/notifications";
import { getStaffProfile, PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { addBusinessDays, getBusinessDate } from "@/lib/time/london";
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

// Derived from London's today, never hardcoded: the guard compares against
// `getBusinessDate()`, so a frozen fixture date would rot.
const TODAY = getBusinessDate();
const YESTERDAY = addBusinessDays(TODAY, -1);
const TOMORROW = addBusinessDays(TODAY, 1);

/** The assignment the actor is finishing. */
const OWN_ASSIGNMENT = {
  id: "assignment-1",
  booking_id: "booking-1",
  assigned_staff_id: therapist.id,
  required_therapist_gender: "female",
  status: "assigned",
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
 * the WHERE guard finds nothing, and `maybeSingle()` reports that as an empty
 * result rather than an error. `promoteError` models a genuine write failure,
 * which must still surface.
 *
 * `bookingDate` defaults to a past visit — the ordinary case for a practitioner
 * finishing their work — so only the temporal specs need to name it.
 */
function stubAdminClient({
  bookingStatus = "confirmed",
  bookingDate = YESTERDAY,
  assignments = [
    { assigned_staff_id: therapist.id, status: "completed" },
    { assigned_staff_id: "staff-Other", status: "no_show" },
  ] as { assigned_staff_id: string | null; status: string }[],
  promoteMatchesRow = true,
  promoteError = null as string | null,
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
      if (entry.op === "select") {
        return { data: { status: bookingStatus, booking_date: bookingDate }, error: null };
      }
      // The recompute's `assignment_status` write is awaited for its error only.
      if (!Object.hasOwn(entry.payload ?? {}, "status")) {
        return { data: null, error: null };
      }
      if (promoteError) return { data: null, error: { message: promoteError } };
      return promoteMatchesRow
        ? { data: { status: "completed" }, error: null }
        : { data: null, error: null };
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
      maybeSingle: <T,>() =>
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
  // The caller reports a failed promote through `console.error`; two specs
  // below turn on whether it fired, so it is silenced and observed rather than
  // left to write into the test output. `vi.clearAllMocks()` resets its call
  // history each time without dropping the silencing implementation.
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getStaffProfile).mockResolvedValue(therapist);
    // Awaited with a `.catch` tail, so it has to be thenable.
    vi.mocked(sendAssignedStaffBookingChangeEmails).mockReset().mockResolvedValue();
  });

  afterAll(() => {
    consoleError.mockRestore();
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

  // W03-E-2 reached through the back door. Nothing stops a practitioner
  // finishing next week's assignment today — `updateOwnAssignmentStatus` has no
  // date guard and the own-work check only asks who holds the assignment — so
  // the promoter is where the booking-level write is refused, exactly as
  // `quickUpdateBooking`'s `complete` chip refuses it.
  it("does not promote a future-dated booking", async () => {
    const stub = stubAdminClient({ bookingDate: TOMORROW });

    expect(await updateOwnAssignmentStatus(assignmentFormData("completed"))).toEqual({
      success: true,
    });

    expectNoPromotion(stub);
    // Only the promotion is suppressed: the practitioner's own write lands.
    expect(
      stub.ops.filter(
        (entry) => entry.table === "booking_assignments" && entry.op === "update"
      )
    ).toEqual([
      expect.objectContaining({ payload: { status: "completed" } }),
    ]);
  });

  // The over-blocking canary. The guard is date-only, like the chip's: a visit
  // on today's date is finishable however late in the day it was booked for.
  it("still promotes a booking dated today", async () => {
    const stub = stubAdminClient({ bookingDate: TODAY });

    await updateOwnAssignmentStatus(assignmentFormData("completed"));

    expect(stub.promoteUpdates()).toHaveLength(1);
    expect(stub.auditRows("booking_auto_promoted_completed")).toHaveLength(1);
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
  // no second email (brief §5.4). It is also the path that must stay SILENT —
  // the guard did its job, so nothing here is a failure to report.
  it("writes nothing and reports nothing when a concurrent promote got there first", async () => {
    const stub = stubAdminClient({ promoteMatchesRow: false });

    expect(await updateOwnAssignmentStatus(assignmentFormData("completed"))).toEqual({
      success: true,
    });

    expect(stub.promoteUpdates()).toHaveLength(1);
    expect(stub.auditRows("booking_auto_promoted_completed")).toHaveLength(0);
    expect(sendAssignedStaffBookingChangeEmails).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  // The other half of the same contract: quietening the race must not quieten a
  // real write failure.
  it("reports a genuine failure of the promoting UPDATE", async () => {
    const stub = stubAdminClient({ promoteError: "deadlock detected" });

    expect(await updateOwnAssignmentStatus(assignmentFormData("completed"))).toEqual({
      success: true,
    });

    expect(stub.auditRows("booking_auto_promoted_completed")).toHaveLength(0);
    expect(consoleError).toHaveBeenCalledWith("Auto-promote failed.", "deadlock detected");
  });

  // The status this promotes to is `completed`, so at least one assignment has
  // to have been completed. Every practitioner stood up means nobody was seen —
  // recording that visit as `completed` would put an appointment that never
  // happened into the client's history and the revenue reports. It stays where
  // it is for a human to classify.
  it("does not promote when every assignment was a no-show", async () => {
    const stub = stubAdminClient({
      assignments: [{ assigned_staff_id: therapist.id, status: "no_show" }],
    });

    expect(await updateOwnAssignmentStatus(assignmentFormData("no_show"))).toEqual({
      success: true,
    });

    expect(stub.promoteUpdates()).toHaveLength(0);
    expect(stub.auditRows("booking_auto_promoted_completed")).toHaveLength(0);
    expect(sendAssignedStaffBookingChangeEmails).not.toHaveBeenCalled();
    // Only the promotion is withheld: the practitioner's own write is recorded.
    expect(stub.auditRows("booking_assignment_no_show")).toHaveLength(1);
  });

  // The sanctioned mix: one practitioner was stood up, another completed their
  // work. The visit happened, so the booking still completes.
  it("still promotes when some but not all assignments are no-shows", async () => {
    const stub = stubAdminClient({
      assignments: [
        { assigned_staff_id: therapist.id, status: "no_show" },
        { assigned_staff_id: "staff-Other", status: "completed" },
      ],
    });

    await updateOwnAssignmentStatus(assignmentFormData("no_show"));

    expect(stub.promoteUpdates()).toHaveLength(1);
    expect(stub.auditRows("booking_auto_promoted_completed")).toHaveLength(1);
  });
});
