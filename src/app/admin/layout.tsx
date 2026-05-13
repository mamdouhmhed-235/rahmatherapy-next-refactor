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
                className="inline-flex min-h-10 items-center justify-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-white px-4 text-sm font-semibold text-[var(--admin-heading)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                Sign out
              </button>
            </form>
          }
        />
      </main>
    );
  }

  const variant = resolveAdminShellVariant(profile) ?? "owner_admin";

  const notifications = await getNavNotifications(profile.id);

  return (
    <AdminTopNav
      profile={{
        name: profile.name,
        roleName: profile.role_name,
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
