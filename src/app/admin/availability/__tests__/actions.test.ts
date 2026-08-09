import { updateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requirePermission } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createBlockedDate,
  deleteAvailabilityOverride,
  deleteAvailabilityRule,
  deleteBlockedDate,
  saveAvailabilityDay,
  saveAvailabilityOverride,
} from "../actions";
import type { DaySchedule } from "@/lib/booking/working-hours-segments";

/**
 * C-09 Phase B fix round — Step 3 spec coverage. availability/actions.ts had
 * no dedicated spec at all. Each mutation here already carried
 * staff + bookings + audit ("availability affects booking eligibility") —
 * this file asserts that tag set is actually what's invalidated.
 */

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/auth/rbac", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/rbac")>()),
  requirePermission: vi.fn(),
}));

const ACTOR = { id: "staff-owner", name: "Owner" };
const EXPECTED_TAGS = ["report-data", "dashboard-data", "staff", "bookings", "audit"];

function stubAdminClient() {
  const audits: Record<string, unknown>[] = [];

  // C-14 Phase A Step 9 — the day save is a single RPC so the delete and the
  // insert share one transaction; it hands back the day's rows either side of
  // the swap for the audit entry.
  const rpc = vi.fn<
    (
      name: string,
      args: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message: string } | null }>
  >(async () => ({
    data: {
      before: [{ id: "rule-old", start_time: "09:00:00", end_time: "17:00:00" }],
      after: [{ id: "rule-new", start_time: "08:00:00", end_time: "12:30:00" }],
    },
    error: null,
  }));

  // C-14 Phase C Step 12a — the override save is a plain delete-then-insert,
  // not the RPC. Every insert is recorded so a spec can assert the SEGMENTS
  // that reach the table, which is the whole point of the rewrite.
  const overrideInserts: unknown[] = [];
  const overrideDeletes: unknown[] = [];

  const from = vi.fn((table: string) => {
    if (table === "audit_logs") {
      return {
        insert: vi.fn(async (row: Record<string, unknown>) => {
          audits.push(row);
          return { error: null };
        }),
      };
    }
    if (table === "availability_overrides") {
      // A date is now N rows: read them, delete them all, insert the new set.
      const rows = [{ id: "override-1", override_date: "2099-01-01" }];
      return {
        select: () => ({
          eq: async () => ({ data: rows, error: null }),
        }),
        delete: () => ({
          eq: async (_column: string, value: unknown) => {
            overrideDeletes.push(value);
            return { error: null };
          },
        }),
        insert: (payload: unknown) => {
          overrideInserts.push(payload);
          return {
            select: async () => ({ data: [{ id: "override-new" }], error: null }),
          };
        },
      };
    }
    // availability_rules / blocked_dates — both get the same shape of query
    // from this file (select/eq/single, insert/update + select/single,
    // delete/eq).
    return {
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { id: "row-1" }, error: null }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: async () => ({ data: { id: "row-1" }, error: null }),
        }),
      }),
      update: () => ({
        eq: () => ({
          select: () => ({
            single: async () => ({ data: { id: "row-1" }, error: null }),
          }),
        }),
      }),
      upsert: () => ({
        select: () => ({
          single: async () => ({ data: { id: "row-1" }, error: null }),
        }),
      }),
      delete: () => ({
        eq: async () => ({ error: null }),
      }),
    };
  });

  return { client: { from, rpc }, audits, rpc, overrideInserts, overrideDeletes };
}

/** Monday 08:00–20:00 with a 12:30–15:00 break. */
const MONDAY_WITH_BREAK: DaySchedule = {
  isWorkingDay: true,
  opens: "08:00",
  closes: "20:00",
  breaks: [{ start: "12:30", end: "15:00" }],
};

function blockedDateFormData() {
  const data = new FormData();
  data.set("blocked_date", "2099-01-01");
  data.set("reason", "Bank holiday");
  return data;
}

const OVERRIDE_DATE = "2099-01-01";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePermission).mockResolvedValue(ACTOR as never);
});

describe("availability/actions.ts — cache tag invalidation", () => {
  it("saveAvailabilityDay invalidates staff + bookings + audit", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await saveAvailabilityDay(1, MONDAY_WITH_BREAK);

    expect(result.error).toBeUndefined();
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual(EXPECTED_TAGS);
  });

  it("deleteAvailabilityRule invalidates staff + bookings + audit", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await deleteAvailabilityRule("rule-1");

    expect(result.error).toBeUndefined();
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual(EXPECTED_TAGS);
  });

  it("createBlockedDate invalidates staff + bookings + audit", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await createBlockedDate({}, blockedDateFormData());

    expect(result.error).toBeUndefined();
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual(EXPECTED_TAGS);
  });

  it("deleteBlockedDate invalidates staff + bookings + audit", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await deleteBlockedDate("blocked-1");

    expect(result.error).toBeUndefined();
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual(EXPECTED_TAGS);
  });

  it("saveAvailabilityOverride invalidates staff + bookings + audit", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await saveAvailabilityOverride(
      OVERRIDE_DATE,
      MONDAY_WITH_BREAK,
      "Half day"
    );

    expect(result.error).toBeUndefined();
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual(EXPECTED_TAGS);
  });

  it("deleteAvailabilityOverride invalidates staff + bookings + audit", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await deleteAvailabilityOverride(OVERRIDE_DATE);

    expect(result.error).toBeUndefined();
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual(EXPECTED_TAGS);
  });
});

/**
 * C-14 Phase C Step 12a — the migration drops the unique on `override_date`,
 * which is what the old `.upsert(…, { onConflict: "override_date" })` needed to
 * exist: PostgREST's ON CONFLICT fails with 42P10 the moment it is gone. These
 * specs pin the replacement shape — replace the whole DATE, as segments.
 */
describe("saveAvailabilityOverride — segments", () => {
  it("writes one row per bookable segment, so a break survives the save", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    await saveAvailabilityOverride(OVERRIDE_DATE, MONDAY_WITH_BREAK, "Half day");

    expect(stub.overrideInserts).toEqual([
      [
        {
          override_date: OVERRIDE_DATE,
          start_time: "08:00",
          end_time: "12:30",
          reason: "Half day",
        },
        {
          override_date: OVERRIDE_DATE,
          start_time: "15:00",
          end_time: "20:00",
          reason: "Half day",
        },
      ],
    ]);
  });

  it("clears the date's existing rows before inserting the new set", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    await saveAvailabilityOverride(OVERRIDE_DATE, MONDAY_WITH_BREAK, "");

    // Deleting FIRST is deliberate: a failed insert then leaves the date on the
    // clinic's ordinary weekly hours, where inserting first would leave the old
    // and new windows side by side — more availability than anyone asked for.
    expect(stub.overrideDeletes).toEqual([OVERRIDE_DATE]);
  });

  it("stores a no-break date as the single row it has always been", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    await saveAvailabilityOverride(
      OVERRIDE_DATE,
      { ...MONDAY_WITH_BREAK, breaks: [] },
      ""
    );

    expect(stub.overrideInserts).toEqual([
      [
        {
          override_date: OVERRIDE_DATE,
          start_time: "08:00",
          end_time: "20:00",
          reason: null,
        },
      ],
    ]);
  });

  it("audits every row on either side of the swap, not one target row", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    await saveAvailabilityOverride(OVERRIDE_DATE, MONDAY_WITH_BREAK, "");

    expect(stub.audits).toHaveLength(1);
    expect(stub.audits[0]).toMatchObject({
      action_type: "availability_override_upserted",
      target_type: "availability_overrides",
      target_id: "override-new",
    });
    expect(stub.audits[0].before_state).toEqual([
      { id: "override-1", override_date: OVERRIDE_DATE },
    ]);
  });

  it("refuses a break that falls outside the date's hours", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await saveAvailabilityOverride(
      OVERRIDE_DATE,
      { ...MONDAY_WITH_BREAK, breaks: [{ start: "12:30", end: "23:00" }] },
      ""
    );

    expect(result.fieldErrors?.start_time).toBe(
      "Break 1 has to sit between 08:00 and 20:00."
    );
    // Nothing was deleted: a rejected save must not clear the date's hours.
    expect(stub.overrideDeletes).toEqual([]);
    expect(stub.overrideInserts).toEqual([]);
  });

  it("refuses a malformed date before it reaches a DELETE", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await saveAvailabilityOverride("", MONDAY_WITH_BREAK, "");

    expect(result.fieldErrors?.override_date).toBe("Choose an override date.");
    expect(stub.overrideDeletes).toEqual([]);
  });
});

/**
 * A date with a break is several rows, so "remove this adjustment" has to mean
 * all of them — deleting by row id would strip the morning and leave the
 * afternoon standing as if it were the whole day's hours.
 */
describe("deleteAvailabilityOverride — by date", () => {
  it("deletes by override_date and audits every row it removed", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await deleteAvailabilityOverride(OVERRIDE_DATE);

    expect(result.error).toBeUndefined();
    expect(stub.overrideDeletes).toEqual([OVERRIDE_DATE]);
    expect(stub.audits[0].before_state).toEqual([
      { id: "override-1", override_date: OVERRIDE_DATE },
    ]);
  });

  it("rejects a non-date reference instead of deleting", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await deleteAvailabilityOverride("override-1");

    expect(result.error).toBe("Availability override not found.");
    expect(stub.overrideDeletes).toEqual([]);
  });
});

/**
 * C-14 Phase A Step 9. The RPC is what makes the day's delete + insert one
 * transaction: without it a failed insert leaves the day with ZERO rows, and
 * `getRuleWindowsForDay` reads a day with no rows as CLOSED — a silent,
 * customer-facing closure that looks correct on the admin screen.
 */
describe("saveAvailabilityDay — segments", () => {
  it("sends every segment of the day, so a break survives the save", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    await saveAvailabilityDay(1, MONDAY_WITH_BREAK);

    expect(stub.rpc).toHaveBeenCalledWith("save_availability_day", {
      p_day_of_week: 1,
      p_segments: [
        { start_time: "08:00", end_time: "12:30", is_working_day: true },
        { start_time: "15:00", end_time: "20:00", is_working_day: true },
      ],
    });
  });

  it("writes a closed day as one is_working_day:false row that keeps the hours", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    await saveAvailabilityDay(0, { ...MONDAY_WITH_BREAK, isWorkingDay: false });

    expect(stub.rpc).toHaveBeenCalledWith("save_availability_day", {
      p_day_of_week: 0,
      p_segments: [
        { start_time: "08:00", end_time: "20:00", is_working_day: false },
      ],
    });
  });

  it("audits the rows the RPC reports from either side of the swap", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    await saveAvailabilityDay(1, MONDAY_WITH_BREAK);

    expect(stub.audits).toHaveLength(1);
    expect(stub.audits[0]).toMatchObject({
      actor_staff_id: "staff-owner",
      action_type: "availability_rule_updated",
      target_type: "availability_rules",
      target_id: "rule-new",
    });
    expect(stub.audits[0].before_state).toEqual([
      { id: "rule-old", start_time: "09:00:00", end_time: "17:00:00" },
    ]);
    expect(stub.audits[0].after_state).toEqual([
      { id: "rule-new", start_time: "08:00:00", end_time: "12:30:00" },
    ]);
  });

  it("refuses a schedule whose breaks fall outside the working day", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await saveAvailabilityDay(1, {
      ...MONDAY_WITH_BREAK,
      breaks: [{ start: "12:30", end: "23:00" }],
    });

    expect(result.fieldErrors?.start_time).toBe(
      "Break 1 has to sit between 08:00 and 20:00."
    );
    expect(stub.rpc).not.toHaveBeenCalled();
  });

  it("refuses a day outside 0..6", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await saveAvailabilityDay(7, MONDAY_WITH_BREAK);

    expect(result.fieldErrors?.day_of_week).toBe("Choose a valid day.");
    expect(stub.rpc).not.toHaveBeenCalled();
  });

  it("surfaces an RPC failure instead of reporting success", async () => {
    const stub = stubAdminClient();
    stub.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "permission denied for table availability_rules" },
    } as never);
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await saveAvailabilityDay(1, MONDAY_WITH_BREAK);

    expect(result.error).toBe("permission denied for table availability_rules");
    expect(result.success).toBeUndefined();
    expect(stub.audits).toHaveLength(0);
  });
});
