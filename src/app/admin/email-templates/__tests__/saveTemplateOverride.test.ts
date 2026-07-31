import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveTemplateOverride } from "../actions";

/**
 * C-08 Phase B (security review, Task 2). `body_cta_url` is the one
 * admin-editable field that lands in a real `<a href>` (templates.ts). This
 * file covers the save-time gate in `saveTemplateOverride`: non-https values
 * (including `javascript:`) are rejected before ever reaching the database,
 * and a valid `https://` value still saves normally.
 */

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

const TEMPLATE_ID = "review_request_client";

function formData(fieldValue: string) {
  const data = new FormData();
  data.set("template_id", TEMPLATE_ID);
  data.set("field:body_cta_url", fieldValue);
  return data;
}

/** Stub covering the beforeRow read, the upsert, and the audit_logs insert. */
function stubAdminClient() {
  const upserts: Record<string, unknown>[] = [];
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
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
      upsert: (row: Record<string, unknown>) => {
        upserts.push(row);
        return {
          select: () => ({
            single: async () => ({ data: { id: "override-1", ...row }, error: null }),
          }),
        };
      },
    };
  });

  return { client: { from }, upserts, audits };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePermission).mockResolvedValue({
    id: "staff-owner",
    name: "Owner",
  } as never);
});

describe("saveTemplateOverride — body_cta_url scheme validation", () => {
  it("rejects a javascript: URL with a clear error and writes nothing", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await saveTemplateOverride(null, formData("javascript:alert(1)"));

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/https:\/\//);
    expect(stub.upserts).toHaveLength(0);
  });

  it("rejects an http:// URL — https is required", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await saveTemplateOverride(
      null,
      formData("http://example.test/review")
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/https:\/\//);
    expect(stub.upserts).toHaveLength(0);
  });

  it("rejects a malformed value that isn't a URL at all", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await saveTemplateOverride(null, formData("not a url"));

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/https:\/\//);
    expect(stub.upserts).toHaveLength(0);
  });

  it("accepts a valid https:// URL and saves it", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await saveTemplateOverride(
      null,
      formData("https://g.page/r/example/review")
    );

    expect(result.ok).toBe(true);
    expect(result.cleanedValues).toMatchObject({
      body_cta_url: "https://g.page/r/example/review",
    });
    expect(stub.upserts).toHaveLength(1);
    expect(stub.upserts[0]).toMatchObject({
      template_id: TEMPLATE_ID,
      field_key: "body_cta_url",
      value: "https://g.page/r/example/review",
    });
  });

  it("allows clearing the field back to empty without triggering the scheme check", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await saveTemplateOverride(null, formData(""));

    // Nothing existed to delete (maybeSingle returns null above), so this is
    // a no-op success — the point being no validation error is raised.
    expect(result.ok).toBe(true);
    expect(stub.upserts).toHaveLength(0);
  });
});
