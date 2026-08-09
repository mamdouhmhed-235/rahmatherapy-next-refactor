import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { getStaffProfile, PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendRecurringSeriesCreatedEmail } from "@/lib/email/notifications";
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

/**
 * Admin-client stand-in. `services` is the only table the happy path reads;
 * `audit_logs` is deliberately reachable so the specs can prove the action does
 * NOT write a second audit row over the one the RPC writes internally.
 */
function stubAdminClient(service: Record<string, unknown> | null) {
  const ops: RecordedOp[] = [];

  function startOp(table: string, op: RecordedOp["op"]) {
    const entry: RecordedOp = { table, op };
    ops.push(entry);
    const settle = () =>
      Promise.resolve(
        table === "services"
          ? { data: service, error: service ? null : { message: "No rows" } }
          : { data: null, error: null }
      );
    const chain = {
      eq: () => chain,
      select: () => chain,
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
  rpc.mockResolvedValue({ data: RPC_RESULT, error: null });
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
      p_end_date: null,
      p_service_address_line1: "10 Test Street",
      p_service_postcode: "LU1 1AA",
      p_service_city: "Luton",
      p_service_area: "Bedfordshire",
      p_notes: "Rear gate code 1234",
      p_consent_acknowledged: true,
      p_horizon_weeks: 12,
    });
  });

  it("nulls every unsupplied optional rather than dropping the key", async () => {
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
      p_bound_therapist_id: null,
      p_open_to_any_therapist: false,
      p_end_count: null,
      p_end_date: null,
      p_service_address_line1: null,
      p_service_postcode: null,
      p_service_city: null,
      p_service_area: null,
      p_notes: null,
      // Never left to the RPC's `DEFAULT true` — the whole point of the gate.
      p_consent_acknowledged: true,
      p_horizon_weeks: 12,
    });
  });

  it("sends the participant's own gender into both gender parameters", async () => {
    stubAdminClient(RECURRABLE_SERVICE);

    await createRecurringSeries({}, recurringFormData({ participant_gender: "male" }));

    const [, args] = rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(args.p_participant_gender).toBe("male");
    expect(args.p_required_therapist_gender).toBe("male");
  });

  it("keeps open_to_any_therapist orthogonal to the gender requirement", async () => {
    stubAdminClient(RECURRABLE_SERVICE);

    await createRecurringSeries(
      {},
      recurringFormData({ open_to_any_therapist: "on", participant_gender: "male" })
    );

    const [, args] = rpc.mock.calls[0] as [string, Record<string, unknown>];
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
