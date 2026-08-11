// SERVER ONLY — the free-travel town list the public booking dialog shows
// (item 8 Phase 2).
//
// This exists so the town list has exactly ONE source of truth: the
// business_settings row the admin settings form writes. Before item 8 the same
// list was hardcoded twice more — a five-town constant in the booking schema
// that blocked submission, and a two-town database gate that returned an empty
// calendar — and the three disagreed, which is why a Harpenden customer saw a
// green tick and then no slots at all.
//
// The list is now DISPLAY ONLY. Nothing gates on it: an address outside these
// towns is bookable, and an admin sets the travel charge by hand afterwards.
//
// Mirrors getPublicBookingWindow (booking-window-settings.ts) deliberately:
// same admin client, same 60s revalidate, same TAGS.SETTINGS tag that
// settings/actions.ts already invalidates on save, so changing the towns in
// admin updates the booking page without a deploy. Kept as a separate function
// rather than folded into that one because the two feed different steps and
// its header is a contract about the date window specifically.
//
// Failure-tolerant by design: any error returns an empty list, and callers
// render the notice without a town list rather than throwing into a page.
//
// CACHE HAZARD AUDIT (SHARED-NOTES §15): the returned shape is a string array.
// No Set / Map / Date crosses the cache boundary.
//
// unstable_cache forbids cookies(), so the read runs on the admin client — the
// same trade-off, for the same reason, as booking-window-settings.ts. It
// exposes nothing an anonymous visitor cannot already read on the marketing
// pages.

import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tag-taxonomy";

export async function getFreeTravelCities(): Promise<string[]> {
  const cached = unstable_cache(
    async (): Promise<string[]> => {
      try {
        const admin = createSupabaseAdminClient();
        const { data } = await admin
          .from("business_settings")
          .select("free_travel_cities")
          .eq("id", 1)
          .single<{ free_travel_cities: unknown }>();

        if (!Array.isArray(data?.free_travel_cities)) return [];

        return data.free_travel_cities.filter(
          (city): city is string => typeof city === "string" && city.trim() !== ""
        );
      } catch {
        return [];
      }
    },
    ["public-free-travel-cities"],
    { revalidate: 60, tags: [TAGS.SETTINGS] }
  );

  return cached();
}
