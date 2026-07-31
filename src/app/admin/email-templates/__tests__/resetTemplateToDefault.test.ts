// C-15 Phase D, Step 16 — resetTemplateToDefault coverage.
//
// Scope, per the dispatch: permission gate, delete-all (every override row
// for the template_id, not just registered field kinds), the audit row
// (before_state must be reconstructable by hand — field_key + value per
// row), and the zero-override server-side disable (mirrors the client's
// disabled button, brief §5.4).

import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetTemplateToDefault } from "../actions";
import { PermissionError } from "@/lib/auth/rbac";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

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

const TEMPLATE_ID = "booking_confirmation";

function formData(templateId = TEMPLATE_ID) {
  const data = new FormData();
  data.set("template_id", templateId);
  return data;
}

interface ExistingRow {
  id: string;
  field_key: string;
  value: string;
  updated_by: string | null;
  updated_at: string;
}

/** Stubs the SELECT (existing rows), DELETE, and audit_logs insert. */
function stubAdminClient(existingRows: ExistingRow[]) {
  const deletedTemplateIds: string[] = [];
  const audits: Record<string, unknown>[] = [];

  const from = vi.fn((table: string) => {
    if (table === "audit_logs") {
      return {
        insert: vi.fn(async (row: Record<string, unknown>) => {
          audits.push(row);
          return { error: null };
        }),
      };
    }
    // email_template_overrides
    return {
      select: () => ({
        eq: async () => ({ data: existingRows, error: null }),
      }),
      delete: () => ({
        eq: (_col: string, val: string) => {
          deletedTemplateIds.push(val);
          return Promise.resolve({ error: null });
        },
      }),
    };
  });

  return { client: { from }, deletedTemplateIds, audits };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePermission).mockResolvedValue({
    id: "staff-owner",
    name: "Owner",
  } as never);
});

describe("resetTemplateToDefault — permission gate", () => {
  it("returns an error and deletes nothing when the actor lacks MANAGE_EMAIL_TEMPLATES", async () => {
    vi.mocked(requirePermission).mockRejectedValueOnce(
      new PermissionError("FORBIDDEN", "Permission required.")
    );
    const stub = stubAdminClient([
      { id: "row-1", field_key: "greeting_intro", value: "x", updated_by: null, updated_at: "2026-07-01T00:00:00Z" },
    ]);
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await resetTemplateToDefault(null, formData());

    expect(result.ok).toBe(false);
    expect(stub.deletedTemplateIds).toHaveLength(0);
    expect(stub.audits).toHaveLength(0);
  });

  it("rethrows an unrelated error from requirePermission rather than swallowing it", async () => {
    vi.mocked(requirePermission).mockRejectedValueOnce(new Error("db unreachable"));
    await expect(resetTemplateToDefault(null, formData())).rejects.toThrow("db unreachable");
  });
});

describe("resetTemplateToDefault — unknown template", () => {
  it("rejects an id that isn't in the registry", async () => {
    const stub = stubAdminClient([]);
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await resetTemplateToDefault(null, formData("not_a_real_template"));

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/unknown template/i);
    expect(stub.deletedTemplateIds).toHaveLength(0);
  });
});

describe("resetTemplateToDefault — zero-override disable (brief §5.4)", () => {
  it("refuses to reset a template that already has no overrides, and writes no audit row", async () => {
    const stub = stubAdminClient([]);
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await resetTemplateToDefault(null, formData());

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/already using its defaults/i);
    expect(stub.deletedTemplateIds).toHaveLength(0);
    expect(stub.audits).toHaveLength(0);
  });
});

describe("resetTemplateToDefault — delete-all + reconstructable audit row", () => {
  it("deletes every override row for the template_id (not just one field) and audits enough to reconstruct them by hand", async () => {
    const existingRows: ExistingRow[] = [
      {
        id: "row-1",
        field_key: "greeting_intro",
        value: "Salaam {clientName}, saved override.",
        updated_by: "staff-1",
        updated_at: "2026-07-01T00:00:00Z",
      },
      {
        id: "row-2",
        field_key: "subject",
        value: "Custom subject line",
        updated_by: "staff-1",
        updated_at: "2026-07-02T00:00:00Z",
      },
    ];
    const stub = stubAdminClient(existingRows);
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await resetTemplateToDefault(null, formData());

    expect(result.ok).toBe(true);
    // The delete targets the whole template_id, not a single field_key —
    // every override row for this template is gone in one operation.
    expect(stub.deletedTemplateIds).toEqual([TEMPLATE_ID]);

    expect(stub.audits).toHaveLength(1);
    expect(stub.audits[0]).toMatchObject({
      actor_staff_id: "staff-owner",
      action_type: "email_template_reset",
    });

    const before = stub.audits[0].before_state as {
      template_id: string;
      overrides: { field_key: string; value: string }[];
    };
    expect(before.template_id).toBe(TEMPLATE_ID);
    // field_key + value per row is what a human needs to type the
    // customisation back in by hand — asserting both are present and
    // correct for every deleted row.
    expect(before.overrides).toEqual([
      { field_key: "greeting_intro", value: "Salaam {clientName}, saved override.", updated_by: "staff-1", updated_at: "2026-07-01T00:00:00Z" },
      { field_key: "subject", value: "Custom subject line", updated_by: "staff-1", updated_at: "2026-07-02T00:00:00Z" },
    ]);
  });

  it("does not delete anything if fetching the existing rows fails", async () => {
    const from = vi.fn((table: string) => {
      if (table === "audit_logs") {
        return { insert: vi.fn(async () => ({ error: null })) };
      }
      return {
        select: () => ({
          eq: async () => ({ data: null, error: { message: "connection reset" } }),
        }),
        delete: () => {
          throw new Error("delete should never be called when the fetch failed");
        },
      };
    });
    vi.mocked(createSupabaseAdminClient).mockReturnValue({ from } as never);

    const result = await resetTemplateToDefault(null, formData());

    expect(result.ok).toBe(false);
    expect(result.error).toBe("connection reset");
  });
});
