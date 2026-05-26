"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  CURRENT_CIPHER_VERSION,
  hashResetToken,
  verifyResetToken,
} from "@/lib/auth/password-reset-token";

const COOKIE_NAME = "rahma_password_reset_request";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const REQUEST_TTL_HOURS = 24;
const MIN_PASSWORD_LENGTH = 12;

function maskEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.indexOf("@");
  if (at <= 0) return "f••@rahmatherapy.co.uk";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const head = local.slice(0, 1) || "f";
  return `${head}••@${domain}`;
}

async function findStaffByEmail(email: string) {
  const adminClient = createSupabaseAdminClient();
  // The `auth` schema isn't exposed via PostgREST by default, so look up the
  // user via the Auth admin API. Practical bound: pageSize 1000 covers any
  // realistic single-clinic staff list. If headcount ever exceeds that we'd
  // switch to an RPC for a single-row email lookup.
  const { data: list, error: listError } =
    await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) {
    console.error("findStaffByEmail listUsers error:", listError);
    return null;
  }
  const authUser = list.users.find(
    (u) => u.email?.toLowerCase() === email
  );
  if (!authUser?.email) return null;
  const { data: staff } = await adminClient
    .from("staff_profiles")
    .select("id, name, active, auth_user_id")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();
  if (!staff || !staff.active) return null;
  return {
    staff,
    authUser: { id: authUser.id, email: authUser.email },
  } as const;
}

async function setRequestCookie(email: string) {
  const cookieStore = await cookies();
  cookieStore.set({
    name: COOKIE_NAME,
    value: JSON.stringify({
      maskedEmail: maskEmail(email),
      submittedAt: new Date().toISOString(),
    }),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin/password-reset",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

async function clearRequestCookie() {
  const cookieStore = await cookies();
  cookieStore.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin/password-reset",
    maxAge: 0,
  });
}

export async function submitPasswordResetRequest(
  formData: FormData
): Promise<void> {
  const raw = formData.get("email");
  const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";

  if (!email || !email.includes("@")) {
    const params = new URLSearchParams();
    params.set("error", email ? "format" : "empty");
    if (email) params.set("email", email);
    redirect(`/admin/password-reset?${params.toString()}`);
  }

  const adminClient = createSupabaseAdminClient();
  const match = await findStaffByEmail(email);

  // Uniform response: same cookie + redirect either way. Email enumeration
  // is foreclosed by branching only inside the audit + insert paths below.
  if (match) {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + REQUEST_TTL_HOURS * 60 * 60 * 1000
    );
    const { data: inserted, error } = await adminClient
      .from("account_password_requests")
      .insert({
        staff_id: match.staff.id,
        status: "pending",
        requested_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        payload_cipher_version: CURRENT_CIPHER_VERSION,
      })
      .select("id")
      .single();
    if (error) {
      console.error("submitPasswordResetRequest insert error:", error);
    } else if (inserted) {
      await adminClient.from("audit_logs").insert({
        actor_staff_id: match.staff.id,
        action_type: "password_reset_requested",
        target_type: "account_password_requests",
        target_id: inserted.id,
        after_state: { masked_email: maskEmail(email) },
      });
    }
  } else {
    await adminClient.from("audit_logs").insert({
      actor_staff_id: null,
      action_type: "password_reset_request_lookup_failed",
      target_type: "account_password_requests",
      target_id: null,
      after_state: { masked_email: maskEmail(email) },
    });
  }

  await setRequestCookie(email);
  redirect("/admin/password-reset?state=submitted");
}

export async function clearPasswordResetCookie(): Promise<void> {
  await clearRequestCookie();
  redirect("/admin/password-reset");
}

interface CandidateRow {
  id: string;
  staff_id: string;
  status: "pending" | "approved" | "rejected" | "expired" | "used";
  expires_at: string;
  encrypted_payload: string | null;
  payload_cipher_version: number;
}

export async function setPasswordWithToken(formData: FormData): Promise<void> {
  const tokenRaw = formData.get("token");
  const newPwRaw = formData.get("new_password");
  const confirmRaw = formData.get("confirm_new_password");
  const token = typeof tokenRaw === "string" ? tokenRaw : "";
  const newPassword = typeof newPwRaw === "string" ? newPwRaw : "";
  const confirmNew = typeof confirmRaw === "string" ? confirmRaw : "";

  if (!token) redirect("/admin/password-reset");

  function failBack(code: string): never {
    const params = new URLSearchParams({ error: code });
    redirect(
      `/admin/password-reset/${encodeURIComponent(token)}?${params.toString()}`
    );
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) failBack("short");
  if (newPassword !== confirmNew) failBack("mismatch");

  const adminClient = createSupabaseAdminClient();
  const hash = await hashResetToken(token);
  const { data: row } = await adminClient
    .from("account_password_requests")
    .select(
      "id, staff_id, status, expires_at, encrypted_payload, payload_cipher_version"
    )
    .eq("encrypted_payload", hash)
    .eq("payload_cipher_version", CURRENT_CIPHER_VERSION)
    .maybeSingle<CandidateRow>();

  async function logRejection(targetId: string | null, reason: string) {
    await adminClient.from("audit_logs").insert({
      actor_staff_id: null,
      action_type: "password_reset_token_rejected",
      target_type: "account_password_requests",
      target_id: targetId,
      after_state: { reason },
    });
  }

  if (!row) {
    await logRejection(null, "no_match");
    failBack("invalid");
  }
  // Defence-in-depth: verifyResetToken constant-time-compares the hash again.
  const verified = await verifyResetToken(token, {
    encrypted_payload: row.encrypted_payload,
    payload_cipher_version: row.payload_cipher_version,
  });
  if (!verified) {
    await logRejection(row.id, "hash_mismatch");
    failBack("invalid");
  }
  if (row.status === "used") {
    await logRejection(row.id, "already_used");
    failBack("expired");
  }
  if (row.status !== "approved") {
    await logRejection(row.id, `status_${row.status}`);
    failBack("invalid");
  }
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await logRejection(row.id, "expired");
    failBack("expired");
  }

  // Resolve auth_user_id + email for the Supabase Auth admin call.
  const { data: staff } = await adminClient
    .from("staff_profiles")
    .select("id, auth_user_id, name")
    .eq("id", row.staff_id)
    .maybeSingle();
  if (!staff?.auth_user_id) {
    await logRejection(row.id, "staff_missing");
    failBack("invalid");
  }

  const { error: updatePwError } =
    await adminClient.auth.admin.updateUserById(staff.auth_user_id, {
      password: newPassword,
    });
  if (updatePwError) {
    console.error("auth.admin.updateUserById error:", updatePwError);
    await logRejection(row.id, "auth_update_failed");
    failBack("auth");
  }

  await adminClient
    .from("account_password_requests")
    .update({ status: "used" })
    .eq("id", row.id);

  await adminClient.from("audit_logs").insert({
    actor_staff_id: staff.id,
    action_type: "password_reset_completed",
    target_type: "account_password_requests",
    target_id: row.id,
    after_state: { staff_id: staff.id },
  });

  // Fetch the email to sign the staff member in.
  const { data: authUserResult } =
    await adminClient.auth.admin.getUserById(staff.auth_user_id);
  const userEmail = authUserResult?.user?.email ?? null;

  await clearRequestCookie();

  if (userEmail) {
    const serverClient = await createSupabaseServerClient();
    await serverClient.auth.signInWithPassword({
      email: userEmail,
      password: newPassword,
    });
  }

  redirect("/admin/dashboard");
}
