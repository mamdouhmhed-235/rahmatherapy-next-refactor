// F-04B-02 — the inline-assignment block of `createManualBooking`.
//
// ⛔ WHY THIS FILE EXISTS. The block that applies the admin's step-4 therapist
// choices was silently broken and 3,119 tests passed the whole time, because
// this code path had NO test at all. The old code read participants with
// `.order("created_at")`, but `booking_participants` HAS NO `created_at`
// column: PostgREST answered 400/42703, the call destructured only `data`, the
// error vanished, `participants` came back null, and every therapist selection
// was discarded with nothing shown, logged or thrown. The booking was created,
// the admin saw a success redirect, and no therapist was ever attached.
//
// The first test below is the regression itself and MUST fail against that old
// code — see the note on it for exactly which assertion does the discriminating.
//
// HARNESS: this reuses `createManualBooking-optional-email.test.ts` exactly —
// same module mocks, same `withBookableServices` wrapper, same form-data
// builder shape. The only addition is a fuller `from()` stub, because the
// inline-assignment block reads four more tables than the email path does.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStaffProfile } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendBookingCreatedEmails } from "@/lib/email/notifications";
import { ensureBookingManageUrl } from "@/lib/booking/manage-token";
import { createManualBooking } from "../actions";
import { withBookableServices } from "@/lib/booking/bookable-services.test-stub";

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
  sendStaffAssignmentEmail: vi.fn(),
}));

vi.mock("@/lib/booking/manage-token", () => ({
  ensureBookingManageUrl: vi.fn(),
}));

// ⛔ `recordOperationalEvent` is deliberately NOT mocked. It is the thing under
// test in the privacy case: it writes `summary` and `safe_context` straight
// into `operational_events`, and this file asserts on the ROW it would insert.
// Mocking it would move the privacy assertion off the real payload.

const rpc = vi.fn();

const bookingManager = {
  id: "staff-1",
  auth_user_id: "auth-1",
  name: "Owner",
  email: "owner@example.test",
  role_id: "role-1",
  role_name: "Owner",
  gender: "female",
  active: true,
  can_take_bookings: false,
  availability_mode: "use_global",
  permissions: new Set(["manage_bookings_all"]),
} satisfies Awaited<ReturnType<typeof getStaffProfile>>;

// ─── the admin-client stub ──────────────────────────────────────────────────
//
// A recording query chain. Every PostgREST verb the inline-assignment block
// uses returns the chain; the chain itself is thenable, so `await from(t)
// .select(…).eq(…)` resolves, and `.single()` resolves too. Which `{data,
// error}` comes back is decided per table AND per verb, because
// `booking_assignments` is both read (`.select("id").eq().single()`) and
// written (`.update().eq()`) in the same pass.

type ChainOp = { op: string; args: unknown[] };
type Recorded = { table: string; op: string; args: unknown[] };
type Answer = { data: unknown; error: unknown };

interface ParticipantRow {
  id: string;
  display_name: string | null;
  is_main_contact: boolean;
  required_therapist_gender: "male" | "female";
}

interface StaffRow {
  id: string;
  name: string;
  gender: "male" | "female";
}

interface StubConfig {
  participants?: ParticipantRow[];
  participantsError?: { message: string; code?: string } | null;
  staff?: StaffRow[];
  staffError?: { message: string; code?: string } | null;
  /** participant id → assignment row id, or null to simulate a missing row. */
  assignmentByParticipant?: Record<string, string | null>;
}

function buildAdminStub(config: StubConfig) {
  const calls: Recorded[] = [];

  function answer(table: string, ops: ChainOp[]): Answer {
    const verbs = ops.map((o) => o.op);
    switch (table) {
      case "booking_participants":
        return {
          data: config.participantsError ? null : (config.participants ?? []),
          error: config.participantsError ?? null,
        };
      case "staff_profiles":
        return {
          data: config.staffError ? null : (config.staff ?? []),
          error: config.staffError ?? null,
        };
      case "booking_assignments": {
        if (verbs.includes("update")) return { data: null, error: null };
        const participantId = String(
          ops.find((o) => o.op === "eq" && o.args[0] === "participant_id")?.args[1] ?? ""
        );
        const assignmentId =
          config.assignmentByParticipant?.[participantId] ??
          `assignment-of-${participantId}`;
        return assignmentId
          ? { data: { id: assignmentId }, error: null }
          : { data: null, error: { message: "no rows", code: "PGRST116" } };
      }
      default:
        return { data: null, error: null };
    }
  }

  const from = (table: string) => {
    const ops: ChainOp[] = [];
    const chain: Record<string, unknown> = {};
    const record = (op: string) => (...args: unknown[]) => {
      ops.push({ op, args });
      calls.push({ table, op, args });
      return chain;
    };
    Object.assign(chain, {
      select: record("select"),
      insert: record("insert"),
      update: record("update"),
      upsert: record("upsert"),
      eq: record("eq"),
      in: record("in"),
      // ⛔ Kept on the stub ON PURPOSE. The old code called `.order("created_at")`
      // on a table that has no such column. If the stub lacked `order` the old
      // code would die with a TypeError instead of reproducing the real 400,
      // and the regression test would "pass" for the wrong reason.
      order: record("order"),
      returns: record("returns"),
      single: (...args: unknown[]) => {
        ops.push({ op: "single", args });
        calls.push({ table, op: "single", args });
        return Promise.resolve(answer(table, ops));
      },
      maybeSingle: (...args: unknown[]) => {
        ops.push({ op: "maybeSingle", args });
        calls.push({ table, op: "maybeSingle", args });
        return Promise.resolve(answer(table, ops));
      },
      then: (
        resolve: (value: Answer) => unknown,
        reject?: (reason: unknown) => unknown
      ) => Promise.resolve(answer(table, ops)).then(resolve, reject),
    });
    return chain;
  };

  const client = {
    rpc,
    from: withBookableServices(from),
  } as unknown as ReturnType<typeof createSupabaseAdminClient>;

  return {
    client,
    calls,
    callsTo: (table: string, op?: string) =>
      calls.filter((c) => c.table === table && (op ? c.op === op : true)),
    /** Every `booking_assignments.update({...})` payload, in order. */
    assignmentUpdates: () =>
      calls
        .filter((c) => c.table === "booking_assignments" && c.op === "update")
        .map((c) => c.args[0] as Record<string, unknown>),
    /** Every `bookings.update({...})` payload, in order. */
    bookingUpdates: () =>
      calls
        .filter((c) => c.table === "bookings" && c.op === "update")
        .map((c) => c.args[0] as Record<string, unknown>),
    /** Every row handed to `operational_events.insert(...)`. */
    operationalEvents: () =>
      calls
        .filter((c) => c.table === "operational_events" && c.op === "insert")
        .map((c) => c.args[0] as Record<string, unknown>),
  };
}

function manualBookingFormData(
  overrides: Record<string, string> = {}
): FormData {
  const formData = new FormData();
  formData.append("service_slugs", "hijama-package");
  formData.set("booking_source", "phone");
  formData.set("booking_date", "2026-06-01");
  formData.set("start_time", "10:00");
  formData.set("booking_for", "self");
  formData.set("full_name", "Aisha Khan");
  formData.set("email", "aisha@example.test");
  formData.set("phone", "07123 456 789");
  formData.set("number_of_people", "1");
  formData.set("participant_name_0", "Aisha Khan");
  formData.set("participant_gender_0", "female");
  formData.set("address", "10 Test Street");
  formData.set("postcode", "LU1 1AA");
  formData.set("city", "Luton");
  formData.set("area", "Bedfordshire");
  formData.set("consent_acknowledged", "on");
  // No confirmation email in this file — the send path has its own coverage in
  // createManualBooking-optional-email.test.ts and would only add noise here.
  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }
  return formData;
}

/** Two-person form: two names, two genders, two therapist selections. */
function twoPersonFormData(overrides: Record<string, string> = {}): FormData {
  return manualBookingFormData({
    number_of_people: "2",
    participant_name_0: "Alice Probe",
    participant_gender_0: "female",
    participant_name_1: "Bella Probe",
    participant_gender_1: "female",
    ...overrides,
  });
}

const THERAPIST_F = {
  id: "therapist-female",
  name: "Fatima Therapist",
  gender: "female",
} as const;
const THERAPIST_M = {
  id: "therapist-male",
  name: "Musa Therapist",
  gender: "male",
} as const;

let consoleError: ReturnType<typeof vi.spyOn>;

/** Every console.error call this run, flattened to one searchable line each. */
function surfacedConsoleLines(): string[] {
  return (consoleError.mock.calls as unknown[][]).map((args) =>
    args.map((arg) => String(arg)).join(" ")
  );
}

describe("createManualBooking — inline therapist assignment (F-04B-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(getStaffProfile).mockResolvedValue(bookingManager);
    vi.mocked(ensureBookingManageUrl).mockResolvedValue("https://example.test/manage");
    vi.mocked(sendBookingCreatedEmails).mockResolvedValue({ manageUrl: null });
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  function arrange(config: StubConfig, participantCount: number) {
    rpc.mockResolvedValue({
      data: {
        bookingId: "booking-new",
        participantCount,
        itemCount: 1,
        assignmentCount: participantCount,
      },
      error: null,
    });
    const stub = buildAdminStub(config);
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client);
    return stub;
  }

  // ── 1. THE REGRESSION ITSELF ──────────────────────────────────────────────
  //
  // ⛔ THIS TEST MUST FAIL AGAINST THE OLD CODE. Against the old code the
  // participants read errored, `error` was never destructured, `participants`
  // was null, the `if` was false and the block was skipped in complete silence:
  // nothing thrown, nothing logged, no operational event. So the DISCRIMINATING
  // assertion is the surfaced-failure one — `expect(consoleError)…` — not the
  // "update never called" one, which the old code also satisfied (by doing
  // nothing at all). Both are asserted: the second one is what proves the fix
  // did not paper over the failure by assigning something arbitrary instead.
  it("surfaces a failing participants query instead of silently discarding every selection", async () => {
    const stub = arrange(
      {
        participantsError: {
          message: 'column booking_participants.created_at does not exist',
          code: "42703",
        },
      },
      2
    );

    await createManualBooking({}, twoPersonFormData({
      therapist_assignment_0: THERAPIST_F.id,
      therapist_assignment_1: THERAPIST_F.id,
    }));

    // The failure reaches a human-readable channel carrying the real cause.
    const surfaced = surfacedConsoleLines();
    expect(
      surfaced.some(
        (line) =>
          line.includes("Inline assignment failed") &&
          line.includes("participant lookup failed") &&
          line.includes("created_at")
      )
    ).toBe(true);

    // ⛔ And nothing was written on a guess. A failed read must not become an
    // arbitrary pairing — this clinic matches therapists by gender.
    expect(stub.assignmentUpdates()).toEqual([]);
    expect(stub.callsTo("booking_assignments", "update")).toHaveLength(0);
    expect(stub.bookingUpdates()).toEqual([]);
  });

  it("surfaces a failing therapist lookup the same way, and assigns nobody", async () => {
    const stub = arrange(
      {
        participants: [
          {
            id: "p-1",
            display_name: "Alice Probe",
            is_main_contact: true,
            required_therapist_gender: "female",
          },
        ],
        staffError: { message: "staff_profiles read refused", code: "42501" },
      },
      1
    );

    await createManualBooking({}, manualBookingFormData({
      participant_name_0: "Alice Probe",
      therapist_assignment_0: THERAPIST_F.id,
    }));

    const surfaced = surfacedConsoleLines();
    expect(
      surfaced.some(
        (line) =>
          line.includes("Inline assignment failed") &&
          line.includes("therapist lookup failed")
      )
    ).toBe(true);
    expect(stub.assignmentUpdates()).toEqual([]);
  });

  // ── 2. THE HAPPY PATH ─────────────────────────────────────────────────────
  it("applies both selections for two named participants and marks the booking fully_assigned", async () => {
    const stub = arrange(
      {
        participants: [
          {
            id: "p-alice",
            display_name: "Alice Probe",
            is_main_contact: true,
            required_therapist_gender: "female",
          },
          {
            id: "p-bella",
            display_name: "Bella Probe",
            is_main_contact: false,
            required_therapist_gender: "female",
          },
        ],
        staff: [{ ...THERAPIST_F }],
      },
      2
    );

    await createManualBooking({}, twoPersonFormData({
      therapist_assignment_0: THERAPIST_F.id,
      therapist_assignment_1: THERAPIST_F.id,
    }));

    // Both assignment rows written, each with the chosen therapist.
    expect(stub.assignmentUpdates()).toEqual([
      { assigned_staff_id: THERAPIST_F.id, status: "assigned" },
      { assigned_staff_id: THERAPIST_F.id, status: "assigned" },
    ]);

    // Each update targeted the assignment row of the RIGHT participant — the
    // whole point of matching on display_name rather than on row order.
    const targetedAssignmentIds = stub
      .callsTo("booking_assignments", "eq")
      .filter((c) => c.args[0] === "id")
      .map((c) => c.args[1]);
    expect(targetedAssignmentIds).toEqual([
      "assignment-of-p-alice",
      "assignment-of-p-bella",
    ]);

    expect(stub.bookingUpdates()).toEqual([{ assignment_status: "fully_assigned" }]);
    expect(stub.operationalEvents()).toEqual([]);
    // An audit row per applied assignment, on top of the creation audit row.
    expect(
      stub
        .callsTo("audit_logs", "insert")
        .map((c) => (c.args[0] as { action_type: string }).action_type)
    ).toEqual([
      "manual_admin_booking_created",
      "booking_assignment_reassigned",
      "booking_assignment_reassigned",
    ]);
  });

  it("marks the booking partially_assigned when only one of two is chosen", async () => {
    const stub = arrange(
      {
        participants: [
          {
            id: "p-alice",
            display_name: "Alice Probe",
            is_main_contact: true,
            required_therapist_gender: "female",
          },
          {
            id: "p-bella",
            display_name: "Bella Probe",
            is_main_contact: false,
            required_therapist_gender: "female",
          },
        ],
        staff: [{ ...THERAPIST_F }],
      },
      2
    );

    await createManualBooking({}, twoPersonFormData({
      therapist_assignment_0: THERAPIST_F.id,
    }));

    expect(stub.assignmentUpdates()).toHaveLength(1);
    expect(stub.bookingUpdates()).toEqual([{ assignment_status: "partially_assigned" }]);
    // Choosing nobody for participant 2 is not a failure — no alert for it.
    expect(stub.operationalEvents()).toEqual([]);
  });

  // ── 3. THE `Participant N` FALLBACK ───────────────────────────────────────
  //
  // ⛔ HONEST COVERAGE NOTE. `expectedDisplayName` falls back to
  // `Participant ${i + 1}` for a blank name at index ≥ 1, mirroring
  // `create_booking_request` (proven against the live database: 'Carl Probe' /
  // 'Participant 2'). That fallback is UNREACHABLE from this action today,
  // because `createBookingTransaction.getParticipantNames` refuses a blank name
  // whenever numberOfPeople > 1 and throws BEFORE the RPC — so no such booking
  // can exist to assign against. These two tests pin BOTH halves: the guard
  // that makes it unreachable, and the matching that would be correct if a
  // participant genuinely carries that label (an admin can type it).
  it("refuses a blank second participant name before any booking is created", async () => {
    const stub = arrange({}, 2);

    const result = await createManualBooking({}, twoPersonFormData({
      participant_name_1: "",
      therapist_assignment_0: THERAPIST_F.id,
      therapist_assignment_1: THERAPIST_F.id,
    }));

    expect(result).toEqual({ error: "Enter a name or label for every participant." });
    expect(rpc).not.toHaveBeenCalled();
    expect(stub.assignmentUpdates()).toEqual([]);
  });

  it("matches a participant literally labelled 'Participant 2'", async () => {
    const stub = arrange(
      {
        participants: [
          {
            id: "p-carl",
            display_name: "Carl Probe",
            is_main_contact: true,
            required_therapist_gender: "male",
          },
          {
            id: "p-second",
            display_name: "Participant 2",
            is_main_contact: false,
            required_therapist_gender: "male",
          },
        ],
        staff: [{ ...THERAPIST_M }],
      },
      2
    );

    await createManualBooking({}, twoPersonFormData({
      participant_name_0: "Carl Probe",
      participant_gender_0: "male",
      participant_name_1: "Participant 2",
      participant_gender_1: "male",
      therapist_assignment_1: THERAPIST_M.id,
    }));

    expect(stub.assignmentUpdates()).toEqual([
      { assigned_staff_id: THERAPIST_M.id, status: "assigned" },
    ]);
    const targeted = stub
      .callsTo("booking_assignments", "eq")
      .filter((c) => c.args[0] === "participant_id")
      .map((c) => c.args[1]);
    expect(targeted).toEqual(["p-second"]);
  });

  // ── 4. SOLO BLANK NAME → THE CONTACT'S NAME ───────────────────────────────
  it("matches a solo participant with a blank name to the contact's name", async () => {
    const stub = arrange(
      {
        participants: [
          {
            id: "p-solo",
            display_name: "ZZ Solo Probe",
            is_main_contact: true,
            required_therapist_gender: "female",
          },
        ],
        staff: [{ ...THERAPIST_F }],
      },
      1
    );

    await createManualBooking({}, manualBookingFormData({
      full_name: "ZZ Solo Probe",
      participant_name_0: "",
      therapist_assignment_0: THERAPIST_F.id,
    }));

    expect(stub.assignmentUpdates()).toEqual([
      { assigned_staff_id: THERAPIST_F.id, status: "assigned" },
    ]);
    expect(stub.bookingUpdates()).toEqual([{ assignment_status: "fully_assigned" }]);
    expect(stub.operationalEvents()).toEqual([]);
  });

  // ── 4b. RA-01 — THE SOLO DIVERGENCE, PINNED POSITIVELY ────────────────────
  //
  // ⛔ THIS IS THE REGRESSION TEST FOR THE BUG THE FIRST VERSION OF THIS FIX
  // STILL HAD. The reconstruction originally preferred the TYPED participant
  // label. But for a solo booking that is not "for someone else",
  // `createBookingTransaction.getParticipantNames` sends `details.fullName` —
  // so the stored `display_name` is the CONTACT's name and the typed label is
  // discarded before the database ever sees it. Matching on the label found
  // nothing, and every solo therapist selection was skipped, silently in the
  // first version and merely reported in the second.
  //
  // Here the admin books FOR THEMSELVES, types a different label, and picks a
  // gender-matching therapist. The assignment MUST be applied.
  // ⛔ Revert `expectedDisplayName` to preferring the typed name and this test
  // fails — that is the whole point of it.
  it("applies a solo selection when the typed label differs from the contact name", async () => {
    const stub = arrange(
      {
        participants: [
          {
            id: "p-solo",
            display_name: "Aisha Khan", // what the DB really stores for solo/self
            is_main_contact: true,
            required_therapist_gender: "female",
          },
        ],
        staff: [{ ...THERAPIST_F }],
      },
      1
    );

    await createManualBooking({}, manualBookingFormData({
      booking_for: "self",
      participant_name_0: "Some Other Label", // deliberately NOT the contact name
      therapist_assignment_0: THERAPIST_F.id,
    }));

    expect(stub.assignmentUpdates()).toEqual([
      { assigned_staff_id: THERAPIST_F.id, status: "assigned" },
    ]);
    expect(stub.bookingUpdates()).toEqual([{ assignment_status: "fully_assigned" }]);
    expect(stub.operationalEvents()).toEqual([]);
  });

  // ── 5. THE GENDER GUARD ───────────────────────────────────────────────────
  //
  // ⛔ This clinic matches therapists by gender. A wrong pairing is worse than
  // no pairing, so a mismatch must be REFUSED and REPORTED, never written.
  // ⛔ FIXTURE CORRECTED (RA-01). A SOLO booking in "self" mode stores the
  // CONTACT's name as `display_name`, not the typed participant label —
  // `createBookingTransaction.getParticipantNames` substitutes `details.fullName`
  // unless bookingFor === "someone_else". The form below deliberately types a
  // DIFFERENT label ("Alice Probe") from the contact ("Aisha Khan"), so this
  // fixture now reproduces the exact divergence that made the first version of
  // this fix skip every solo selection. It must stay this way.
  it("refuses a therapist whose gender does not match required_therapist_gender", async () => {
    const stub = arrange(
      {
        participants: [
          {
            id: "p-alice",
            display_name: "Aisha Khan",
            is_main_contact: true,
            required_therapist_gender: "female",
          },
        ],
        staff: [{ ...THERAPIST_M }],
      },
      1
    );

    await createManualBooking({}, manualBookingFormData({
      participant_name_0: "Alice Probe",
      therapist_assignment_0: THERAPIST_M.id,
    }));

    expect(stub.assignmentUpdates()).toEqual([]);
    expect(stub.bookingUpdates()).toEqual([]);

    const events = stub.operationalEvents();
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe("therapist_selection_not_applied");
    expect(events[0].booking_id).toBe("booking-new");
    expect((events[0].safe_context as Record<string, unknown>).skipped_count).toBe(1);
    expect((events[0].safe_context as Record<string, unknown>).applied_count).toBe(0);
    expect(String((events[0].safe_context as Record<string, unknown>).reasons)).toContain(
      "needs a female therapist"
    );
  });

  it("still applies the matching half of a mixed pair and reports the refused half", async () => {
    const stub = arrange(
      {
        participants: [
          {
            id: "p-alice",
            display_name: "Alice Probe",
            is_main_contact: true,
            required_therapist_gender: "female",
          },
          {
            id: "p-bella",
            display_name: "Bella Probe",
            is_main_contact: false,
            required_therapist_gender: "female",
          },
        ],
        staff: [{ ...THERAPIST_F }, { ...THERAPIST_M }],
      },
      2
    );

    await createManualBooking({}, twoPersonFormData({
      therapist_assignment_0: THERAPIST_F.id,
      therapist_assignment_1: THERAPIST_M.id,
    }));

    expect(stub.assignmentUpdates()).toEqual([
      { assigned_staff_id: THERAPIST_F.id, status: "assigned" },
    ]);
    // One of two applied → NOT fully_assigned.
    expect(stub.bookingUpdates()).toEqual([{ assignment_status: "partially_assigned" }]);
    const events = stub.operationalEvents();
    expect(events).toHaveLength(1);
    expect((events[0].safe_context as Record<string, unknown>).applied_count).toBe(1);
    expect((events[0].safe_context as Record<string, unknown>).skipped_count).toBe(1);
  });

  // ── 6. AMBIGUITY — NEVER GUESS ────────────────────────────────────────────
  it("assigns nobody when two participants share the same display name", async () => {
    const stub = arrange(
      {
        participants: [
          {
            id: "p-twin-a",
            display_name: "Sara Probe",
            is_main_contact: false,
            required_therapist_gender: "female",
          },
          {
            id: "p-twin-b",
            display_name: "Sara Probe",
            is_main_contact: false,
            required_therapist_gender: "female",
          },
        ],
        staff: [{ ...THERAPIST_F }],
      },
      2
    );

    await createManualBooking({}, twoPersonFormData({
      full_name: "Aisha Khan",
      participant_name_0: "Sara Probe",
      participant_name_1: "Sara Probe",
      therapist_assignment_0: THERAPIST_F.id,
      therapist_assignment_1: THERAPIST_F.id,
    }));

    // ⛔ Neither is assigned. Picking "the first match" would be a coin flip on
    // a real client's therapist.
    expect(stub.assignmentUpdates()).toEqual([]);
    expect(stub.bookingUpdates()).toEqual([]);
    const events = stub.operationalEvents();
    expect(events).toHaveLength(1);
    expect(String((events[0].safe_context as Record<string, unknown>).reasons)).toContain(
      "name matches more than one participant"
    );
    expect((events[0].safe_context as Record<string, unknown>).skipped_count).toBe(2);
  });

  it("disambiguates index 0 by is_main_contact when the contact's name repeats", async () => {
    const stub = arrange(
      {
        participants: [
          {
            id: "p-contact",
            display_name: "Sara Probe",
            is_main_contact: true,
            required_therapist_gender: "female",
          },
          {
            id: "p-namesake",
            display_name: "Sara Probe",
            is_main_contact: false,
            required_therapist_gender: "female",
          },
        ],
        staff: [{ ...THERAPIST_F }],
      },
      2
    );

    await createManualBooking({}, twoPersonFormData({
      participant_name_0: "Sara Probe",
      participant_name_1: "Sara Probe",
      therapist_assignment_0: THERAPIST_F.id,
    }));

    // Index 0 resolves to the main-contact row; index 1 was not selected.
    const targeted = stub
      .callsTo("booking_assignments", "eq")
      .filter((c) => c.args[0] === "participant_id")
      .map((c) => c.args[1]);
    expect(targeted).toEqual(["p-contact"]);
    expect(stub.assignmentUpdates()).toHaveLength(1);
  });

  // ⛔ Same corrected fixture as above — solo "self" stores the CONTACT's name.
  it("skips — and reports — a selection whose therapist row does not come back", async () => {
    const stub = arrange(
      {
        participants: [
          {
            id: "p-alice",
            display_name: "Aisha Khan",
            is_main_contact: true,
            required_therapist_gender: "female",
          },
        ],
        staff: [], // the chosen id resolves to no staff row
      },
      1
    );

    await createManualBooking({}, manualBookingFormData({
      participant_name_0: "Alice Probe",
      therapist_assignment_0: "therapist-deleted",
    }));

    expect(stub.assignmentUpdates()).toEqual([]);
    expect(String((stub.operationalEvents()[0].safe_context as Record<string, unknown>).reasons)).toContain(
      "chosen therapist not found"
    );
  });

  it("reports at error severity when selections were made but no participant rows exist", async () => {
    const stub = arrange({ participants: [] }, 1);

    await createManualBooking({}, manualBookingFormData({
      therapist_assignment_0: THERAPIST_F.id,
    }));

    const events = stub.operationalEvents();
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe("therapist_selection_not_applied");
    expect(events[0].severity).toBe("error");
    expect(stub.assignmentUpdates()).toEqual([]);
  });

  it("does not touch any assignment table when no therapist was chosen", async () => {
    const stub = arrange({}, 1);

    await createManualBooking({}, manualBookingFormData());

    expect(stub.callsTo("booking_participants")).toEqual([]);
    expect(stub.callsTo("staff_profiles")).toEqual([]);
    expect(stub.assignmentUpdates()).toEqual([]);
    expect(stub.operationalEvents()).toEqual([]);
  });

  // ── 7. PRIVACY ────────────────────────────────────────────────────────────
  //
  // ⛔ `operational_events` is documented at the top of
  // src/lib/ops/operational-events.ts: "stores safe operational summaries,
  // never raw payloads". /admin/operations is visible to staff who may have no
  // business seeing this booking's clients, so a participant's display name —
  // a real client's name — must never reach `summary` or `safe_context`. The
  // booking id is on the row; the 1-based index is enough to find the person.
  it("puts NO participant name and NO therapist name in the operational event", async () => {
    const stub = arrange(
      {
        participants: [
          {
            id: "p-alice",
            display_name: "Alice Probe",
            is_main_contact: true,
            required_therapist_gender: "female",
          },
          {
            id: "p-bella",
            display_name: "Bella Probe",
            is_main_contact: false,
            required_therapist_gender: "female",
          },
        ],
        staff: [{ ...THERAPIST_M }],
      },
      2
    );

    await createManualBooking({}, twoPersonFormData({
      therapist_assignment_0: THERAPIST_M.id,
      therapist_assignment_1: THERAPIST_M.id,
    }));

    const events = stub.operationalEvents();
    expect(events).toHaveLength(1);

    // Everything the row carries, flattened — summary, safe_context and all.
    const written = JSON.stringify(events[0]);

    const forbidden = [
      "Alice Probe", // participant display name
      "Bella Probe", // participant display name
      "Aisha Khan", // the contact's name
      "Fatima Therapist", // therapist name
      "Musa Therapist", // therapist name
      "aisha@example.test", // contact email
      "07123 456 789", // contact phone
      "10 Test Street", // service address
      "LU1 1AA", // postcode
    ];
    for (const secret of forbidden) {
      expect(written).not.toContain(secret);
    }

    // It is still USEFUL: it says how many failed, which one, and why.
    expect(String(events[0].summary)).toContain("2 of 2 therapist selection(s)");
    expect(String((events[0].safe_context as Record<string, unknown>).reasons)).toContain(
      "participant 1"
    );
    expect(String((events[0].safe_context as Record<string, unknown>).reasons)).toContain(
      "participant 2"
    );
  });

  it("keeps the raw booking payload out of the no-participant-rows event too", async () => {
    const stub = arrange({ participants: [] }, 1);

    await createManualBooking({}, manualBookingFormData({
      participant_name_0: "Alice Probe",
      therapist_assignment_0: THERAPIST_F.id,
    }));

    const written = JSON.stringify(stub.operationalEvents()[0]);
    for (const secret of ["Alice Probe", "Aisha Khan", "aisha@example.test", "LU1 1AA"]) {
      expect(written).not.toContain(secret);
    }
  });
});
