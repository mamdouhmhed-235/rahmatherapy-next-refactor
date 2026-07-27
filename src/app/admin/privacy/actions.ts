"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { PERMISSIONS, requirePermission } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteClient } from "../clients/actions";

const privacyStatusSchema = z.object({
  request_id: z.string().uuid(),
  status: z.enum(["open", "reviewing", "completed", "declined"]),
});

export interface PrivacyActionState {
  error?: string;
  success?: boolean;
}

async function requirePrivacyManager() {
  const supabase = await createSupabaseServerClient();
  return requirePermission(PERMISSIONS.MANAGE_PRIVACY_OPERATIONS, supabase);
}

export async function updatePrivacyRequestStatus(
  _previousState: PrivacyActionState,
  formData: FormData
): Promise<PrivacyActionState> {
  let actor;
  try {
    actor = await requirePrivacyManager();
  } catch {
    return { error: "Insufficient permissions." };
  }

  const parsed = privacyStatusSchema.safeParse({
    request_id: formData.get("request_id"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { error: "Choose a valid privacy request status." };
  }

  const adminClient = createSupabaseAdminClient();
  const { data: before, error: fetchError } = await adminClient
    .from("client_privacy_requests")
    .select("id, client_id, request_type, status")
    .eq("id", parsed.data.request_id)
    .single();

  if (fetchError || !before) {
    return { error: fetchError?.message ?? "Privacy request not found." };
  }

  const { error: updateError } = await adminClient
    .from("client_privacy_requests")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.request_id);

  if (updateError) {
    return { error: updateError.message };
  }

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "client_privacy_request_status_updated",
    target_type: "client_privacy_requests",
    target_id: parsed.data.request_id,
    before_state: {
      client_id: before.client_id,
      request_type: before.request_type,
      status: before.status,
    },
    after_state: {
      client_id: before.client_id,
      request_type: before.request_type,
      status: parsed.data.status,
    },
  });

  // Completion branches (brief §2.4). Until now "Completed" only moved a label
  // while the modal promised a deletion and an email that never happened.
  //
  //   deletion_review       → run the erasure the page has always claimed to run
  //   data_export           → nothing to cascade: the JSON is produced by
  //                           `generateClientDataExport`, which the privacy
  //                           manager triggers explicitly from the modal
  //   correction            → manual workflow, status only
  //   sensitive_note_review → manual review, status only
  let erasureError: string | null = null;
  if (
    parsed.data.status === "completed" &&
    before.request_type === "deletion_review"
  ) {
    // Idempotent by design: a client already removed via the Delete button
    // comes back `{ success: true, alreadyDeleted: true }` and the cascade is
    // skipped (brief §5.5). That is a success, not an error.
    const erasure = await deleteClient(
      before.client_id,
      "gdpr_erasure",
      adminClient,
      actor.id
    );
    if (!erasure.success) {
      erasureError =
        erasure.error ?? "The client record could not be erased.";
    }
  }

  revalidatePath("/admin/privacy");
  revalidatePath(`/admin/clients/${before.client_id}`);

  // The status update above already committed, so a failed erasure cannot be
  // reported as a plain "couldn't update the request" — say exactly which half
  // landed, and where to finish the job.
  if (erasureError) {
    return {
      error: `Status saved, but the client record was not erased: ${erasureError} Delete the client from their profile page to finish the erasure.`,
    };
  }

  return { success: true };
}
