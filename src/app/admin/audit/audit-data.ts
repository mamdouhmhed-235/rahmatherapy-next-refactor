// SERVER ONLY — cached data helper for /admin/audit (C-09 Phase C Step 5).
//
// Permission (MANAGE_AUDIT_LOGS) is enforced upstream in page.tsx; the reads
// run on the admin client, exactly as they did inline before.
//
// CACHE HAZARD AUDIT (SHARED-NOTES §15): the returned shape is JSON-safe.
//  - `events` are AuditEventRow[] — scalars plus two plain JSON objects.
//  - `nextCursor` is `{ created_at: string; id: string } | null`.
//  - TRANSFORM APPLIED: the staff lookup is returned as an ARRAY of
//    `{ id, name }`, not the `Map<string, string>` the page ultimately uses.
//    A Map round-trips through unstable_cache as `{}`; page.tsx rebuilds the
//    Map from this array AFTER the cache boundary.
// No Set / Map / Date crosses the boundary.
//
// Tag: `audit` only, per the plan's Step 5 table. Staff renames also write an
// audit_logs row (staff/actions.ts sets both TAGS.STAFF and TAGS.AUDIT), so
// the actor-name list here invalidates on the same event.
//
// PAGINATION: this surface already pages by compound cursor rather than
// limit/offset, so `cursor` is the paging param and it is part of the cache
// key — page 2 can never be served page 1's rows. Page size stays
// AUDIT_PAGE_SIZE (unchanged); /admin/audit is not on C-16's limit/offset list.

import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tag-taxonomy";
import { cacheKeyPart } from "@/lib/cache/cache-key";
import {
  fetchAuditPage,
  type AuditCursor,
  type AuditEventRow,
  type AuditFilters,
} from "./queries";

export interface AuditStaffOption {
  id: string;
  name: string;
}

export interface AuditPageData {
  events: AuditEventRow[];
  nextCursor: AuditCursor | null;
  staff: AuditStaffOption[];
}

export interface AuditPageParams {
  filters: AuditFilters;
  cursor?: AuditCursor | null;
}

export async function getAuditPageData(
  params: AuditPageParams
): Promise<AuditPageData> {
  const { filters, cursor = null } = params;
  const cached = unstable_cache(
    async (): Promise<AuditPageData> => {
      const adminClient = createSupabaseAdminClient();
      const [{ rows, nextCursor }, { data: staff }] = await Promise.all([
        fetchAuditPage({ filters, cursor }),
        adminClient.from("staff_profiles").select("id, name"),
      ]);
      return {
        events: rows,
        nextCursor,
        staff: (staff ?? []) as AuditStaffOption[],
      };
    },
    ["audit-page", cacheKeyPart({ filters, cursor })],
    { revalidate: 60, tags: [TAGS.AUDIT] }
  );
  return cached();
}
