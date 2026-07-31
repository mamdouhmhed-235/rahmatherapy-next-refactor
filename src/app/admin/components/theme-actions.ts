"use server";

import { z } from "zod/v4";
import { getStaffProfile } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const themeSchema = z.enum(["dark", "light", "system"]);

/**
 * Persists the signed-in staff member's admin theme choice.
 *
 * The write is scoped to the caller's OWN profile id: the session is resolved
 * first, and the service-role client is only created once a profile exists, so
 * there is no path where an unauthenticated caller reaches an admin-client
 * write. The Supabase `error` is returned rather than discarded — a missing
 * grant or a CHECK violation must surface, not fail silently.
 */
export async function saveThemePreference(
  theme: string
): Promise<{ success: boolean; error?: string }> {
  const parsed = themeSchema.safeParse(theme);
  if (!parsed.success) {
    return { success: false, error: "Invalid theme value." };
  }

  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile) return { success: false, error: "Not authenticated." };

  const adminClient = createSupabaseAdminClient();
  const { error } = await adminClient
    .from("staff_profiles")
    .update({ theme_preference: parsed.data })
    .eq("id", profile.id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
