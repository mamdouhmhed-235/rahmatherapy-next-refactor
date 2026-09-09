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

/**
 * ⚠️ `resetLinkUrl` is present only on the APPROVE success path, and it is the one
 * and only chance to see it: the database keeps a one-way hash, so once this result
 * is discarded the link cannot be produced again by anything. Show it to the
 * reviewer; treat it exactly like a password.
 *
 * `emailSent` false is NOT a failure — the approval stands and the link is valid.
 * It means the reviewer has to pass the link on themselves.
 */
export type ReviewActionResult =
  | {
      ok: true;
      resetLinkUrl?: string;
      recipientEmail?: string;
      expiresInHours?: number;
      emailSent?: boolean;
      emailError?: string | null;
    }
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

  // ⛔ EVERYTHING THAT MUST SURVIVE HAPPENS BEFORE THE EMAIL.
  //
  // This ordering used to be the other way round, and it was a trap. The row was
  // already marked approved above, and the plaintext token exists ONLY in this
  // function's memory — the database stores a one-way hash, so it can never be
  // recovered afterwards. If the send then failed, the action returned an error
  // while leaving behind a request that was approved, whose only valid token had
  // been destroyed, and with no audit row saying approval ever happened. The
  // reviewer could not even retry, because the row was no longer "pending".
  //
  // ⚠️ A slow provider is enough to trigger it — sendEmail has a timeout, so a
  // timed-out send is indistinguishable from a hard failure here.
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
  // ⛔ NO CACHE INVALIDATION HERE AT ALL — not revalidatePath, not updateTag.
  //
  // Either one destroys the thing this function exists to return. Refreshing this
  // page re-renders the request list; the approved row leaves the Pending tab; the
  // ApproveModal rendered inside that row UNMOUNTS; its `useActionState` result — the
  // only copy of the one-time link that will ever exist — is gone. The database keeps
  // a one-way hash, so the approval is spent and the requester must start over.
  //
  // ⚠️ I removed `revalidatePath` first and thought that was enough. It was not, and
  // the comment I left claiming this page "does not read the audit tag" was simply
  // wrong: `password-requests-data.ts:183,214` caches the list with
  // `tags: [TAGS.AUDIT, TAGS.STAFF]`, and its own header at :46-49 says outright that
  // approve/reject's `updateTag(TAGS.AUDIT)` is what invalidates it. So the tag call
  // was doing exactly the damage the removed line had been doing. Verified failing
  // 3/3 in a browser before this second fix.
  //
  // Invalidation is deferred to `finishApprovalRefresh()` below, which the modal calls
  // when the reviewer clicks Done — i.e. once the link has been read and copied.
  // ⚠️ Until then this page and /admin/audit may be up to 60s stale (their own
  // `revalidate: 60`), which is the correct trade: briefly stale beats permanently
  // destroyed.

  // ⛔ getSiteUrl() THROWS when NEXT_PUBLIC_SITE_URL is unset, and it used to sit
  // outside the try/catch — an uncaught server-action rejection AFTER the row was
  // committed, i.e. a generic error page and a destroyed token. It is inside now,
  // so a misconfigured environment degrades to "here is the path, add your domain"
  // instead of losing the approval.
  let resetLinkUrl: string;
  try {
    resetLinkUrl = `${getSiteUrl()}/admin/password-reset/${token}`;
  } catch {
    resetLinkUrl = `/admin/password-reset/${token}`;
  }

  // The email is best-effort from here. It is the delivery van, not the lock: the
  // token is verified by hashing whatever the recipient presents, so a failed send
  // costs convenience, never correctness. The reviewer is handed the same link on
  // screen and can pass it on themselves.
  let emailSent = false;
  let emailError: string | null = null;

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
    emailSent = true;
  } catch (sendErr) {
    emailError =
      sendErr instanceof EmailDeliveryError
        ? sendErr.message
        : "Email could not be sent.";
    console.error("approvePasswordResetRequest email error:", sendErr);
  }

  // ⚠️ The link is returned on BOTH paths. This is the only moment it can be — it
  // is unrecoverable once this function returns.
  return {
    ok: true,
    resetLinkUrl,
    recipientEmail: requester.email,
    expiresInHours: REQUEST_TTL_HOURS,
    emailSent,
    emailError,
  };
}

/**
 * Flush the caches that `approvePasswordResetRequest` deliberately left alone.
 *
 * ⛔ Called by ApproveModal's **Done** button, never by the approve action itself.
 * The approval writes its row immediately; only the cache refresh is deferred, and
 * only because refreshing unmounts the dialog holding the one-time link. By the time
 * this runs the reviewer has had their chance to copy it, so the remount is harmless.
 *
 * ⚠️ Safe to call at any time and safe to miss: if the reviewer closes the tab instead
 * of clicking Done, both caches self-heal within their own 60-second window. Nothing
 * here can fail in a way that matters, so it returns nothing.
 */
export async function finishApprovalRefresh(): Promise<void> {
  const reviewer = await requireReviewer();
  // Not a security boundary — it only busts a cache — but there is no reason to let an
  // unauthenticated caller poke it either.
  if (!reviewer) return;

  updateTag(TAGS.AUDIT);
  revalidatePath("/admin/account-password-requests");
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

  // Same best-effort treatment as approve, for the same reason: the rejection is
  // already committed above and cannot be undone from this screen. Failing here
  // would report "couldn't reject" for a request that IS rejected.
  //
  // ⚠️ Unlike approve there is nothing irreplaceable to hand over — the email only
  // tells the person the answer was no — so a failed send costs a notification, not
  // an action. Nothing is returned to the reviewer beyond success.
  let emailInput: PasswordResetRejectedEmailInput;
  try {
    emailInput = {
      companyName: COMPANY_NAME,
      recipientName: requester.name ?? requester.email,
      reviewerNote,
      retryUrl: `${getSiteUrl()}/admin/password-reset`,
    };
  } catch {
    emailInput = {
      companyName: COMPANY_NAME,
      recipientName: requester.name ?? requester.email,
      reviewerNote,
      retryUrl: "/admin/password-reset",
    };
  }

  try {
    await sendEmail({
      to: requester.email,
      subject: renderPasswordResetRejectedSubject(),
      html: renderPasswordResetRejectedHtml(emailInput),
      text: renderPasswordResetRejectedText(emailInput),
    });
  } catch (sendErr) {
    console.error("rejectPasswordResetRequest email error:", sendErr);
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
