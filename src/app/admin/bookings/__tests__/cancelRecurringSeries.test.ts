import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath, updateTag } from "next/cache";
import { getStaffProfile, PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendRecurringSeriesCancelledEmail } from "@/lib/email/notifications";
import { cancelRecurringSeries } from "../recurring-actions";

/**
 * C-02 Phase C (Step 8) — `cancelRecurringSeries`.
 *
 * The cascade is a bulk UPDATE with no per-row read, so its three filters are
 * the only thing standing between "cancel the future visits of this series" and
 * "cancel somebody else's booking": drop the `recurring_template_id` equality
 * and it empties the table, drop the `gte(booking_date)` and it rewrites
 * history. Each is asserted on its value, not on a call count.
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

// C-02 Phase Fb — cancelRecurringSeries now sends a cancellation-confirmation
// email after the cascade succeeds. Mocked wholesale so the specs below
// never reach the real render/send pipeline (no template-registry lookups,
// no network) — only that the action calls it with the new template id and
// cascade count.
vi.mock("@/lib/email/notifications", () => ({
  sendRecurringSeriesCancelledEmail: vi.fn(),
}));

// Only the profile lookup is stubbed — the permission helpers stay real so the
// action is gated exactly as it is in production.
vi.mock("@/lib/auth/rbac", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/rbac")>()),
  getStaffProfile: vi.fn(),
}));

/** 10:00 London on a BST day, so `getTodayIsoDate()` is unambiguously 2026-09-04. */
const NOW = new Date("2026-09-04T09:00:00.000Z");
const TEMPLATE_ID = "33333333-3333-4333-8333-333333333333";
const CLIENT_ID = "11111111-1111-4111-8111-111111111111";

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

interface RecordedOp {
  table: string;
  op: "select" | "update" | "insert";
  payload?: Record<string, unknown>;
  eq: [string, unknown][];
  is: [string, unknown][];
  in: [string, unknown][];
  gte: [string, unknown][];
}

interface StubOptions {
  template?: Record<string, unknown> | null;
  templateError?: { message: string } | null;
  cancelledRows?: { id: string }[];
  bookingsError?: { message: string } | null;
}

function stubAdminClient(options: StubOptions = {}) {
  const {
    template = { id: TEMPLATE_ID, client_id: CLIENT_ID },
    templateError = null,
    cancelledRows = [{ id: "booking-1" }, { id: "booking-2" }, { id: "booking-3" }],
    bookingsError = null,
  } = options;
  const ops: RecordedOp[] = [];

  function resolve(entry: RecordedOp) {
    if (entry.table === "recurring_booking_templates") {
      return { data: templateError ? null : template, error: templateError };
    }
    if (entry.table === "bookings") {
      return { data: bookingsError ? null : cancelledRows, error: bookingsError };
    }
    return { data: null, error: null };
  }

  function startOp(table: string, op: RecordedOp["op"], payload?: Record<string, unknown>) {
    const entry: RecordedOp = { table, op, payload, eq: [], is: [], in: [], gte: [] };
    ops.push(entry);
    const settle = () => Promise.resolve(resolve(entry));
    const chain = {
      eq: (column: string, value: unknown) => {
        entry.eq.push([column, value]);
        return chain;
      },
      is: (column: string, value: unknown) => {
        entry.is.push([column, value]);
        return chain;
      },
      in: (column: string, value: unknown) => {
        entry.in.push([column, value]);
        return chain;
      },
      gte: (column: string, value: unknown) => {
        entry.gte.push([column, value]);
        return chain;
      },
      select: () => chain,
      single: settle,
      maybeSingle: settle,
      then: (onFulfilled: (value: unknown) => unknown) => settle().then(onFulfilled),
    };
    return chain;
  }

  const from = vi.fn((table: string) => ({
    select: () => startOp(table, "select"),
    update: (payload: Record<string, unknown>) => startOp(table, "update", payload),
    insert: (payload: Record<string, unknown>) => startOp(table, "insert", payload),
  }));

  const client = { from } as unknown as ReturnType<typeof createSupabaseAdminClient>;
  vi.mocked(createSupabaseAdminClient).mockReturnValue(client);

  return {
    ops,
    op: (table: string) => ops.find((entry) => entry.table === table),
  };
}

function cancelFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.set("template_id", TEMPLATE_ID);
  formData.set("reason", "Client moving away");
  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.mocked(getStaffProfile).mockResolvedValue(owner);
  vi.mocked(sendRecurringSeriesCancelledEmail).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("cancelRecurringSeries — RBAC", () => {
  it("rejects a therapist without manage_bookings_all before touching the DB", async () => {
    const stub = stubAdminClient();
    vi.mocked(getStaffProfile).mockResolvedValue(therapist);

    expect(await cancelRecurringSeries(null, cancelFormData())).toEqual({
      ok: false,
      error: "Insufficient permissions.",
    });
    expect(stub.ops).toHaveLength(0);
  });

  it("rejects a deactivated manager", async () => {
    const stub = stubAdminClient();
    vi.mocked(getStaffProfile).mockResolvedValue({ ...owner, active: false });

    expect(await cancelRecurringSeries(null, cancelFormData())).toEqual({
      ok: false,
      error: "Insufficient permissions.",
    });
    expect(stub.ops).toHaveLength(0);
  });
});

describe("cancelRecurringSeries — guards", () => {
  it("requires a template id", async () => {
    const stub = stubAdminClient();

    expect(await cancelRecurringSeries(null, cancelFormData({ template_id: "  " }))).toEqual({
      ok: false,
      error: "Template ID is required.",
    });
    expect(stub.ops).toHaveLength(0);
  });

  it("stops before the cascade when the template is already cancelled", async () => {
    const stub = stubAdminClient({ template: null });

    expect(await cancelRecurringSeries(null, cancelFormData())).toEqual({
      ok: false,
      error: "Template not found or already cancelled.",
    });
    expect(stub.op("bookings")).toBeUndefined();
    expect(stub.op("audit_logs")).toBeUndefined();
  });

  it("surfaces a template update error", async () => {
    const stub = stubAdminClient({ templateError: { message: "permission denied" } });

    expect(await cancelRecurringSeries(null, cancelFormData())).toEqual({
      ok: false,
      error: "permission denied",
    });
    expect(stub.op("bookings")).toBeUndefined();
  });

  it("surfaces a cascade error and writes no audit row", async () => {
    const stub = stubAdminClient({ bookingsError: { message: "42501" } });

    expect(await cancelRecurringSeries(null, cancelFormData())).toEqual({
      ok: false,
      error: "42501",
    });
    expect(stub.op("audit_logs")).toBeUndefined();
    expect(updateTag).not.toHaveBeenCalled();
  });
});

describe("cancelRecurringSeries — cascade", () => {
  it("marks the template cancelled only while it is still active", async () => {
    const stub = stubAdminClient();

    await cancelRecurringSeries(null, cancelFormData());

    const templateOp = stub.op("recurring_booking_templates");
    expect(templateOp?.payload).toEqual({
      cancelled_at: NOW.toISOString(),
      cancelled_by: owner.id,
      cancelled_reason: "Client moving away",
    });
    expect(templateOp?.eq).toEqual([["id", TEMPLATE_ID]]);
    expect(templateOp?.is).toEqual([["cancelled_at", null]]);
  });

  it("stores no reason when none was given", async () => {
    const stub = stubAdminClient();

    await cancelRecurringSeries(null, cancelFormData({ reason: "   " }));

    expect(stub.op("recurring_booking_templates")?.payload?.cancelled_reason).toBeNull();
    expect(stub.op("audit_logs")?.payload?.after_state).toMatchObject({ reason: null });
  });

  it("cancels only this series' future, still-live occurrences", async () => {
    const stub = stubAdminClient();

    await cancelRecurringSeries(null, cancelFormData());

    const bookingsOp = stub.op("bookings");
    expect(bookingsOp?.payload).toEqual({
      status: "cancelled",
      cancelled_at: NOW.toISOString(),
    });
    expect(bookingsOp?.eq).toEqual([["recurring_template_id", TEMPLATE_ID]]);
    expect(bookingsOp?.in).toEqual([["status", ["pending", "confirmed"]]]);
    // London "today", not UTC — the two diverge for a BST evening cancellation.
    expect(bookingsOp?.gte).toEqual([["booking_date", "2026-09-04"]]);
  });

  it("reports how many occurrences it cancelled", async () => {
    stubAdminClient();

    expect(await cancelRecurringSeries(null, cancelFormData())).toEqual({
      ok: true,
      cancelledOccurrenceCount: 3,
    });
  });

  it("reports zero when the series had no future occurrences left", async () => {
    stubAdminClient({ cancelledRows: [] });

    expect(await cancelRecurringSeries(null, cancelFormData())).toEqual({
      ok: true,
      cancelledOccurrenceCount: 0,
    });
  });

  it("writes the audit row against the template with the real cancellation instant", async () => {
    const stub = stubAdminClient();

    await cancelRecurringSeries(null, cancelFormData());

    expect(stub.op("audit_logs")?.payload).toEqual({
      actor_staff_id: owner.id,
      action_type: "recurring_series_cancelled",
      target_type: "recurring_booking_templates",
      target_id: TEMPLATE_ID,
      after_state: {
        cancelled_at: NOW.toISOString(),
        reason: "Client moving away",
        cascaded_occurrence_count: 3,
      },
    });
  });

  it("invalidates the series, list, calendar and client caches", async () => {
    stubAdminClient();

    await cancelRecurringSeries(null, cancelFormData());

    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([
      "report-data",
      "dashboard-data",
    ]);
    expect(vi.mocked(revalidatePath).mock.calls.map(([path]) => path)).toEqual([
      "/admin/bookings",
      `/admin/bookings/series/${TEMPLATE_ID}`,
      "/admin/calendar",
      `/admin/clients/${CLIENT_ID}`,
    ]);
  });

  it("sends the recurring series cancelled email with the template id and cascade count", async () => {
    stubAdminClient();

    await cancelRecurringSeries(null, cancelFormData());

    expect(sendRecurringSeriesCancelledEmail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendRecurringSeriesCancelledEmail).mock.calls[0][0]).toBe(TEMPLATE_ID);
    expect(vi.mocked(sendRecurringSeriesCancelledEmail).mock.calls[0][1]).toBe(3);
  });

  it("does not let a rejected cancellation email undo a successful cancellation", async () => {
    stubAdminClient();
    vi.mocked(sendRecurringSeriesCancelledEmail).mockRejectedValue(new Error("Resend is down"));

    const result = await cancelRecurringSeries(null, cancelFormData());

    expect(result).toEqual({ ok: true, cancelledOccurrenceCount: 3 });
    expect(updateTag).toHaveBeenCalled();
  });
});
