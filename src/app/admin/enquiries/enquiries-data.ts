// SERVER ONLY — cached data helper for /admin/enquiries (C-09 Phase C Step 5).
//
// Access (canManageEnquiries) is enforced upstream in page.tsx; the reads run
// on the admin client, exactly as they did inline.
//
// CACHE HAZARD AUDIT (SHARED-NOTES §15): the returned shape is JSON-safe.
//  - `enquiries` and `staff` are plain row arrays of scalars.
//  - TRANSFORM APPLIED: `staff` is returned as an ARRAY of {id,name}, not the
//    `Map` page.tsx builds from it — a Map re-hydrates as {}. page.tsx builds
//    the Map after the cache boundary.
//  - All timestamps stay ISO strings; the page's date arithmetic and sorting
//    (`new Date(row.created_at).getTime()`) runs on this side of the boundary.
// No Set / Map / Date crosses the boundary.
//
// Tag: `enquiries`, per the plan's Step 5 table. The active-staff dropdown
// rides along in the same entry; a staff rename does not set the enquiries
// tag, so that dropdown can trail by at most the 60s revalidate window.
//
// PAGINATION-READY (C-16): optional `limit` + `offset` flow into BOTH the
// enquiries query and the cache key, so page 2 can never be served page 1's
// rows. Both default to undefined, which reproduces today's unbounded list
// exactly. `countEnquiries` is the cheap head-count companion for C-16's
// "Showing X–Y of Z" readout; it is not called by the page today.
//
// FILTERS: still fetched unfiltered, as before — the page's tab/source/
// assigned/date/q filtering stays in memory until C-09 Phase D Step 8 moves it
// server-side. This step only moves WHERE the fetch happens, never WHAT it
// returns.

import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tag-taxonomy";
import { cacheKeyPart } from "@/lib/cache/cache-key";

const ENQUIRIES_SELECT =
  "id, full_name, phone, email, source, status, service_interest, notes, client_id, converted_booking_id, assigned_staff_id, created_at, updated_at";

export interface EnquiryRecord {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  source: string;
  status: string;
  service_interest: string | null;
  notes: string | null;
  client_id: string | null;
  converted_booking_id: string | null;
  assigned_staff_id: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface EnquiryStaffOption {
  id: string;
  name: string;
}

export interface EnquiriesParams {
  limit?: number;
  offset?: number;
}

export interface EnquiriesPageData {
  enquiries: EnquiryRecord[];
  staff: EnquiryStaffOption[];
}

export async function getEnquiriesPageData(
  params: EnquiriesParams = {}
): Promise<EnquiriesPageData> {
  const { limit, offset } = params;

  const cached = unstable_cache(
    async (): Promise<EnquiriesPageData> => {
      const adminClient = createSupabaseAdminClient();

      let enquiriesQuery = adminClient
        .from("enquiries")
        .select(ENQUIRIES_SELECT)
        .order("created_at", { ascending: false });
      if (limit !== undefined) {
        const start = offset ?? 0;
        enquiriesQuery = enquiriesQuery.range(start, start + limit - 1);
      }

      const [{ data: enquiriesRaw }, { data: staffRaw }] = await Promise.all([
        enquiriesQuery.returns<EnquiryRecord[]>(),
        adminClient
          .from("staff_profiles")
          .select("id, name")
          .eq("active", true)
          .order("name")
          .returns<EnquiryStaffOption[]>(),
      ]);

      return { enquiries: enquiriesRaw ?? [], staff: staffRaw ?? [] };
    },
    ["enquiries-page", cacheKeyPart({ limit, offset })],
    { revalidate: 60, tags: [TAGS.ENQUIRIES] }
  );
  return cached();
}

/**
 * Cheap head-count companion for C-16's "Showing X–Y of Z" readout. Head
 * request — no rows transferred. Not used by the page yet.
 */
export async function countEnquiries(): Promise<number> {
  const cached = unstable_cache(
    async (): Promise<number> => {
      const adminClient = createSupabaseAdminClient();
      const { count, error } = await adminClient
        .from("enquiries")
        .select("id", { count: "exact", head: true });
      if (error) return 0;
      return count ?? 0;
    },
    ["enquiries-count"],
    { revalidate: 60, tags: [TAGS.ENQUIRIES] }
  );
  return cached();
}
