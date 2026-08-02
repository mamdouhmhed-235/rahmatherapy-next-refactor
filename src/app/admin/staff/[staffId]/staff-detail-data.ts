// SERVER ONLY — cached data helper for /admin/staff/[staffId]
// (C-09 Phase C Step 5).
//
// `getStaffTeamAccess` is evaluated upstream in page.tsx. Its scope, the
// RBAC-derived select string and every panel-gating boolean come in as params
// and form part of the cache key, so a narrower viewer can never be served a
// wider viewer's entry. StaffProfile itself never crosses the boundary — it
// carries a `Set` of permissions (SHARED-NOTES §15).
// getStaffTeamSelect / staffProfilesFrom are FPM verbatim-preserved
// (RECON §5) and are called here unchanged.
//
// CACHE HAZARD AUDIT (SHARED-NOTES §15): the returned shape is JSON-safe.
//  - every field is a plain row array or a scalar; nested `bookings`,
//    `permissions` and `roles` objects are plain JSON.
//  - TRANSFORM APPLIED: the last-modified actor is resolved to a NAME STRING
//    inside the fetcher (`lastModifiedActorName`) rather than returning a row
//    the page would have to re-query for.
//  - Every timestamp stays a string. page.tsx's `nowIso` upcoming/past split
//    and its `relativeTime` formatting run on the consumer side, so the
//    "upcoming" boundary is never frozen by the cache.
// No Set / Map / Date crosses the boundary.
//
// NOT CACHED, deliberately: the `roles` lookup stays in page.tsx. It runs on
// the RLS-bound server client, and `cookies()` is forbidden inside a function
// wrapped in unstable_cache; moving it to the admin client would silently drop
// its RLS scoping. page.tsx still issues it in parallel with this helper, so
// the request waterfall is unchanged.
//
// Tags per the plan's Step 5 table: staff, bookings, audit.
//
// PAGINATION (C-16): /admin/staff/[id] is not on C-16's Phase A list and has
// no unbounded list — assignments are capped at 16, the audit strip at 8, the
// sibling list is the active directory. `assignmentLimit` and `auditLimit` are
// the real, query-level knobs and both flow into the cache key. No offset is
// offered: the page splits the single assignment read into upcoming/past in
// memory, so an offset would page a window that does not exist in the UI.

import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tag-taxonomy";
import { cacheKeyPart } from "@/lib/cache/cache-key";
import { staffProfilesFrom, type StaffTeamAccess } from "../team-access";

export const STAFF_DETAIL_ASSIGNMENT_LIMIT = 16;
export const STAFF_DETAIL_AUDIT_LIMIT = 8;

export type StaffDetailRole = {
  id?: string;
  name: string;
  display_label?: string | null;
};

export type StaffDetailRow = {
  id: string;
  auth_user_id?: string | null;
  name: string;
  email?: string | null;
  role_id?: string;
  gender: "male" | "female";
  active: boolean;
  can_take_bookings: boolean;
  availability_mode: string;
  profile_photo_path?: string | null;
  phone?: string | null;
  show_phone_on_profile?: boolean | null;
  short_bio?: string | null;
  specialties?: string[] | null;
  languages?: string[] | null;
  service_areas?: string[] | null;
  roles?: StaffDetailRole | null;
};

export interface StaffDetailPermission {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  scope: string | null;
  risk_level: string | null;
}

export type StaffDetailAssignmentRow = {
  id: string;
  status: string;
  required_therapist_gender: string;
  bookings: {
    id: string;
    booking_date: string;
    start_time: string;
    status: string;
    contact_full_name?: string | null;
    service_city?: string | null;
  } | null;
};

export interface StaffDetailParams {
  staffId: string;
  /** Viewer's own staff id — decides the own-profile widening. */
  viewerId: string;
  /** Viewer's gender — narrows the same-gender team scope. */
  viewerGender: string | null;
  isOwnProfile: boolean;
  scope: StaffTeamAccess["scope"];
  /** The RBAC-narrowed column list page.tsx resolved for this viewer. */
  staffSelect: string;
  hasTeamAccess: boolean;
  canShowAdminPanels: boolean;
  canViewPermissionControls: boolean;
  canViewAudit: boolean;
  showClientWorkloadContext: boolean;
  assignmentLimit?: number;
  auditLimit?: number;
}

export interface StaffDetailData {
  staff: StaffDetailRow | null;
  rolePermissions: { permission_id: string; permissions: unknown }[];
  staffOverrides: { permission_id: string; is_granted: boolean }[];
  allPermissions: StaffDetailPermission[];
  assignments: StaffDetailAssignmentRow[];
  auditLogs: { id: string; action_type: string; created_at: string }[];
  availabilityRules: { id: string }[];
  siblingStaff: { id: string; name: string }[];
  lastModified:
    | { created_at: string; actor_id: string | null; action_type: string }
    | null;
  lastModifiedActorName: string | null;
}

const EMPTY: StaffDetailData = {
  staff: null,
  rolePermissions: [],
  staffOverrides: [],
  allPermissions: [],
  assignments: [],
  auditLogs: [],
  availabilityRules: [],
  siblingStaff: [],
  lastModified: null,
  lastModifiedActorName: null,
};

export async function getStaffDetailData(
  params: StaffDetailParams
): Promise<StaffDetailData> {
  const {
    staffId,
    viewerId,
    viewerGender,
    isOwnProfile,
    scope,
    staffSelect,
    hasTeamAccess,
    canShowAdminPanels,
    canViewPermissionControls,
    canViewAudit,
    showClientWorkloadContext,
  } = params;
  const assignmentLimit = params.assignmentLimit ?? STAFF_DETAIL_ASSIGNMENT_LIMIT;
  const auditLimit = params.auditLimit ?? STAFF_DETAIL_AUDIT_LIMIT;

  const cached = unstable_cache(
    async (): Promise<StaffDetailData> => {
      const adminClient = createSupabaseAdminClient();
      const staffProfiles = staffProfilesFrom(adminClient);

      let staffQuery = staffProfiles
        .select<StaffDetailRow>(staffSelect)
        .eq("id", staffId);
      if (!isOwnProfile && scope === "assignment") {
        staffQuery = staffQuery.eq("active", true).eq("can_take_bookings", true);
      }
      if (!isOwnProfile && scope === "same_gender_team") {
        staffQuery = staffQuery
          .eq("active", true)
          .eq("can_take_bookings", true)
          .eq("gender", viewerGender);
      }

      const { data: staff } = await staffQuery.maybeSingle();
      if (!staff) return EMPTY;

      const typedStaff = staff as unknown as StaffDetailRow;

      const [
        { data: rolePermissions },
        { data: staffOverrides },
        { data: allPermissions },
        { data: assignments },
        { data: auditLogs },
        { data: availabilityRules },
        { data: siblingStaff },
        { data: lastModifiedRows },
      ] = await Promise.all([
        canShowAdminPanels && typedStaff.role_id
          ? adminClient
              .from("role_permissions")
              .select("permission_id, permissions(name)")
              .eq("role_id", typedStaff.role_id)
          : Promise.resolve({ data: [] }),
        canViewPermissionControls
          ? adminClient
              .from("staff_permission_overrides")
              .select("permission_id, is_granted")
              .eq("staff_id", staffId)
          : Promise.resolve({ data: [] }),
        canViewPermissionControls
          ? adminClient
              .from("permissions")
              .select("id, name, description, category, scope, risk_level, active")
              .eq("active", true)
              .order("category", { ascending: true })
              .order("name", { ascending: true })
          : Promise.resolve({ data: [] }),
        adminClient
          .from("booking_assignments")
          .select(
            showClientWorkloadContext
              ? "id, status, required_therapist_gender, bookings(id, booking_date, start_time, status, contact_full_name, service_city)"
              : "id, status, required_therapist_gender, bookings(id, booking_date, start_time, status)"
          )
          .eq("assigned_staff_id", staffId)
          .order("created_at", { ascending: false })
          .limit(assignmentLimit),
        canViewAudit
          ? adminClient
              .from("audit_logs")
              .select("id, action_type, created_at")
              .eq("target_id", staffId)
              .order("created_at", { ascending: false })
              .limit(auditLimit)
          : Promise.resolve({ data: [] }),
        adminClient
          .from("staff_availability_rules")
          .select("id")
          .eq("staff_id", staffId),
        // Sibling staff for prev/next header arrows (only when caller has
        // team-directory visibility). Restricted to active staff so prev/next
        // never lands on retired colleagues.
        hasTeamAccess
          ? adminClient
              .from("staff_profiles")
              .select("id, name")
              .eq("active", true)
              .order("name", { ascending: true })
          : Promise.resolve({ data: [] }),
        // Last-modified caption — most-recent staff-write audit event by an
        // actor whose name we can resolve.
        canViewAudit
          ? adminClient
              .from("audit_logs")
              .select("created_at, actor_id, action_type")
              .eq("target_id", staffId)
              .order("created_at", { ascending: false })
              .limit(1)
          : Promise.resolve({ data: [] }),
      ]);

      const lastModified =
        ((lastModifiedRows ?? [])[0] as
          | { created_at: string; actor_id: string | null; action_type: string }
          | undefined) ?? null;

      let lastModifiedActorName: string | null = null;
      if (lastModified?.actor_id) {
        const { data: actorRow } = await adminClient
          .from("staff_profiles")
          .select("name")
          .eq("id", lastModified.actor_id)
          .maybeSingle();
        lastModifiedActorName = (actorRow as { name?: string } | null)?.name ?? null;
      }

      return {
        staff: typedStaff,
        rolePermissions: (rolePermissions ?? []) as {
          permission_id: string;
          permissions: unknown;
        }[],
        staffOverrides: (staffOverrides ?? []) as {
          permission_id: string;
          is_granted: boolean;
        }[],
        allPermissions: (allPermissions ?? []) as unknown as StaffDetailPermission[],
        assignments: (assignments ?? []) as unknown as StaffDetailAssignmentRow[],
        auditLogs: (auditLogs ?? []) as {
          id: string;
          action_type: string;
          created_at: string;
        }[],
        availabilityRules: (availabilityRules ?? []) as { id: string }[],
        siblingStaff: (siblingStaff ?? []) as { id: string; name: string }[],
        lastModified,
        lastModifiedActorName,
      };
    },
    [
      "staff-detail",
      cacheKeyPart({
        staffId,
        viewerId,
        viewerGender,
        isOwnProfile,
        scope,
        staffSelect,
        hasTeamAccess,
        canShowAdminPanels,
        canViewPermissionControls,
        canViewAudit,
        showClientWorkloadContext,
        assignmentLimit,
        auditLimit,
      }),
    ],
    { revalidate: 60, tags: [TAGS.STAFF, TAGS.BOOKINGS, TAGS.AUDIT] }
  );
  return cached();
}
