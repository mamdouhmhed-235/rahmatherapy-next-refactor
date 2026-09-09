import { updateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  approvePasswordResetRequest,
  finishApprovalRefresh,
  rejectPasswordResetRequest,
} from "../actions";

/**
 * C-09 addendum (Owner-approved 2026-08-03, third pass on "which mutating
 * actions still need tags"). Both actions write an `audit_logs` row
 * (`password_reset_approved` / `password_reset_rejected`) as a side effect of
 * reviewing a request, but previously called only `revalidatePath` — leaving
 * `/admin/audit` (unstable_cache tagged `audit` only, no default target_type
 * filter) stale for up to the 60s revalidate window. Asserts the audit tag
 * now invalidated, and that permission/validation failures call updateTag
 * zero times.
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
  getStaffProfile: vi.fn(),
}));

// The provider boundary, closed. Nothing in this file can reach Resend.
vi.mock("@/lib/email/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email/client")>()),
  sendEmail: vi.fn().mockResolvedValue({ id: "resend-stub-id" }),
  getSiteUrl: vi.fn(() => "https://rahmatherapy.example.test"),
}));

const { getStaffProfile } = await import("@/lib/auth/rbac");
const { sendEmail } = await import("@/lib/email/client");

const REQUEST_ID = "request-1";
const REQUESTER_STAFF_ID = "staff-requester";

function reviewer(overrides: Partial<StaffProfile> = {}): StaffProfile {
  return {
    id: "staff-reviewer",
    auth_user_id: "auth-reviewer",
    name: "Reviewer",
    email: "reviewer@rahmatherapy.example.test",
    role_id: "role-owner",
    role_name: "Owner",
    gender: "female",
    active: true,
    can_take_bookings: false,
    availability_mode: "use_global",
    permissions: new Set([PERMISSIONS.MANAGE_ACCOUNT_PASSWORD_REQUESTS]),
    ...overrides,
  } as StaffProfile;
}

function stubAdminClient(opts: {
  requestRow?: {
    id: string;
    staff_id: string;
    status: string;
    reviewed_by: string | null;
  } | null;
  updateSucceeds?: boolean;
} = {}) {
  const requestRow =
    opts.requestRow === undefined
      ? {
          id: REQUEST_ID,
          staff_id: REQUESTER_STAFF_ID,
          status: "pending",
          reviewed_by: null,
        }
      : opts.requestRow;
  const updateSucceeds = opts.updateSucceeds ?? true;

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
    if (table === "account_password_requests") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: requestRow, error: null })),
          })),
        })),
        update: vi.fn((patch: Record<string, unknown>) => {
          updates.push(patch);
          return {
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(async () => ({
                  data: updateSucceeds ? [{ id: REQUEST_ID }] : [],
                  error: null,
                })),
              })),
            })),
          };
        }),
      };
    }
    if (table === "staff_profiles") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: {
                id: REQUESTER_STAFF_ID,
                name: "Requester",
                auth_user_id: "auth-requester",
              },
              error: null,
            })),
          })),
        })),
      };
    }
    throw new Error(`Unexpected table in test: ${table}`);
  });

  const auth = {
    admin: {
      getUserById: vi.fn(async () => ({
        data: { user: { email: "requester@rahmatherapy.example.test" } },
      })),
    },
  };

  const client = { from, auth } as unknown as ReturnType<
    typeof createSupabaseAdminClient
  >;
  vi.mocked(createSupabaseAdminClient).mockReturnValue(client);
  return { client, audits, updates };
}

function approveFormData(overrides: Record<string, string> = {}) {
  const data = new FormData();
  data.set("requestId", overrides.requestId ?? REQUEST_ID);
  data.set("reviewer_note", overrides.reviewer_note ?? "");
  return data;
}

function rejectFormData(overrides: Record<string, string> = {}) {
  const data = new FormData();
  data.set("requestId", overrides.requestId ?? REQUEST_ID);
  data.set("reviewer_note", overrides.reviewer_note ?? "Not the right time.");
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("approvePasswordResetRequest — cache tag invalidation", () => {
  it("invalidates the audit tag on a successful approval", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(reviewer());
    stubAdminClient();

    const result = await approvePasswordResetRequest(approveFormData());

    // The result carries the one-time link now — see the next two tests for why.
    expect(result).toMatchObject({ ok: true, emailSent: true, emailError: null });
    expect(sendEmail).toHaveBeenCalledTimes(1);

    // ⛔ CONTRACT INVERTED ON PURPOSE — approve must invalidate NOTHING.
    //
    // This used to assert `["audit"]`. Busting that tag re-renders the request list
    // (password-requests-data.ts caches it with tags [AUDIT, STAFF]); the approved row
    // then leaves the Pending tab, unmounting ApproveModal and destroying the
    // one-time link it holds — the only copy that will ever exist. Observed failing
    // 3/3 in a real browser. Invalidation moved to finishApprovalRefresh(), asserted
    // below.
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([]);
  });

  it("finishApprovalRefresh invalidates what approve deliberately left alone", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(reviewer());
    stubAdminClient();

    await finishApprovalRefresh();

    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([
      "audit",
    ]);
  });

  // ⛔ Pins the fix for the ordering bug. Before it, a failed send returned
  // {ok:false} even though the row had ALREADY been marked approved and the only
  // valid token had been destroyed — the reviewer saw an error, could not retry
  // (the row was no longer pending), and the requester was stranded.
  it("still succeeds, and returns the link, when the email fails", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(reviewer());
    stubAdminClient();
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("Resend timed out"));

    const result = await approvePasswordResetRequest(approveFormData());

    expect(result).toMatchObject({ ok: true, emailSent: false });
    expect(result).toHaveProperty("resetLinkUrl");
    if (result.ok) {
      expect(result.resetLinkUrl).toContain("/admin/password-reset/");
      expect(result.emailError).toBeTruthy();
    }
    // ⛔ Still no invalidation here — see the note in the first test. The audit ROW
    // is written regardless (that is what matters); only the cache flush is deferred.
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([]);
  });

  // The link is unrecoverable after this call returns (the row stores a one-way
  // hash), so the success path must always hand it back.
  it("returns a usable reset link on the happy path", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(reviewer());
    stubAdminClient();

    const result = await approvePasswordResetRequest(approveFormData());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.resetLinkUrl).toMatch(/\/admin\/password-reset\/[0-9a-f]{64}$/);
    }
  });

  it("never calls updateTag when the reviewer lacks permission", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(
      reviewer({ permissions: new Set() })
    );
    stubAdminClient();

    const result = await approvePasswordResetRequest(approveFormData());

    expect(result).toEqual({
      ok: false,
      code: "server",
      message: "Insufficient permissions.",
    });
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("never calls updateTag when validation fails (missing request id)", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(reviewer());
    stubAdminClient();

    const result = await approvePasswordResetRequest(
      approveFormData({ requestId: "" })
    );

    expect(result).toEqual({
      ok: false,
      code: "validation",
      message: "Missing request id.",
    });
    expect(updateTag).not.toHaveBeenCalled();
  });
});

describe("rejectPasswordResetRequest — cache tag invalidation", () => {
  it("invalidates the audit tag on a successful rejection", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(reviewer());
    stubAdminClient();

    const result = await rejectPasswordResetRequest(rejectFormData());

    expect(result).toEqual({ ok: true });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([
      "audit",
    ]);
  });

  it("never calls updateTag when the reviewer lacks permission", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(
      reviewer({ permissions: new Set() })
    );
    stubAdminClient();

    const result = await rejectPasswordResetRequest(rejectFormData());

    expect(result).toEqual({
      ok: false,
      code: "server",
      message: "Insufficient permissions.",
    });
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("never calls updateTag when validation fails (missing reviewer note)", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(reviewer());
    stubAdminClient();

    const result = await rejectPasswordResetRequest(
      rejectFormData({ reviewer_note: "" })
    );

    expect(result).toEqual({
      ok: false,
      code: "validation",
      message: "Add a note before rejecting. The requester needs to know why.",
    });
    expect(updateTag).not.toHaveBeenCalled();
  });
});
