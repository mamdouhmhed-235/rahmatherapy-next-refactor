"use server";

import { z } from "zod/v4";
import { updateTag } from "next/cache";
import { canManageEmailTemplates, getStaffProfile } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TAGS } from "@/lib/cache/tag-taxonomy";
import { NOTIFICATION_ALERT_TYPES } from "./alert-types";

const notificationEmailSchema = z.union([
  z.email("Enter a valid email address."),
  z.literal(""),
]);

export interface SaveNotificationSettingsState {
  success?: boolean;
  error?: string;
}

interface StoredPrefs {
  enabled?: boolean;
  types?: Record<string, boolean>;
}

/**
 * Persists the signed-in Owner/Admin's own business-notification settings.
 * Mirrors `saveThemePreference` (admin/components/theme-actions.ts, the
 * C-11 precedent): the session is resolved first, the write is scoped to
 * the caller's own profile id (never a target id from the form), and the
 * admin client is only created once that profile — and the role gate — has
 * been checked.
 */
export async function saveNotificationSettings(
  _previousState: SaveNotificationSettingsState,
  formData: FormData
): Promise<SaveNotificationSettingsState> {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile || !profile.active || !canManageEmailTemplates(profile)) {
    return { error: "Insufficient permissions." };
  }

  const emailParsed = notificationEmailSchema.safeParse(
    String(formData.get("notification_email") ?? "").trim()
  );
  if (!emailParsed.success) {
    return { error: "Enter a valid email address." };
  }
  const notificationEmail = emailParsed.data || null;

  const adminClient = createSupabaseAdminClient();

  const { data: beforeRow } = await adminClient
    .from("staff_profiles")
    .select("notification_email, business_notification_prefs")
    .eq("id", profile.id)
    .single();
  const beforePrefs = (beforeRow?.business_notification_prefs ??
    null) as StoredPrefs | null;

  const enabled = formData.get("enabled") === "on";

  // The per-type checkboxes are `disabled` in the UI while the master
  // toggle is off, so a browser never submits them in that case — preserve
  // whatever per-type prefs were already stored rather than reading their
  // absence as "opt out of everything". Only when the toggle is genuinely
  // on do the submitted checkbox states become the new source of truth.
  let types: Record<string, boolean> | undefined;
  if (enabled) {
    types = {};
    for (const type of NOTIFICATION_ALERT_TYPES) {
      if (formData.get(`type_${type}`) !== "on") {
        types[type] = false;
      }
    }
  } else {
    types = beforePrefs?.types;
  }

  const prefsPayload: StoredPrefs =
    types && Object.keys(types).length > 0 ? { enabled, types } : { enabled };

  const { error } = await adminClient
    .from("staff_profiles")
    .update({
      notification_email: notificationEmail,
      business_notification_prefs: prefsPayload,
    })
    .eq("id", profile.id);

  if (error) return { error: "Failed to save notification settings." };

  await adminClient.from("audit_logs").insert({
    actor_staff_id: profile.id,
    action_type: "notification_settings_updated",
    target_type: "staff_profiles",
    target_id: profile.id,
    before_state: {
      notification_email: beforeRow?.notification_email ?? null,
      business_notification_prefs: beforePrefs,
    },
    after_state: {
      notification_email: notificationEmail,
      business_notification_prefs: prefsPayload,
    },
  });
  updateTag(TAGS.AUDIT);

  return { success: true };
}
