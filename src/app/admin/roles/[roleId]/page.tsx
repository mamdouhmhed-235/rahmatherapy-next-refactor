import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ChevronLeft, ShieldCheck } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  canManageRoleTemplates,
  getRoleDisplayName,
  getStaffProfile,
} from "@/lib/auth/rbac";
import {
  AdminAccessDenied,
  AdminPanel,
  AdminStatusBadge,
} from "../../components/admin-ui";
import { PermissionRow } from "./PermissionRow";
import { RoleMetadataForm } from "./RoleMetadataForm";
import { PermissionsFilterStrip } from "./PermissionsFilterStrip";
import { DangerZonePanel } from "./DangerZonePanel";

interface RoleDetailPageProps {
  params: Promise<{ roleId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata = {
  title: "Role detail — Rahma Therapy Admin",
};

function asArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function firstLetter(label: string): string {
  const trimmed = label.trim();
  return trimmed.length > 0 ? trimmed.charAt(0).toUpperCase() : "?";
}

// The seeded "Inactive / Suspended" system role lives with active=true in the
// DB but the brief treats it as inactive. Mirrors `roles/page.tsx` coercion.
function isInactiveSystemRole(role: { is_system: boolean; name: string }): boolean {
  return role.is_system && role.name.trim().toLowerCase() === "inactive";
}

function humanizeCategory(value: string): string {
  return value
    .split(/[_\s]+/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

export default async function RoleDetailPage({
  params,
  searchParams,
}: RoleDetailPageProps) {
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

  const { roleId } = await params;
  const resolvedSearchParams = await searchParams;
  const selectedCategories = asArray(resolvedSearchParams.category);
  const selectedRiskLevels = asArray(resolvedSearchParams.risk_level);
  const grantedOnly = resolvedSearchParams.granted_only === "1";
  const queryRaw =
    typeof resolvedSearchParams.q === "string"
      ? resolvedSearchParams.q.trim()
      : "";
  const queryLower = queryRaw.toLowerCase();

  const { data: role } = await supabase
    .from("roles")
    .select("id, name, display_label, description, sort_order, active, is_system")
    .eq("id", roleId)
    .single();

  if (!role) notFound();

  const [{ data: allPermissions }, { data: rolePermissions }, { data: staffOnRole }] =
    await Promise.all([
      supabase
        .from("permissions")
        .select("id, name, description, category, scope, risk_level, active")
        .eq("active", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("role_permissions")
        .select("permission_id")
        .eq("role_id", roleId),
      supabase
        .from("staff_profiles")
        .select("id, name, email, active")
        .eq("role_id", roleId)
        .order("name"),
    ]);

  const grantedIds = new Set(
    (rolePermissions ?? []).map((rp) => rp.permission_id)
  );

  const permissions = allPermissions ?? [];
  const totalCount = permissions.length;
  const grantedCount = permissions.filter((p) => grantedIds.has(p.id)).length;

  const categories = Array.from(
    new Set(permissions.map((p) => p.category).filter(Boolean))
  ) as string[];

  const filteredPermissions = permissions.filter((perm) => {
    if (selectedCategories.length > 0) {
      if (!perm.category || !selectedCategories.includes(perm.category)) {
        return false;
      }
    }
    if (selectedRiskLevels.length > 0) {
      if (!perm.risk_level || !selectedRiskLevels.includes(perm.risk_level)) {
        return false;
      }
    }
    if (grantedOnly && !grantedIds.has(perm.id)) return false;
    if (queryLower) {
      const haystack =
        `${perm.name ?? ""} ${perm.description ?? ""}`.toLowerCase();
      if (!haystack.includes(queryLower)) return false;
    }
    return true;
  });

  const groupedFiltered = filteredPermissions.reduce<
    Map<string, typeof permissions>
  >((acc, perm) => {
    const key = perm.category ?? "uncategorised";
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key)!.push(perm);
    return acc;
  }, new Map());

  const isOwnerRole = role.name.toLowerCase() === "owner";
  const displayLabel = getRoleDisplayName(role);
  const staffList = staffOnRole ?? [];
  const staffCount = staffList.length;
  const treatAsInactive = !role.active || isInactiveSystemRole(role);
  const editingOwnRole = profile.role_id === role.id;

  return (
    <div className="grid gap-6 pb-24 lg:pb-16">
      {/* Breadcrumb */}
      <div>
        <Link
          href="/admin/roles"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--admin-text-muted)] outline-none transition-colors hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Roles
        </Link>
      </div>

      {/* Page header */}
      <header className="grid gap-3">
        <div className="flex items-start gap-3 sm:gap-4">
          <span
            aria-hidden="true"
            title={displayLabel}
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-[var(--admin-radius-card)] bg-[oklch(95.5%_0.012_155)] font-display text-xl font-semibold text-[var(--admin-heading)] sm:size-14 sm:text-2xl"
          >
            {firstLetter(displayLabel)}
          </span>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
              <h1 className="min-w-0 break-words font-display text-2xl font-semibold tracking-[-0.02em] text-[var(--admin-heading)] sm:text-[1.75rem]">
                {displayLabel}
              </h1>
              {role.is_system ? (
                <span
                  className="inline-flex"
                  title="System role. Comes with the clinic; can be edited but not deleted."
                >
                  <AdminStatusBadge value="System" tone="restricted" compact />
                </span>
              ) : null}
              {treatAsInactive ? (
                <span
                  className="inline-flex"
                  title="Inactive. Kept on file, not assignable."
                >
                  <AdminStatusBadge value="Inactive" tone="restricted" compact />
                </span>
              ) : (
                <span
                  className="inline-flex"
                  title="Active. Assignable to staff."
                >
                  <AdminStatusBadge value="Active" tone="success" compact />
                </span>
              )}
            </div>
            <p
              className="mt-1 font-mono text-xs text-[var(--admin-text-muted)]"
              title="This identifier appears in code and audit logs"
            >
              DB role: {role.name}
            </p>
            {role.description ? (
              <RoleDescription text={role.description} />
            ) : null}
          </div>
        </div>
      </header>

      {editingOwnRole ? (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-[var(--admin-radius-card)] border border-[oklch(88%_0.06_65)] bg-[oklch(96%_0.038_75)] px-4 py-3 text-sm leading-6 text-[oklch(28%_0.12_55)]"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            You&apos;re editing your own role. Revoking permissions here will affect
            your next page load, including recovery actions. Confirm with your team
            before changing critical permissions.
          </span>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-8">
        {/* LEFT — permissions */}
        <section className="grid min-w-0 gap-4">
          <PermissionsFilterStrip
            categories={categories}
            selectedCategories={selectedCategories}
            selectedRiskLevels={selectedRiskLevels}
            grantedOnly={grantedOnly}
            query={queryRaw}
            totalCount={totalCount}
            filteredCount={filteredPermissions.length}
          />

          <AdminPanel
            title="Permissions"
            description={
              filteredPermissions.length === permissions.length
                ? `${grantedCount} of ${totalCount} granted on this role.`
                : `${filteredPermissions.length} match — ${grantedCount} of ${totalCount} granted overall.`
            }
            badge={
              <AdminStatusBadge
                value={`${grantedCount} / ${totalCount}`}
                tone={grantedCount === 0 ? "muted" : "success"}
                compact
              />
            }
            footer={
              <p
                className="text-xs leading-5 text-[var(--admin-text-muted)]"
                title={`${grantedCount} permissions granted on this role`}
              >
                <span className="font-semibold text-[var(--admin-heading)]">
                  {grantedCount}
                </span>{" "}
                {grantedCount === 1 ? "permission" : "permissions"} granted on this
                role.
              </p>
            }
          >
            {filteredPermissions.length === 0 ? (
              <PermissionsEmpty grantedOnly={grantedOnly} />
            ) : (
              <div className="max-h-[70vh] overflow-y-auto pr-1 lg:max-h-[min(72vh,720px)]">
                {Array.from(groupedFiltered.entries()).map(([category, perms]) => (
                  <section
                    key={category}
                    aria-label={`${humanizeCategory(category)} permissions`}
                    className="grid"
                  >
                    <h3 className="sticky top-0 z-10 -mx-1 bg-[var(--admin-panel)] px-1 py-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--admin-text-muted)] backdrop-blur-[2px]">
                      <span className="inline-flex items-center gap-2 border-b border-[var(--admin-border)] pb-1.5 pr-3">
                        <ShieldCheck
                          className="size-3.5"
                          aria-hidden="true"
                        />
                        {humanizeCategory(category)}
                        <span className="font-mono text-[0.625rem] font-normal normal-case tracking-normal">
                          ({perms.length})
                        </span>
                      </span>
                    </h3>
                    <ul className="m-0 grid list-none gap-0.5 p-0">
                      {perms.map((perm) => (
                        <PermissionRow
                          key={perm.id}
                          roleId={role.id}
                          roleName={role.name}
                          roleDisplayLabel={displayLabel}
                          permissionId={perm.id}
                          permissionName={perm.name}
                          permissionDescription={perm.description}
                          permissionCategory={perm.category}
                          permissionScope={perm.scope}
                          permissionRiskLevel={perm.risk_level}
                          isGranted={grantedIds.has(perm.id)}
                          isOwnerRole={isOwnerRole}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </AdminPanel>
        </section>

        {/* RIGHT — metadata / staff / lifecycle.
            H2 lives on the left (Permissions); these are H3 per brief §6. */}
        <aside className="grid min-w-0 gap-6 xl:max-w-[22rem]">
          <AdminPanel>
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="font-display text-base font-semibold tracking-[-0.01em] text-[var(--admin-heading)]">
                Role details
              </h3>
            </div>
            <RoleMetadataForm role={role} />
          </AdminPanel>

          <AdminPanel>
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="font-display text-base font-semibold tracking-[-0.01em] text-[var(--admin-heading)]">
                Staff with this role
              </h3>
              <AdminStatusBadge
                value={String(staffCount)}
                tone={staffCount === 0 ? "muted" : "success"}
                compact
              />
            </div>
            {staffCount === 0 ? (
              <p className="text-sm text-[var(--admin-text-muted)]">
                No staff assigned.
              </p>
            ) : (
              <ul className="m-0 grid list-none gap-2 p-0">
                {staffList.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/admin/staff/${s.id}`}
                      title={`Open ${s.name}'s profile`}
                      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-3 py-2.5 outline-none transition-colors hover:border-[var(--admin-primary)]/35 hover:bg-[oklch(95.5%_0.012_155)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                    >
                      <span
                        aria-hidden="true"
                        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[oklch(95.5%_0.012_155)] font-display text-sm font-semibold text-[var(--admin-heading)]"
                      >
                        {firstLetter(s.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-[var(--admin-heading)]">
                          {s.name}
                        </span>
                        <span className="block truncate text-xs text-[var(--admin-text-muted)]">
                          {s.email}
                        </span>
                      </span>
                      {!s.active ? (
                        <span
                          className="inline-flex shrink-0"
                          title="Inactive. Sign-in blocked."
                        >
                          <AdminStatusBadge
                            value="Inactive"
                            tone="restricted"
                            compact
                          />
                        </span>
                      ) : (
                        <span aria-hidden="true" />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </AdminPanel>

          <AdminPanel>
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="font-display text-base font-semibold tracking-[-0.01em] text-[var(--admin-heading)]">
                Role lifecycle
              </h3>
            </div>
            <DangerZonePanel
              roleId={role.id}
              displayLabel={displayLabel}
              active={role.active}
              isSystem={role.is_system}
              isInactiveSystem={isInactiveSystemRole(role)}
              staffCount={staffCount}
              metadataFormId="role-metadata-form"
            />
          </AdminPanel>
        </aside>
      </div>
    </div>
  );
}

function RoleDescription({ text }: { text: string }) {
  const isLong = text.length > 180;
  if (!isLong) {
    return (
      <p className="mt-2 max-w-[68ch] text-sm leading-6 text-[var(--admin-text-muted)]">
        {text}
      </p>
    );
  }
  return (
    <details className="group mt-2 max-w-[68ch]">
      <summary className="cursor-pointer list-none text-sm leading-6 text-[var(--admin-text-muted)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 [&::-webkit-details-marker]:hidden">
        <span className="line-clamp-2 group-open:hidden">{text}</span>
        <span className="hidden group-open:inline">{text}</span>
        <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[var(--admin-body)] hover:text-[var(--admin-heading)]">
          <span className="group-open:hidden">Show more</span>
          <span className="hidden group-open:inline">Show less</span>
        </span>
      </summary>
    </details>
  );
}

function PermissionsEmpty({ grantedOnly }: { grantedOnly: boolean }) {
  return (
    <div className="grid justify-items-center gap-3 py-12 text-center">
      <span
        aria-hidden="true"
        className="inline-flex size-12 items-center justify-center rounded-full bg-[oklch(94%_0.008_280)]"
      >
        <ShieldCheck
          className="size-6 text-[oklch(30%_0.02_280)]"
          aria-hidden="true"
        />
      </span>
      <h3 className="font-display text-base font-semibold text-[var(--admin-heading)]">
        {grantedOnly ? "No permissions granted yet" : "No permissions match"}
      </h3>
      <p className="max-w-[40ch] text-sm leading-6 text-[var(--admin-text-muted)]">
        {grantedOnly
          ? "Toggle on the permissions this role needs to do its job."
          : "Try adjusting or clearing your filters."}
      </p>
    </div>
  );
}
