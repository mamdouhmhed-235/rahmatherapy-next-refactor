"use server";

// data-redesign-backend="FAKE"
//
// These server actions are wired through `<form action={…}>` and preserve the
// forward-looking signatures from the brief Feature Preservation Manifest:
//   - approvePasswordResetRequest({ requestId, reviewerNote? })
//   - rejectPasswordResetRequest({ requestId, reviewerNote })
//
// Real wiring blocks on three outstanding BUILD plans:
//   - BUILD-rbac-permission-account-password-requests.md (Layer 0 #1)
//   - BUILD-password-reset-email-templates.md            (Layer 0 #2)
//   - BUILD-approve-reject-password-reset.md             (Layer 1 #25)
//
// Until those land the handlers no-op (no Supabase Auth admin-API call, no
// Resend send, no DB write, no audit log) and revalidate the page so the
// optimistic UI can re-fetch the unchanged row list.

import { revalidatePath } from "next/cache";

export type ReviewActionResult =
  | { ok: true }
  | { ok: false; code: "validation"; message: string }
  | { ok: false; code: "race"; otherReviewer: string }
  | { ok: false; code: "self_approval" }
  | { ok: false; code: "server"; message: string };

const FAKE_DELAY_MS = 320;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function approvePasswordResetRequest(
  formData: FormData
): Promise<ReviewActionResult> {
  const requestId = String(formData.get("requestId") ?? "");
  const reviewerNote = String(formData.get("reviewer_note") ?? "").trim();

  if (!requestId) {
    return { ok: false, code: "validation", message: "Missing request id." };
  }
  if (reviewerNote.length > 240) {
    return {
      ok: false,
      code: "validation",
      message: "Trim the note to 240 characters or fewer.",
    };
  }

  // FAKE: simulate network latency so the spinner pattern is visible.
  await sleep(FAKE_DELAY_MS);

  // Real implementation will:
  //   1. SELECT row WHERE id = requestId FOR UPDATE; verify status = 'pending'
  //   2. Refuse if reviewed_by === current user (self-approval guard)
  //   3. Call supabase.auth.admin.generateLink({ type: 'recovery', email })
  //   4. UPDATE row: status='approved', reviewer_note, reviewed_by, reviewed_at,
  //      encrypted_token_payload
  //   5. Send `password_reset_approved` email via Resend
  //   6. INSERT into audit_logs (action='password_reset_approved')

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
  if (reviewerNote.length > 240) {
    return {
      ok: false,
      code: "validation",
      message: "Trim the note to 240 characters or fewer.",
    };
  }

  await sleep(FAKE_DELAY_MS);

  // Real implementation will:
  //   1. SELECT row FOR UPDATE; verify status = 'pending'
  //   2. UPDATE row: status='rejected', reviewer_note, reviewed_by, reviewed_at
  //   3. Send `password_reset_rejected` email via Resend
  //   4. INSERT into audit_logs (action='password_reset_rejected')

  revalidatePath("/admin/account-password-requests");
  return { ok: true };
}
