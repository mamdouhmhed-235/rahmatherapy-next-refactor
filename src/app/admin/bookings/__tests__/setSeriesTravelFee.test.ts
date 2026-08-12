import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStaffProfile, PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { setSeriesTravelFee } from "../recurring-actions";

/**
 * Item 8 Phase 4 — `setSeriesTravelFee`.
 *
 * Mirrors cancelRecurringSeries.test.ts's harness. The same reasoning applies:
 * the three filters on the candidate query are the only thing standing between
 * "reprice this series' upcoming visits" and "rewrite somebody's financial
 * history", so each is asserted on its VALUE, not on a call count.
 */

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/email/notifications", () => ({
  sendRecurringSeriesCancelledEmail: vi.fn(),
  sendRecurringSeriesCreatedEmail: vi.fn(),
}));

vi.mock("@/lib/auth/rbac", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/rbac")>()),
  getStaffProfile: vi.fn(),
}));

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
  in: [string, unknown][];
  gte: [string, unknown][];
}

/** Two upcoming visits at 60.00, one of them already paid in full. */
const CANDIDATES = [
  {
    id: "booking-unpaid",
    total_price: 60,
    amount_due: 60,
    amount_paid: 0,
    travel_fee: 0,
  },
  {
    id: "booking-paid",
    total_price: 60,
    amount_due: 60,
    amount_paid: 60,
    travel_fee: 0,
  },
];

function stubAdminClient(
  options: {
    template?: Record<string, unknown> | null;
    candidates?: Record<string, unknown>[];
  } = {}
) {
  const {
    template = {
      id: TEMPLATE_ID,
      client_id: CLIENT_ID,
      travel_fee: 0,
      cancelled_at: null,
    },
    candidates = CANDIDATES,
  } = options;
  const ops: RecordedOp[] = [];

  function resolve(entry: RecordedOp) {
    if (entry.table === "recurring_booking_templates") {
      return { data: template, error: null };
    }
    if (entry.table === "bookings" && entry.op === "select") {
      return { data: candidates, error: null };
    }
    return { data: null, error: null };
  }

  function startOp(
    table: string,
    op: RecordedOp["op"],
    payload?: Record<string, unknown>
  ) {
    const entry: RecordedOp = { table, op, payload, eq: [], in: [], gte: [] };
    ops.push(entry);
    const settle = () => Promise.resolve(resolve(entry));
    const chain = {
      eq: (c: string, v: unknown) => {
        entry.eq.push([c, v]);
        return chain;
      },
      in: (c: string, v: unknown) => {
        entry.in.push([c, v]);
        return chain;
      },
      gte: (c: string, v: unknown) => {
        entry.gte.push([c, v]);
        return chain;
      },
      is: () => chain,
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

  vi.mocked(createSupabaseAdminClient).mockReturnValue(
    { from } as unknown as ReturnType<typeof createSupabaseAdminClient>
  );

  return {
    ops,
    bookingUpdates: () =>
      ops.filter((o) => o.table === "bookings" && o.op === "update"),
    candidateSelect: () =>
      ops.find((o) => o.table === "bookings" && o.op === "select"),
    audit: () =>
      ops.find((o) => o.table === "audit_logs" && o.op === "insert")?.payload,
  };
}

function formData(fee: string, templateId = TEMPLATE_ID) {
  const data = new FormData();
  data.set("template_id", templateId);
  data.set("travel_fee", fee);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getStaffProfile).mockResolvedValue(owner);
});

describe("setSeriesTravelFee", () => {
  it("applies the change to future unpaid occurrences, skips fully-paid ones, and reports both counts", async () => {
    const stub = stubAdminClient();

    const result = await setSeriesTravelFee(null, formData("14"));

    expect(result.ok).toBe(true);
    expect(result.updated).toBe(1);
    expect(result.skipped).toBe(1);

    const updates = stub.bookingUpdates();
    expect(updates).toHaveLength(1);
    expect(updates[0].eq).toContainEqual(["id", "booking-unpaid"]);
    expect(updates[0].payload).toEqual({
      travel_fee: 14,
      total_price: 74,
      amount_due: 74,
    });
    // amount_paid is never in the payload: what the customer already handed
    // over does not change because the charge did.
    expect(updates[0].payload).not.toHaveProperty("amount_paid");
  });

  // ⛔ The fully-paid skip CANNOT be one PostgREST filter — the client compares
  // a column to a literal, never to another column. If this ever becomes a
  // single .filter("amount_paid","lt","amount_due") call it silently matches
  // nothing. The partition therefore happens in application code, and this
  // asserts the query is the three-filter candidate fetch it must be.
  it("never asks the database to compare amount_paid against amount_due", async () => {
    const stub = stubAdminClient();

    await setSeriesTravelFee(null, formData("14"));

    const select = stub.candidateSelect();
    expect(select?.eq).toContainEqual(["recurring_template_id", TEMPLATE_ID]);
    expect(select?.in).toContainEqual(["status", ["pending", "confirmed"]]);
    expect(select?.gte?.[0]?.[0]).toBe("booking_date");
    // Past, completed and cancelled visits are financial history.
    expect(select?.gte).toHaveLength(1);
  });

  it("computes each occurrence's delta from its own current fee, not the template's", async () => {
    // A visit carrying a per-booking override starts from a different place.
    // Using the template's old fee here would corrupt its total.
    const stub = stubAdminClient({
      template: {
        id: TEMPLATE_ID,
        client_id: CLIENT_ID,
        travel_fee: 10,
        cancelled_at: null,
      },
      candidates: [
        {
          id: "booking-overridden",
          total_price: 85,
          amount_due: 85,
          amount_paid: 0,
          travel_fee: 25,
        },
      ],
    });

    await setSeriesTravelFee(null, formData("14"));

    // 85 - 25 + 14 = 74. Using the template's old fee of 10 would give 89.
    expect(stub.bookingUpdates()[0].payload).toEqual({
      travel_fee: 14,
      total_price: 74,
      amount_due: 74,
    });
  });

  it("does nothing when the fee is unchanged", async () => {
    const stub = stubAdminClient({
      template: {
        id: TEMPLATE_ID,
        client_id: CLIENT_ID,
        travel_fee: 14,
        cancelled_at: null,
      },
    });

    const result = await setSeriesTravelFee(null, formData("14"));

    expect(result).toEqual({ ok: true, updated: 0, skipped: 0 });
    expect(stub.bookingUpdates()).toHaveLength(0);
  });

  it("records the change in the audit trail with both counts", async () => {
    const stub = stubAdminClient();

    await setSeriesTravelFee(null, formData("14"));

    expect(stub.audit()).toMatchObject({
      action_type: "recurring_series_travel_fee_updated",
      target_type: "recurring_booking_templates",
      target_id: TEMPLATE_ID,
      before_state: { travel_fee: 0 },
      after_state: {
        travel_fee: 14,
        updated_occurrence_count: 1,
        skipped_occurrence_count: 1,
      },
    });
  });

  it("rejects a fee that is not a plain money amount", async () => {
    const stub = stubAdminClient();

    const result = await setSeriesTravelFee(null, formData("-5"));

    expect(result.fieldErrors?.travel_fee).toBeDefined();
    expect(stub.bookingUpdates()).toHaveLength(0);
  });

  it("refuses to reprice a cancelled series", async () => {
    const stub = stubAdminClient({
      template: {
        id: TEMPLATE_ID,
        client_id: CLIENT_ID,
        travel_fee: 0,
        cancelled_at: "2026-09-01T10:00:00.000Z",
      },
    });

    const result = await setSeriesTravelFee(null, formData("14"));

    expect(result.ok).toBe(false);
    expect(stub.bookingUpdates()).toHaveLength(0);
  });

  it("refuses a staff member without manage-all-bookings", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(therapist);
    const stub = stubAdminClient();

    const result = await setSeriesTravelFee(null, formData("14"));

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/permission/i);
    expect(stub.bookingUpdates()).toHaveLength(0);
  });
});
