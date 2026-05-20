import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  History,
  ShieldCheck,
  ShieldPlus,
  Users,
} from "lucide-react";
import {
  AdminAccessDenied,
  AdminPageHeader,
  AdminPanel,
  AdminStatusBadge,
} from "../components/admin-ui";
import { EmptyState } from "../components/EmptyState";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  canManageRoleTemplates,
  getRoleDisplayName,
  getStaffProfile,
} from "@/lib/auth/rbac";
import { CreateRoleSheet } from "./CreateRoleSheet";

export const metadata = {
  title: "Roles and permissions â€” Rahma Therapy Admin",
};

type RoleRow = {
  id: string;
  name: string;
  display_label: string | null;
  description: string | null;
  sort_order: number | null;
  active: boolean;
  is_system: boolean;
  role_permissions: { count: number }[] | null;
  staff_profiles: { count: number }[] | null;
};

type Tier = "privileged" | "operational";

function countPermissions(role: RoleRow): number {
  return role.role_permissions?.[0]?.count ?? 0;
}

function countStaff(role: RoleRow): number {
  return role.staff_profiles?.[0]?.count ?? 0;
}

function firstLetter(label: string): string {
  const trimmed = label.trim();
  return trimmed.length > 0 ? trimmed.charAt(0).toUpperCase() : "â€¢";
}

function permissionsLabel(count: number): string {
  return `${count} ${count === 1 ? "permission" : "permissions"}`;
}

function staffLabel(count: number): string {
  // Brief: "{n} staff" is uncountable â€” no plural switch.
  return `${count} staff`;
}

// The seeded "Inactive / Suspended" system role currently lives with
// active=true in the DB, but the brief treats it as the inactive holding role.
// Coerce it so the UI matches operator expectations.
function isInactiveSystemRole(role: RoleRow): boolean {
  return role.is_system && role.name.trim().toLowerCase() === "inactive";
}

function treatAsInactive(role: RoleRow): boolean {
  return !role.active || isInactiveSystemRole(role);
}

function tierOf(role: RoleRow): Tier {
  const lower = role.name.trim().toLowerCase();
  return lower === "owner" || lower === "admin" ? "privileged" : "operational";
}

function groupByTier(rolesIn: RoleRow[]): Array<{ tier: Tier; roles: RoleRow[] }> {
  return rolesIn.reduce<Array<{ tier: Tier; roles: RoleRow[] }>>((acc, role) => {
    const tier = tierOf(role);
    const last = acc[acc.length - 1];
    if (!last || last.tier !== tier) {
      acc.push({ tier, roles: [role] });
    } else {
      last.roles.push(role);
    }
    return acc;
  }, []);
}

const TIER_LABEL: Record<Tier, string> = {
  privileged: "Privileged",
  operational: "Operational",
};

export default async function RolesPage() {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  if (!canManageRoleTemplates(profile)) {
    return (
      <AdminAccessDenied
        title="Roles access limited"
        message="Role and permission management is restricted to the practice owner. Ask the owner if you need a permission changed."
      />
    );
  }

  const { data, error } = await supabase
    .from("roles")
    .select(
      "id, name, display_label, description, sort_order, active, is_system, role_permissions(count), staff_profiles(count)"
    )
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  const roles = (data ?? []) as RoleRow[];
  const activeRoles = roles.filter((role) => !treatAsInactive(role));
  const inactiveRoles = roles.filter((role) => treatAsInactive(role));

  const totalStaff = roles.reduce((sum, role) => sum + countStaff(role), 0);

  const nextSortOrder =
    roles.reduce((max, role) => Math.max(max, role.sort_order ?? 0), 0) + 10;

  const summary = (() => {
    const stem =
      inactiveRoles.length > 0
        ? `${activeRoles.length} active roles, ${inactiveRoles.length} inactive.`
        : `${activeRoles.length} active roles.`;
    return `${stem} ${totalStaff} staff assigned across all roles.`;
  })();

  const tieredActive = groupByTier(activeRoles);
  const showTierLabels = tieredActive.length > 1;

  return (
    <div className="grid gap-6 pb-24 lg:pb-16">
      <AdminPageHeader
        title="Roles and permissions"
        description="What each role can do across the admin."
        actions={<CreateRoleSheet defaultSortOrder={nextSortOrder} />}
      />

      <p className="flex items-center gap-2 text-sm leading-snug text-[var(--admin-text-muted)]">
        <Users className="size-4 shrink-0" aria-hidden="true" />
        <span>{summary}</span>
      </p>

      {error ? (
        <AdminPanel error="Couldn't load roles. Try refreshing.">
          <span className="sr-only">Roles list failed to load.</span>
        </AdminPanel>
      ) : roles.length === 0 ? (
        <AdminPanel>
          <RolesEmptyState defaultSortOrder={nextSortOrder} />
        </AdminPanel>
      ) : (
        <AdminPanel>
          {tieredActive.map((group, idx) => (
            <div key={group.tier} className={idx > 0 ? "mt-5" : undefined}>
              {showTierLabels ? (
                <p
                  className="mb-2 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-[var(--admin-text-muted)]"
                  title={
                    group.tier === "privileged"
                      ? "Privileged roles â€” full or near-full admin reach."
                      : "Operational roles â€” day-to-day clinic work, scoped reach."
                  }
                >
                  {TIER_LABEL[group.tier]}
                </p>
              ) : null}
              <ul className="grid list-none gap-1 pl-0">
                {group.roles.map((role) => (
                  <li key={role.id}>
                    <RoleListRow role={role} />
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {inactiveRoles.length > 0 ? (
            <div className="mt-6">
              <p className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-[var(--admin-text-muted)]">
                Inactive
              </p>
              <details className="group mt-2 rounded-[var(--admin-radius-control)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] px-4 py-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel)] focus-visible:ring-[3px] focus-visible:ring-[var(--admin-focus)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-canvas)] [&::-webkit-details-marker]:hidden">
                  <span>Inactive roles ({inactiveRoles.length})</span>
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-[var(--admin-text-muted)]">
                    <span className="group-open:hidden">
                      <span className="sr-only">Show inactive roles. </span>
                      Show
                    </span>
                    <span className="hidden group-open:inline">
                      <span className="sr-only">Hide inactive roles. </span>
                      Hide
                    </span>
                    <span aria-hidden="true" className="inline-flex group-open:hidden">
                      <ChevronDown className="size-4" />
                    </span>
                    <span aria-hidden="true" className="hidden group-open:inline-flex">
                      <ChevronUp className="size-4" />
                    </span>
                  </span>
                </summary>
                <ul className="mt-3 grid list-none gap-1 pl-0">
                  {inactiveRoles.map((role) => (
                    <li key={role.id}>
                      <RoleListRow role={role} />
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          ) : null}
        </AdminPanel>
      )}
    </div>
  );
}

function RolesEmptyState({ defaultSortOrder }: { defaultSortOrder: number }) {
  return (
    <EmptyState
      icon={ShieldPlus}
      title="No roles defined"
      message="Set up a role to assign staff."
      actions={<CreateRoleSheet defaultSortOrder={defaultSortOrder} />}
    />
  );
}

function RoleListRow({ role }: { role: RoleRow }) {
  const displayName = getRoleDisplayName(role);
  const permCount = countPermissions(role);
  const staffCount = countStaff(role);
  const inactive = treatAsInactive(role);
  const detailHref = `/admin/roles/${role.id}`;
  const auditHref = `/admin/audit?target_type=roles&target_id=${role.id}`;
  const skipLetterToken = isInactiveSystemRole(role);

  return (
    <div className="group relative rounded-[var(--admin-radius-control)] transition-[background-color,box-shadow] duration-150 ease-out hover:bg-[var(--admin-hover-mist)] hover:shadow-[var(--admin-shadow-hover)] focus-within:ring-[3px] focus-within:ring-[var(--admin-focus)]/60 focus-within:ring-offset-2 focus-within:ring-offset-[var(--admin-canvas)]">
      {/* Whole-row overlay link: sits beneath nested links via z-index */}
      <Link
        href={detailHref}
        aria-label={`Open role ${displayName}`}
        className="absolute inset-0 z-0 rounded-[var(--admin-radius-control)] outline-none"
      >
        <span className="sr-only">{`Open role ${displayName}`}</span>
      </Link>

      <div className="pointer-events-none relative z-[1] grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 sm:gap-4 sm:px-4">
        {/* Letter token (left column) */}
        {!skipLetterToken ? (
          <span
            aria-hidden="true"
            title={displayName}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-[var(--admin-radius-control)] bg-[var(--admin-hover-mist)] font-display text-base font-semibold text-[var(--admin-heading)] group-hover:bg-[var(--admin-selected-sky)]"
          >
            {firstLetter(displayName)}
          </span>
        ) : (
          <span aria-hidden="true" className="hidden size-10 shrink-0 sm:block" />
        )}

        {/* Centre column */}
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="min-w-0 break-words font-display text-[1.125rem] font-medium leading-[1.3] tracking-[-0.01em] text-[var(--admin-heading)]">
              {displayName}
            </h2>
            {role.is_system ? (
              <span
                className="inline-flex"
                title="System role. Comes with the clinic; can be edited but not deleted."
              >
                <AdminStatusBadge value="System" tone="restricted" compact />
              </span>
            ) : null}
            {inactive ? (
              <span
                className="inline-flex"
                title="Inactive. Kept on file, not assignable."
              >
                <AdminStatusBadge value="Inactive" tone="restricted" compact />
              </span>
            ) : null}
          </div>

          {role.description ? (
            <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--admin-text-muted)]">
              {role.description}
            </p>
          ) : null}

          <p className="mt-1 font-mono text-xs text-[var(--admin-text-muted)]">
            DB role: {role.name}
          </p>

          {/* Mobile-only counts â€” stacked two-line metadata */}
          <ul
            className="mt-2 grid list-none gap-1 pl-0 text-xs text-[var(--admin-text-muted)] sm:hidden"
            aria-label={`Counts for ${displayName}`}
          >
            <li className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
              {permissionsLabel(permCount)}
            </li>
            <li>
              {staffCount > 0 ? (
                <NestedStaffLink roleId={role.id} staffCount={staffCount} />
              ) : (
                <span
                  className="inline-flex items-center gap-1.5"
                  title="No staff on this role yet"
                >
                  <Users className="size-3.5 shrink-0" aria-hidden="true" />
                  {staffLabel(staffCount)}
                </span>
              )}
            </li>
            <li>
              <NestedActivityLink href={auditHref} />
            </li>
          </ul>
        </div>

        {/* Right column â€” desktop counts cluster + chevron; mobile collapses to chevron only */}
        <div className="flex shrink-0 items-center self-center gap-3 text-xs text-[var(--admin-text-muted)]">
          <span
            className="hidden items-center gap-1.5 sm:inline-flex"
            title={`${permCount} permissions granted on this role`}
          >
            <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
            {permissionsLabel(permCount)}
          </span>
          <span className="hidden sm:inline-flex">
            {staffCount > 0 ? (
              <NestedStaffLink roleId={role.id} staffCount={staffCount} />
            ) : (
              <span
                className="inline-flex items-center gap-1.5"
                title="No staff on this role yet"
              >
                <Users className="size-3.5 shrink-0" aria-hidden="true" />
                {staffLabel(staffCount)}
              </span>
            )}
          </span>
          <span className="hidden sm:inline-flex">
            <NestedActivityLink href={auditHref} />
          </span>
          <ChevronRight
            aria-hidden="true"
            className="size-4 shrink-0 text-[var(--admin-text-muted)] transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
          />
        </div>
      </div>
    </div>
  );
}

function NestedStaffLink({
  roleId,
  staffCount,
}: {
  roleId: string;
  staffCount: number;
}) {
  return (
    <Link
      href={`/admin/staff?roleId=${roleId}`}
      className="pointer-events-auto relative z-[2] inline-flex min-h-11 items-center gap-1.5 rounded-[var(--admin-radius-control)] px-2 py-1.5 text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-selected-sky)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 sm:min-h-0 sm:px-1.5 sm:py-0.5"
      title="Open the staff list filtered to this role"
    >
      <Users className="size-3.5 shrink-0" aria-hidden="true" />
      {staffLabel(staffCount)}
    </Link>
  );
}

function NestedActivityLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="pointer-events-auto relative z-[2] inline-flex min-h-11 items-center gap-1.5 rounded-[var(--admin-radius-control)] px-2 py-1.5 text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-selected-sky)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 sm:min-h-0 sm:px-1.5 sm:py-0.5"
      title="View this role's audit-log activity"
    >
      <History className="size-3.5 shrink-0" aria-hidden="true" />
      <span>Activity</span>
    </Link>
  );
}
