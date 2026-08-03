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
import {
  canManageBookings,
  canManageEmailTemplates,
  canManageEnquiries,
  canManagePermissionOverrides,
  canManageRoleTemplates,
  canOpenReports,
  getStaffProfile,
  PERMISSIONS,
} from "@/lib/auth/rbac";
import { getAdminPageAccess } from "@/lib/auth/admin-access";
import { getStaffTeamAccess } from "@/app/admin/staff/team-access";
import {
  resolveAdminShellVariant,
  type AdminShellVariant,
} from "@/app/admin/shell-variant";
import { parseReportFilters } from "@/app/admin/reports/reporting";
import { PerformanceSurface } from "@/app/admin/components/PerformanceSurface";
import {
  buildRangeChips,
  buildRangeWindowLabel,
} from "@/app/admin/components/performance-surface-helpers";
import { NotificationSettingsCard } from "./NotificationSettingsCard";
import { QuickLinks, type QuickLink } from "./QuickLinks";

// B-140 — per-role Quick Links for /admin/me. Bucketed on the same
// capability-based shell variant the page already resolves
// (resolveAdminShellVariant), NOT on `profile.role_name` — that field holds
// the human-editable role display_label ("Owner / Main Admin", "Client
// Care / Booking Coordinator"), not a stable slug, so an exact-match switch
// on it would silently return no links for every seeded role except
// Therapist. Owner vs Admin (both bucket to "owner_admin") is split on
// `canManagePermissionOverrides`/`canManageRoleTemplates` — the two
// permissions the current role seed grants Owner but not Admin — used only
// to choose which curated set to show, never to gate access.
//
// Every individual link is additionally gated on the EXACT predicate its
// destination page itself enforces (verified against each page's source),
// so a staff member with an individual permission override (staff_
// permission_overrides) never receives a link into a page that would then
// deny them — brief §3's RBAC matrix calls for links "gated by existing
// predicates," plural.
function getQuickLinksForRole(
  profile: NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>,
  shell: AdminShellVariant
): QuickLink[] {
  const staffId = profile.id;
  const links: QuickLink[] = [];

  if (shell === "therapist") {
    // /admin/bookings* — mirrors bookings/page.tsx's own gate.
    if (canManageBookings(profile)) {
      links.push({ label: "Today's visits", href: "/admin/bookings?view=today" });
      links.push({ label: "Claimable work", href: "/admin/bookings?view=claimable" });
    }
    // /admin/staff/{ownId} — the staff detail page always allows a viewer
    // to open their own profile (isOwnProfile bypass), regardless of role.
    links.push({ label: "My staff profile", href: `/admin/staff/${staffId}` });
    if (canManageBookings(profile)) {
      links.push({
        label: "Completed visits",
        href: `/admin/bookings?view=completed&staffId=${staffId}`,
      });
    }
    return links;
  }

  if (shell === "coordinator") {
    if (canManageBookings(profile)) {
      links.push({ label: "Today's bookings", href: "/admin/bookings?view=today" });
      links.push({ label: "Triage queue", href: "/admin/bookings?view=attention" });
    }
    // /admin/enquiries — mirrors enquiries/page.tsx's own gate.
    if (canManageEnquiries(profile)) {
      links.push({ label: "Active enquiries", href: "/admin/enquiries" });
    }
    links.push({ label: "My staff profile", href: `/admin/staff/${staffId}` });
    return links;
  }

  // shell === "owner_admin"
  const isOwnerTier =
    canManagePermissionOverrides(profile) || canManageRoleTemplates(profile);

  if (isOwnerTier) {
    // /admin/dashboard — mirrors dashboard/page.tsx's own gate exactly.
    if (getAdminPageAccess(profile, "dashboard").access) {
      links.push({ label: "Dashboard", href: "/admin/dashboard" });
    }
    if (canOpenReports(profile)) {
      links.push({ label: "Reports", href: "/admin/reports" });
    }
    // /admin/settings — mirrors settings/page.tsx's own inline gate.
    if (profile.permissions.has(PERMISSIONS.MANAGE_SETTINGS)) {
      links.push({ label: "Settings", href: "/admin/settings" });
    }
    if (canManageBookings(profile)) {
      links.push({ label: "Today's bookings", href: "/admin/bookings?view=today" });
    }
    return links;
  }

  if (getAdminPageAccess(profile, "dashboard").access) {
    links.push({ label: "Dashboard", href: "/admin/dashboard" });
  }
  if (canManageBookings(profile)) {
    links.push({ label: "Today's bookings", href: "/admin/bookings?view=today" });
  }
  // /admin/staff — mirrors staff/page.tsx's own gate (getStaffTeamAccess).
  if (getStaffTeamAccess(profile).access) {
    links.push({ label: "Staff roster", href: "/admin/staff" });
  }
  // /admin/audit — mirrors audit/page.tsx's own inline gate.
  if (profile.permissions.has(PERMISSIONS.MANAGE_AUDIT_LOGS)) {
    links.push({ label: "Recent activity", href: "/admin/audit" });
  }
  return links;
}

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
    <>
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
      {/* C-08 Phase D Step 17 (brief §2.8) — Owner/Admin only. C-07's
          Quick-links panel mounts on this same page; C-08 ships first, so
          this simply slots below PerformanceSurface with no accommodation
          for a sibling that doesn't exist yet. Not inside <main
          id="admin-main">, which PerformanceSurface itself renders — this
          wrapper only mirrors its outer spacing so the two read as one
          column; edited without touching PerformanceSurface.tsx, which is
          outside this plan's files-touched list. */}
      {canManageEmailTemplates(profile) ? (
        <div className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6 sm:pb-8">
          <NotificationSettingsCard
            loginEmail={profile.email}
            notificationEmail={profile.notification_email ?? null}
            prefs={profile.business_notification_prefs}
          />
        </div>
      ) : null}
      {/* B-140 — mounts below NotificationSettingsCard (C-08, shipped
          first); see the coordination note at this file's top imports. */}
      <div className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6 sm:pb-8">
        <QuickLinks links={getQuickLinksForRole(profile, shell)} />
      </div>
    </>
  );
}
