import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
import { ChevronLeft, ShieldCheck, Users } from "lucide-react";
import { PermissionRow } from "./PermissionRow";

interface RoleDetailPageProps {
  params: Promise<{ roleId: string }>;
}

export const metadata = {
  title: "Role Detail — Rahma Therapy Admin",
};

export default async function RoleDetailPage({ params }: RoleDetailPageProps) {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  if (!profile.permissions.has(PERMISSIONS.MANAGE_ROLES)) {
    redirect("/admin/roles");
  }

  const { roleId } = await params;

  // Fetch role
  const { data: role } = await supabase
    .from("roles")
    .select("id, name, description")
    .eq("id", roleId)
    .single();

  if (!role) notFound();

  // Fetch all permissions
  const { data: allPermissions } = await supabase
    .from("permissions")
    .select("id, name, description")
    .order("name");

  // Fetch this role's granted permission IDs
  const { data: rolePermissions } = await supabase
    .from("role_permissions")
    .select("permission_id")
    .eq("role_id", roleId);

  const grantedIds = new Set(
    (rolePermissions ?? []).map((rp) => rp.permission_id)
  );

  const isOwnerRole = role.name.toLowerCase() === "owner";

  // Fetch staff members on this role
  const { data: staffOnRole } = await supabase
    .from("staff_profiles")
    .select("id, name, email, active")
    .eq("role_id", roleId)
    .order("name");

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/admin/roles"
          className="flex items-center gap-1.5 text-sm text-[var(--rahma-muted)] hover:text-[var(--rahma-charcoal)] transition-colors"
        >
          <ChevronLeft className="size-3.5" />
          Roles &amp; Permissions
        </Link>
      </div>

      {/* Page header */}
      <div className="mb-8 flex items-start gap-4">
        <div
          className="flex size-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "var(--rahma-green)" }}
        >
          <ShieldCheck className="size-5 text-white" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--rahma-charcoal)]">
            {role.name}
          </h1>
          {role.description && (
            <p className="mt-1 text-sm text-[var(--rahma-muted)]">
              {role.description}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Permissions column (2/3) */}
        <section className="lg:col-span-2">
          <h2 className="mb-4 text-base font-semibold text-[var(--rahma-charcoal)]">
            Permissions
          </h2>
          <div className="flex flex-col gap-2">
            {(allPermissions ?? []).map((perm) => (
              <PermissionRow
                key={perm.id}
                roleId={role.id}
                roleName={role.name}
                permissionId={perm.id}
                permissionName={perm.name}
                permissionDescription={perm.description}
                isGranted={grantedIds.has(perm.id)}
                isOwnerRole={isOwnerRole}
              />
            ))}
          </div>
        </section>

        {/* Staff on this role (1/3) */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-[var(--rahma-charcoal)]">
            <Users className="size-4" />
            Staff with this role
          </h2>
          <div className="flex flex-col gap-2">
            {(staffOnRole ?? []).length === 0 ? (
              <p className="text-sm text-[var(--rahma-muted)]">
                No staff assigned.
              </p>
            ) : (
              (staffOnRole ?? []).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-xl border bg-white px-4 py-3"
                  style={{ borderColor: "var(--rahma-border)" }}
                >
                  <div
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{ background: "var(--rahma-green)" }}
                  >
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--rahma-charcoal)]">
                      {s.name}
                    </p>
                    <p className="truncate text-xs text-[var(--rahma-muted)]">
                      {s.email}
                    </p>
                  </div>
                  {!s.active && (
                    <span className="ml-auto shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                      Inactive
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
