"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { PERMISSIONS, requirePermission } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  revalidatePath("/admin/privacy");
  revalidatePath(`/admin/clients/${before.client_id}`);
  return { success: true };
}
