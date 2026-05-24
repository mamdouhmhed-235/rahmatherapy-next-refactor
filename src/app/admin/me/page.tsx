// B-3 — self-view Performance route. Every active staff member can reach
// /admin/me to see their own scorecard + activity + upcoming work.
// Query budget: ≤4 cold-cache (data current + data prior + audit + upcoming).

import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStaffProfile, PERMISSIONS, canOpenReports } from "@/lib/auth/rbac";
import { resolveAdminShellVariant } from "@/app/admin/shell-variant";
import {
  parseReportFilters,
  buildPriorPeriodFilters,
  getReportData,
  getStaffScorecard,
  getAuditLogForStaff,
  summarizeReports,
} from "@/app/admin/reports/reporting";
import { PerformanceSurface } from "@/app/admin/components/PerformanceSurface";
import { tilesForRole } from "@/app/admin/components/performance-helpers";
import {
  getUpcomingWorkForStaff,
  buildPerformanceTrend,
} from "@/app/admin/components/performance-data";
import {
  buildRangeChips,
  buildRangeWindowLabel,
  buildMobileStickyConfig,
} from "@/app/admin/components/performance-surface-helpers";

export const metadata = {
  title: "My Performance — Rahma Therapy Admin",
};

interface MyPerformancePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MyPerformancePage({ searchParams }: MyPerformancePageProps) {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile || !profile.active) redirect("/admin/login");

  const shell = resolveAdminShellVariant(profile);
  if (!shell) redirect("/admin/login");

  const params = await searchParams;
  const filters = parseReportFilters(params);
  const priorFilters = buildPriorPeriodFilters(filters);
  const adminClient = createSupabaseAdminClient();

  // B-2 cache pattern — per-profile key + 60s revalidate + report-data tag
  // (server actions across the codebase invalidate via updateTag).
  const fetchCachedReportData = (purpose: "current" | "prior", periodFilters: typeof filters) =>
    unstable_cache(
      () =>
        Sentry.startSpan(
          {
            name: "getReportData",
            op: "db.query",
            attributes: {
              profile_id: profile.id,
              range: periodFilters.range,
              purpose,
            },
          },
          async () => getReportData(adminClient, profile, periodFilters)
        ),
      ["report-data", profile.id, JSON.stringify(periodFilters)],
      { revalidate: 60, tags: ["report-data"] }
    )();

  const [data, priorData, auditLogForScorecard, upcomingWork] = await Promise.all([
    fetchCachedReportData("current", filters),
    priorFilters ? fetchCachedReportData("prior", priorFilters) : Promise.resolve(undefined),
    // ≤4 query budget: the scorecard.admin sub-object + the timeline reuse the
    // same audit-log fetch (cached at the helper level by getAuditLogForStaff's
    // Sentry span). 100 rows comfortably covers both periods + the 20-row UI.
    getAuditLogForStaff(adminClient, profile.id, 100),
    getUpcomingWorkForStaff(adminClient, profile.id, shell, 5),
  ]);

  const scorecard = getStaffScorecard(data, profile.id, priorData, auditLogForScorecard);
  const businessNetRevenue =
    shell === "owner_admin" && scorecard.clinical.assignmentsTotal === 0
      ? summarizeReports(data).collectedRevenue
      : undefined;

  const tiles = tilesForRole(shell, scorecard, {
    staffId: profile.id,
    range: filters.range,
    businessNetRevenue,
    showAll: params.show === "all",
  });

  const trend = buildPerformanceTrend(data, profile.id, shell);
  const rangeChips = buildRangeChips("/admin/me", filters.range, params);
  const rangeWindowLabel = buildRangeWindowLabel(filters.from, filters.to);
  const viewerCanManageAudit = profile.permissions.has(PERMISSIONS.MANAGE_AUDIT_LOGS);
  const viewInReportsHref = canOpenReports(profile)
    ? `/admin/reports?staffId=${profile.id}&scope=personal&range=${filters.range}`
    : undefined;
  const sticky = buildMobileStickyConfig(shell, upcomingWork);

  return (
    <PerformanceSurface
      profile={profile}
      viewer={profile}
      mode="self"
      shell={shell}
      tiles={tiles}
      trend={trend}
      upcomingWork={upcomingWork}
      auditEvents={auditLogForScorecard.slice(0, 20)}
      rangeChips={rangeChips}
      rangeWindowLabel={rangeWindowLabel}
      viewInReportsHref={viewInReportsHref}
      viewerCanManageAudit={viewerCanManageAudit}
      mobileStickyHref={sticky?.href}
      mobileStickyLabel={sticky?.label}
    />
  );
}
