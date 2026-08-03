// SERVER ONLY — cached data helper for /admin/account-password-requests
// (C-16 Phase D Step 12).
//
// Access (getStaffProfile + PERMISSIONS.MANAGE_ACCOUNT_PASSWORD_REQUESTS) is
// enforced upstream in page.tsx before either export below is called.
//
// VERDICT — cap + view-all, NOT a full pager. Phase A's inventory (finding
// N5, `redesign/per-page-progress/C-16-data-growth-pagination-progress.md`
// §2) found this surface fetched the ENTIRE `account_password_requests`
// table with no bound at all, filtered into five status tabs in memory, and
// — unlike privacy/staff — wasn't even cache-wrapped. Growth class is "slow"
// (brief §1.1 / progress §2): the table grows with staff headcount x
// occasional password resets, not customer traffic, and the brief's own
// 5-year projection for this surface is "hundreds" of rows, not tens of
// thousands. Two things specifically make a full pager disproportionate here:
//   1. The "pending" tab is SELF-BOUNDING — a request expires
//      REQUEST_TTL_HOURS (24h) after creation (see actions.ts) or is
//      reviewed within that window, so anything still "pending" is always
//      inside the most-recent-N window below regardless of how large the
//      table's full history grows.
//   2. The five tabs each sort on a DIFFERENT column (pending: expires_at
//      asc; approved/rejected: reviewed_at desc; expired/all: created_at
//      desc — see `filterByStatus` in page.tsx) — a real pager would need
//      server-side sorts and per-tab count queries for each, a lift
//      disproportionate to a slow, staff-only surface (cf. Operations Step
//      11, which got the heavier pager treatment because its growth is
//      "fast" and the alternative is real, unrecoverable data loss).
// Precedent: privacy's sensitive-notes rail (C-16 Step 10) got exactly this
// cap+view-all shape for the same reason (a slow-changing side list) — this
// mirrors its PRIVACY_NOTES_LIMIT / PRIVACY_NOTES_VIEW_ALL_CAP pair.
//
// WHAT HAPPENS WHEN THE BOUND IS HIT: `getPasswordResetRequests` caps the
// query to the PASSWORD_REQUESTS_LIMIT (100) most-recent requests across ALL
// statuses; page.tsx's `filterByStatus` then buckets that capped set into
// tabs in memory, unchanged from before this step. A status tab whose
// entries are older than the cap's recency window simply won't show them —
// NOT silently: `countPasswordResetRequests()` (below) surfaces the real
// table total so page.tsx can tell the user requests are hidden and offer a
// "View all" control, which raises the cap to PASSWORD_REQUESTS_VIEW_ALL_CAP
// (500 — a defensive ceiling, not a truly unbounded read, same shape as
// PRIVACY_NOTES_VIEW_ALL_CAP).
//
// CACHE FIX: this fetch was NOT cache-wrapped before this step (Phase A
// finding N5) — every render re-read the whole table plus a staff-profiles
// lookup plus an Auth admin `listUsers` call. It is now `unstable_cache`d,
// tags `[TAGS.AUDIT, TAGS.STAFF]`. `actions.ts` (approve/reject) already
// calls `updateTag(TAGS.AUDIT)` after every mutation (for its own audit-log
// insert) — no change to actions.ts is needed for this cache to invalidate
// on approve/reject.
//
// CACHE HAZARD AUDIT (SHARED-NOTES §15): the returned shape is JSON-safe —
// `PasswordResetRequest[]` is scalars only (every date is already an ISO
// string from the DB / Auth API). No Set / Map / Date crosses the boundary.

import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tag-taxonomy";
import { cacheKeyPart } from "@/lib/cache/cache-key";

export const PASSWORD_REQUESTS_LIMIT = 100;
export const PASSWORD_REQUESTS_VIEW_ALL_CAP = 500;

export type PasswordRequestRowStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "used";

export interface PasswordResetRequest {
  id: string;
  email: string;
  status: PasswordRequestRowStatus;
  created_at: string;
  expires_at: string;
  reviewed_at: string | null;
  reviewed_by_name: string | null;
  reviewer_note: string | null;
}

interface RawRequestRow {
  id: string;
  staff_id: string;
  status: PasswordRequestRowStatus;
  requested_at: string;
  created_at: string;
  expires_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewer_note: string | null;
}

interface StaffEmailLookup {
  id: string;
  name: string | null;
  auth_user_id: string;
}

export async function getPasswordResetRequests(
  params: { viewAll?: boolean } = {}
): Promise<PasswordResetRequest[]> {
  const limit = params.viewAll ? PASSWORD_REQUESTS_VIEW_ALL_CAP : PASSWORD_REQUESTS_LIMIT;

  const cached = unstable_cache(
    async (): Promise<PasswordResetRequest[]> => {
      const adminClient = createSupabaseAdminClient();
      const { data: rawRows, error } = await adminClient
        .from("account_password_requests")
        .select(
          "id, staff_id, status, requested_at, created_at, expires_at, reviewed_at, reviewed_by, reviewer_note"
        )
        .order("requested_at", { ascending: false })
        .limit(limit)
        .returns<RawRequestRow[]>();

      if (error || !rawRows) {
        if (error) console.error("getPasswordResetRequests db error:", error);
        return [];
      }
      if (rawRows.length === 0) return [];

      const staffIds = Array.from(
        new Set(
          rawRows.flatMap((row) =>
            [row.staff_id, row.reviewed_by].filter((v): v is string => Boolean(v))
          )
        )
      );

      const { data: staffRows } = await adminClient
        .from("staff_profiles")
        .select("id, name, auth_user_id")
        .in("id", staffIds)
        .returns<StaffEmailLookup[]>();

      const staffById = new Map<string, StaffEmailLookup>(
        (staffRows ?? []).map((staff) => [staff.id, staff])
      );

      const authUserIds = new Set(
        (staffRows ?? [])
          .map((s) => s.auth_user_id)
          .filter((v): v is string => Boolean(v))
      );

      // The `auth` schema isn't exposed via PostgREST. Use the Auth admin
      // API, page through (single page covers any realistic staff list), and
      // build the lookup map client-side.
      const emailByAuthUserId = new Map<string, string>();
      if (authUserIds.size > 0) {
        const { data: list, error: listError } =
          await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (listError) {
          console.error("getPasswordResetRequests listUsers error:", listError);
        } else {
          for (const u of list.users) {
            if (u.id && authUserIds.has(u.id) && u.email) {
              emailByAuthUserId.set(u.id, u.email);
            }
          }
        }
      }

      return rawRows.map((row) => {
        const requester = staffById.get(row.staff_id);
        const reviewer = row.reviewed_by ? staffById.get(row.reviewed_by) : null;
        const email = requester
          ? emailByAuthUserId.get(requester.auth_user_id) ?? "(unknown email)"
          : "(unknown staff)";
        return {
          id: row.id,
          email,
          status: row.status,
          created_at: row.requested_at ?? row.created_at,
          expires_at: row.expires_at,
          reviewed_at: row.reviewed_at,
          reviewed_by_name: reviewer?.name ?? null,
          reviewer_note: row.reviewer_note,
        };
      });
    },
    ["password-requests-list", cacheKeyPart({ limit })],
    { revalidate: 60, tags: [TAGS.AUDIT, TAGS.STAFF] }
  );
  return cached();
}

/**
 * Cheap head-count companion (C-16 Step 12). Head request — no rows
 * transferred. Two jobs:
 *  - called with no `status`, it's the REAL table total, independent of
 *    PASSWORD_REQUESTS_LIMIT — page.tsx compares it against
 *    `getPasswordResetRequests`' row count to know whether the cap is
 *    currently hiding anything.
 *  - called with `status: "pending"`, it drives the "Pending (N)" tab badge
 *    exactly (not an approximation over the capped fetch), since that badge
 *    is the number staff actually act on.
 */
export async function countPasswordResetRequests(
  status?: PasswordRequestRowStatus
): Promise<number> {
  const cached = unstable_cache(
    async (): Promise<number> => {
      const adminClient = createSupabaseAdminClient();
      let query = adminClient
        .from("account_password_requests")
        .select("id", { count: "exact", head: true });
      if (status) query = query.eq("status", status);
      const { count, error } = await query;
      if (error) return 0;
      return count ?? 0;
    },
    ["password-requests-count", cacheKeyPart({ status })],
    { revalidate: 60, tags: [TAGS.AUDIT, TAGS.STAFF] }
  );
  return cached();
}
