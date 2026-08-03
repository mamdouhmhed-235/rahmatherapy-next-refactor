"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
import { TAGS } from "@/lib/cache/tag-taxonomy";
import {
  CURRENT_CIPHER_VERSION,
  generateResetToken,
  hashResetToken,
} from "@/lib/auth/password-reset-token";
import {
  PasswordResetApprovedEmailInput,
  PasswordResetRejectedEmailInput,
  renderPasswordResetApprovedHtml,
  renderPasswordResetApprovedSubject,
  renderPasswordResetApprovedText,
  renderPasswordResetRejectedHtml,
  renderPasswordResetRejectedSubject,
  renderPasswordResetRejectedText,
} from "@/lib/email/templates";
import {
  EmailDeliveryError,
  getSiteUrl,
  sendEmail,
} from "@/lib/email/client";

export type ReviewActionResult =
  | { ok: true }
  | { ok: false; code: "validation"; message: string }
  | { ok: false; code: "race"; otherReviewer: string }
  | { ok: false; code: "self_approval" }
  | { ok: false; code: "server"; message: string };

const REQUEST_TTL_HOURS = 24;
const NOTE_MAX = 240;
const COMPANY_NAME = "Rahma Therapy";

interface PendingRowSelect {
  id: string;
  staff_id: string;
  status: string;
  reviewed_by: string | null;
}

async function requireReviewer() {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (
    !profile ||
    !profile.active ||
    !profile.permissions.has(PERMISSIONS.MANAGE_ACCOUNT_PASSWORD_REQUESTS)
  ) {
    return null;
  }
  return profile;
}

async function lookupRequester(staffId: string) {
  const adminClient = createSupabaseAdminClient();
  const { data: staff } = await adminClient
    .from("staff_profiles")
    .select("id, name, auth_user_id")
    .eq("id", staffId)
    .maybeSingle();
  if (!staff?.auth_user_id) return null;
  const { data: authResult } = await adminClient.auth.admin.getUserById(
    staff.auth_user_id
  );
  const email = authResult?.user?.email ?? null;
  if (!email) return null;
  return { staffId: staff.id, name: staff.name, email };
}

async function lookupReviewerName(reviewerId: string): Promise<string> {
  const adminClient = createSupabaseAdminClient();
  const { data } = await adminClient
    .from("staff_profiles")
    .select("name")
    .eq("id", reviewerId)
    .maybeSingle();
  return data?.name ?? "another reviewer";
}

export async function approvePasswordResetRequest(
  formData: FormData
): Promise<ReviewActionResult> {
  const requestId = String(formData.get("requestId") ?? "");
  const reviewerNote = String(formData.get("reviewer_note") ?? "").trim();

  if (!requestId) {
    return { ok: false, code: "validation", message: "Missing request id." };
  }
  if (reviewerNote.length > NOTE_MAX) {
    return {
      ok: false,
      code: "validation",
      message: "Trim the note to 240 characters or fewer.",
    };
  }

  const reviewer = await requireReviewer();
  if (!reviewer) {
    return { ok: false, code: "server", message: "Insufficient permissions." };
  }

  const adminClient = createSupabaseAdminClient();
  const { data: row, error: readError } = await adminClient
    .from("account_password_requests")
    .select("id, staff_id, status, reviewed_by")
    .eq("id", requestId)
    .maybeSingle<PendingRowSelect>();

  if (readError || !row) {
    return {
      ok: false,
      code: "server",
      message: "Couldn't load the request. Refresh and try again.",
    };
  }

  if (row.status !== "pending") {
    const otherReviewer = row.reviewed_by
      ? await lookupReviewerName(row.reviewed_by)
      : "another reviewer";
    return { ok: false, code: "race", otherReviewer };
  }

  if (row.staff_id === reviewer.id) {
    return { ok: false, code: "self_approval" };
  }

  const requester = await lookupRequester(row.staff_id);
  if (!requester) {
    return {
      ok: false,
      code: "server",
      message: "The requester's account couldn't be loaded.",
    };
  }

  const token = generateResetToken();
  const hash = await hashResetToken(token);
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + REQUEST_TTL_HOURS * 60 * 60 * 1000
  );

  const { data: updated, error: updateError } = await adminClient
    .from("account_password_requests")
    .update({
      status: "approved",
      encrypted_payload: hash,
      payload_cipher_version: CURRENT_CIPHER_VERSION,
      expires_at: expiresAt.toISOString(),
      reviewed_by: reviewer.id,
      reviewed_at: now.toISOString(),
      reviewer_note: reviewerNote || null,
    })
    .eq("id", requestId)
    .eq("status", "pending") // belt-and-braces against a concurrent state change.
    .select("id");

  if (updateError) {
    console.error("approvePasswordResetRequest update error:", updateError);
    return {
      ok: false,
      code: "server",
      message: "Couldn't save the approval. Try again.",
    };
  }
  if (!updated || updated.length === 0) {
    // The `.eq("status", "pending")` filter matched zero rows — a concurrent
    // reviewer beat us to it between the SELECT above and this UPDATE.
    // Re-read the row so we can attribute the conflict to the right reviewer.
    const { data: currentRow } = await adminClient
      .from("account_password_requests")
      .select("reviewed_by")
      .eq("id", requestId)
      .maybeSingle<{ reviewed_by: string | null }>();
    const otherReviewer = currentRow?.reviewed_by
      ? await lookupReviewerName(currentRow.reviewed_by)
      : "another reviewer";
    return { ok: false, code: "race", otherReviewer };
  }

  const resetLinkUrl = `${getSiteUrl()}/admin/password-reset/${token}`;
  const emailInput: PasswordResetApprovedEmailInput = {
    companyName: COMPANY_NAME,
    recipientName: requester.name ?? requester.email,
    resetLinkUrl,
    expiresInHours: REQUEST_TTL_HOURS,
  };

  try {
    await sendEmail({
      to: requester.email,
      subject: renderPasswordResetApprovedSubject(),
      html: renderPasswordResetApprovedHtml(emailInput),
      text: renderPasswordResetApprovedText(emailInput),
    });
  } catch (sendErr) {
    const message =
      sendErr instanceof EmailDeliveryError
        ? sendErr.message
        : "Email could not be sent.";
    console.error("approvePasswordResetRequest email error:", sendErr);
    return { ok: false, code: "server", message };
  }

  await adminClient.from("audit_logs").insert({
    actor_staff_id: reviewer.id,
    action_type: "password_reset_approved",
    target_type: "account_password_requests",
    target_id: row.id,
    after_state: {
      staff_id: row.staff_id,
      reviewer_note: reviewerNote || null,
      expires_at: expiresAt.toISOString(),
    },
  });
  updateTag(TAGS.AUDIT);

  revalidatePath("/admin/account-password-requests");
  return { ok: true };
}

export async function rejectPasswordResetRequest(
  formData: FormData
): Promise<ReviewActionResult> {
  const requestId = String(formData.get("requestId") ?? "");
  const reviewerNote = String(formData.get("reviewer_note") ?? "").trim();

  if (!requestId) {
    return { ok: false, code: "validation", message: "Missing request id." };
  }
  if (!reviewerNote) {
    return {
      ok: false,
      code: "validation",
      message: "Add a note before rejecting. The requester needs to know why.",
    };
  }
  if (reviewerNote.length > NOTE_MAX) {
    return {
      ok: false,
      code: "validation",
      message: "Trim the note to 240 characters or fewer.",
    };
  }

  const reviewer = await requireReviewer();
  if (!reviewer) {
    return { ok: false, code: "server", message: "Insufficient permissions." };
  }

  const adminClient = createSupabaseAdminClient();
  const { data: row } = await adminClient
    .from("account_password_requests")
    .select("id, staff_id, status, reviewed_by")
    .eq("id", requestId)
    .maybeSingle<PendingRowSelect>();

  if (!row) {
    return {
      ok: false,
      code: "server",
      message: "Couldn't load the request. Refresh and try again.",
    };
  }
  if (row.status !== "pending") {
    const otherReviewer = row.reviewed_by
      ? await lookupReviewerName(row.reviewed_by)
      : "another reviewer";
    return { ok: false, code: "race", otherReviewer };
  }

  const requester = await lookupRequester(row.staff_id);
  if (!requester) {
    return {
      ok: false,
      code: "server",
      message: "The requester's account couldn't be loaded.",
    };
  }

  const now = new Date();
  const { data: updated, error: updateError } = await adminClient
    .from("account_password_requests")
    .update({
      status: "rejected",
      reviewed_by: reviewer.id,
      reviewed_at: now.toISOString(),
      reviewer_note: reviewerNote,
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id");

  if (updateError) {
    console.error("rejectPasswordResetRequest update error:", updateError);
    return {
      ok: false,
      code: "server",
      message: "Couldn't save the rejection. Try again.",
    };
  }
  if (!updated || updated.length === 0) {
    const { data: currentRow } = await adminClient
      .from("account_password_requests")
      .select("reviewed_by")
      .eq("id", requestId)
      .maybeSingle<{ reviewed_by: string | null }>();
    const otherReviewer = currentRow?.reviewed_by
      ? await lookupReviewerName(currentRow.reviewed_by)
      : "another reviewer";
    return { ok: false, code: "race", otherReviewer };
  }

  const emailInput: PasswordResetRejectedEmailInput = {
    companyName: COMPANY_NAME,
    recipientName: requester.name ?? requester.email,
    reviewerNote,
    retryUrl: `${getSiteUrl()}/admin/password-reset`,
  };

  try {
    await sendEmail({
      to: requester.email,
      subject: renderPasswordResetRejectedSubject(),
      html: renderPasswordResetRejectedHtml(emailInput),
      text: renderPasswordResetRejectedText(emailInput),
    });
  } catch (sendErr) {
    const message =
      sendErr instanceof EmailDeliveryError
        ? sendErr.message
        : "Email could not be sent.";
    console.error("rejectPasswordResetRequest email error:", sendErr);
    return { ok: false, code: "server", message };
  }

  await adminClient.from("audit_logs").insert({
    actor_staff_id: reviewer.id,
    action_type: "password_reset_rejected",
    target_type: "account_password_requests",
    target_id: row.id,
    after_state: {
      staff_id: row.staff_id,
      reviewer_note: reviewerNote,
    },
  });
  updateTag(TAGS.AUDIT);

  revalidatePath("/admin/account-password-requests");
  return { ok: true };
}
