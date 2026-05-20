import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  AlertCircle,
  CalendarCheck,
  CheckCircle,
  ChevronRight,
  Clock,
  Languages,
  Lock,
  Mail,
  MapPin,
  Users,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRoleDisplayName, getStaffProfile } from "@/lib/auth/rbac";
import {
  AdminAccessDenied,
  AdminActionGroup,
  AdminFilterBar,
  AdminPageHeader,
  AdminPageScaffold,
  AdminPanel,
  AdminStatusBadge,
} from "../components/admin-ui";
import { EmptyState } from "../components/EmptyState";
import { NewStaffForm } from "./NewStaffForm";
import { getStaffTeamAccess, getStaffTeamSelect, staffProfilesFrom } from "./team-access";

export const metadata = {
  title: "Team - Rahma Therapy Admin",
};

type StaffRole = { name: string; display_label?: string | null };
type StaffDirectoryRow = {
  id: string;
  auth_user_id?: string | null;
  name: string;
  email?: string | null;
  role_id?: string | null;
  gender: string | null;
  active: boolean;
  can_take_bookings: boolean;
  availability_mode: string;
  phone?: string | null;
  short_bio?: string | null;
  specialties?: string[] | null;
  languages?: string[] | null;
  service_areas?: string[] | null;
  roles?: StaffRole | null;
};
type AssignmentRow = {
  assigned_staff_id: string | null;
  status: string;
  bookings: {
    booking_date: string;
    start_time: string;
    status: string;
  } | null;
};
type StaffTone = "success" | "info" | "restricted" | "warning";

type StaffSearchParams = {
  q?: string;
  roleId?: string;
  gender?: string;
  status?: string;
  workload?: string;
  bookable?: string;
  onboarding?: string;
};

interface StaffPageProps {
  searchParams: Promise<StaffSearchParams>;
}

function workloadTone(count: number): StaffTone {
  if (count >= 8) return "warning";
  if (count >= 5) return "info";
  if (count >= 1) return "success";
  return "restricted";
}

function statusChipTone(member: StaffDirectoryRow): { label: string; tone: StaffTone } {
  if (!member.active) return { label: "Inactive", tone: "restricted" };
  if (!member.can_take_bookings) return { label: "Bookings off", tone: "info" };
  return { label: "Active", tone: "success" };
}

function initialOf(name: string): string {
  // Two-letter initials when a surname is present so the directory differentiates
  // members with the same first letter (e.g. "Phase10 ADMIN" â†’ "PA",
  // "Phase10 COORDINATOR" â†’ "PC"). Single-letter fallback when only one token.
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (Array.from(parts[0])[0] ?? "").toUpperCase();
  const first = Array.from(parts[0])[0] ?? "";
  const last = Array.from(parts[parts.length - 1])[0] ?? "";
  return (first + last).toUpperCase();
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export default async function StaffPage({ searchParams }: StaffPageProps) {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  const teamAccess = getStaffTeamAccess(profile);
  if (!teamAccess.access) {
    return (
      <AdminPageScaffold>
        <AdminAccessDenied
          title="Team access limited"
          message="Team directory access is restricted to active staff with directory visibility. Ask the owner if you need access."
        />
      </AdminPageScaffold>
    );
  }

  const adminClient = createSupabaseAdminClient();
  const staffProfiles = staffProfilesFrom(adminClient);
  const staffSelect = getStaffTeamSelect(teamAccess);
  let staff: StaffDirectoryRow[] = [];
  let staffLoadError = false;

  // FPM: getStaffTeamAccess / getStaffTeamSelect / staffProfilesFrom are preserved verbatim (RECON Â§5).
  if (teamAccess.scope === "admin") {
    const { data, error } = await staffProfiles
      .select<StaffDirectoryRow[]>(staffSelect)
      .order("name");
    if (error) staffLoadError = true;
    staff = (data ?? []) as unknown as StaffDirectoryRow[];
  } else if (teamAccess.scope === "assignment") {
    const { data, error } = await staffProfiles
      .select<StaffDirectoryRow[]>(staffSelect)
      .eq("active", true)
      .eq("can_take_bookings", true)
      .order("name");
    if (error) staffLoadError = true;
    staff = (data ?? []) as unknown as StaffDirectoryRow[];
  } else if (teamAccess.scope === "same_gender_team") {
    const [sameGenderResult, ownProfileResult] = await Promise.all([
      staffProfiles
        .select<StaffDirectoryRow[]>(staffSelect)
        .eq("active", true)
        .eq("can_take_bookings", true)
        .eq("gender", profile.gender)
        .order("name"),
      staffProfiles
        .select<StaffDirectoryRow>(staffSelect)
        .eq("id", profile.id)
        .maybeSingle(),
    ]);
    if (sameGenderResult.error || ownProfileResult.error) staffLoadError = true;
    staff = Array.from(
      new Map(
        ([...(sameGenderResult.data ?? []), ownProfileResult.data].filter(Boolean) as StaffDirectoryRow[])
          .map((member) => [member.id, member])
      ).values()
    ).sort((left, right) => left.name.localeCompare(right.name));
  }

  const staffIds = staff.map((member) => member.id);
  const { data: assignments } =
    staffIds.length > 0
      ? await adminClient
          .from("booking_assignments")
          .select("assigned_staff_id, status, bookings(booking_date, start_time, status)")
          .in("assigned_staff_id", staffIds)
      : { data: [] };
  const typedAssignments = (assignments ?? []) as unknown as AssignmentRow[];

  const { data: rolesData } = teamAccess.canCreateStaff
    ? await supabase
        .from("roles")
        .select("id, name, display_label, active, sort_order")
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true })
    : { data: [] };
  const roles = rolesData ?? [];

  // Build a roles-options list for the filter strip (admin scope shows the full active set).
  const roleFilterOptions =
    teamAccess.scope === "admin" || teamAccess.scope === "assignment"
      ? roles.length > 0
        ? roles
        : Array.from(
            new Map(
              staff
                .map((member) =>
                  member.role_id && member.roles
                    ? [member.role_id, { id: member.role_id, ...member.roles }]
                    : null
                )
                .filter(Boolean) as [string, { id: string; name: string; display_label?: string | null }][]
            ).values()
          )
      : [];

  // â”€â”€â”€ Search-param reads â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // FAKE: BUILD-staff-filter-query â€” server-side filtering is currently a no-op;
  // we read the params, render chips, and apply filters client-side from the
  // page-load data. Server query stays untouched (FPM Â§5). Phase 7 swap-in lands
  // the SQL filter on the data-access helpers, then this block reduces to a
  // pass-through for the chip-render.
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const roleIdRaw = (params.roleId ?? "").trim();
  const roleIdParam = roleIdRaw && isUuid(roleIdRaw) ? roleIdRaw : "";
  const roleIdInvalid = Boolean(roleIdRaw) && !roleIdParam;
  const genderParam = ["female", "male"].includes(params.gender ?? "")
    ? (params.gender as "female" | "male")
    : "";
  const statusParam = ["active", "inactive"].includes(params.status ?? "")
    ? (params.status as "active" | "inactive")
    : "";
  const workloadParam = params.workload === "zero" ? "zero" : "";
  const bookableParam = params.bookable === "true" ? "true" : "";
  const onboardingParam = params.onboarding === "incomplete" ? "incomplete" : "";

  const filtersActive = Boolean(
    q ||
      roleIdParam ||
      roleIdInvalid ||
      genderParam ||
      statusParam ||
      workloadParam ||
      bookableParam ||
      onboardingParam
  );

  // Per-member workload count over the next 7 days (existing logic preserved).
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 7);
  const horizonIso = horizon.toISOString().slice(0, 16);
  const nowIso = new Date().toISOString().slice(0, 16);

  function workloadFor(memberId: string): number {
    return typedAssignments.filter((assignment) => {
      const booking = assignment.bookings;
      if (!booking) return false;
      if (assignment.assigned_staff_id !== memberId) return false;
      if (!["pending", "confirmed"].includes(booking.status)) return false;
      const stamp = `${booking.booking_date}T${booking.start_time}`;
      return stamp >= nowIso && stamp <= horizonIso;
    }).length;
  }

  function onboardingComplete(member: StaffDirectoryRow): number {
    return [
      Boolean(member.auth_user_id),
      Boolean(member.role_id),
      Boolean(member.gender),
      member.active,
      member.can_take_bookings,
      Boolean(member.availability_mode),
    ].filter(Boolean).length;
  }

  // Client-side filter pass over the loaded staff array.
  const matchesQ = (member: StaffDirectoryRow) => {
    if (!q) return true;
    if (q.length < 2) return true;
    const needle = q.toLowerCase();
    return (
      member.name.toLowerCase().includes(needle) ||
      (member.email ?? "").toLowerCase().includes(needle)
    );
  };

  const matchesRole = (member: StaffDirectoryRow) =>
    !roleIdParam || member.role_id === roleIdParam;
  const matchesGender = (member: StaffDirectoryRow) =>
    !genderParam || member.gender === genderParam;
  const matchesStatus = (member: StaffDirectoryRow) =>
    !statusParam ||
    (statusParam === "active" ? member.active : !member.active);
  const matchesBookable = (member: StaffDirectoryRow) =>
    !bookableParam || (member.active && member.can_take_bookings);
  const matchesWorkload = (member: StaffDirectoryRow) =>
    !workloadParam || workloadFor(member.id) === 0;
  const matchesOnboarding = (member: StaffDirectoryRow) =>
    !onboardingParam || onboardingComplete(member) < 6;

  const filtered = staff.filter(
    (member) =>
      matchesQ(member) &&
      matchesRole(member) &&
      matchesGender(member) &&
      matchesStatus(member) &&
      matchesBookable(member) &&
      matchesWorkload(member) &&
      matchesOnboarding(member)
  );

  // Active / inactive split for admin scope (other scopes return only active rows).
  const activeMembers = filtered.filter((member) => member.active);
  const inactiveMembers = filtered.filter((member) => !member.active);

  // FAKE: BUILD-staff-workload-aggregates â€” derived client-side from the
  // page-load data. Once the aggregate query lands these numbers come from the
  // server in one round-trip; for now they fall back gracefully and match the
  // visible rows.
  const aggregate = {
    active: staff.filter((member) => member.active).length,
    bookable: staff.filter((member) => member.active && member.can_take_bookings).length,
    noAssignments: staff.filter(
      (member) => member.active && workloadFor(member.id) === 0
    ).length,
    onboardingIncomplete: staff.filter(
      (member) => member.active && onboardingComplete(member) < 6
    ).length,
  };

  const pageTitle = teamAccess.scope === "admin" ? "Staff Management" : "Team Directory";
  const pageDescription =
    teamAccess.scope === "admin"
      ? "Manage your team, their roles, and booking availability."
      : teamAccess.scope === "assignment"
        ? "Active bookable staff for assignment planning."
        : "Active same-gender team members and your own profile.";

  function buildUrl(overrides: Partial<Record<string, string>>): string {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (roleIdParam) next.set("roleId", roleIdParam);
    if (genderParam) next.set("gender", genderParam);
    if (statusParam) next.set("status", statusParam);
    if (workloadParam) next.set("workload", workloadParam);
    if (bookableParam) next.set("bookable", bookableParam);
    if (onboardingParam) next.set("onboarding", onboardingParam);
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined || value === "") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    const qs = next.toString();
    return qs ? `/admin/staff?${qs}` : "/admin/staff";
  }

  const isAdminScope = teamAccess.scope === "admin";
  const isAssignmentScope = teamAccess.scope === "assignment";

  // Active filter chips (always rendered when filters are present)
  const chips: { key: string; label: string; clearTo: string }[] = [];
  if (q) chips.push({ key: "q", label: `Search: "${q}"`, clearTo: buildUrl({ q: "" }) });
  if (roleIdParam) {
    const roleMatch = roleFilterOptions.find((role) => role.id === roleIdParam);
    const label = roleMatch ? getRoleDisplayName(roleMatch) : "Selected";
    chips.push({ key: "roleId", label: `Role: ${label}`, clearTo: buildUrl({ roleId: "" }) });
  }
  if (roleIdInvalid) {
    chips.push({
      key: "roleId-invalid",
      label: "Role: [invalid]",
      clearTo: buildUrl({ roleId: "" }),
    });
  }
  if (genderParam) {
    chips.push({
      key: "gender",
      label: `Gender: ${genderParam === "female" ? "Female" : "Male"}`,
      clearTo: buildUrl({ gender: "" }),
    });
  }
  if (statusParam) {
    chips.push({
      key: "status",
      label: `Status: ${statusParam === "active" ? "Active" : "Inactive"}`,
      clearTo: buildUrl({ status: "" }),
    });
  }
  if (workloadParam) {
    chips.push({
      key: "workload",
      label: "No assignments this week",
      clearTo: buildUrl({ workload: "" }),
    });
  }
  if (bookableParam) {
    chips.push({
      key: "bookable",
      label: "Bookable only",
      clearTo: buildUrl({ bookable: "" }),
    });
  }
  if (onboardingParam) {
    chips.push({
      key: "onboarding",
      label: "Onboarding incomplete",
      clearTo: buildUrl({ onboarding: "" }),
    });
  }

  return (
    <AdminPageScaffold>
      <AdminPageHeader
        title={pageTitle}
        actions={
          teamAccess.canCreateStaff ? (
            <div className="hidden sm:block">
              <NewStaffForm roles={roles} />
            </div>
          ) : null
        }
      />

      {/* Description rendered outside AdminPageHeader so it wraps cleanly at 375.
          Width clamped to (100vw âˆ’ 2rem) so it respects the viewport even when
          the shared AdminPageScaffold grid track auto-expands to fit a wider
          sibling (filter form, AdminPanel). */}
      <p className="-mt-2 mb-4 max-w-[calc(100vw-2rem)] text-sm leading-6 text-balance text-[var(--admin-text-muted)] sm:mb-6 sm:max-w-3xl">
        {pageDescription}
      </p>

      {teamAccess.canCreateStaff ? (
        <div className="mb-4 sm:hidden">
          <NewStaffForm roles={roles} fullWidth />
        </div>
      ) : null}

      {isAdminScope ? (
        <section
          aria-label="Team health at a glance"
          data-redesign-backend="FAKE"
          data-redesign-fake="staff-workload-aggregates"
          className="mb-4 flex min-w-0 flex-col gap-x-4 gap-y-2 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:px-4"
        >
          <div className="flex shrink-0 items-center gap-2">
            <Activity
              className="size-4 shrink-0 text-[var(--admin-primary)]"
              aria-hidden="true"
            />
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[var(--admin-heading)]">
              Team health
            </span>
          </div>
          <span
            aria-hidden="true"
            className="hidden h-4 w-px shrink-0 bg-[var(--admin-border)] sm:inline-block"
          />
          {/* Pills: 2x2 grid up to lg (forces a clean wrap at tablet sizes
              instead of the awkward 3+1 row split flex-wrap produces), then
              inline single-row flex at lg+ where all four fit comfortably. */}
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5 lg:flex lg:flex-wrap lg:items-center">
            <WorkloadSegment
              href={buildUrl({ status: "active" })}
              title="Filter to active staff"
              label="Active"
              count={aggregate.active}
              icon={CheckCircle}
              tone="success"
              isActive={statusParam === "active"}
            />
            <WorkloadSegment
              href={buildUrl({ bookable: "true" })}
              title="Filter to bookable staff"
              label="Bookable"
              count={aggregate.bookable}
              icon={CalendarCheck}
              tone="muted"
              isActive={bookableParam === "true"}
            />
            <WorkloadSegment
              href={buildUrl({ workload: "zero" })}
              title="Filter to staff with no assignments this week"
              label="No assignments"
              count={aggregate.noAssignments}
              icon={Clock}
              tone={aggregate.noAssignments > 0 ? "info" : "muted"}
              isActive={workloadParam === "zero"}
            />
            <WorkloadSegment
              href={buildUrl({ onboarding: "incomplete" })}
              title="Filter to onboarding-incomplete staff"
              label="Onboarding incomplete"
              count={aggregate.onboardingIncomplete}
              icon={AlertCircle}
              tone={aggregate.onboardingIncomplete > 0 ? "warning" : "muted"}
              isActive={onboardingParam === "incomplete"}
            />
          </div>
        </section>
      ) : null}

      <AdminFilterBar
        actions={
          filtersActive ? (
            <Link
              href="/admin/staff"
              className="inline-flex h-9 items-center rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              Clear filters
            </Link>
          ) : null
        }
      >
        <form
          method="get"
          action="/admin/staff"
          data-redesign-backend="FAKE"
          data-redesign-fake="staff-filter-query"
          className="grid w-full min-w-0 gap-3 sm:grid-cols-2 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
        >
          <label className="grid min-w-0 gap-1">
            <span className="text-xs font-medium text-[var(--admin-text-muted)]">Search</span>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search by name or email"
              minLength={2}
              className="h-10 w-full min-w-0 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
            />
          </label>

          {(isAdminScope || isAssignmentScope) && roleFilterOptions.length > 0 ? (
            <label className="grid min-w-0 gap-1">
              <span className="text-xs font-medium text-[var(--admin-text-muted)]">Role</span>
              <select
                name="roleId"
                defaultValue={roleIdParam}
                className="h-10 w-full min-w-0 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
              >
                <option value="">Any role</option>
                {roleFilterOptions.map((role) => (
                  <option key={role.id} value={role.id}>
                    {getRoleDisplayName(role)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {isAdminScope ? (
            <label className="grid min-w-0 gap-1">
              <span className="text-xs font-medium text-[var(--admin-text-muted)]">Gender</span>
              <select
                name="gender"
                defaultValue={genderParam}
                className="h-10 w-full min-w-0 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
              >
                <option value="">Any gender</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </label>
          ) : null}

          {isAdminScope ? (
            <label className="grid min-w-0 gap-1">
              <span className="text-xs font-medium text-[var(--admin-text-muted)]">Status</span>
              <select
                name="status"
                defaultValue={statusParam}
                className="h-10 w-full min-w-0 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
              >
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          ) : null}

          {/* Preserve current advanced flags across submit */}
          {bookableParam ? <input type="hidden" name="bookable" value={bookableParam} /> : null}
          {workloadParam ? <input type="hidden" name="workload" value={workloadParam} /> : null}
          {onboardingParam ? <input type="hidden" name="onboarding" value={onboardingParam} /> : null}

          <button
            type="submit"
            className="h-10 w-full self-end rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 sm:col-span-full md:col-span-1 md:w-auto"
          >
            Apply filters
          </button>
        </form>
      </AdminFilterBar>

      {chips.length > 0 ? (
        <AdminActionGroup className="mb-4 -mt-2 gap-2">
          {chips.map((chip) => (
            <Link
              key={chip.key}
              href={chip.clearTo}
              className="inline-flex items-center gap-1.5 rounded-full bg-[oklch(94%_0.008_280)] px-3 py-1 text-xs font-medium text-[oklch(30%_0.02_280)] outline-none transition-colors hover:bg-[oklch(91%_0.012_280)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              <span>{chip.label}</span>
              <span aria-hidden="true">Ã—</span>
              <span className="sr-only">Remove filter</span>
            </Link>
          ))}
        </AdminActionGroup>
      ) : null}

      {filtersActive && !staffLoadError && filtered.length > 0 ? (
        <p
          role="status"
          aria-live="polite"
          className="mb-3 px-1 text-xs text-[var(--admin-text-muted)]"
        >
          Showing <span className="tabular-nums font-medium text-[var(--admin-body)]">{filtered.length}</span> of{" "}
          <span className="tabular-nums font-medium text-[var(--admin-body)]">{staff.length}</span>{" "}
          {staff.length === 1 ? "member" : "members"}.
        </p>
      ) : null}

      {staffLoadError ? (
        <div
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          className="flex flex-col items-start gap-3 rounded-[var(--admin-radius-card)] border border-[oklch(88%_0.045_20)] bg-[oklch(95.5%_0.028_20)] p-4 text-sm text-[oklch(26%_0.14_25)] sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2.5">
            <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>Couldn&rsquo;t load the team. Try refreshing.</span>
          </div>
          <Link
            href="/admin/staff"
            className="inline-flex h-9 items-center rounded-[var(--admin-radius-control)] border border-[oklch(88%_0.045_20)] bg-transparent px-3 text-sm font-medium text-[oklch(26%_0.14_25)] outline-none transition-colors hover:bg-[oklch(93%_0.04_20)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            Try again
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <AdminPanel>
          {filtersActive ? (
            <EmptyState
              icon={Users}
              title="No staff match"
              message="Try adjusting or clearing your filters."
              action={{ label: "Clear filters", href: "/admin/staff" }}
            />
          ) : isAdminScope ? (
            <EmptyState
              icon={Users}
              title="No staff yet. Add the first team member."
              message="Therapists, coordinators, and admins all live in this directory."
              actions={
                teamAccess.canCreateStaff ? <NewStaffForm roles={roles} /> : undefined
              }
            />
          ) : isAssignmentScope ? (
            <EmptyState
              icon={Users}
              title="No bookable staff in your assignment pool yet"
              message="Bookable team members appear here once they're set up."
            />
          ) : (
            <EmptyState
              icon={Users}
              title="No same-gender team members visible. Your profile is still here."
              message="Your colleagues in the same-gender team will appear here when they're added."
            />
          )}
        </AdminPanel>
      ) : (
        <AdminPanel>
          <ul className="list-none divide-y divide-[var(--admin-border)] p-0" aria-label="Team members">
            {activeMembers.map((member) => (
              <li key={member.id}>
                <StaffRow
                  member={member}
                  isSelf={member.id === profile.id}
                  showRole={teamAccess.canViewAdminFields || isAssignmentScope}
                  showContact={teamAccess.canViewContactFields}
                  showWorkload={
                    teamAccess.canViewWorkloadSummary &&
                    (teamAccess.scope !== "same_gender_team" || member.id === profile.id)
                  }
                  showAdminMeta={teamAccess.canViewAdminFields}
                  workload={workloadFor(member.id)}
                  onboardingScore={onboardingComplete(member)}
                  showTherapistYouChip={teamAccess.scope === "same_gender_team"}
                />
              </li>
            ))}
          </ul>

          {isAdminScope && inactiveMembers.length > 0 ? (
            <details className="group mt-4 border-t border-[var(--admin-border)] pt-4">
              <summary
                title="Inactive staff. Sign-in is blocked at the middleware."
                className="flex cursor-pointer list-none items-center gap-2 rounded-[var(--admin-radius-control)] bg-[oklch(94%_0.008_280)]/40 px-2.5 py-1.5 text-sm font-medium text-[oklch(30%_0.02_280)] outline-none transition-colors hover:bg-[oklch(94%_0.008_280)]/70 focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 [&::-webkit-details-marker]:hidden"
              >
                <ChevronRight
                  className="size-4 shrink-0 transition-transform group-open:rotate-90"
                  aria-hidden="true"
                />
                <Lock className="size-3.5 shrink-0" aria-hidden="true" />
                Inactive members ({inactiveMembers.length})
              </summary>
              <ul className="mt-3 list-none divide-y divide-[var(--admin-border)] p-0" aria-label="Inactive team members">
                {inactiveMembers.map((member) => (
                  <li key={member.id}>
                    <StaffRow
                      member={member}
                      isSelf={member.id === profile.id}
                      showRole={teamAccess.canViewAdminFields}
                      showContact={teamAccess.canViewContactFields}
                      showWorkload={false}
                      showAdminMeta={teamAccess.canViewAdminFields}
                      workload={0}
                      onboardingScore={onboardingComplete(member)}
                          showTherapistYouChip={false}
                    />
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </AdminPanel>
      )}

      {/* Bottom spacer â€” ensures the last row + inactive disclosure don't sit
          under the mobile bottom nav (h-14 + safe-area-inset-bottom). */}
      <div aria-hidden="true" className="h-8 lg:hidden" />
    </AdminPageScaffold>
  );
}

// â”€â”€â”€ Workload-strip prose segment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function WorkloadSegment({
  href,
  title,
  label,
  count,
  icon: Icon,
  tone = "muted",
  isActive = false,
}: {
  href: string;
  title: string;
  label: string;
  count: number;
  icon: LucideIcon;
  tone?: "muted" | "info" | "warning" | "success";
  isActive?: boolean;
}) {
  // Icon takes tone colour so attention items catch the eye first; the count
  // and label stay quiet so the strip never reads as a KPI tile row.
  const iconColor =
    tone === "warning"
      ? "text-[oklch(40%_0.13_55)]"
      : tone === "info"
        ? "text-[oklch(40%_0.12_55)]"
        : tone === "success"
          ? "text-[oklch(35%_0.085_155)]"
          : "text-[var(--admin-text-muted)]";
  const countWeight =
    tone === "warning" || tone === "info"
      ? "font-semibold text-[var(--admin-heading)]"
      : "font-medium text-[var(--admin-heading)]";
  // Active-filter state: muted-panel background + ring so the operator sees
  // which segment's filter is currently applied.
  const surface = isActive
    ? "bg-[var(--admin-panel-muted)] ring-1 ring-[var(--admin-border)]"
    : "bg-transparent hover:bg-[var(--admin-panel-muted)]/60";
  return (
    <Link
      href={href}
      title={title}
      aria-current={isActive ? "true" : undefined}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 ${surface}`}
    >
      <Icon className={`size-3.5 shrink-0 ${iconColor}`} aria-hidden="true" />
      <span className={`tabular-nums ${countWeight}`}>{count}</span>
      <span className="text-[var(--admin-text-muted)]">{label}</span>
    </Link>
  );
}

// â”€â”€â”€ Avatar token (initialled fallback) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Single Hover Moss fill per brief Â§5 line 53. The initial letter does the
// member-distinguishing work; reserving colour for the named-status chips
// keeps status signal exclusive (no decorative tint can be misread as a
// category badge). Inactive members keep the muted variant.
function Avatar({
  name,
  dim = false,
}: {
  name: string;
  dim?: boolean;
}) {
  return (
    <span
      title={name}
      aria-hidden="true"
      className={
        dim
          ? "inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--admin-panel-muted)] text-[0.8125rem] font-semibold tracking-tight text-[var(--admin-text-muted)]"
          : "inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--admin-hover-mist)] text-[0.8125rem] font-semibold tracking-tight text-[var(--admin-heading)]"
      }
    >
      {initialOf(name)}
    </span>
  );
}

function StatusChipTitle(label: string): string {
  switch (label) {
    case "Active":
      return "Active. Can sign in and accept bookings.";
    case "Bookings off":
      return "Active but not accepting new bookings.";
    case "Inactive":
      return "Inactive. Sign-in blocked.";
    default:
      return label;
  }
}

// â”€â”€â”€ Workload pill (custom â€” CalendarCheck icon over status-tone tokens) â”€â”€â”€â”€â”€â”€

function WorkloadPill({ count }: { count: number }) {
  // Zero-state reads as quiet metadata (no badge fill, Soft Slate text, no icon
  // fill). This keeps a right-rail of zero-workload members from collapsing
  // into a monotone column of Restricted-grey badges. Active counts keep the
  // four-tone ladder.
  if (count === 0) {
    return (
      <span
        title="No upcoming bookings"
        className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--admin-text-muted)]"
      >
        <CalendarCheck className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
        <span>No bookings</span>
      </span>
    );
  }

  const tone = workloadTone(count);
  const bg =
    tone === "warning"
      ? "bg-[oklch(95%_0.05_65)]"
      : tone === "info"
        ? "bg-[oklch(96%_0.038_75)]"
        : "bg-[oklch(93.5%_0.038_155)]";
  const text =
    tone === "warning"
      ? "text-[oklch(26%_0.13_55)]"
      : tone === "info"
        ? "text-[oklch(28%_0.12_55)]"
        : "text-[oklch(22%_0.085_155)]";
  const title =
    count >= 8
      ? "Heavy load. Consider re-balancing."
      : `${count} upcoming bookings in the next 7 days`;
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${bg} ${text}`}
    >
      <CalendarCheck className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="tabular-nums">{count} upcoming</span>
    </span>
  );
}

// â”€â”€â”€ Progress dots â€” thin tick strip for onboarding / profile counts â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ProgressDots({
  completed,
  total,
  tone,
}: {
  completed: number;
  total: number;
  tone: "warning" | "success" | "muted";
}) {
  const filled =
    tone === "warning"
      ? "bg-[oklch(78%_0.13_55)]"
      : tone === "success"
        ? "bg-[oklch(50%_0.085_155)]"
        : "bg-[var(--admin-text-muted)]";
  return (
    <span
      className="inline-flex shrink-0 items-center gap-[2px]"
      aria-hidden="true"
    >
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 w-2.5 rounded-[1px] ${
            i < completed ? filled : "bg-[var(--admin-border)]"
          }`}
        />
      ))}
    </span>
  );
}

// â”€â”€â”€ Staff row â€” h2 title resolves Sam #1 heading skip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StaffRow({
  member,
  isSelf,
  showRole,
  showContact,
  showWorkload,
  showAdminMeta,
  workload,
  onboardingScore,
  showTherapistYouChip,
}: {
  member: StaffDirectoryRow;
  isSelf: boolean;
  showRole: boolean;
  showContact: boolean;
  showWorkload: boolean;
  showAdminMeta: boolean;
  workload: number;
  onboardingScore: number;
  showTherapistYouChip: boolean;
}) {
  const role = (member.roles as StaffRole | null | undefined) ?? null;
  const roleLabel =
    showRole && role
      ? getRoleDisplayName(role)
      : member.can_take_bookings
        ? "Bookable team member"
        : "Team member";
  const status = statusChipTone(member);
  const onboardingTone: StaffTone =
    onboardingScore < 6 ? "warning" : "success";

  return (
    <Link
      href={`/admin/staff/${member.id}`}
      className="group flex items-start gap-3 rounded-[var(--admin-radius-control)] px-2 py-2.5 outline-none transition-colors hover:bg-[var(--admin-panel-muted)]/60 focus-visible:bg-[var(--admin-panel-muted)]/60 focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
    >
      <Avatar name={member.name} dim={!member.active} />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="min-w-0 break-words font-display text-base font-semibold tracking-[-0.01em] text-[var(--admin-heading)]">
              {member.name}
            </h2>
            {showTherapistYouChip && isSelf ? (
              <span title="This is you">
                <AdminStatusBadge value="You" tone="success" compact />
              </span>
            ) : null}
          </div>
          <span
            title={StatusChipTitle(status.label)}
            className="shrink-0"
          >
            <AdminStatusBadge value={status.label} tone={status.tone} compact />
          </span>
        </div>

        {showWorkload ? (
          <div className="mt-2 sm:hidden">
            <WorkloadPill count={workload} />
          </div>
        ) : null}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--admin-text-muted)]">
          <span
            className="font-medium text-[var(--admin-body)]"
            title={role?.name ? `Role: ${roleLabel}` : roleLabel}
          >
            {roleLabel}
          </span>
          {showContact && member.email ? (
            <>
              <span aria-hidden="true">Â·</span>
              <span className="inline-flex min-w-0 max-w-full items-center gap-1">
                <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                {/* [overflow-wrap:anywhere] lets the address break mid-character so
                    its min-content doesn't force the grid track wider than the
                    viewport at 375. Brief allows tightening for layout. */}
                <span className="min-w-0 [overflow-wrap:anywhere]">{member.email}</span>
              </span>
            </>
          ) : null}
          {member.gender || showAdminMeta ? (
            <>
              <span aria-hidden="true">Â·</span>
              <span>Gender: {member.gender ?? "Not set"}</span>
            </>
          ) : null}
        </div>

        {(member.languages?.length || member.service_areas?.length) ? (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--admin-text-muted)]">
            {member.languages?.length ? (
              <span
                className="inline-flex min-w-0 max-w-full items-center gap-1"
                title={member.languages.join(", ")}
              >
                <Languages className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {member.languages.join(", ")}
                </span>
              </span>
            ) : null}
            {member.languages?.length && member.service_areas?.length ? (
              <span aria-hidden="true">Â·</span>
            ) : null}
            {member.service_areas?.length ? (
              <span
                className="inline-flex min-w-0 max-w-full items-center gap-1"
                title={member.service_areas.join(", ")}
              >
                <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {member.service_areas.join(", ")}
                </span>
              </span>
            ) : null}
          </div>
        ) : null}

        {showAdminMeta ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
            <span
              className={
                onboardingTone === "warning"
                  ? "inline-flex items-center gap-1.5 text-[oklch(26%_0.13_55)]"
                  : "inline-flex items-center gap-1.5 text-[oklch(22%_0.085_155)]"
              }
              title={
                onboardingScore < 6
                  ? "Onboarding incomplete. Open the profile to finish setup."
                  : "Onboarding complete"
              }
            >
              <ProgressDots completed={onboardingScore} total={6} tone={onboardingTone} />
              Onboarding {onboardingScore}/6
            </span>
          </div>
        ) : null}

        {member.specialties?.length ? (
          <details className="mt-2 xl:hidden">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-[var(--admin-radius-control)] px-2 py-0.5 text-xs font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 [&::-webkit-details-marker]:hidden">
              {member.specialties.length} specialties
            </summary>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {member.specialties.map((specialty) => (
                <span
                  key={specialty}
                  className="inline-flex items-center rounded-full bg-[oklch(94%_0.008_280)] px-2 py-0.5 text-[0.6875rem] font-medium text-[oklch(30%_0.02_280)]"
                  title={specialty}
                >
                  {specialty}
                </span>
              ))}
            </div>
          </details>
        ) : null}
        {member.specialties?.length ? (
          <div className="mt-2 hidden flex-wrap gap-1.5 xl:flex">
            {member.specialties.slice(0, 3).map((specialty) => (
              <span
                key={specialty}
                className="inline-flex items-center rounded-full bg-[oklch(94%_0.008_280)] px-2 py-0.5 text-[0.6875rem] font-medium text-[oklch(30%_0.02_280)]"
                title={specialty}
              >
                {specialty}
              </span>
            ))}
            {member.specialties.length > 3 ? (
              <span className="text-[0.6875rem] font-medium text-[var(--admin-text-muted)]">
                +{member.specialties.length - 3} more
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2 self-stretch">
        {showWorkload ? (
          <div className="hidden sm:block">
            <WorkloadPill count={workload} />
          </div>
        ) : null}
        <ChevronRight
          className="size-5 self-center text-[var(--admin-text-muted)] transition-transform group-hover:translate-x-0.5 sm:self-end"
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}
