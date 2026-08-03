import { updateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashResetToken } from "@/lib/auth/password-reset-token";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { submitPasswordResetRequest, setPasswordWithToken } from "../actions";

/**
 * C-09 addendum (Owner-approved 2026-08-03, third pass on "which mutating
 * actions still need tags"). `submitPasswordResetRequest`, `setPasswordWithToken`
 * and the shared `logRejection` helper (called from every reject branch in
 * `setPasswordWithToken`) each write an `audit_logs` row but previously called
 * no `updateTag` at all — leaving `/admin/audit` (tagged `audit` only) stale.
 *
 * This file is unauthenticated by design — `src/middleware.ts` allow-lists
 * every `/admin/password-reset*` path, so these actions run for a
 * not-signed-in visitor. `updateTag` is a pure server-side cache-invalidation
 * primitive (no session read, no data exposure, no new privilege boundary),
 * so calling it from a public action is safe; there is no "permission-denied"
 * category here because there is no permission gate to deny. `redirect()` is
 * mocked to throw (matching real Next.js `NEXT_REDIRECT` semantics) because,
 * unlike other admin actions, this file's control flow genuinely depends on
 * redirect() short-circuiting execution (e.g. the email-format check falls
 * through to the DB-writing code below it otherwise).
 */

vi.mock("next/cache", () => ({
  updateTag: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    set: vi.fn(),
    get: vi.fn(),
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: { signInWithPassword: vi.fn().mockResolvedValue({ error: null }) },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function stubAdminClientForSubmit(opts: {
  users?: { id: string; email: string }[];
  staffRow?: { id: string; name: string; active: boolean; auth_user_id: string } | null;
  insertResult?: { data: { id: string } | null; error: { message: string } | null };
}) {
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
    if (table === "staff_profiles") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: opts.staffRow ?? null,
              error: null,
            })),
          })),
        })),
      };
    }
    if (table === "account_password_requests") {
      return {
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () =>
              opts.insertResult ?? { data: { id: "apr-1" }, error: null }
            ),
          })),
        })),
      };
    }
    throw new Error(`Unexpected table in test: ${table}`);
  });

  const auth = {
    admin: {
      listUsers: vi.fn(async () => ({
        data: { users: opts.users ?? [] },
        error: null,
      })),
    },
  };

  const client = { from, auth } as unknown as ReturnType<
    typeof createSupabaseAdminClient
  >;
  vi.mocked(createSupabaseAdminClient).mockReturnValue(client);
  return { audits };
}

function submitFormData(email: string) {
  const data = new FormData();
  data.set("email", email);
  return data;
}

describe("submitPasswordResetRequest — cache tag invalidation", () => {
  it("invalidates the audit tag when a matching staff member is found", async () => {
    stubAdminClientForSubmit({
      users: [{ id: "auth-1", email: "staff@rahmatherapy.example.test" }],
      staffRow: {
        id: "staff-1",
        name: "Staff",
        active: true,
        auth_user_id: "auth-1",
      },
    });

    await expect(
      submitPasswordResetRequest(submitFormData("staff@rahmatherapy.example.test"))
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([
      "audit",
    ]);
  });

  it("invalidates the audit tag when no matching staff is found (enumeration-safe path)", async () => {
    const stub = stubAdminClientForSubmit({ users: [] });

    await expect(
      submitPasswordResetRequest(submitFormData("nobody@rahmatherapy.example.test"))
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(stub.audits[0]).toMatchObject({
      action_type: "password_reset_request_lookup_failed",
    });
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([
      "audit",
    ]);
  });

  it("never calls updateTag when the account_password_requests insert fails", async () => {
    stubAdminClientForSubmit({
      users: [{ id: "auth-1", email: "staff@rahmatherapy.example.test" }],
      staffRow: {
        id: "staff-1",
        name: "Staff",
        active: true,
        auth_user_id: "auth-1",
      },
      insertResult: { data: null, error: { message: "insert failed" } },
    });

    await expect(
      submitPasswordResetRequest(submitFormData("staff@rahmatherapy.example.test"))
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(updateTag).not.toHaveBeenCalled();
  });

  it("never calls updateTag when email validation fails", async () => {
    stubAdminClientForSubmit({});

    await expect(
      submitPasswordResetRequest(submitFormData("not-an-email"))
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });
});

interface CandidateRow {
  id: string;
  staff_id: string;
  status: "pending" | "approved" | "rejected" | "expired" | "used";
  expires_at: string;
  encrypted_payload: string | null;
  payload_cipher_version: number;
}

function stubAdminClientForToken(opts: {
  candidateRow?: CandidateRow | null;
  staffRow?: { id: string; auth_user_id: string; name: string } | null;
  updatePasswordError?: { message: string } | null;
}) {
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
    if (table === "account_password_requests") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: opts.candidateRow ?? null,
                error: null,
              })),
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(async () => ({ error: null })),
        })),
      };
    }
    if (table === "staff_profiles") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: opts.staffRow ?? null,
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
      updateUserById: vi.fn(async () => ({
        error: opts.updatePasswordError ?? null,
      })),
      getUserById: vi.fn(async () => ({
        data: { user: { email: "staff@rahmatherapy.example.test" } },
      })),
    },
  };

  const client = { from, auth } as unknown as ReturnType<
    typeof createSupabaseAdminClient
  >;
  vi.mocked(createSupabaseAdminClient).mockReturnValue(client);
  return { audits };
}

function tokenFormData(overrides: Record<string, string> = {}) {
  const data = new FormData();
  data.set("token", overrides.token ?? "test-token-123");
  data.set("new_password", overrides.new_password ?? "SuperSecurePassword123");
  data.set(
    "confirm_new_password",
    overrides.confirm_new_password ?? "SuperSecurePassword123"
  );
  return data;
}

describe("setPasswordWithToken — cache tag invalidation", () => {
  it("invalidates the audit tag on a rejected (unmatched) token — real behaviour is NOT zero calls", async () => {
    const stub = stubAdminClientForToken({ candidateRow: null });

    await expect(
      setPasswordWithToken(tokenFormData())
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(stub.audits[0]).toMatchObject({
      action_type: "password_reset_token_rejected",
      after_state: { reason: "no_match" },
    });
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([
      "audit",
    ]);
  });

  it("invalidates the audit tag once on successful completion", async () => {
    const token = "test-token-123";
    const encrypted_payload = await hashResetToken(token);
    const futureExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const stub = stubAdminClientForToken({
      candidateRow: {
        id: "apr-1",
        staff_id: "staff-1",
        status: "approved",
        expires_at: futureExpiry,
        encrypted_payload,
        payload_cipher_version: 0,
      },
      staffRow: { id: "staff-1", auth_user_id: "auth-1", name: "Staff" },
    });

    await expect(
      setPasswordWithToken(tokenFormData({ token }))
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(stub.audits).toHaveLength(1);
    expect(stub.audits[0]).toMatchObject({
      action_type: "password_reset_completed",
    });
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([
      "audit",
    ]);
  });

  it("never calls updateTag when password validation fails before any DB read", async () => {
    await expect(
      setPasswordWithToken(tokenFormData({ new_password: "short", confirm_new_password: "short" }))
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });
});
