import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteClient } from "../../clients/actions";
import { updatePrivacyRequestStatus } from "../actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));

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

vi.mock("../../clients/actions", () => ({
  deleteClient: vi.fn(),
}));

const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
const { requirePermission } = await import("@/lib/auth/rbac");

const REQUEST_ID = "11111111-2222-4333-8444-555555555555";
const CLIENT_ID = "99999999-8888-4777-8666-555555555555";

function stubAdminClient(requestType: string) {
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
    return {
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              id: REQUEST_ID,
              client_id: CLIENT_ID,
              request_type: requestType,
              status: "reviewing",
            },
            error: null,
          }),
        }),
      }),
      update: (patch: Record<string, unknown>) => {
        updates.push(patch);
        return { eq: async () => ({ error: null }) };
      },
    };
  });

  return { client: { from }, audits, updates };
}

function formData(status: string) {
  const data = new FormData();
  data.set("request_id", REQUEST_ID);
  data.set("status", status);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePermission).mockResolvedValue({
    id: "staff-owner",
    name: "Owner",
  } as never);
  vi.mocked(deleteClient).mockResolvedValue({ success: true });
});

describe("updatePrivacyRequestStatus completion branching", () => {
  it("erases the client when a deletion_review is marked completed", async () => {
    const stub = stubAdminClient("deletion_review");
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await updatePrivacyRequestStatus({}, formData("completed"));

    expect(result).toEqual({ success: true });
    expect(deleteClient).toHaveBeenCalledTimes(1);
    expect(deleteClient).toHaveBeenCalledWith(
      CLIENT_ID,
      "gdpr_erasure",
      stub.client,
      "staff-owner"
    );
    expect(stub.updates).toEqual([{ status: "completed" }]);
  });

  it("treats an already-deleted client as a clean success (brief §5.5)", async () => {
    const stub = stubAdminClient("deletion_review");
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);
    vi.mocked(deleteClient).mockResolvedValue({
      success: true,
      alreadyDeleted: true,
    });

    await expect(
      updatePrivacyRequestStatus({}, formData("completed"))
    ).resolves.toEqual({ success: true });
  });

  it("reports which half landed when the erasure fails after the status saved", async () => {
    const stub = stubAdminClient("deletion_review");
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);
    vi.mocked(deleteClient).mockResolvedValue({
      success: false,
      error: "Sensitive notes could not be removed.",
    });

    const result = await updatePrivacyRequestStatus({}, formData("completed"));

    expect(result.success).toBeUndefined();
    expect(result.error).toContain("Status saved");
    expect(result.error).toContain("Sensitive notes could not be removed.");
    // The status update is not rolled back — the message must not deny it.
    expect(stub.updates).toEqual([{ status: "completed" }]);
  });

  it.each(["data_export", "correction", "sensitive_note_review"])(
    "never deletes anything when a %s request is marked completed",
    async (requestType) => {
      const stub = stubAdminClient(requestType);
      vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

      const result = await updatePrivacyRequestStatus({}, formData("completed"));

      expect(result).toEqual({ success: true });
      expect(deleteClient).not.toHaveBeenCalled();
      expect(stub.updates).toEqual([{ status: "completed" }]);
    }
  );

  it.each(["open", "reviewing", "declined"])(
    "never deletes anything when a deletion_review moves to %s",
    async (status) => {
      const stub = stubAdminClient("deletion_review");
      vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

      const result = await updatePrivacyRequestStatus({}, formData(status));

      expect(result).toEqual({ success: true });
      expect(deleteClient).not.toHaveBeenCalled();
    }
  );

  it("refuses without the privacy-operations permission", async () => {
    const stub = stubAdminClient("deletion_review");
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);
    vi.mocked(requirePermission).mockRejectedValue(new Error("nope"));

    await expect(
      updatePrivacyRequestStatus({}, formData("completed"))
    ).resolves.toEqual({ error: "Insufficient permissions." });
    expect(deleteClient).not.toHaveBeenCalled();
  });
});
