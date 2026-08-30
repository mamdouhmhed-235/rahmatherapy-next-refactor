import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { getStaffProfile, PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendRecurringSeriesCreatedEmail } from "@/lib/email/notifications";
import { checkSeriesSlots } from "@/lib/booking/availability";
import { createRecurringSeries } from "../recurring-actions";

/**
 * C-02 Phase C (Step 8) — `createRecurringSeries`.
 *
 * The load-bearing assertion here is the RPC argument object: the applied
 * `create_recurring_booking_series` takes nine required parameters, two of them
 * gender columns that are NOT NULL on a two-member enum, so a dropped or
 * mis-spelled key is a runtime-only failure that tsc cannot see (the admin
 * client carries no generated Database type, so `rpc()` is loosely typed).
 * Every gate below is also asserted to have reached the RPC not at all.
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

// C-02 Phase D — createRecurringSeries now sends a confirmation email after
// the RPC succeeds. Mocked wholesale so the happy-path specs below never
// reach the real render/send pipeline (no template-registry lookups, no
// network) — only that the action calls it with the new template id.
vi.mock("@/lib/email/notifications", () => ({
  sendRecurringSeriesCreatedEmail: vi.fn(),
}));

// ⛔ D-042 — the availability pre-check. Stubbed so THESE cases stay about the
// action's own argument-passing and refusals; the engine has its own suite, and
// the pre-check's own behaviour is pinned by the D-042 block at the end of this
// file. ⚠️ The default verdict is "every date is coverable" — every case below
// predates the check and must not start failing for a reason it was never about.
vi.mock("@/lib/booking/availability", () => ({
  checkSeriesSlots: vi.fn(),
}));

// Only the profile lookup is stubbed — the permission helpers stay real so the
// action is gated exactly as it is in production.
vi.mock("@/lib/auth/rbac", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/rbac")>()),
  getStaffProfile: vi.fn(),
}));

const CLIENT_ID = "11111111-1111-4111-8111-111111111111";
const THERAPIST_ID = "22222222-2222-4222-8222-222222222222";
const TEMPLATE_ID = "33333333-3333-4333-8333-333333333333";

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
const therapist = staff("Therapist", [PERMISSIONS.CLAIM_ASSIGNMENTS]);

const RPC_RESULT = {
  templateId: TEMPLATE_ID,
  occurrenceCount: 12,
  skippedCount: 0,
  horizonThrough: "2026-11-26",
  firstOccurrenceDate: "2026-09-04",
  serviceName: "Hijama Package",
};

interface RecordedOp {
  table: string;
  op: "select" | "update" | "insert";
}

const rpc = vi.fn();

/** ⛔ Selects the CREATE call BY NAME. Indexing `rpc.mock.calls[0]` worked while
 *  there was only one rpc call; the D-042 availability pre-check now calls
 *  `compute_occurrence_dates` FIRST, so position is no longer a safe handle.
 *  Two cases failed on exactly that, and are fixed properly here rather than
 *  papered over by bumping the index to [1]. */
function createSeriesArgs(): Record<string, unknown> {
  const call = rpc.mock.calls.find(
    ([name]) => name === "create_recurring_booking_series"
  ) as [string, Record<string, unknown>] | undefined;
  if (!call) throw new Error("create_recurring_booking_series was never called");
  return call[1];
}

/** What the stubbed `compute_occurrence_dates` hands back. */
const OCCURRENCE_DATES = ["2026-09-15", "2026-09-22", "2026-09-29"];

/**
 * Admin-client stand-in. `services` is the only table the happy path reads;
 * `audit_logs` is deliberately reachable so the specs can prove the action does
 * NOT write a second audit row over the one the RPC writes internally.
 */
/**
 * @param service        the `services` row the single()-style lookup returns
 * @param serviceVisible ⛔ D-033 — whether that service passes the
 *   `is_visible_on_frontend` check. `assertServicesBookable` reads `services`
 *   with `.in(...).eq(...).eq(...).returns()`, which resolves to an ARRAY, not
 *   the single row the allow_recurrence lookup uses — so the stub has to model
 *   BOTH shapes off the same table. `false` returns an empty array, which is
 *   exactly what a hidden service looks like to that query.
 */
function stubAdminClient(
  service: Record<string, unknown> | null,
  serviceVisible = true
) {
  const ops: RecordedOp[] = [];

  function startOp(table: string, op: RecordedOp["op"]) {
    const entry: RecordedOp = { table, op };
    ops.push(entry);
    let requestedSlugs: string[] | null = null;
    const settle = () =>
      Promise.resolve(
        table === "services"
          ? requestedSlugs
            // the visibility guard's array-shaped read
            ? {
                data: serviceVisible ? requestedSlugs.map((slug) => ({ slug })) : [],
                error: null,
              }
            : { data: service, error: service ? null : { message: "No rows" } }
          : { data: null, error: null }
      );
    const chain = {
      eq: () => chain,
      select: () => chain,
      in: (_column: string, values: string[]) => {
        requestedSlugs = values;
        return chain;
      },
      returns: () => chain,
      single: settle,
      maybeSingle: settle,
      then: (resolve: (value: unknown) => unknown) => settle().then(resolve),
    };
    return chain;
  }

  const from = vi.fn((table: string) => ({
    select: () => startOp(table, "select"),
    update: () => startOp(table, "update"),
    insert: () => startOp(table, "insert"),
  }));

  const client = { from, rpc } as unknown as ReturnType<typeof createSupabaseAdminClient>;
  vi.mocked(createSupabaseAdminClient).mockReturnValue(client);

  return {
    ops,
    writes: () => ops.filter((entry) => entry.op !== "select"),
  };
}

const RECURRABLE_SERVICE = {
  id: "service-1",
  allow_recurrence: true,
  name: "Hijama Package",
};

function recurringFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.set("client_id", CLIENT_ID);
  formData.set("participant_gender", "female");
  formData.set("service_slug", "hijama-package");
  formData.set("first_occurrence_date", "2026-09-04");
  formData.set("anchor_start_time", "14:00");
  formData.set("cadence", "weekly");
  formData.set("end_type", "until_cancelled");
  // C-02 Phase E — the form emits this from the step-4 consent checkbox and the
  // action now refuses without it, so every spec below has to carry it.
  formData.set("consent_acknowledged", "on");
  // Email-defect fix (2026-08-09) — mirrors the shared "Send confirmation
  // email to client" checkbox, ticked by default in ManualBookingForm.tsx
  // (`useState(true)`). Kept "on" here so the existing happy-path specs below
  // still exercise the email send; the "confirmation email checkbox" block
  // overrides it to prove the unticked case.
  formData.set("send_confirmation_email", "on");
  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getStaffProfile).mockResolvedValue(owner);
  // ⛔ The action now makes TWO rpc calls: `compute_occurrence_dates` FIRST —
  // it asks the database for the exact occurrence dates rather than
  // re-deriving the cadence walk in TypeScript — and
  // `create_recurring_booking_series` after it. Dispatch on the NAME so the
  // call order is not baked into the stub.
  rpc.mockImplementation((fn: string) =>
    fn === "compute_occurrence_dates"
      ? Promise.resolve({ data: OCCURRENCE_DATES, error: null })
      : Promise.resolve({ data: RPC_RESULT, error: null })
  );
  vi.mocked(checkSeriesSlots).mockResolvedValue({
    verdicts: OCCURRENCE_DATES.map((date) => ({ date, available: true })),
    durationMins: 60,
  });
  vi.mocked(sendRecurringSeriesCreatedEmail).mockResolvedValue(undefined);
});

describe("createRecurringSeries — RBAC", () => {
  it("rejects a therapist without manage_bookings_all before touching the DB", async () => {
    const stub = stubAdminClient(RECURRABLE_SERVICE);
    vi.mocked(getStaffProfile).mockResolvedValue(therapist);

    expect(await createRecurringSeries({}, recurringFormData())).toEqual({
      error: "Insufficient permissions.",
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(stub.ops).toHaveLength(0);
  });

  it("rejects a deactivated manager", async () => {
    const stub = stubAdminClient(RECURRABLE_SERVICE);
    vi.mocked(getStaffProfile).mockResolvedValue({ ...owner, active: false });

    expect(await createRecurringSeries({}, recurringFormData())).toEqual({
      error: "Insufficient permissions.",
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(stub.ops).toHaveLength(0);
  });

  it("rejects a signed-out caller", async () => {
    const stub = stubAdminClient(RECURRABLE_SERVICE);
    vi.mocked(getStaffProfile).mockResolvedValue(null);

    expect(await createRecurringSeries({}, recurringFormData())).toEqual({
      error: "Insufficient permissions.",
    });
    expect(stub.ops).toHaveLength(0);
  });
});

describe("createRecurringSeries — validation", () => {
  it("rejects an unknown cadence", async () => {
    stubAdminClient(RECURRABLE_SERVICE);

    const result = await createRecurringSeries({}, recurringFormData({ cadence: "daily" }));

    expect(result.error).toBe("Check the recurring booking details.");
    expect(result.fieldErrors?.cadence).toBeDefined();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a missing participant gender rather than letting the DB NOT NULL fail", async () => {
    stubAdminClient(RECURRABLE_SERVICE);
    const formData = recurringFormData();
    formData.delete("participant_gender");

    const result = await createRecurringSeries({}, formData);

    expect(result.error).toBe("Check the recurring booking details.");
    expect(result.fieldErrors?.participant_gender).toBeDefined();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a gender outside the two-member staff_gender_type enum", async () => {
    stubAdminClient(RECURRABLE_SERVICE);

    const result = await createRecurringSeries(
      {},
      recurringFormData({ participant_gender: "any" })
    );

    expect(result.fieldErrors?.participant_gender).toBeDefined();
    expect(rpc).not.toHaveBeenCalled();
  });

  // C-02 Phase E (Owner decision 2026-08-02). `createManualBooking` refuses a
  // single booking without an explicit consent tick; the RPC's
  // `p_consent_acknowledged DEFAULT true` would have let a 12-visit series
  // through on weaker consent than one visit.
  it("rejects an unticked consent before the RPC is called", async () => {
    const stub = stubAdminClient(RECURRABLE_SERVICE);
    const formData = recurringFormData();
    formData.set("consent_acknowledged", "");

    const result = await createRecurringSeries({}, formData);

    expect(result.error).toBe("Check the recurring booking details.");
    expect(result.fieldErrors?.consent_acknowledged).toBe(
      "Confirm the consent box before creating repeat visits."
    );
    expect(rpc).not.toHaveBeenCalled();
    expect(stub.writes()).toHaveLength(0);
  });

  it("rejects a consent field the form never sent", async () => {
    stubAdminClient(RECURRABLE_SERVICE);
    const formData = recurringFormData();
    formData.delete("consent_acknowledged");

    const result = await createRecurringSeries({}, formData);

    expect(result.fieldErrors?.consent_acknowledged).toBeDefined();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a malformed start time", async () => {
    stubAdminClient(RECURRABLE_SERVICE);

    const result = await createRecurringSeries({}, recurringFormData({ anchor_start_time: "2pm" }));

    expect(result.fieldErrors?.anchor_start_time).toBeDefined();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a monthly series anchored past the 28th", async () => {
    stubAdminClient(RECURRABLE_SERVICE);

    const result = await createRecurringSeries(
      {},
      recurringFormData({ cadence: "monthly", first_occurrence_date: "2026-09-29" })
    );

    expect(result).toEqual({
      error: "Monthly recurrence requires a day between 1 and 28.",
      fieldErrors: {
        first_occurrence_date:
          "Monthly recurrence requires a day between 1 and 28 to avoid month-end ambiguity.",
      },
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("accepts a monthly series anchored on the 28th", async () => {
    stubAdminClient(RECURRABLE_SERVICE);

    await createRecurringSeries(
      {},
      recurringFormData({ cadence: "monthly", first_occurrence_date: "2026-09-28" })
    );

    expect(rpc).toHaveBeenCalledWith(
      "create_recurring_booking_series",
      expect.objectContaining({ p_cadence: "monthly", p_first_occurrence_date: "2026-09-28" })
    );
  });

  it("lets a weekly series start after the 28th — the day-of-month rule is monthly-only", async () => {
    stubAdminClient(RECURRABLE_SERVICE);

    await createRecurringSeries({}, recurringFormData({ first_occurrence_date: "2026-09-29" }));

    expect(rpc).toHaveBeenCalledWith(
      "create_recurring_booking_series",
      expect.objectContaining({ p_first_occurrence_date: "2026-09-29" })
    );
  });
});

describe("createRecurringSeries — service opt-out", () => {
  it("refuses a service with allow_recurrence off, naming it", async () => {
    stubAdminClient({ ...RECURRABLE_SERVICE, allow_recurrence: false });

    expect(await createRecurringSeries({}, recurringFormData())).toEqual({
      error: "Recurring not available for Hijama Package.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses an unknown service slug", async () => {
    stubAdminClient(null);

    expect(await createRecurringSeries({}, recurringFormData())).toEqual({
      error: "Recurring not available for this service.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("createRecurringSeries — D-033 hidden services", () => {
  // ⛔ THIS IS THE CASE THAT WAS MISSING, and an independent review is what
  // found it. The one-off booking path was guarded inside
  // createBookingTransaction, but a recurring series never goes through it — it
  // calls create_recurring_booking_series directly, and that RPC filters
  // services on `is_active` alone. So hiding a service blocked single bookings
  // and left STANDING ones wide open: a staff member could start a weekly
  // commitment against a service the Owner had just hidden.
  it("⛔ refuses to start a standing booking for a HIDDEN service", async () => {
    const stub = stubAdminClient(RECURRABLE_SERVICE, false);

    expect(await createRecurringSeries({}, recurringFormData())).toEqual({
      error: "Hijama Package is hidden and cannot be booked. Make it visible again first.",
    });

    // ⛔ The half that matters: nothing was created. A refusal that still wrote
    // the first occurrence would be no refusal at all.
    expect(rpc, "no series may be created for a hidden service").not.toHaveBeenCalled();
    expect(stub.writes(), "and nothing else was written either").toHaveLength(0);
  });

  it("still allows a standing booking for a VISIBLE service", async () => {
    // ⛔ Non-vacuity. Without this the assertion above would also pass against a
    // guard that refused every service outright — which would silently kill
    // recurring bookings altogether.
    stubAdminClient(RECURRABLE_SERVICE, true);
    rpc.mockResolvedValue({ data: { series_id: "series-1" }, error: null });

    const result = await createRecurringSeries({}, recurringFormData());

    expect(result, "a visible service is unaffected").not.toEqual(
      expect.objectContaining({ error: expect.stringMatching(/hidden/i) })
    );
    expect(rpc).toHaveBeenCalledWith(
      "create_recurring_booking_series",
      expect.anything()
    );
  });
});

describe("createRecurringSeries — happy path", () => {
  it("hands the RPC exactly the argument object the applied signature expects", async () => {
    stubAdminClient(RECURRABLE_SERVICE);

    await createRecurringSeries(
      {},
      recurringFormData({
        end_type: "after_count",
        end_count: "6",
        cadence: "fortnightly",
        bound_therapist_id: THERAPIST_ID,
        service_address_line1: "10 Test Street",
        service_postcode: "LU1 1AA",
        service_city: "Luton",
        service_area: "Bedfordshire",
        notes: "Rear gate code 1234",
      })
    );

    expect(rpc).toHaveBeenCalledWith("create_recurring_booking_series", {
      p_client_id: CLIENT_ID,
      p_service_slug: "hijama-package",
      p_first_occurrence_date: "2026-09-04",
      p_anchor_start_time: "14:00",
      p_cadence: "fortnightly",
      p_end_type: "after_count",
      p_participant_gender: "female",
      p_required_therapist_gender: "female",
      p_actor_staff_id: owner.id,
      p_bound_therapist_id: THERAPIST_ID,
      p_open_to_any_therapist: false,
      p_end_count: 6,
      p_end_date: undefined,
      p_service_address_line1: "10 Test Street",
      p_service_postcode: "LU1 1AA",
      p_service_city: "Luton",
      p_service_area: "Bedfordshire",
      p_notes: "Rear gate code 1234",
      p_consent_acknowledged: true,
      p_horizon_weeks: 12,
    });
  });

  // ⛔ RETARGETED 2026-08-29, NOT RE-BASELINED. This test used to assert that every
  // unsupplied optional was sent as an explicit `null`. Wiring the generated Supabase
  // types in made `null` un-typeable for these parameters, because the generated Args
  // type reads the deployed signature's defaults back and marks each one optional and
  // non-null. The key is now omitted instead.
  //
  // ⛔ THE STORED ROW IS UNCHANGED, and that was verified rather than assumed: the
  // deployed signature was read from pg_proc on 2026-08-29 and every parameter dropped
  // below is declared `DEFAULT NULL` —
  //   p_end_count integer DEFAULT NULL, p_end_date date DEFAULT NULL,
  //   p_service_address_line1/postcode/city/area text DEFAULT NULL,
  //   p_notes text DEFAULT NULL, p_bound_therapist_id uuid DEFAULT NULL
  // PostgREST applies a parameter's default when its key is absent, so an omitted key
  // stores exactly the NULL the explicit `null` stored.
  //
  // ⛔ THE ORIGINAL POINT OF THE TEST IS PRESERVED AND STILL ASSERTED BELOW: the three
  // parameters whose SQL default is NOT null are still passed explicitly, so the RPC's
  // own defaults are never leaned on — `p_consent_acknowledged` (DEFAULT true, the
  // consent gate), `p_open_to_any_therapist` (DEFAULT false) and `p_horizon_weeks`
  // (DEFAULT 12, which must match the horizon the action checked).
  it("omits DEFAULT NULL optionals but never leans on a non-null RPC default", async () => {
    stubAdminClient(RECURRABLE_SERVICE);

    await createRecurringSeries({}, recurringFormData());

    expect(rpc).toHaveBeenCalledWith("create_recurring_booking_series", {
      p_client_id: CLIENT_ID,
      p_service_slug: "hijama-package",
      p_first_occurrence_date: "2026-09-04",
      p_anchor_start_time: "14:00",
      p_cadence: "weekly",
      p_end_type: "until_cancelled",
      p_participant_gender: "female",
      p_required_therapist_gender: "female",
      p_actor_staff_id: owner.id,
      p_bound_therapist_id: undefined,
      p_open_to_any_therapist: false,
      p_end_count: undefined,
      p_end_date: undefined,
      p_service_address_line1: undefined,
      p_service_postcode: undefined,
      p_service_city: undefined,
      p_service_area: undefined,
      p_notes: undefined,
      // Never left to the RPC's `DEFAULT true` — the whole point of the gate.
      p_consent_acknowledged: true,
      p_horizon_weeks: 12,
    });
  });

  it("sends the participant's own gender into both gender parameters", async () => {
    stubAdminClient(RECURRABLE_SERVICE);

    await createRecurringSeries({}, recurringFormData({ participant_gender: "male" }));

    const args = createSeriesArgs();
    expect(args.p_participant_gender).toBe("male");
    expect(args.p_required_therapist_gender).toBe("male");
  });

  it("keeps open_to_any_therapist orthogonal to the gender requirement", async () => {
    stubAdminClient(RECURRABLE_SERVICE);

    await createRecurringSeries(
      {},
      recurringFormData({ open_to_any_therapist: "on", participant_gender: "male" })
    );

    const args = createSeriesArgs();
    expect(args.p_open_to_any_therapist).toBe(true);
    expect(args.p_required_therapist_gender).toBe("male");
  });

  it("redirects to the new series view and invalidates the affected caches", async () => {
    stubAdminClient(RECURRABLE_SERVICE);

    await createRecurringSeries({}, recurringFormData());

    expect(redirect).toHaveBeenCalledWith(`/admin/bookings/series/${TEMPLATE_ID}?created=1`);
    // C-09 Phase B — resource tags (bookings, clients, audit, emails) ride
    // alongside the pre-existing report-data/dashboard-data pair.
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([
      "report-data",
      "dashboard-data",
      "bookings",
      "clients",
      "audit",
      "emails",
    ]);
    expect(vi.mocked(revalidatePath).mock.calls.map(([path]) => path)).toEqual([
      "/admin/bookings",
      "/admin/dashboard",
      "/admin/calendar",
      `/admin/clients/${CLIENT_ID}`,
    ]);
  });

  it("writes no audit row of its own — the RPC already wrote one", async () => {
    const stub = stubAdminClient(RECURRABLE_SERVICE);

    await createRecurringSeries({}, recurringFormData());

    expect(stub.ops.filter((entry) => entry.table === "audit_logs")).toHaveLength(0);
    expect(stub.writes()).toHaveLength(0);
  });

  it("sends the recurring series created email with the new template id", async () => {
    stubAdminClient(RECURRABLE_SERVICE);

    await createRecurringSeries({}, recurringFormData());

    expect(sendRecurringSeriesCreatedEmail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendRecurringSeriesCreatedEmail).mock.calls[0][0]).toBe(TEMPLATE_ID);
  });

  it("does not let a failed confirmation email roll back the redirect or cache invalidation", async () => {
    stubAdminClient(RECURRABLE_SERVICE);
    vi.mocked(sendRecurringSeriesCreatedEmail).mockRejectedValue(new Error("Resend is down"));

    await createRecurringSeries({}, recurringFormData());

    expect(redirect).toHaveBeenCalledWith(`/admin/bookings/series/${TEMPLATE_ID}?created=1`);
    expect(updateTag).toHaveBeenCalled();
  });
});

describe("createRecurringSeries — confirmation email checkbox", () => {
  // Email-defect fix (2026-08-09) — recurringSchema had no field for the
  // shared "Send confirmation email to client" checkbox, so the send fired
  // unconditionally regardless of the operator's tick. Mirrors
  // createManualBooking's `sendConfirmationEmail` gate (actions.ts).
  it("sends the email when the checkbox is ticked", async () => {
    stubAdminClient(RECURRABLE_SERVICE);

    await createRecurringSeries(
      {},
      recurringFormData({ send_confirmation_email: "on" })
    );

    expect(sendRecurringSeriesCreatedEmail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendRecurringSeriesCreatedEmail).mock.calls[0][0]).toBe(TEMPLATE_ID);
  });

  it("does not attempt the send when the checkbox is unticked", async () => {
    stubAdminClient(RECURRABLE_SERVICE);

    await createRecurringSeries({}, recurringFormData({ send_confirmation_email: "" }));

    expect(sendRecurringSeriesCreatedEmail).not.toHaveBeenCalled();
    // The series itself must still be created — only the email is gated.
    expect(redirect).toHaveBeenCalledWith(`/admin/bookings/series/${TEMPLATE_ID}?created=1`);
  });

  it("does not attempt the send when the form never posts the field at all", async () => {
    // Covers a hand-crafted post, same posture as createManualBooking's
    // second gate (actions.ts): `formData.get(...) === "on"` reads a missing
    // field as false, never as "trust the caller".
    stubAdminClient(RECURRABLE_SERVICE);
    const formData = recurringFormData();
    formData.delete("send_confirmation_email");

    await createRecurringSeries({}, formData);

    expect(sendRecurringSeriesCreatedEmail).not.toHaveBeenCalled();
  });
});

describe("createRecurringSeries — RPC failure", () => {
  it("surfaces the RPC message and does not redirect", async () => {
    stubAdminClient(RECURRABLE_SERVICE);
    rpc.mockResolvedValue({
      data: null,
      error: { message: "That cadence and end condition produce no visits" },
    });

    expect(await createRecurringSeries({}, recurringFormData())).toEqual({
      error: "That cadence and end condition produce no visits",
    });
    expect(redirect).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
    expect(sendRecurringSeriesCreatedEmail).not.toHaveBeenCalled();
  });
});

// ── ⛔ D-042 — A STANDING BOOKING IS NO LONGER PLACED BLIND ──────────────────
//
// Owner ruling D-042 (2026-08-22), chosen from three options: "fix it properly".
//
// Before this, `create_recurring_booking_series` checked NOTHING about
// availability — measured against the live function body, it contains zero
// occurrences of `availability_rules`, `booking_status_enabled` or
// `p_override_availability`. Its only test was "does this same client already
// hold a booking at this date and time".
describe("createRecurringSeries — D-042 availability pre-check", () => {
  it("asks the DATABASE for the occurrence dates rather than re-deriving them", async () => {
    stubAdminClient(RECURRABLE_SERVICE);

    await createRecurringSeries({}, recurringFormData());

    // ⛔ `compute_occurrence_dates` is the very function the create RPC uses to
    // lay the series out, and it is EXECUTE-granted to service_role. Calling it
    // means the dates checked are the dates that will exist, by construction —
    // re-walking the cadence in TypeScript would have been a second date engine.
    const call = rpc.mock.calls.find(([name]) => name === "compute_occurrence_dates");
    expect(call, "the dates must be asked for, not guessed").toBeTruthy();
    const args = call![1] as Record<string, unknown>;
    expect(args.p_first_date).toBe("2026-09-04");
    expect(args.p_cadence).toBe("weekly");
    // 12 weeks inclusive of the first day — the same constant the create call
    // is given, so the two cannot drift apart.
    expect(args.p_horizon_end).toBe("2026-11-26");
  });

  it("checks every occurrence date, at the anchor time, for the right gender", async () => {
    stubAdminClient(RECURRABLE_SERVICE);

    await createRecurringSeries({}, recurringFormData());

    expect(checkSeriesSlots).toHaveBeenCalledTimes(1);
    const [input] = vi.mocked(checkSeriesSlots).mock.calls[0];
    expect(input.dates, "every date, not just the first").toEqual(OCCURRENCE_DATES);
    expect(input.startTime).toBe("14:00");
    expect(input.serviceIds).toEqual(["hijama-package"]);
    expect(input.participantGenders).toEqual(["female"]);
  });

  it("⛔ refuses, and never creates anything, when the FIRST visit cannot be covered", async () => {
    stubAdminClient(RECURRABLE_SERVICE);
    vi.mocked(checkSeriesSlots).mockResolvedValue({
      verdicts: [
        {
          date: OCCURRENCE_DATES[0],
          available: false,
          reason: "No therapist of the right gender is free at that time.",
        },
        ...OCCURRENCE_DATES.slice(1).map((date) => ({ date, available: true })),
      ],
      durationMins: 60,
    });

    const result = await createRecurringSeries({}, recurringFormData());

    expect(result.error).toMatch(/no therapist of the right gender is free/i);
    expect(result.error, "and it must say what to do next").toMatch(/pick a different day or time/i);
    // ⛔ THE POINT OF THE WHOLE RULING: nothing is written.
    expect(
      rpc.mock.calls.filter(([name]) => name === "create_recurring_booking_series"),
      "a series whose very first visit cannot be staffed must not be created at all"
    ).toHaveLength(0);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("names the BOUND therapist as the reason when the series is locked to one person", async () => {
    stubAdminClient(RECURRABLE_SERVICE);
    vi.mocked(checkSeriesSlots).mockResolvedValue({
      // ⛔ available: TRUE on every date. The clinic CAN cover the visit — just
      // not with the person the series is locked to. If this case set
      // available:false it would pass for the wrong reason, and would not
      // distinguish the bound-therapist refusal from a plain capacity refusal
      // at all.
      verdicts: OCCURRENCE_DATES.map((date, index) => ({
        date,
        available: true,
        boundStaffFree: index !== 0,
        reason:
          index === 0
            ? "The therapist this series is locked to is not free at that time."
            : undefined,
      })),
      durationMins: 60,
    });

    const result = await createRecurringSeries({}, recurringFormData({ bound_therapist_id: THERAPIST_ID }));

    expect(result.error).toMatch(/locked to is not free/i);
    // ⛔ The bound therapist must actually reach the check, or it could never
    // have returned that verdict for a real reason.
    const [input] = vi.mocked(checkSeriesSlots).mock.calls[0];
    expect(input.boundStaffId).toBe(THERAPIST_ID);
  });

  it("⚠️ still creates the series when only a LATER date cannot be covered", async () => {
    stubAdminClient(RECURRABLE_SERVICE);
    vi.mocked(checkSeriesSlots).mockResolvedValue({
      verdicts: OCCURRENCE_DATES.map((date, index) => ({
        date,
        available: index === 0,
        reason: index === 0 ? undefined : "No therapist of the right gender is free at that time.",
      })),
      durationMins: 60,
    });

    await createRecurringSeries({}, recurringFormData());

    // ⛔ DELIBERATE, AND THE OPPOSITE OF AN OVERSIGHT. One bank holiday, or one
    // clash in week seven, must not throw away an arrangement the client wants
    // for the rest of the year. Those visits are created `pending` and
    // `unassigned` — the state the bookings list's "attention" view exists to
    // surface — and the nightly horizon cron refuses to materialise uncoverable
    // dates beyond the first horizon.
    expect(
      rpc.mock.calls.filter(([name]) => name === "create_recurring_booking_series"),
      "only the FIRST visit is fatal"
    ).toHaveLength(1);
  });

  it("⛔ HONOURS the operator's availability override, the same as a one-off booking", async () => {
    // ⚠️ Found by independent review (D-035) straight after D-042 shipped, and
    // it was the one refusal with no workaround inside the feature.
    //
    // `ManualBookingForm.tsx:1274-1276` emits `override_availability` from the
    // SHARED hidden-input block — one <form>, two actions, only the action
    // swapped — and `createManualBooking` reads it (`actions.ts:1602`). The
    // recurring schema did not, so the tick was present in the FormData and
    // silently dropped.
    //
    // ⛔ In the Owner's terms: "Mrs X, every Tuesday 8pm, the therapist has
    // agreed to stay late" could be booked as twelve separate visits with the
    // override ticked, and NOT as a series. The operator was told to pick a
    // different day or time, with no way to say "I know".
    stubAdminClient(RECURRABLE_SERVICE);
    vi.mocked(checkSeriesSlots).mockResolvedValue({
      verdicts: OCCURRENCE_DATES.map((date) => ({
        date,
        available: false,
        reason: "No therapist of the right gender is free at that time.",
      })),
      durationMins: 60,
    });

    await createRecurringSeries(
      {},
      recurringFormData({ override_availability: "on" })
    );

    expect(
      rpc.mock.calls.filter(([name]) => name === "create_recurring_booking_series"),
      "the operator overrode it, so the series must be created"
    ).toHaveLength(1);
  });

  it("still refuses the SAME case when the override is not ticked", async () => {
    // ⛔ THE CONTROL. Without it the case above would pass even if the guard had
    // simply been deleted.
    stubAdminClient(RECURRABLE_SERVICE);
    vi.mocked(checkSeriesSlots).mockResolvedValue({
      verdicts: OCCURRENCE_DATES.map((date) => ({
        date,
        available: false,
        reason: "No therapist of the right gender is free at that time.",
      })),
      durationMins: 60,
    });

    const result = await createRecurringSeries({}, recurringFormData());

    expect(result.error).toMatch(/no therapist of the right gender is free/i);
    expect(
      rpc.mock.calls.filter(([name]) => name === "create_recurring_booking_series")
    ).toHaveLength(0);
  });

  it("⛔ refuses when the availability check returns NO verdict for the first visit", async () => {
    // Fails CLOSED on a missing verdict. `verdicts` is always the same length as
    // `dates` today, but the earlier shape treated "no verdict" as "go ahead",
    // which is the wrong default for a check whose whole job is to refuse.
    stubAdminClient(RECURRABLE_SERVICE);
    vi.mocked(checkSeriesSlots).mockResolvedValue({ verdicts: [], durationMins: 60 });

    const result = await createRecurringSeries({}, recurringFormData());

    expect(result.error).toBeTruthy();
    expect(
      rpc.mock.calls.filter(([name]) => name === "create_recurring_booking_series")
    ).toHaveLength(0);
  });

  it("⛔ fails CLOSED when the availability engine cannot answer", async () => {
    stubAdminClient(RECURRABLE_SERVICE);
    vi.mocked(checkSeriesSlots).mockResolvedValue({
      verdicts: OCCURRENCE_DATES.map((date) => ({
        date,
        available: false,
        reason: "Booking settings unavailable.",
      })),
      durationMins: 0,
      reason: "Booking settings unavailable.",
    });

    const result = await createRecurringSeries({}, recurringFormData());

    // ⛔ Not being able to check is not the same as being free.
    expect(result.error).toMatch(/booking settings unavailable/i);
    expect(
      rpc.mock.calls.filter(([name]) => name === "create_recurring_booking_series")
    ).toHaveLength(0);
  });
});
