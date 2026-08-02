import { updateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEnquiry } from "../actions";

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

vi.mock("@/lib/email/notifications", () => ({
  sendEnquiryLoggedEmail: vi.fn(),
}));

const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
const { requirePermission } = await import("@/lib/auth/rbac");
const { sendEnquiryLoggedEmail } = await import("@/lib/email/notifications");

const ACTOR = { id: "staff-admin-1", name: "Jamie" };
const NEW_ENQUIRY_ID = "enquiry-99";

/**
 * C-08 Phase D Step 16 — the enquiry_logged hook fires after the insert +
 * audit row, wrapped in catch-and-continue (a failed alert must never fail
 * the enquiry). This is the "extend existing booking-action tests" sub-step
 * for a trigger site with no pre-existing action test file to extend.
 */
function stubAdminClient() {
  const audits: Record<string, unknown>[] = [];

  const from = vi.fn((table: string) => {
    if (table === "enquiries") {
      return {
        insert: () => ({
          select: () => ({
            single: async () => ({
              data: { id: NEW_ENQUIRY_ID, status: "new" },
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === "audit_logs") {
      return {
        insert: vi.fn(async (row: Record<string, unknown>) => {
          audits.push(row);
          return { error: null };
        }),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return { client: { from }, audits };
}

function formData(overrides: Record<string, string> = {}) {
  const data = new FormData();
  data.set("full_name", overrides.full_name ?? "Priya Shah");
  data.set("phone", overrides.phone ?? "07123456789");
  data.set("email", overrides.email ?? "priya@client.example.test");
  data.set("source", overrides.source ?? "website");
  data.set("service_interest", overrides.service_interest ?? "Swedish massage");
  data.set("notes", overrides.notes ?? "");
  data.set("assigned_staff_id", overrides.assigned_staff_id ?? "");
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePermission).mockResolvedValue(ACTOR as never);
});

describe("createEnquiry — C-08 Phase D Step 16 enquiry_logged hook", () => {
  it("sends the enquiry_logged alert after a successful create, with the actor for skip-self", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);
    vi.mocked(sendEnquiryLoggedEmail).mockResolvedValue(undefined);

    const result = await createEnquiry({}, formData());

    expect(result).toEqual({ success: true });
    expect(sendEnquiryLoggedEmail).toHaveBeenCalledTimes(1);
    expect(sendEnquiryLoggedEmail).toHaveBeenCalledWith(
      NEW_ENQUIRY_ID,
      ACTOR.id,
      stub.client
    );
  });

  it("catch-and-continue: a failed alert send does not fail the enquiry creation", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);
    vi.mocked(sendEnquiryLoggedEmail).mockRejectedValue(new Error("Resend is down."));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await createEnquiry({}, formData());

    expect(result).toEqual({ success: true });
    expect(errorSpy).toHaveBeenCalledWith(
      "Unable to send enquiry_logged email.",
      expect.any(Error)
    );

    errorSpy.mockRestore();
  });

  // C-09 Phase B fix round: sendEnquiryLoggedEmail routes through
  // sendTrackedEmail, which writes an email_delivery_events row — the emails
  // tag has to be invalidated alongside enquiries + audit, or the newly
  // logged enquiry's notification won't appear on /admin/emails once Phase C
  // caches that page on the emails tag.
  it("invalidates the enquiries, audit, and emails cache tags", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);
    vi.mocked(sendEnquiryLoggedEmail).mockResolvedValue(undefined);

    const result = await createEnquiry({}, formData());

    expect(result).toEqual({ success: true });
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([
      "report-data",
      "dashboard-data",
      "enquiries",
      "audit",
      "emails",
    ]);
  });

  it("never calls the alert send when the enquiry insert itself fails", async () => {
    const from = vi.fn((table: string) => {
      if (table === "enquiries") {
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: null,
                error: { message: "insert failed" },
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    vi.mocked(createSupabaseAdminClient).mockReturnValue({ from } as never);

    const result = await createEnquiry({}, formData());

    expect(result).toEqual({ error: "insert failed" });
    expect(sendEnquiryLoggedEmail).not.toHaveBeenCalled();
  });
});
