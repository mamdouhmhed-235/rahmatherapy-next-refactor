// B-3 — manager-view Performance sub-route. Mirrors /admin/me's data flow
// via the shared <PerformanceSurface> (per-section Suspense streaming), but
// resolves the target staff separately from the viewer so the audit log +
// scorecard are scoped to target.id while RBAC + report-data fetching use
// the viewer's permissions.

import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getStaffProfile,
  canOpenReports,
  type StaffProfile,
} from "@/lib/auth/rbac";
import { AdminAccessDenied } from "@/app/admin/components/admin-ui";
import { getStaffTeamAccess } from "@/app/admin/staff/team-access";
import { parseReportFilters } from "@/app/admin/reports/reporting";
import { PerformanceSurface } from "@/app/admin/components/PerformanceSurface";
import { type PerformanceShell } from "@/app/admin/components/performance-helpers";
import {
  buildRangeChips,
  buildRangeWindowLabel,
} from "@/app/admin/components/performance-surface-helpers";

interface PerformanceSubrouteProps {
  params: Promise<{ staffId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata = {
  title: "Staff Performance — Rahma Therapy Admin",
};

// Maps the target staff's role to a PerformanceShell. We can't reuse
// resolveAdminShellVariant on the target without their full permissions
// Set — which would require a fan-out role_permissions + overrides fetch
// per render (4 extra queries, busts the budget). Instead derive from
// role_name. Inactive targets fall back to therapist tile set per brief
// §6 + AUDIT G5 (most deactivations are deactivated therapists).
function targetShellFromRoleName(roleName: string | null | undefined): PerformanceShell {
  switch ((roleName ?? "").trim().toLowerCase()) {
    case "owner":
    case "admin":
      return "owner_admin";
    case "booking coordinator":
      return "coordinator";
    case "therapist":
    case "inactive":
    default:
      return "therapist";
  }
}

export default async function PerformanceSubroute({
  params,
  searchParams,
}: PerformanceSubrouteProps) {
  const supabase = await createSupabaseServerClient();
  const viewer = await getStaffProfile(supabase);
  if (!viewer || !viewer.active) redirect("/admin/login");

  const { staffId } = await params;

  // Canonical URL for self-view is /admin/me. Self-redirect keeps the surface
  // single-source-of-truth (brief §4 + AUDIT H7).
  if (viewer.id === staffId) redirect("/admin/me");

  const teamAccess = getStaffTeamAccess(viewer);
  if (!teamAccess.canViewAdminFields) {
    return (
      <AdminAccessDenied
        title="Performance access limited"
        message="This area is private to that staff member and senior management."
      />
    );
  }

  const adminClient = createSupabaseAdminClient();
  const { data: targetRow } = await adminClient
    .from("staff_profiles")
    .select("id, name, active, role_id, roles(name)")
    .eq("id", staffId)
    .maybeSingle();
  if (!targetRow) notFound();

  type TargetRow = {
    id: string;
    name: string;
    active: boolean;
    role_id: string;
    roles: { name: string | null } | null;
  };
  const typedTarget = targetRow as unknown as TargetRow;

  // Thin StaffProfile for the surface (target is read-only here; permissions
  // not needed because the surface uses `viewer` for any permission checks).
  const targetProfile: StaffProfile = {
    id: typedTarget.id,
    auth_user_id: "",
    name: typedTarget.name,
    email: "",
    role_id: typedTarget.role_id,
    role_name: typedTarget.roles?.name ?? "Unknown",
    gender: "",
    active: typedTarget.active,
    can_take_bookings: false,
    availability_mode: "",
    permissions: new Set<string>(),
  };

  const shell = targetShellFromRoleName(targetProfile.role_name);
  const isInactive = !typedTarget.active;
  // AUDIT G5 — discreet "Inactive" pill in the header. The schema has no
  // `inactive_since` column on staff_profiles (verified 2026-05-24), so the
  // pill ships date-less in B-3. A future migration could thread the deactivation
  // date through and append "since {date}" to this label.
  const inactiveSinceLabel = isInactive ? "Inactive" : undefined;
  const queryParams = await searchParams;
  const filters = parseReportFilters(queryParams);
  const basePath = `/admin/staff/${staffId}/performance`;

  const rangeChips = buildRangeChips(basePath, filters.range, queryParams);
  const rangeWindowLabel = buildRangeWindowLabel(filters.from, filters.to);
  const viewInReportsHref = canOpenReports(viewer)
    ? `/admin/reports?staffId=${targetProfile.id}&scope=personal&range=${filters.range}`
    : undefined;

  return (
    <PerformanceSurface
      profile={targetProfile}
      viewer={viewer}
      mode="manager"
      shell={shell}
      filters={filters}
      tileOptions={{ showAll: queryParams.show === "all" }}
      rangeChips={rangeChips}
      rangeWindowLabel={rangeWindowLabel}
      isInactive={isInactive}
      inactiveSinceLabel={inactiveSinceLabel}
      viewInReportsHref={viewInReportsHref}
      customDateRange={{ from: filters.from, to: filters.to }}
      basePath={basePath}
    />
  );
}
