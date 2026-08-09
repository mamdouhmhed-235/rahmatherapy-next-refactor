import { updateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requirePermission } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createAvailabilityOverride,
  createBlockedDate,
  deleteAvailabilityOverride,
  deleteAvailabilityRule,
  deleteBlockedDate,
  saveAvailabilityDay,
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

  const from = vi.fn((table: string) => {
    if (table === "audit_logs") {
      return {
        insert: vi.fn(async (row: Record<string, unknown>) => {
          audits.push(row);
          return { error: null };
        }),
      };
    }
    // availability_rules / blocked_dates / availability_overrides — all three
    // tables get the same shape of query from this file (select/eq/single,
    // insert/update + select/single, delete/eq).
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

  return { client: { from, rpc }, audits, rpc };
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

function overrideFormData() {
  const data = new FormData();
  data.set("override_date", "2099-01-01");
  data.set("start_time", "09:00");
  data.set("end_time", "12:00");
  data.set("reason", "Half day");
  return data;
}

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

  it("createAvailabilityOverride invalidates staff + bookings + audit", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await createAvailabilityOverride({}, overrideFormData());

    expect(result.error).toBeUndefined();
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual(EXPECTED_TAGS);
  });

  it("deleteAvailabilityOverride invalidates staff + bookings + audit", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await deleteAvailabilityOverride("override-1");

    expect(result.error).toBeUndefined();
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual(EXPECTED_TAGS);
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
