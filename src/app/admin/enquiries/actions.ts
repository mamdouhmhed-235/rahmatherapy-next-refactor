"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod/v4";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PERMISSIONS, requirePermission } from "@/lib/auth/rbac";
import { sendEnquiryLoggedEmail } from "@/lib/email/notifications";
import { TAGS } from "@/lib/cache/tag-taxonomy";

const ENQUIRY_SOURCES = [
  "website",
  "phone",
  "whatsapp",
  "instagram",
  "referral",
  "other",
] as const;
const ENQUIRY_STATUSES = ["new", "contacted", "booked", "closed"] as const;

export interface EnquiryActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
}

const enquirySchema = z.object({
  full_name: z.string().trim().min(1, "Name is required."),
  phone: z.string().trim().optional(),
  email: z.union([z.email("Enter a valid email."), z.literal("")]).optional(),
  source: z.enum(ENQUIRY_SOURCES),
  service_interest: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  assigned_staff_id: z.string().trim().optional(),
});

async function requireEnquiryManager() {
  const supabase = await createSupabaseServerClient();
  return requirePermission(PERMISSIONS.MANAGE_ENQUIRIES, supabase);
}

function toFieldErrors(error: z.ZodError) {
  return Object.fromEntries(
    Object.entries(z.flattenError(error).fieldErrors).map(([key, value]) => [
      key,
      (value as string[] | undefined)?.[0] ?? "Invalid value.",
    ])
  );
}

export async function createEnquiry(
  _previousState: EnquiryActionState,
  formData: FormData
): Promise<EnquiryActionState> {
  let actor;
  try {
    actor = await requireEnquiryManager();
  } catch {
    return { error: "Insufficient permissions." };
  }

  const parsed = enquirySchema.safeParse({
    full_name: formData.get("full_name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    source: formData.get("source"),
    service_interest: formData.get("service_interest"),
    notes: formData.get("notes"),
    assigned_staff_id: formData.get("assigned_staff_id"),
  });

  if (!parsed.success) {
    return {
      error: "Check the enquiry details.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const adminClient = createSupabaseAdminClient();
  const payload = {
    full_name: parsed.data.full_name,
    phone: parsed.data.phone || null,
    email: parsed.data.email?.trim().toLowerCase() || null,
    source: parsed.data.source,
    service_interest: parsed.data.service_interest || null,
    notes: parsed.data.notes || null,
    assigned_staff_id: parsed.data.assigned_staff_id || null,
    created_by_staff_id: actor.id,
  };

  const { data, error } = await adminClient
    .from("enquiries")
    .insert(payload)
    .select()
    .single();

  if (error) return { error: error.message };

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "enquiry_created",
    target_type: "enquiries",
    target_id: data.id,
    after_state: {
      source: payload.source,
      status: data.status,
      assigned_staff_id: payload.assigned_staff_id,
    },
  });

  // C-08 Phase D Step 16 — alert opted-in Owner/Admin recipients (skip-self
  // via actor.id). Catch-and-continue: a failed alert must never fail an
  // enquiry that was already successfully created.
  await sendEnquiryLoggedEmail(data.id, actor.id, adminClient).catch((error) => {
    console.error("Unable to send enquiry_logged email.", error);
  });

  updateTag("report-data");
  updateTag("dashboard-data");
  updateTag(TAGS.ENQUIRIES);
  updateTag(TAGS.AUDIT);
  // C-09 Phase B fix round: sendEnquiryLoggedEmail routes through
  // sendTrackedEmail, which writes an email_delivery_events row — this
  // notification would never appear on /admin/emails once Phase C caches
  // that page on the emails tag without this.
  updateTag(TAGS.EMAILS);
  revalidatePath("/admin/enquiries");
  revalidatePath("/admin/dashboard");
  return { success: true };
}

export async function updateEnquiryStatus(formData: FormData) {
  let actor;
  try {
    actor = await requireEnquiryManager();
  } catch {
    return { error: "Insufficient permissions." };
  }

  const enquiryId = String(formData.get("enquiry_id") ?? "").trim();
  const status = String(formData.get("status") ?? "");
  if (!enquiryId) return { error: "Enquiry is required." };
  if (!ENQUIRY_STATUSES.includes(status as (typeof ENQUIRY_STATUSES)[number])) {
    return { error: "Choose a valid enquiry status." };
  }

  const adminClient = createSupabaseAdminClient();
  const { data: beforeState } = await adminClient
    .from("enquiries")
    .select("*")
    .eq("id", enquiryId)
    .single();

  if (!beforeState) return { error: "Enquiry not found." };

  // B-2 idempotent guard (per AUDIT-2026-05-22 H4): stamp first_contacted_at only on
  // the first transition to 'contacted'. Later transitions (contacted→booked etc.) leave
  // the timestamp unchanged so the time-to-first-contact metric measures the original
  // contact event, not the most recent status edit.
  const updatePayload: Record<string, unknown> = { status };
  if (status === "contacted" && beforeState.first_contacted_at == null) {
    updatePayload.first_contacted_at = new Date().toISOString();
  }

  const { data, error } = await adminClient
    .from("enquiries")
    .update(updatePayload)
    .eq("id", enquiryId)
    .select()
    .single();

  if (error) return { error: error.message };

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "enquiry_status_updated",
    target_type: "enquiries",
    target_id: enquiryId,
    before_state: { status: beforeState.status },
    after_state: { status: data.status },
  });

  updateTag("report-data");
  updateTag("dashboard-data");
  updateTag(TAGS.ENQUIRIES);
  updateTag(TAGS.AUDIT);
  revalidatePath("/admin/enquiries");
  revalidatePath("/admin/dashboard");
  // Return previous status so client can offer Undo (DESIGN.md Status Communication
  // — recovery-toast pattern). Counter-call is `updateEnquiryStatus` with
  // status = previousStatus.
  return { success: true, previousStatus: beforeState.status as string };
}
