"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requirePermission, PERMISSIONS } from "@/lib/auth/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type GenderRestriction = "any" | "male_only" | "female_only";

export interface ServiceFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
}

interface ServicePayload {
  slug: string;
  name: string;
  group_category: string | null;
  short_description: string | null;
  full_description: string | null;
  suitable_for_notes: string | null;
  gender_restrictions: GenderRestriction;
  price: number;
  duration_mins: number;
  is_active: boolean;
  is_visible_on_frontend: boolean;
  display_order: number;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getBooleanValue(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function getTextValue(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function parseServiceFormData(formData: FormData) {
  const fieldErrors: Record<string, string> = {};
  const name = String(formData.get("name") ?? "").trim();
  const submittedSlug = String(formData.get("slug") ?? "").trim();
  const slug = slugify(submittedSlug || name);
  const genderRestriction = String(
    formData.get("gender_restrictions") ?? "any"
  ) as GenderRestriction;
  const price = Number(formData.get("price"));
  const durationMins = Number(formData.get("duration_mins"));
  const displayOrder = Number(formData.get("display_order") ?? 0);

  if (!name) fieldErrors.name = "Name is required.";
  if (!slug) fieldErrors.slug = "Slug is required.";
  if (!["any", "male_only", "female_only"].includes(genderRestriction)) {
    fieldErrors.gender_restrictions = "Choose a valid gender restriction.";
  }
  if (!Number.isFinite(price) || price < 0) {
    fieldErrors.price = "Enter a valid price.";
  }
  if (!Number.isInteger(durationMins) || durationMins <= 0) {
    fieldErrors.duration_mins = "Enter a valid duration.";
  }
  if (!Number.isInteger(displayOrder)) {
    fieldErrors.display_order = "Enter a valid display order.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  const payload: ServicePayload = {
    slug,
    name,
    group_category: getTextValue(formData, "group_category"),
    short_description: getTextValue(formData, "short_description"),
    full_description: getTextValue(formData, "full_description"),
    suitable_for_notes: getTextValue(formData, "suitable_for_notes"),
    gender_restrictions: genderRestriction,
    price,
    duration_mins: durationMins,
    is_active: getBooleanValue(formData, "is_active"),
    is_visible_on_frontend: getBooleanValue(formData, "is_visible_on_frontend"),
    display_order: displayOrder,
  };

  return { payload };
}

async function requireServiceManager() {
  const supabase = await createSupabaseServerClient();
  return requirePermission(PERMISSIONS.MANAGE_SERVICES, supabase);
}

export async function createService(
  _previousState: ServiceFormState,
  formData: FormData
): Promise<ServiceFormState> {
  let actor;
  try {
    actor = await requireServiceManager();
  } catch {
    return { error: "Insufficient permissions." };
  }

  const parsed = parseServiceFormData(formData);
  if ("fieldErrors" in parsed) return { fieldErrors: parsed.fieldErrors };

  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("services")
    .insert(parsed.payload)
    .select()
    .single();

  if (error) return { error: error.message };

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "service_created",
    target_type: "services",
    target_id: data.id,
    after_state: data,
  });

  revalidatePath("/admin/services");

  return { success: true };
}

export async function updateService(
  serviceId: string,
  _previousState: ServiceFormState,
  formData: FormData
): Promise<ServiceFormState> {
  let actor;
  try {
    actor = await requireServiceManager();
  } catch {
    return { error: "Insufficient permissions." };
  }

  const parsed = parseServiceFormData(formData);
  if ("fieldErrors" in parsed) return { fieldErrors: parsed.fieldErrors };

  const adminClient = createSupabaseAdminClient();
  const { data: beforeState } = await adminClient
    .from("services")
    .select("*")
    .eq("id", serviceId)
    .single();

  if (!beforeState) return { error: "Service not found." };

  const { data, error } = await adminClient
    .from("services")
    .update(parsed.payload)
    .eq("id", serviceId)
    .select()
    .single();

  if (error) return { error: error.message };

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "service_updated",
    target_type: "services",
    target_id: serviceId,
    before_state: beforeState,
    after_state: data,
  });

  revalidatePath("/admin/services");

  return { success: true };
}

export async function deleteService(serviceId: string): Promise<{ error?: string }> {
  let actor;
  try {
    actor = await requireServiceManager();
  } catch {
    return { error: "Insufficient permissions." };
  }

  const adminClient = createSupabaseAdminClient();

  const { count, error: usageError } = await adminClient
    .from("booking_items")
    .select("id", { count: "exact", head: true })
    .eq("service_id", serviceId);

  if (usageError) return { error: usageError.message };
  if ((count ?? 0) > 0) {
    return {
      error:
        "This service has booking snapshots. Deactivate it instead of deleting it.",
    };
  }

  const { data: beforeState } = await adminClient
    .from("services")
    .select("*")
    .eq("id", serviceId)
    .single();

  if (!beforeState) return { error: "Service not found." };

  const { error } = await adminClient
    .from("services")
    .delete()
    .eq("id", serviceId);

  if (error) return { error: error.message };

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "service_deleted",
    target_type: "services",
    target_id: serviceId,
    before_state: beforeState,
  });

  revalidatePath("/admin/services");

  return {};
}
