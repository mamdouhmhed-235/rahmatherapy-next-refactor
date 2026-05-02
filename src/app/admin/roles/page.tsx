import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";
import { ChevronRight, ShieldCheck, Users } from "lucide-react";

export const metadata = {
  title: "Roles & Permissions — Rahma Therapy Admin",
};

export default async function RolesPage() {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  // Fine-grained permission gate — 403 message, not a redirect
  if (!profile.permissions.has(PERMISSIONS.MANAGE_ROLES)) {
    return (
      <div>
        <h1 className="font-display text-2xl font-semibold text-[var(--rahma-charcoal)] mb-2">
          Roles &amp; Permissions
        </h1>
        <div className="mt-6 rounded-2xl border bg-white px-6 py-8 text-center"
          style={{ borderColor: "var(--rahma-border)" }}>
          <ShieldCheck className="mx-auto mb-3 size-8 text-[var(--rahma-muted)]" />
          <p className="font-medium text-[var(--rahma-charcoal)]">Insufficient permissions</p>
          <p className="mt-1 text-sm text-[var(--rahma-muted)]">
            You need the <code className="rounded bg-muted px-1 py-0.5 text-xs">manage_roles</code> permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  // Fetch all roles with permission count and staff count
  const { data: roles } = await supabase
    .from("roles")
    .select("id, name, description, role_permissions(count), staff_profiles(count)")
    .order("name");

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-[var(--rahma-charcoal)]">
          Roles &amp; Permissions
        </h1>
        <p className="mt-1 text-sm text-[var(--rahma-muted)]">
          Manage what each role can do across the admin.
        </p>
      </div>

      {/* Roles list */}
      <div className="flex flex-col gap-3">
        {(roles ?? []).map((role) => {
          const permCount = (role.role_permissions as { count: number }[])?.[0]?.count ?? 0;
          const staffCount = (role.staff_profiles as { count: number }[])?.[0]?.count ?? 0;

          return (
            <Link
              key={role.id}
              href={`/admin/roles/${role.id}`}
              className="flex items-center gap-4 rounded-2xl border bg-white px-6 py-5 transition-shadow duration-150 hover:shadow-card"
              style={{
                borderColor: "var(--rahma-border)",
                boxShadow: "var(--shadow-soft-token)",
              }}
            >
              {/* Icon */}
              <div
                className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "var(--rahma-green)" }}
              >
                <ShieldCheck className="size-5 text-white" />
              </div>

              {/* Role info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[var(--rahma-charcoal)]">
                  {role.name}
                </p>
                {role.description && (
                  <p className="mt-0.5 truncate text-sm text-[var(--rahma-muted)]">
                    {role.description}
                  </p>
                )}
              </div>

              {/* Counts */}
              <div className="flex shrink-0 items-center gap-4 text-sm text-[var(--rahma-muted)]">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5" />
                  {permCount} permissions
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="size-3.5" />
                  {staffCount} staff
                </span>
                <ChevronRight className="size-4" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
