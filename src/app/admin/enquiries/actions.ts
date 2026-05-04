"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PERMISSIONS, requirePermission } from "@/lib/auth/rbac";

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
  return requirePermission(PERMISSIONS.MANAGE_CLIENTS, supabase);
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

  const { data, error } = await adminClient
    .from("enquiries")
    .update({ status })
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

  revalidatePath("/admin/enquiries");
  revalidatePath("/admin/dashboard");
  return { success: true };
}
