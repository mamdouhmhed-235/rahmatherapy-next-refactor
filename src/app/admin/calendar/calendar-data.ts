// SERVER ONLY — cached data helper for /admin/calendar (C-09 Phase C Step 5).
//
// `getAdminPageAccess(profile, "calendar")` is enforced upstream in page.tsx.
//
// ⛔ `getReportData` narrows BOOKINGS ONLY. An earlier version of this comment
// said it "applies its own RBAC narrowing from the profile it is given", full
// stop, and that sentence is false in the direction that matters: `bookings`,
// `assignments` and `bookingItems` are scoped to the caller, but `clients`,
// `staff`, `enquiries`, `emailEvents` and `operationalEvents` come back as
// whole clinic-wide tables for every profile, including a Therapist holding
// none of VIEW_CLIENTS_ALL, VIEW_STAFF, MANAGE_ENQUIRIES or VIEW_EMAIL_LOGS.
// That is ITEM N, and it is the root cause behind the export exposure fixed as
// ITEM L. Anything reading those five off `data` here must scope them itself.
//
// The cache key still carries `profileId` alongside the serialised filters —
// the same keying convention dashboard-data.ts and reports-data.ts already use,
// and load-bearing precisely BECAUSE the narrowing is profile-dependent.
// The profile object itself is a CLOSURE argument only: it carries a `Set` of
// permissions and must never be keyed or returned (SHARED-NOTES §15).
//
// CACHE HAZARD AUDIT (SHARED-NOTES §15): the returned shape is JSON-safe.
//  - `data` is ReportData, which reports-data.ts already documents as
//    JSON-safe (its `staffAvailabilityRuleStaffIds` is a string[], not a Set —
//    the B-2 cache-Set regression, commit d556278, is the canonical lesson).
//    It is already round-tripped through unstable_cache by dashboard-data.ts
//    and reports-data.ts today.
//  - TRANSFORM APPLIED: the participant and recurring lookups are returned as
//    ROW ARRAYS, not the `participantsByBooking` / `groupInfoByBooking` /
//    `recurringByBooking` Maps the page renders from. A Map re-hydrates as {};
//    page.tsx builds all three Maps after the cache boundary, unchanged.
//  - Every date/time is a string. The page's date arithmetic runs on
//    `getBusinessDate()` / `addBusinessDays()` in page.tsx, on the consumer
//    side, and the resolved range is part of `filters` — so the visible window
//    is never frozen by the 60s revalidate.
// No Set / Map / Date crosses the boundary.
//
// Tags per the plan's Step 5 table: bookings, staff, settings.
//
// PAGINATION (C-16): /admin/calendar is not on C-16's Phase A list and has no
// paged list. Its bound is the selected date range, which is already inside
// `filters` and therefore already part of the cache key — day, week, month and
// range views cache separately, and no window can be served another's rows.
// A limit/offset pair would have nothing to bound.

import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tag-taxonomy";
import { cacheKeyPart } from "@/lib/cache/cache-key";
import type { getStaffProfile } from "@/lib/auth/rbac";
import {
  getReportData,
  type ReportData,
  type ReportFilters,
} from "../reports/reporting";

type Profile = NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>;

/**
 * C-13 Phase E (brief §2.5) — `ReportBooking` carries no participants join and
 * `reporting.ts` is untouchable (RECON §5), so this shape backs a second,
 * separate, read-only query scoped to just the booking ids already on screen.
 */
export interface CalendarParticipantRow {
  id: string;
  booking_id: string;
  display_name: string | null;
  is_main_contact: boolean | null;
}

/**
 * C-02 Phase H (plan Step 22) — same rationale as `CalendarParticipantRow`:
 * `ReportBooking` carries no `recurring_template_id` join and `reporting.ts`
 * is untouchable (RECON §5).
 */
export interface CalendarRecurringRow {
  id: string;
  recurring_template_id: string | null;
  recurring_booking_templates: {
    cadence: "weekly" | "fortnightly" | "monthly";
  } | null;
}

export interface CalendarPageParams {
  /** Closure-only: never keyed, never returned (carries a permissions Set). */
  profile: Profile;
  filters: ReportFilters;
}

export interface CalendarPageData {
  data: ReportData;
  participantRows: CalendarParticipantRow[];
  recurringRows: CalendarRecurringRow[];
}

export async function getCalendarPageData(
  params: CalendarPageParams
): Promise<CalendarPageData> {
  const { profile, filters } = params;

  const cached = unstable_cache(
    async (): Promise<CalendarPageData> => {
      const adminClient = createSupabaseAdminClient();
      const data = await getReportData(adminClient, profile, filters);

      const calendarBookingIds = data.bookings.map((b) => b.id);

      const { data: participantRows } =
        calendarBookingIds.length > 0
          ? await adminClient
              .from("booking_participants")
              .select("id, booking_id, display_name, is_main_contact")
              .in("booking_id", calendarBookingIds)
              .returns<CalendarParticipantRow[]>()
          : { data: [] as CalendarParticipantRow[] };

      const { data: recurringRows } =
        calendarBookingIds.length > 0
          ? await adminClient
              .from("bookings")
              .select("id, recurring_template_id, recurring_booking_templates(cadence)")
              .in("id", calendarBookingIds)
              .not("recurring_template_id", "is", null)
              .returns<CalendarRecurringRow[]>()
          : { data: [] as CalendarRecurringRow[] };

      return {
        data,
        participantRows: participantRows ?? [],
        recurringRows: recurringRows ?? [],
      };
    },
    ["calendar-page", profile.id, cacheKeyPart({ filters })],
    { revalidate: 60, tags: [TAGS.BOOKINGS, TAGS.STAFF, TAGS.SETTINGS] }
  );
  return cached();
}
