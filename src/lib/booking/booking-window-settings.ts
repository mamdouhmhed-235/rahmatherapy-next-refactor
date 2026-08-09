// SERVER ONLY — the two business_settings values the public booking dialog's
// date picker needs in order to draw the booking window (C-14 Phase D, Step 4).
//
// The dialog has no server entry of its own: it mounts client-only through
// BookingExperienceLoader (ssr:false) from src/app/(public)/layout.tsx, so the
// layout is where the settings enter the client tree.
//
// Failure-tolerant by design. Any error — missing row, missing service-role
// env at build time, network — returns null, and the picker keeps exactly the
// behaviour it had before this existed (past days and fully-booked days
// disabled, no window bound). This must never throw into a page render.
//
// CACHE HAZARD AUDIT (SHARED-NOTES §15): the returned shape is two numbers.
// No Set / Map / Date crosses the cache boundary. Deliberately so — the bounds
// themselves are derived from these numbers on the VISITOR's clock inside
// ScheduleStep, so a cached (or prerendered) page can never bake in a stale
// "today".
//
// unstable_cache forbids cookies(), so the read runs on the admin client — the
// same trade-off, for the same reason, as src/app/admin/settings/settings-data.ts.
// It exposes nothing an anonymous visitor cannot already infer from
// /api/availability, which is itself a public service-role read.

import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tag-taxonomy";

export interface PublicBookingWindow {
  bookingWindowDays: number;
  minimumNoticeHours: number;
}

export async function getPublicBookingWindow(): Promise<PublicBookingWindow | null> {
  const cached = unstable_cache(
    async (): Promise<PublicBookingWindow | null> => {
      try {
        const admin = createSupabaseAdminClient();
        const { data } = await admin
          .from("business_settings")
          .select("booking_window_days, minimum_notice_hours")
          .eq("id", 1)
          .single<{
            booking_window_days: number;
            minimum_notice_hours: number;
          }>();

        if (!data) return null;

        return {
          bookingWindowDays: data.booking_window_days,
          minimumNoticeHours: data.minimum_notice_hours,
        };
      } catch {
        return null;
      }
    },
    ["public-booking-window"],
    { revalidate: 60, tags: [TAGS.SETTINGS] }
  );

  return cached();
}
