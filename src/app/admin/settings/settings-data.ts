// SERVER ONLY — cached data helper for /admin/settings (C-09 Phase C Step 5).
//
// Permission (MANAGE_SETTINGS) is enforced upstream in page.tsx before this
// helper is called; the fetch itself runs on the admin client.
//
// CACHE HAZARD AUDIT (SHARED-NOTES §15): the returned shape is JSON-safe.
//  - `settings` is the raw `business_settings` row (scalars + a string[]).
//  - `lastChange` is three strings. The `Date` used to build `display` lives
//    entirely INSIDE the fetcher and never crosses the cache boundary; the
//    raw timestamp is carried as `isoTimestamp` (string), which is what the
//    consumer renders into a <time dateTime> attribute.
// No Set / Map / Date is returned.
//
// PRE-EXISTING BEHAVIOUR PRESERVED, with one deliberate client swap: the page
// previously read `business_settings` through the RLS-bound server client.
// `unstable_cache` forbids `cookies()` inside the cached function, so the read
// moved to the admin client — the same client `loadLastChange` already used.
// The row is a single global settings record and the page is owner-gated, so
// the visible result is unchanged.
//
// No pagination params: this surface reads one settings row and one audit row.
// There is no list to bound, so C-16 has nothing to page here.

import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tag-taxonomy";

export interface SettingsLastChange {
  actor: string;
  display: string;
  isoTimestamp: string;
}

/**
 * The `business_settings` columns SettingsForm consumes. Declared here rather
 * than imported because SettingsForm's copy is module-private; the shapes are
 * structurally identical, which is what the assignment in page.tsx relies on.
 */
export interface BusinessSettingsRow {
  company_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  booking_window_days: number;
  buffer_time_mins: number;
  minimum_notice_hours: number;
  customer_cancellation_cutoff_hours: number;
  allowed_cities: string[];
  booking_status_enabled: boolean;
}

export interface SettingsPageData {
  settings: BusinessSettingsRow | null;
  lastChange: SettingsLastChange | null;
}

async function loadLastChange(): Promise<SettingsLastChange | null> {
  try {
    const admin = createSupabaseAdminClient();
    const { data: row } = await admin
      .from("audit_logs")
      .select("actor_staff_id, created_at")
      .eq("target_type", "business_settings")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) return null;

    let actor = "System";
    if (row.actor_staff_id) {
      const { data: staff } = await admin
        .from("staff_profiles")
        .select("name")
        .eq("id", row.actor_staff_id)
        .maybeSingle();
      if (staff?.name) actor = staff.name;
    }

    const date = new Date(row.created_at);
    const display = date.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    return { actor, display, isoTimestamp: row.created_at };
  } catch {
    return null;
  }
}

export async function getSettingsPageData(): Promise<SettingsPageData> {
  const cached = unstable_cache(
    async (): Promise<SettingsPageData> => {
      const admin = createSupabaseAdminClient();
      const [{ data: settings }, lastChange] = await Promise.all([
        admin
          .from("business_settings")
          .select("*")
          .eq("id", 1)
          .single<BusinessSettingsRow>(),
        loadLastChange(),
      ]);
      return { settings: settings ?? null, lastChange };
    },
    ["settings-page"],
    { revalidate: 60, tags: [TAGS.SETTINGS] }
  );
  return cached();
}
