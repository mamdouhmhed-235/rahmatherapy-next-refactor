"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requirePermission, PERMISSIONS } from "@/lib/auth/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface SettingsActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
}

function parseAllowedCities(value: string) {
  return value
    .split(/[\n,]/)
    .map((city) => city.trim())
    .filter(Boolean);
}

async function requireSettingsManager() {
  const supabase = await createSupabaseServerClient();
  return requirePermission(PERMISSIONS.MANAGE_SETTINGS, supabase);
}

export async function updateBusinessSettings(
  _previousState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  let actor;
  try {
    actor = await requireSettingsManager();
  } catch {
    return { error: "Insufficient permissions." };
  }

  const fieldErrors: Record<string, string> = {};
  const companyName = String(formData.get("company_name") ?? "").trim();
  const contactEmail = String(formData.get("contact_email") ?? "").trim();
  const contactPhone = String(formData.get("contact_phone") ?? "").trim();
  const bookingWindowDays = Number(formData.get("booking_window_days"));
  const bufferTimeMins = Number(formData.get("buffer_time_mins"));
  const minimumNoticeHours = Number(formData.get("minimum_notice_hours"));
  const allowedCities = parseAllowedCities(
    String(formData.get("allowed_cities") ?? "")
  );

  if (!companyName) fieldErrors.company_name = "Company name is required.";
  if (!Number.isInteger(bookingWindowDays) || bookingWindowDays <= 0) {
    fieldErrors.booking_window_days = "Enter a booking window above 0 days.";
  }
  if (!Number.isInteger(bufferTimeMins) || bufferTimeMins < 0) {
    fieldErrors.buffer_time_mins = "Enter a buffer time of 0 minutes or more.";
  }
  if (!Number.isInteger(minimumNoticeHours) || minimumNoticeHours < 0) {
    fieldErrors.minimum_notice_hours =
      "Enter a minimum notice of 0 hours or more.";
  }
  if (allowedCities.length === 0) {
    fieldErrors.allowed_cities = "Enter at least one allowed service area.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  const adminClient = createSupabaseAdminClient();

  const { data: beforeState } = await adminClient
    .from("business_settings")
    .select("*")
    .eq("id", 1)
    .single();

  const payload = {
    id: 1,
    company_name: companyName,
    contact_email: contactEmail || null,
    contact_phone: contactPhone || null,
    booking_window_days: bookingWindowDays,
    buffer_time_mins: bufferTimeMins,
    minimum_notice_hours: minimumNoticeHours,
    allowed_cities: allowedCities,
    booking_status_enabled: formData.get("booking_status_enabled") === "on",
  };

  const { data, error } = await adminClient
    .from("business_settings")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();

  if (error) return { error: error.message };

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "business_settings_updated",
    target_type: "business_settings",
    before_state: beforeState,
    after_state: data,
  });

  revalidatePath("/admin/settings");
  return { success: true };
}
