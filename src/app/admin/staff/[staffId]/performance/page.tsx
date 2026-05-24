// B-3 — manager-view Performance sub-route. Mirrors /admin/me's data flow
// (same ≤4 query budget) but uses the target staff's id throughout. Self-
// redirects to /admin/me for the canonical self-view URL.

import { notFound, redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getStaffProfile,
  hasPermission,
  PERMISSIONS,
  canOpenReports,
  type StaffProfile,
} from "@/lib/auth/rbac";
import { AdminAccessDenied } from "@/app/admin/components/admin-ui";
import { getStaffTeamAccess } from "@/app/admin/staff/team-access";
import {
  parseReportFilters,
  buildPriorPeriodFilters,
  getReportData,
  getStaffScorecard,
  getAuditLogForStaff,
  summarizeReports,
} from "@/app/admin/reports/reporting";
import { PerformanceSurface } from "@/app/admin/components/PerformanceSurface";
import {
  tilesForRole,
  type PerformanceShell,
} from "@/app/admin/components/performance-helpers";
import {
  getUpcomingWorkForStaff,
  buildPerformanceTrend,
} from "@/app/admin/components/performance-data";
import {
  buildRangeChips,
  buildRangeWindowLabel,
  buildMobileStickyConfig,
} from "@/app/admin/components/performance-surface-helpers";

interface PerformanceSubrouteProps {
  params: Promise<{ staffId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata = {
  title: "Staff Performance — Rahma Therapy Admin",
};

// Maps the target staff's role to a PerformanceShell. The viewer's own shell
// is resolved via permissions (resolveAdminShellVariant) but that needs a
// loaded permissions Set; the target only has role_name surfaced cheaply,
// so we map by role here. Inactive targets fall back to therapist (most
// deactivations in this clinic are deactivated therapists; brief §6 + AUDIT
// G5 say the page renders the historical scorecard regardless).
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

export default async function PerformanceSubroute({ params, searchParams }: PerformanceSubrouteProps) {
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

  // Build a thin StaffProfile-shaped object for the surface. Performance is
  // read-only so we don't need the target's full resolved permission set —
  // only id / name / role_name / active / gender / etc. Permissions empty.
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

  const queryParams = await searchParams;
  const filters = parseReportFilters(queryParams);
  const priorFilters = buildPriorPeriodFilters(filters);

  // Use the VIEWER's profile for getReportData's RBAC narrowing — the function
  // filters the dataset by what the caller is allowed to see. We then narrow
  // the resulting scorecard to the target's staffId.
  const fetchCachedReportData = (purpose: "current" | "prior", periodFilters: typeof filters) =>
    unstable_cache(
      () =>
        Sentry.startSpan(
          {
            name: "getReportData",
            op: "db.query",
            attributes: {
              profile_id: viewer.id,
              range: periodFilters.range,
              purpose,
            },
          },
          async () => getReportData(adminClient, viewer, periodFilters)
        ),
      ["report-data", viewer.id, JSON.stringify(periodFilters)],
      { revalidate: 60, tags: ["report-data"] }
    )();

  const [data, priorData, auditLogForScorecard, upcomingWork] = await Promise.all([
    fetchCachedReportData("current", filters),
    priorFilters ? fetchCachedReportData("prior", priorFilters) : Promise.resolve(undefined),
    getAuditLogForStaff(adminClient, targetProfile.id, 100),
    getUpcomingWorkForStaff(adminClient, targetProfile.id, shell, 5),
  ]);

  const scorecard = getStaffScorecard(data, targetProfile.id, priorData, auditLogForScorecard);
  const businessNetRevenue =
    shell === "owner_admin" && scorecard.clinical.assignmentsTotal === 0
      ? summarizeReports(data).collectedRevenue
      : undefined;

  const tiles = tilesForRole(shell, scorecard, {
    staffId: targetProfile.id,
    range: filters.range,
    businessNetRevenue,
    showAll: queryParams.show === "all",
  });
  const trend = buildPerformanceTrend(data, targetProfile.id, shell);
  const basePath = `/admin/staff/${staffId}/performance`;
  const rangeChips = buildRangeChips(basePath, filters.range, queryParams);
  const rangeWindowLabel = buildRangeWindowLabel(filters.from, filters.to);
  const viewerCanManageAudit = hasPermission(viewer, PERMISSIONS.MANAGE_AUDIT_LOGS);
  const viewInReportsHref = canOpenReports(viewer)
    ? `/admin/reports?staffId=${targetProfile.id}&scope=personal&range=${filters.range}`
    : undefined;

  // Manager-view doesn't get a mobile sticky bar (no "my next visit" semantic).
  const sticky = isInactive ? undefined : buildMobileStickyConfig("owner_admin", upcomingWork);

  return (
    <PerformanceSurface
      profile={targetProfile}
      viewer={viewer}
      mode="manager"
      shell={shell}
      tiles={tiles}
      trend={trend}
      upcomingWork={upcomingWork}
      auditEvents={auditLogForScorecard.slice(0, 20)}
      rangeChips={rangeChips}
      rangeWindowLabel={rangeWindowLabel}
      isInactive={isInactive}
      viewInReportsHref={viewInReportsHref}
      viewerCanManageAudit={viewerCanManageAudit}
      mobileStickyHref={sticky?.href}
      mobileStickyLabel={sticky?.label}
    />
  );
}
