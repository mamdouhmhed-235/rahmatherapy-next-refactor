import { updateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateEnquiryStatus } from "../actions";

/**
 * C-09 Phase B fix round — Step 3 spec coverage. `updateEnquiryStatus` has
 * no pre-existing spec file (createEnquiry.test.ts only covers the sibling
 * export). Asserts the enquiries + audit tags it invalidates.
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

const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
const { requirePermission } = await import("@/lib/auth/rbac");

const ACTOR = { id: "staff-admin-1", name: "Jamie" };
const ENQUIRY_ID = "enquiry-1";

function stubAdminClient(beforeState: Record<string, unknown>) {
  const audits: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];

  const from = vi.fn((table: string) => {
    if (table === "audit_logs") {
      return {
        insert: vi.fn(async (row: Record<string, unknown>) => {
          audits.push(row);
          return { error: null };
        }),
      };
    }
    // enquiries
    return {
      select: () => ({
        eq: () => ({
          single: async () => ({ data: beforeState, error: null }),
        }),
      }),
      update: (patch: Record<string, unknown>) => {
        updates.push(patch);
        return {
          eq: () => ({
            select: () => ({
              single: async () => ({
                data: { ...beforeState, ...patch },
                error: null,
              }),
            }),
          }),
        };
      },
    };
  });

  return { client: { from }, audits, updates };
}

function formData(status = "contacted") {
  const data = new FormData();
  data.set("enquiry_id", ENQUIRY_ID);
  data.set("status", status);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePermission).mockResolvedValue(ACTOR as never);
});

describe("updateEnquiryStatus — cache tag invalidation", () => {
  it("invalidates the enquiries and audit cache tags alongside the existing output tags", async () => {
    const stub = stubAdminClient({
      id: ENQUIRY_ID,
      status: "new",
      first_contacted_at: null,
    });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await updateEnquiryStatus(formData("contacted"));

    expect(result).toEqual({ success: true, previousStatus: "new" });
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([
      "report-data",
      "dashboard-data",
      "enquiries",
      "audit",
    ]);
  });
});
