// B-3 — self-view Performance route. Every active staff member can reach
// /admin/me to see their own scorecard + activity + upcoming work.
//
// Per-section Suspense (plan step 5.5): this page resolves the viewer +
// builds chrome inputs (chips, range labels, viewInReportsHref), then hands
// off to <PerformanceSurface>. Each section inside the surface is its own
// async server component that fetches via the React `cache()`-deduped
// helpers in performance-data.ts. Per-render dedup collapses the 4 logical
// fetches (current ReportData / prior ReportData / audit log / upcoming
// work) into 4 actual DB queries even when multiple sections await the
// same helper — SHARED-NOTES §11 budget preserved.

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile, canOpenReports } from "@/lib/auth/rbac";
import { resolveAdminShellVariant } from "@/app/admin/shell-variant";
import { parseReportFilters } from "@/app/admin/reports/reporting";
import { PerformanceSurface } from "@/app/admin/components/PerformanceSurface";
import {
  buildRangeChips,
  buildRangeWindowLabel,
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

  const rangeChips = buildRangeChips("/admin/me", filters.range, params);
  const rangeWindowLabel = buildRangeWindowLabel(filters.from, filters.to);
  const viewInReportsHref = canOpenReports(profile)
    ? `/admin/reports?staffId=${profile.id}&scope=personal&range=${filters.range}`
    : undefined;

  return (
    <PerformanceSurface
      profile={profile}
      viewer={profile}
      mode="self"
      shell={shell}
      filters={filters}
      tileOptions={{ showAll: params.show === "all" }}
      rangeChips={rangeChips}
      rangeWindowLabel={rangeWindowLabel}
      viewInReportsHref={viewInReportsHref}
      customDateRange={{ from: filters.from, to: filters.to }}
      basePath="/admin/me"
    />
  );
}
