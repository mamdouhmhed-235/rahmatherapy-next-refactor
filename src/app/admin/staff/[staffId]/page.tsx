import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarCheck,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  Mail,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
  XCircle,
} from "lucide-react";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  canAssignStaffRoles,
  canManagePermissionOverrides,
  getStaffProfile,
} from "@/lib/auth/rbac";
import {
  AdminAccessDenied,
  AdminPanel,
  AdminStatusBadge,
  type AdminTone,
} from "../../components/admin-ui";
import { EmptyState } from "../../components/EmptyState";
import {
  canEditSafeStaffProfile,
  getStaffTeamAccess,
  getStaffTeamSelect,
} from "../team-access";
import {
  getStaffDetailData,
  hasHiddenStaffAssignments,
  type StaffDetailAssignmentRow as AssignmentRow,
  type StaffDetailRow,
} from "./staff-detail-data";
import { RolePermissionsList } from "./RolePermissionsPanel";
import { StaffDetailShortcuts } from "./StaffDetailShortcuts";
import { StaffPermissionOverridesForm } from "./StaffPermissionOverridesForm";
import { StaffProfileForm } from "./StaffProfileForm";

interface StaffDetailPageProps {
  params: Promise<{ staffId: string }>;
}

// StaffDetailRow / StaffDetailAssignmentRow moved to staff-detail-data.ts with
// the fetch (C-09 Phase C Step 5); StaffDetailRow is re-imported above for the
// panels below.

export const metadata = {
  title: "Staff profile — Rahma Therapy admin",
};

const AUDIT_VERB_PHRASES: Record<string, string> = {
  staff_profile_updated: "Profile updated",
  staff_role_assigned: "Role assigned",
  staff_activated: "Account activated",
  staff_deactivated: "Account deactivated",
  staff_bookings_enabled: "Bookings enabled",
  staff_bookings_disabled: "Bookings disabled",
  staff_permission_override_granted: "Permission granted",
  staff_permission_override_revoked: "Permission revoked",
  staff_permission_override_reset: "Permission reset to role default",
  staff_availability_mode_changed: "Availability mode changed",
  staff_availability_rule_added: "Availability rule added",
  staff_availability_rule_removed: "Availability rule removed",
};

// Deterministic-hue avatar token — mirrors Brief 00 §4 (`hash(staff.id) % 360`).
function hueFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

function statusFamily(staff: { active: boolean; can_take_bookings: boolean }): {
  label: string;
  tone: AdminTone;
  tooltip: string;
} {
  if (!staff.active) {
    return {
      label: "Inactive",
      tone: "restricted",
      tooltip: "Inactive. Sign-in blocked.",
    };
  }
  if (!staff.can_take_bookings) {
    return {
      label: "Bookings off",
      tone: "warning",
      tooltip: "Active but not accepting new bookings.",
    };
  }
  return {
    label: "Active",
    tone: "success",
    tooltip: "Active. Can sign in and accept bookings.",
  };
}

function checklistTone(done: number, total: number): AdminTone {
  if (done === total) return "success";
  if (done === 0) return "danger";
  return "warning";
}

function relativeTime(dateIso: string): string {
  const then = new Date(dateIso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(new Date(dateIso));
}

export default async function StaffDetailPage({ params }: StaffDetailPageProps) {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  const { staffId } = await params;
  const isOwnProfile = profile.id === staffId;
  const teamAccess = getStaffTeamAccess(profile);

  // Out-of-team denied — viewer has no team-scope access AND is not on own profile.
  if (!teamAccess.access && !isOwnProfile) {
    return (
      <AdminAccessDenied
        title="Team access limited"
        message="Team profiles aren't visible in your role. Open your own profile from the directory instead."
        actions={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link
              href={`/admin/staff/${profile.id}`}
              className="inline-flex h-10 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              Open my profile
            </Link>
            <Link
              href="/admin/dashboard"
              className="inline-flex h-10 items-center rounded-[var(--admin-radius-control)] px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              Back to dashboard
            </Link>
          </div>
        }
      />
    );
  }

  const staffSelect =
    isOwnProfile || teamAccess.scope === "admin"
      ? getStaffTeamSelect({ ...teamAccess, scope: "admin" })
      : getStaffTeamSelect(teamAccess);

  const canViewContactFields = teamAccess.canViewContactFields || isOwnProfile;
  const canShowAdminPanels = teamAccess.canViewAdminFields;
  // Brief §11 isOwnProfile exception: a therapist viewing their own page sees full client context
  // even when teamAccess.canViewClientWorkloadContext is false.
  const showClientWorkloadContext =
    teamAccess.canViewClientWorkloadContext || isOwnProfile;

  // The roles lookup stays on the RLS-bound server client: cookies() cannot be
  // used inside an unstable_cache fetcher, and moving it to the admin client
  // would drop its RLS scoping. Issued in parallel with the cached read so the
  // request waterfall is unchanged.
  const [{ data: roles }, detail] = await Promise.all([
    teamAccess.canViewRoleControls
      ? supabase
          .from("roles")
          .select("id, name, display_label, active, sort_order")
          .eq("active", true)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true })
      : Promise.resolve({ data: [] }),
    getStaffDetailData({
      staffId,
      viewerId: profile.id,
      viewerGender: profile.gender,
      isOwnProfile,
      scope: teamAccess.scope,
      staffSelect,
      hasTeamAccess: teamAccess.access,
      canShowAdminPanels,
      canViewPermissionControls: teamAccess.canViewPermissionControls,
      canViewAudit: teamAccess.canViewAudit,
      showClientWorkloadContext,
    }),
  ]);

  const {
    staff,
    rolePermissions,
    staffOverrides,
    assignments,
    assignmentsTotal,
    auditLogs,
    availabilityRules,
    siblingStaff,
    lastModified: lastModifiedRow,
    lastModifiedActorName,
  } = detail;
  const allPermissions = detail.allPermissions;

  // Out-of-scope denied — viewer holds team access but the queried staff falls outside their scope.
  if (!staff) {
    return (
      <AdminAccessDenied
        title="Team profile not visible"
        message="This profile isn't visible in your current team scope. Ask the owner if you need access."
        actions={
          <Link
            href="/admin/staff"
            className="inline-flex h-10 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            Back to team directory
          </Link>
        }
      />
    );
  }

  const typedStaff = staff;
  const canEditSafeProfile = canEditSafeStaffProfile(profile, staffId);
  const canOpenWorkloadBookings =
    teamAccess.canViewClientWorkloadContext || teamAccess.scope === "assignment" || isOwnProfile;
  const canManageOverrides = canManagePermissionOverrides(profile);

  const permissions = (rolePermissions ?? [])
    .map((row) => (row.permissions as unknown as { name: string } | null)?.name)
    .filter((permission): permission is string => Boolean(permission));
  const inheritedPermissionIds = (rolePermissions ?? []).map((row) => row.permission_id);
  const overrideMap = Object.fromEntries(
    (staffOverrides ?? []).map((override) => [override.permission_id, override.is_granted])
  );
  const overrideStats = Object.values(overrideMap).reduce<{ added: number; revoked: number }>(
    (acc, isGranted) => {
      if (isGranted) acc.added += 1;
      else acc.revoked += 1;
      return acc;
    },
    { added: 0, revoked: 0 }
  );

  const typedAssignments = (assignments ?? []) as unknown as AssignmentRow[];
  const nowIso = new Date().toISOString().slice(0, 16);
  const upcomingAssignments = typedAssignments.filter((assignment) => {
    const booking = assignment.bookings;
    return (
      booking &&
      ["pending", "confirmed"].includes(booking.status) &&
      `${booking.booking_date}T${booking.start_time}` >= nowIso
    );
  });
  const pastAssignments = typedAssignments.filter(
    (assignment) => !upcomingAssignments.includes(assignment)
  );
  const visiblePastAssignments = pastAssignments.slice(0, 8);
  // C-16 Step 14 (N7) — `assignmentsTotal` is a true head-count over the same
  // `assigned_staff_id` scope as `typedAssignments` (capped at
  // STAFF_DETAIL_ASSIGNMENT_LIMIT). This is the only reliable "is anything
  // hidden" signal: the 16-row fetch is ordered by assignment `created_at`,
  // not booking date, so a precise upcoming/past split of what's BEYOND the
  // cap can't be derived from what's already in memory — see
  // staff-detail-data.ts's file header for why an exact server-side split
  // wasn't attempted. `hasHiddenAssignments` covers both: rows truncated by
  // the 16-row fetch itself, AND past rows truncated further by the panel's
  // own 8-visible slice.
  const hasHiddenAssignments = hasHiddenStaffAssignments({
    assignmentsTotal,
    fetchedCount: typedAssignments.length,
    pastCount: pastAssignments.length,
    visiblePastCount: visiblePastAssignments.length,
  });

  const completionItems: { label: string; fieldName: string; done: boolean }[] = [
    { label: "Phone", fieldName: "phone", done: Boolean(typedStaff.phone) },
    { label: "Short bio", fieldName: "short_bio", done: Boolean(typedStaff.short_bio) },
    { label: "Specialties", fieldName: "specialties", done: Boolean(typedStaff.specialties?.length) },
    { label: "Languages", fieldName: "languages", done: Boolean(typedStaff.languages?.length) },
    {
      label: "Service areas",
      fieldName: "service_areas",
      done: Boolean(typedStaff.service_areas?.length),
    },
  ];
  const completionDone = completionItems.filter((item) => item.done).length;
  const completionTotal = completionItems.length;

  const onboardingItems = [
    { label: "Sign-in account created", done: Boolean(typedStaff.auth_user_id), href: null as string | null },
    { label: "Role set", done: Boolean(typedStaff.role_id), href: null },
    { label: "Gender selected (for matching)", done: Boolean(typedStaff.gender), href: null },
    { label: "Active account", done: typedStaff.active, href: null },
    { label: "Bookable for visits", done: typedStaff.can_take_bookings, href: null },
    {
      label: "Availability set up",
      done: typedStaff.availability_mode === "use_global" || (availabilityRules?.length ?? 0) > 0,
      href: `/admin/staff/${staffId}/availability`,
    },
  ];
  const onboardingDone = onboardingItems.filter((item) => item.done).length;
  const onboardingTotal = onboardingItems.length;

  // Prev / next sibling staff for header quick-jump arrows.
  const siblings = (siblingStaff ?? []) as { id: string; name: string }[];
  const currentIndex = siblings.findIndex((row) => row.id === staffId);
  const prevSibling =
    currentIndex > 0 ? siblings[currentIndex - 1] : null;
  const nextSibling =
    currentIndex >= 0 && currentIndex < siblings.length - 1
      ? siblings[currentIndex + 1]
      : null;

  const status = statusFamily(typedStaff);
  const showAvailabilityTab = canShowAdminPanels || isOwnProfile;
  const roleDisplay =
    typedStaff.roles?.display_label || typedStaff.roles?.name || "No role assigned";
  const roleSlug = typedStaff.roles?.name ?? "—";
  const initials = typedStaff.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((piece) => Array.from(piece)[0] ?? "")
    .join("")
    .toUpperCase();

  // The viewer might be on their own staff page but lack admin scope; we still want to
  // surface the editable safe-field subset. `showProfileEditor` mirrors the existing flag.
  const showProfileEditor = canEditSafeProfile || canShowAdminPanels;

  return (
    <div className="grid gap-6 pb-24 lg:pb-0">
      {/* Breadcrumb */}
      <div className="mb-2">
        <Link
          href="/admin/staff"
          className="inline-flex items-center gap-1.5 rounded-sm text-sm text-[var(--admin-text-muted)] outline-none transition-colors hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-surface-page)]"
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />
          Team directory
        </Link>
      </div>

      {/* Flat page header — replaces decorative banner-avatar (Brief §5.2) */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {typedStaff.profile_photo_path ? (
            // User-supplied avatar served from Supabase storage; next/image
            // would require remotePatterns config + width/height that fight
            // the tailwind sizing.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={typedStaff.profile_photo_path}
              alt=""
              aria-hidden="true"
              className="size-10 shrink-0 rounded-full object-cover ring-1 ring-[var(--admin-border)]"
            />
          ) : (
            <span
              aria-hidden="true"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
              style={{
                background: `oklch(93% 0.035 ${hueFromId(typedStaff.id)})`,
                color: `oklch(28% 0.10 ${hueFromId(typedStaff.id)})`,
              }}
              title={isOwnProfile ? `You (${typedStaff.name})` : typedStaff.name}
            >
              {initials || <UserIcon className="size-5" aria-hidden="true" />}
            </span>
          )}
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="font-display text-[clamp(1.5rem,2.5vw,1.95rem)] font-semibold leading-tight tracking-[-0.02em] text-[var(--admin-heading)]">
                {typedStaff.name}
              </h1>
              <AdminStatusBadge value={status.label} tone={status.tone} />
            </div>
            <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
              {isOwnProfile ? "Your profile" : "Staff profile"}
            </p>
            {canViewContactFields && typedStaff.email ? (
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-[var(--admin-text-muted)]">
                <Mail className="size-3.5" aria-hidden="true" />
                <a
                  href={`mailto:${typedStaff.email}`}
                  className="rounded-sm outline-none transition-colors hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 focus-visible:ring-offset-2"
                >
                  {typedStaff.email}
                </a>
              </p>
            ) : null}
            {lastModifiedRow ? (
              <p className="mt-1 text-xs text-[var(--admin-text-muted)]">
                Last modified{" "}
                {lastModifiedActorName ? `by ${lastModifiedActorName} ` : ""}
                {relativeTime(lastModifiedRow.created_at)}
              </p>
            ) : null}
          </div>
        </div>

        {/* Prev / next quick-jump arrows */}
        {teamAccess.access && (prevSibling || nextSibling) ? (
          <nav
            aria-label="Staff navigation"
            className="flex shrink-0 items-center gap-1 self-start"
          >
            {prevSibling ? (
              <Link
                href={`/admin/staff/${prevSibling.id}`}
                aria-label={`Previous staff: ${prevSibling.name}`}
                title={`Previous staff: ${prevSibling.name}`}
                className="inline-flex size-11 sm:size-9 items-center justify-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 focus-visible:ring-offset-2"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </Link>
            ) : (
              <span
                aria-hidden="true"
                className="inline-flex size-11 sm:size-9 items-center justify-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)]/40 bg-transparent text-[var(--admin-text-muted)]/40"
              >
                <ChevronLeft className="size-4" />
              </span>
            )}
            {nextSibling ? (
              <Link
                href={`/admin/staff/${nextSibling.id}`}
                aria-label={`Next staff: ${nextSibling.name}`}
                title={`Next staff: ${nextSibling.name}`}
                className="inline-flex size-11 sm:size-9 items-center justify-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 focus-visible:ring-offset-2"
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </Link>
            ) : (
              <span
                aria-hidden="true"
                className="inline-flex size-11 sm:size-9 items-center justify-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)]/40 bg-transparent text-[var(--admin-text-muted)]/40"
              >
                <ChevronRight className="size-4" />
              </span>
            )}
          </nav>
        ) : null}
      </header>

      {/* Keyboard shortcuts: Cmd+S save, Cmd+[/] tab swap, Cmd+arrow prev/next */}
      <StaffDetailShortcuts
        staffId={staffId}
        availabilityHref={showAvailabilityTab ? `/admin/staff/${staffId}/availability` : null}
        prevHref={prevSibling ? `/admin/staff/${prevSibling.id}` : null}
        nextHref={nextSibling ? `/admin/staff/${nextSibling.id}` : null}
      />

      {/* Inactive banner (Brief §6 — above tab strip) */}
      {!typedStaff.active ? (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-[var(--admin-radius-card)] border border-[var(--admin-status-restricted-border)] bg-[var(--admin-status-restricted-bg)] px-3 py-2.5 text-sm text-[var(--admin-status-restricted-text)]"
        >
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>This staff member is inactive.</p>
        </div>
      ) : null}

      {/* Tab strip — TabPills with aria-current, Therapy Blue fill on active (Sam #3 fix). */}
      <nav
        aria-label="Staff sections"
        className="-mx-1 flex gap-1 overflow-x-auto rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-1"
      >
        <Link
          href={`/admin/staff/${staffId}`}
          aria-current="page"
          className="inline-flex min-h-9 shrink-0 items-center rounded-[6px] bg-[var(--admin-primary)] px-3 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
        >
          Profile
        </Link>
        {showAvailabilityTab ? (
          <Link
            href={`/admin/staff/${staffId}/availability`}
            className="inline-flex min-h-9 shrink-0 items-center rounded-[6px] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            Availability
          </Link>
        ) : null}
        {showAvailabilityTab ? (
          <Link
            href={`/admin/staff/${staffId}/performance`}
            className="inline-flex min-h-9 shrink-0 items-center rounded-[6px] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            Performance
          </Link>
        ) : null}
      </nav>

      {/* Two-column workstation grid */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        {/* ── Main column ─────────────────────────────────────────────────── */}
        <div className="grid min-w-0 gap-6">
          {/* L1 — Profile editor or read-only `dl` */}
          {showProfileEditor ? (
            <AdminPanel title="Profile">
              <StaffProfileForm
                staff={{ ...typedStaff, role_id: typedStaff.role_id ?? "" }}
                roles={roles ?? []}
                canManageUsers={canShowAdminPanels}
                canEditSafeProfile={canEditSafeProfile}
                canAssignRoles={canAssignStaffRoles(profile)}
              />
            </AdminPanel>
          ) : (
            <AdminPanel title="Profile">
              <ReadOnlyProfile staff={typedStaff} />
            </AdminPanel>
          )}

          {/* L2 — Assigned bookings */}
          <AdminPanel
            title="Assigned bookings"
            description={`${upcomingAssignments.length} upcoming · ${visiblePastAssignments.length} past visible.`}
            footer={
              canShowAdminPanels || typedAssignments.length > 0 ? (
                <Link
                  // C-16 Step 14 (N7) — was `?staffId=${staffId}&view=upcoming`:
                  // /admin/bookings has never read a `staffId` param (only
                  // `assigned_staff`), so this link silently filtered to
                  // NOTHING staff-specific, and `view=upcoming` meant past
                  // assignments had no path here at all regardless. Both
                  // fixed: `assigned_staff` actually scopes the list, and
                  // `view=all` matches what "Show all assignments" claims —
                  // that destination is itself fully paginated (C-16 Phase C),
                  // so it always reaches every assignment, never a second cap.
                  href={`/admin/bookings?assigned_staff=${staffId}&view=all`}
                  className="inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold text-[var(--admin-primary)] outline-none transition-colors hover:text-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 focus-visible:ring-offset-2"
                  title="Open the bookings list filtered to this staff member"
                >
                  Show all assignments
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              ) : null
            }
          >
            {typedAssignments.length === 0 ? (
              <EmptyState
                icon={CalendarRange}
                title="No assigned bookings yet"
                message={
                  canShowAdminPanels
                    ? "Assign them to a booking from the bookings list or the booking detail page."
                    : "Assignments will show up here once they're allocated."
                }
                compact
              />
            ) : (
              <div className="grid gap-3">
                {upcomingAssignments.map((assignment) => (
                  <AssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                    canViewClientWorkloadContext={showClientWorkloadContext}
                    canOpen={canOpenWorkloadBookings}
                  />
                ))}
                {visiblePastAssignments.length > 0 ? (
                  <details className="group rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)]/60 px-3 py-2 text-sm">
                    <summary className="cursor-pointer list-none rounded-sm text-sm font-medium text-[var(--admin-body)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 focus-visible:ring-offset-2">
                      <span className="inline-flex items-center gap-1.5">
                        <ChevronRight
                          className="size-3.5 transition-transform group-open:rotate-90 motion-reduce:transition-none"
                          aria-hidden="true"
                        />
                        Past assignments ({visiblePastAssignments.length})
                      </span>
                    </summary>
                    <div className="mt-3 grid gap-3">
                      {visiblePastAssignments.map((assignment) => (
                        <AssignmentCard
                          key={assignment.id}
                          assignment={assignment}
                          canViewClientWorkloadContext={showClientWorkloadContext}
                          canOpen={canOpenWorkloadBookings}
                          past
                        />
                      ))}
                    </div>
                  </details>
                ) : null}
                {/* C-16 Step 14 (N7) — the true total, surfaced. Neither the
                    16-row fetch nor the panel's own 8-visible past slice is
                    the whole picture; this makes that explicit instead of
                    silently truncating, and points at the (now-fixed) footer
                    link that reaches every assignment. */}
                {hasHiddenAssignments ? (
                  <p className="text-xs text-[var(--admin-text-muted)]">
                    Showing {typedAssignments.length} of {assignmentsTotal} total
                    assignments, most recent first.{" "}
                    <Link
                      href={`/admin/bookings?assigned_staff=${staffId}&view=all`}
                      className="font-semibold text-[var(--admin-primary)] underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                    >
                      View the full booking history
                    </Link>
                    .
                  </p>
                ) : null}
              </div>
            )}
          </AdminPanel>

          {/* L3 — Audit history (admin scope only; full panel when populated, single-line Ghost when empty) */}
          {teamAccess.canViewAudit ? (
            (auditLogs ?? []).length === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)]/40 px-4 py-3 text-sm">
                <span className="text-[var(--admin-text-muted)]">
                  No recent audit activity recorded.
                </span>
                <Link
                  href={`/admin/audit?target_type=staff&target_id=${staffId}`}
                  className="inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold text-[var(--admin-primary)] outline-none transition-colors hover:text-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 focus-visible:ring-offset-2"
                  title="Open the audit log filtered to this staff member"
                >
                  Open audit trail
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </div>
            ) : (
              <AdminPanel
                title="Audit history"
                footer={
                  <Link
                    href={`/admin/audit?target_type=staff&target_id=${staffId}`}
                    className="inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold text-[var(--admin-primary)] outline-none transition-colors hover:text-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 focus-visible:ring-offset-2"
                    title="Open the audit log filtered to this staff member"
                  >
                    Open audit trail
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                }
              >
                <ul className="grid gap-2.5">
                  {(auditLogs ?? []).map((event) => (
                    <li
                      key={event.id}
                      className="flex items-start justify-between gap-3 border-b border-[var(--admin-border)] pb-2.5 last:border-0 last:pb-0"
                    >
                      <span className="text-sm text-[var(--admin-body)]">
                        {AUDIT_VERB_PHRASES[event.action_type] ??
                          event.action_type.replace(/_/g, " ")}
                      </span>
                      <time
                        className="shrink-0 text-xs text-[var(--admin-text-muted)]"
                        dateTime={event.created_at}
                      >
                        {relativeTime(event.created_at)}
                      </time>
                    </li>
                  ))}
                </ul>
              </AdminPanel>
            )
          ) : null}
        </div>

        {/* ── Right rail (sticky on xl+) ────────────────────────────────── */}
        <aside className="grid gap-4 xl:sticky xl:top-[var(--admin-top-offset,1.5rem)] xl:self-start">
          {/* R1 — Identity (status chip lives in header; rail panel surfaces the identity ledger only) */}
          <AdminPanel
            title="Identity"
            titleAs="h3"
            density="compact"
            badge={isOwnProfile ? <AdminStatusBadge value="You" tone="success" compact /> : null}
          >
            <div className="grid gap-3 text-sm">
              <dl className="grid gap-2 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-xs font-medium text-[var(--admin-text-muted)]">Gender</dt>
                  <dd className="font-medium capitalize text-[var(--admin-heading)]">
                    {typedStaff.gender}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-xs font-medium text-[var(--admin-text-muted)]">Role</dt>
                  <dd
                    className="text-right font-medium text-[var(--admin-heading)]"
                    title={`Database role: ${roleSlug}`}
                  >
                    {roleDisplay}
                  </dd>
                </div>
              </dl>
              {showAvailabilityTab ? (
                <div className="flex flex-col gap-2">
                  <Link
                    href={`/admin/staff/${staffId}/availability`}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--admin-primary)] outline-none transition-colors hover:text-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 rounded-sm"
                    title="Open this staff member's availability tab"
                  >
                    Open availability
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                  <Link
                    href={`/admin/staff/${staffId}/performance`}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--admin-primary)] outline-none transition-colors hover:text-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 rounded-sm"
                    title="Open this staff member's performance tab"
                  >
                    Open performance
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </div>
              ) : null}
            </div>
          </AdminPanel>

          {/* R2 — Profile completion */}
          {canShowAdminPanels || isOwnProfile ? (
            <AdminPanel
              title="Profile completion"
              titleAs="h3"
              description={`${completionDone} of ${completionTotal} done.`}
              density="compact"
              badge={
                <AdminStatusBadge
                  value={`${completionDone}/${completionTotal}`}
                  tone={checklistTone(completionDone, completionTotal)}
                  compact
                />
              }
            >
              <ul className="grid gap-1.5">
                {completionItems.map((item) => (
                  <ChecklistRow
                    key={item.label}
                    label={item.label}
                    done={item.done}
                    addFocusFieldName={canEditSafeProfile && !item.done ? item.fieldName : null}
                  />
                ))}
              </ul>
            </AdminPanel>
          ) : null}

          {/* R3 — Onboarding checklist (admin scope only) */}
          {canShowAdminPanels ? (
            <AdminPanel
              title="Onboarding"
              titleAs="h3"
              description={`${onboardingDone} of ${onboardingTotal} done.`}
              density="compact"
              badge={
                <AdminStatusBadge
                  value={`${onboardingDone}/${onboardingTotal}`}
                  tone={checklistTone(onboardingDone, onboardingTotal)}
                  compact
                />
              }
            >
              <ul className="grid gap-1.5">
                {onboardingItems.map((item) => (
                  <ChecklistRow
                    key={item.label}
                    label={item.label}
                    done={item.done}
                    href={item.done ? null : item.href}
                  />
                ))}
              </ul>
            </AdminPanel>
          ) : null}

          {/* R4 — Role and permissions (admin scope only) */}
          {canShowAdminPanels ? (
            <AdminPanel title="Role and permissions" titleAs="h3" density="compact">
              <div className="grid gap-2 text-sm">
                <p
                  className="font-medium text-[var(--admin-heading)]"
                  title={`Database role: ${roleSlug}`}
                >
                  {roleDisplay}
                </p>
                <p className="text-xs text-[var(--admin-text-muted)]">
                  Inherits {permissions.length}{" "}
                  {permissions.length === 1 ? "permission" : "permissions"} from role.
                </p>
                {overrideStats.added > 0 || overrideStats.revoked > 0 ? (
                  <AdminStatusBadge
                    value={`+ ${overrideStats.added} added, ${overrideStats.revoked} revoked`}
                    tone="warning"
                    compact
                    className="w-fit"
                  />
                ) : null}
                {permissions.length > 0 ? (
                  <RolePermissionsList permissions={permissions} />
                ) : null}
              </div>
            </AdminPanel>
          ) : null}

          {/* R5 — Permission overrides (when canManageOverrides) */}
          {canManageOverrides ? (
            isOwnProfile ? (
              <AdminPanel title="Permission overrides" titleAs="h3" tone="restricted" density="compact">
                <p className="text-sm leading-6 text-[var(--admin-body)]">
                  Self overrides are disabled to prevent lockout. Ask another owner-level admin to
                  change your overrides.
                </p>
              </AdminPanel>
            ) : (
              <AdminPanel
                title="Permission overrides"
                titleAs="h3"
                helpLabel="What are permission overrides?"
                helpText={
                  <>
                    Each role grants a fixed bundle of permissions. An
                    override flips a single permission ON or OFF for this
                    one staff member without changing the role itself. Use
                    sparingly: every override is a deviation from the role
                    blueprint and shows up in the audit log.
                  </>
                }
                description="Overrides sit on top of the fixed role bundle."
                density="compact"
              >
                <StaffPermissionOverridesForm
                  staffId={staffId}
                  staffName={typedStaff.name}
                  permissions={allPermissions ?? []}
                  inheritedPermissionIds={inheritedPermissionIds}
                  overrides={overrideMap}
                />
              </AdminPanel>
            )
          ) : null}
        </aside>
      </div>
    </div>
  );
}

// ─── ChecklistRow ───────────────────────────────────────────────────────────

function ChecklistRow({
  label,
  done,
  href = null,
  addFocusFieldName = null,
}: {
  label: string;
  done: boolean;
  href?: string | null;
  addFocusFieldName?: string | null;
}) {
  const Icon = done ? CheckCircle2 : XCircle;
  const tone: AdminTone = done ? "success" : "danger";

  return (
    <li className="flex items-center justify-between gap-3 text-sm">
      <span className="inline-flex min-w-0 items-center gap-2 text-[var(--admin-body)]">
        <Icon
          className={
            tone === "success"
              ? "size-4 shrink-0 text-[var(--admin-status-confirmed-text)]"
              : "size-4 shrink-0 text-[var(--admin-status-cancelled-text)]"
          }
          aria-hidden="true"
        />
        <span className="min-w-0 truncate">{label}</span>
        <span className="sr-only">{done ? "complete" : "missing"}</span>
      </span>
      {!done && href ? (
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--admin-primary)] outline-none transition-colors hover:text-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 rounded-sm"
        >
          Add
          <ArrowRight className="size-3" aria-hidden="true" />
        </Link>
      ) : !done && addFocusFieldName ? (
        <ChecklistFocusLink fieldName={addFocusFieldName} />
      ) : null}
    </li>
  );
}

// Tiny client-side scroll-and-focus Ghost for unsatisfied profile-completion items.
function ChecklistFocusLink({ fieldName }: { fieldName: string }) {
  return (
    <a
      href={`#field-${fieldName}`}
      data-staff-focus-field={fieldName}
      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--admin-primary)] outline-none transition-colors hover:text-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 rounded-sm"
      title={`Jump to the ${fieldName.replace(/_/g, " ")} field on the profile form`}
    >
      Add
      <ArrowRight className="size-3" aria-hidden="true" />
    </a>
  );
}

// ─── ReadOnlyProfile (dl-style fallback for read-only viewers) ───────────────

function ReadOnlyProfile({ staff }: { staff: StaffDetailRow }) {
  const hasAny =
    Boolean(staff.short_bio) ||
    Boolean(staff.specialties?.length) ||
    Boolean(staff.languages?.length) ||
    Boolean(staff.service_areas?.length);

  if (!hasAny) {
    return (
      <p className="text-sm leading-6 text-[var(--admin-text-muted)]">
        This colleague&apos;s profile is still being filled in.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      {staff.short_bio ? (
        <p className="text-sm leading-6 text-[var(--admin-body)]">{staff.short_bio}</p>
      ) : null}
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <ChipDl label="Specialties" values={staff.specialties ?? []} icon={Sparkles} />
        <ChipDl label="Languages" values={staff.languages ?? []} icon={ClipboardList} />
        <ChipDl
          label="Service areas"
          values={staff.service_areas ?? []}
          icon={CalendarCheck}
        />
        <div className="rounded-[var(--admin-radius-control)] bg-[var(--admin-panel-muted)] px-3 py-2">
          <dt className="text-xs font-medium text-[var(--admin-text-muted)]">Gender</dt>
          <dd className="mt-1 font-medium capitalize text-[var(--admin-heading)]">
            {staff.gender}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function ChipDl({
  label,
  values,
  icon: Icon,
}: {
  label: string;
  values: string[];
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-[var(--admin-radius-control)] bg-[var(--admin-panel-muted)] px-3 py-2">
      <dt className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--admin-text-muted)]">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-1.5 flex flex-wrap gap-1.5">
        {values.length === 0 ? (
          <span className="text-sm text-[var(--admin-text-muted)]">—</span>
        ) : (
          values.map((value) => (
            <AdminStatusBadge key={value} value={value} tone="restricted" compact />
          ))
        )}
      </dd>
    </div>
  );
}

// ─── AssignmentCard ─────────────────────────────────────────────────────────

function AssignmentCard({
  assignment,
  canViewClientWorkloadContext,
  canOpen,
  past = false,
}: {
  assignment: AssignmentRow;
  canViewClientWorkloadContext: boolean;
  canOpen: boolean;
  past?: boolean;
}) {
  const booking = assignment.bookings;
  const dateLabel = booking?.booking_date
    ? new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }).format(new Date(booking.booking_date))
    : "No date";
  const timeLabel = booking?.start_time?.slice(0, 5) ?? "";
  const title = canViewClientWorkloadContext
    ? booking?.contact_full_name ?? "Unknown contact"
    : assignment.required_therapist_gender === "female"
      ? "Female-required visit"
      : assignment.required_therapist_gender === "male"
        ? "Male-required visit"
        : "Visit";
  const city = canViewClientWorkloadContext ? booking?.service_city : null;
  const statusBadgeTone: AdminTone =
    booking?.status === "confirmed"
      ? "success"
      : booking?.status === "cancelled"
        ? "danger"
        : "warning";

  const inner = (
    <div className="grid gap-2">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm font-semibold text-[var(--admin-heading)]">{title}</p>
        <AdminStatusBadge
          value={assignment.status.replace(/_/g, " ")}
          tone={statusBadgeTone}
          compact
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--admin-text-muted)]">
        <span className="inline-flex items-center gap-1">
          <CalendarCheck className="size-3" aria-hidden="true" />
          {dateLabel}
          {timeLabel ? ` · ${timeLabel}` : ""}
        </span>
        {city ? (
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" aria-hidden="true" />
            {city}
          </span>
        ) : null}
        {past ? (
          <AdminStatusBadge value="Past" tone="muted" compact />
        ) : null}
      </div>
    </div>
  );

  const baseClasses =
    "rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-3 py-3";

  return canOpen && booking ? (
    <Link
      href={`/admin/bookings/${booking.id}`}
      className={`${baseClasses} block outline-none transition-colors hover:border-[var(--admin-primary)]/35 hover:bg-[var(--admin-panel-muted)]/60 focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55`}
    >
      {inner}
    </Link>
  ) : (
    <div className={baseClasses}>{inner}</div>
  );
}
