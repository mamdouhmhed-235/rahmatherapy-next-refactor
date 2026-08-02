// SERVER ONLY — cached data helper for /admin/staff (C-09 Phase C Step 5).
//
// `getStaffTeamAccess` is evaluated upstream in page.tsx; its scope and the
// RBAC-derived select string come in as params and form part of the cache key,
// so a same-gender-scoped therapist can never be served the admin-scope entry.
// getStaffTeamAccess / getStaffTeamSelect / staffProfilesFrom themselves are
// FPM verbatim-preserved (RECON §5) and are called here unchanged.
//
// CACHE HAZARD AUDIT (SHARED-NOTES §15): the returned shape is JSON-safe.
//  - `staff` rows are scalars plus a nested `roles` object and string arrays.
//  - `assignments` rows are scalars plus a nested `bookings` object.
//  - TRANSFORM APPLIED: the Supabase error objects are reduced to the single
//    boolean `staffLoadError`, which is all page.tsx ever derived from them.
//  - The `new Map(...)` used to de-duplicate the same-gender scope's two reads
//    is consumed inside the fetcher and returned as a sorted array.
//  - Every timestamp stays a string. The page's 7-day workload horizon is
//    computed from `new Date()` in page.tsx, on the consumer side, and compared
//    against the `booking_date`/`start_time` strings returned here — so the
//    horizon is never frozen by the cache.
// No Set / Map / Date crosses the boundary.
//
// NOT CACHED, deliberately: the `roles` lookup stays in page.tsx. It runs on
// the RLS-bound server client, and `cookies()` is forbidden inside a function
// wrapped in unstable_cache; moving it to the admin client would silently drop
// its RLS scoping, which is a security change this step has no mandate to make.
//
// Tags per the plan's Step 5 table: staff, bookings.
//
// PAGINATION (C-16): /admin/staff is NOT on C-16's Phase A list, and the
// directory read deliberately exposes no limit/offset. The query runs through
// `staffProfilesFrom`, whose `StaffProfilesTable` builder type (team-access.ts)
// intentionally surfaces only select/eq/order/maybeSingle — adding `.range` to
// it means editing an RECON §5 FPM verbatim-preserved file, which this step has
// no mandate to do. `countStaff` is provided as the cheap head-count companion;
// it is not called by the page today. If C-16 needs to page the directory it
// must widen that builder type first, deliberately.

import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tag-taxonomy";
import { cacheKeyPart } from "@/lib/cache/cache-key";
import { staffProfilesFrom, type StaffTeamAccess } from "./team-access";

export type StaffRole = { name: string; display_label?: string | null };

export type StaffDirectoryRow = {
  id: string;
  auth_user_id?: string | null;
  name: string;
  email?: string | null;
  role_id?: string | null;
  gender: string | null;
  active: boolean;
  can_take_bookings: boolean;
  availability_mode: string;
  phone?: string | null;
  short_bio?: string | null;
  specialties?: string[] | null;
  languages?: string[] | null;
  service_areas?: string[] | null;
  roles?: StaffRole | null;
};

export type StaffAssignmentRow = {
  assigned_staff_id: string | null;
  status: string;
  bookings: {
    booking_date: string;
    start_time: string;
    status: string;
  } | null;
};

export interface StaffListParams {
  /** `getStaffTeamAccess(profile).scope`. */
  scope: StaffTeamAccess["scope"];
  /** `getStaffTeamSelect(teamAccess)` — the RBAC-narrowed column list. */
  staffSelect: string;
  /** Caller's staff id — the same-gender scope always includes their own row. */
  staffId: string;
  /** Caller's gender — narrows the same-gender scope. */
  staffGender: string | null;
}

export interface StaffListData {
  staff: StaffDirectoryRow[];
  assignments: StaffAssignmentRow[];
  staffLoadError: boolean;
}

export async function getStaffListData(
  params: StaffListParams
): Promise<StaffListData> {
  const { scope, staffSelect, staffId, staffGender } = params;

  const cached = unstable_cache(
    async (): Promise<StaffListData> => {
      const adminClient = createSupabaseAdminClient();
      const staffProfiles = staffProfilesFrom(adminClient);
      let staff: StaffDirectoryRow[] = [];
      let staffLoadError = false;

      // FPM: getStaffTeamAccess / getStaffTeamSelect / staffProfilesFrom are
      // preserved verbatim (RECON §5); only the call site moved here.
      if (scope === "admin") {
        const { data, error } = await staffProfiles
          .select<StaffDirectoryRow[]>(staffSelect)
          .order("name");
        if (error) staffLoadError = true;
        staff = (data ?? []) as unknown as StaffDirectoryRow[];
      } else if (scope === "assignment") {
        const { data, error } = await staffProfiles
          .select<StaffDirectoryRow[]>(staffSelect)
          .eq("active", true)
          .eq("can_take_bookings", true)
          .order("name");
        if (error) staffLoadError = true;
        staff = (data ?? []) as unknown as StaffDirectoryRow[];
      } else if (scope === "same_gender_team") {
        const [sameGenderResult, ownProfileResult] = await Promise.all([
          staffProfiles
            .select<StaffDirectoryRow[]>(staffSelect)
            .eq("active", true)
            .eq("can_take_bookings", true)
            .eq("gender", staffGender)
            .order("name"),
          staffProfiles
            .select<StaffDirectoryRow>(staffSelect)
            .eq("id", staffId)
            .maybeSingle(),
        ]);
        if (sameGenderResult.error || ownProfileResult.error) staffLoadError = true;
        staff = Array.from(
          new Map(
            (
              [
                ...(sameGenderResult.data ?? []),
                ownProfileResult.data,
              ].filter(Boolean) as StaffDirectoryRow[]
            ).map((member) => [member.id, member])
          ).values()
        ).sort((left, right) => left.name.localeCompare(right.name));
      }

      const staffIds = staff.map((member) => member.id);
      const { data: assignments } =
        staffIds.length > 0
          ? await adminClient
              .from("booking_assignments")
              .select(
                "assigned_staff_id, status, bookings(booking_date, start_time, status)"
              )
              .in("assigned_staff_id", staffIds)
          : { data: [] };

      return {
        staff,
        assignments: (assignments ?? []) as unknown as StaffAssignmentRow[],
        staffLoadError,
      };
    },
    [
      "staff-list",
      cacheKeyPart({ scope, staffSelect, staffId, staffGender }),
    ],
    { revalidate: 60, tags: [TAGS.STAFF, TAGS.BOOKINGS] }
  );
  return cached();
}

/**
 * Cheap head-count companion for a future paged directory. Head request — no
 * rows transferred. Not used by the page today.
 */
export async function countStaff(): Promise<number> {
  const cached = unstable_cache(
    async (): Promise<number> => {
      const adminClient = createSupabaseAdminClient();
      const { count, error } = await adminClient
        .from("staff_profiles")
        .select("id", { count: "exact", head: true });
      if (error) return 0;
      return count ?? 0;
    },
    ["staff-count"],
    { revalidate: 60, tags: [TAGS.STAFF] }
  );
  return cached();
}
