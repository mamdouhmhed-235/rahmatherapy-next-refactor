import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile } from "@/lib/auth/rbac";
import { ADMIN_PAGE_KEYS, getAdminPageAccess } from "@/lib/auth/admin-access";
import { AdminTopNav } from "./components/AdminTopNav";
import { AdminAccessDenied } from "./components/admin-ui";
import { resolveAdminShellVariant } from "./shell-variant";
import { getNavNotifications } from "./components/nav-notifications";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile) {
    return <>{children}</>;
  }

  if (!profile.active) {
    return (
      <main className="min-h-screen bg-[var(--admin-canvas)] px-4 py-10">
        <AdminAccessDenied
          inactive
          actions={
            <form action="/admin/signout" method="POST">
              <button
                type="submit"
                className="inline-flex min-h-10 items-center justify-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-panel)] px-4 text-sm font-semibold text-[var(--admin-heading)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                Sign out
              </button>
            </form>
          }
        />
      </main>
    );
  }

  const resolvedVariant = resolveAdminShellVariant(profile);

  // §12.3: null variant means no matching capability (or inactive profile).
  // Redirect rather than silently falling back to the owner shell and exposing
  // all nav items visually to a user who cannot act on any of them.
  if (!resolvedVariant) {
    redirect("/admin/login?reason=inactive");
  }

  const variant = resolvedVariant;

  // Variant-aware fetch — each shell variant has its own category set
  // (mirrors the dashboard's role-variant pattern). Permission checks
  // inside each variant helper are retained as defence-in-depth.
  const notifications = await getNavNotifications(profile, variant);

  return (
    <AdminTopNav
      profile={{
        name: profile.name,
        roleName: profile.role_name,
        staffId: profile.id,
      }}
      variant={variant}
      notifications={notifications}
      pageAccess={Object.fromEntries(
        ADMIN_PAGE_KEYS.map((pageKey) => {
          const access = getAdminPageAccess(profile, pageKey);
          return [
            pageKey,
            {
              access: access.access,
              dataScope: access.dataScope,
            },
          ];
        })
      )}
    >
      {children}
    </AdminTopNav>
  );
}
