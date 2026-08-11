"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requirePermission, PERMISSIONS } from "@/lib/auth/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TAGS } from "@/lib/cache/tag-taxonomy";

export interface SettingsActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
}

function parseFreeTravelCities(value: string) {
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
  const cancellationCutoffHours = Number(
    formData.get("customer_cancellation_cutoff_hours")
  );
  const freeTravelCities = parseFreeTravelCities(
    String(formData.get("free_travel_cities") ?? "")
  );
  // Absent (not empty) means the field was never submitted — an Admin's form
  // renders it disabled, and browsers omit disabled inputs from FormData. Only
  // a submitted field can count as a change, or every Admin save would look
  // like an attempt to edit the origin and be rejected.
  const mileageOriginRaw = formData.get("mileage_origin");
  const mileageOriginSubmitted = mileageOriginRaw !== null;
  const mileageOrigin = String(mileageOriginRaw ?? "").trim() || null;

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
  if (!Number.isInteger(cancellationCutoffHours) || cancellationCutoffHours < 0) {
    fieldErrors.customer_cancellation_cutoff_hours =
      "Enter a cancellation cutoff of 0 hours or more.";
  }
  if (freeTravelCities.length === 0) {
    fieldErrors.free_travel_cities = "Enter at least one free-travel area.";
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

  // Normalise both sides to `string | null` before comparing. The stored value
  // is NULL until an owner sets one, and a raw "" from the form is never equal
  // to NULL under `!==` — comparing them un-normalised would mark every save as
  // a change and lock Admins out of the settings page entirely.
  const currentMileageOrigin =
    (beforeState?.mileage_origin as string | null | undefined) ?? null;
  if (
    mileageOriginSubmitted &&
    mileageOrigin !== currentMileageOrigin &&
    !actor.permissions.has(PERMISSIONS.MANAGE_TRAVEL_ORIGIN)
  ) {
    return {
      fieldErrors: {
        mileage_origin: "Only the practice owner can change the mileage origin.",
      },
    };
  }

  const payload = {
    id: 1,
    company_name: companyName,
    contact_email: contactEmail || null,
    contact_phone: contactPhone || null,
    booking_window_days: bookingWindowDays,
    buffer_time_mins: bufferTimeMins,
    minimum_notice_hours: minimumNoticeHours,
    customer_cancellation_cutoff_hours: cancellationCutoffHours,
    // ⛔ DUAL-WRITE, deliberate (plan §0.0c, decision 9). `create_booking_request`
    // still reads `allowed_cities` as its live booking gate, so writing only the
    // new column would let the owner edit the free-travel list while the gate
    // silently enforced the stale one. Delete this line in Step Z — after the
    // deploy and the DROP COLUMN — and not before.
    allowed_cities: freeTravelCities,
    free_travel_cities: freeTravelCities,
    booking_status_enabled: formData.get("booking_status_enabled") === "on",
    // Omitted when the field was not submitted, so an Admin's save can never
    // blank out an origin only the owner may set.
    ...(mileageOriginSubmitted ? { mileage_origin: mileageOrigin } : {}),
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

  updateTag(TAGS.SETTINGS);
  updateTag(TAGS.AUDIT);
  // B-149 fix (brief §2.2): resource-tag invalidation is additive — the
  // comprehensive revalidatePath below stays as defence-in-depth for surfaces
  // that read business_settings without going through unstable_cache.
  revalidatePath("/admin/settings");
  return { success: true };
}
