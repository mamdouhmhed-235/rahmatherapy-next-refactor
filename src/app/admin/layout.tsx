import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile } from "@/lib/auth/rbac";
import { ADMIN_PAGE_KEYS, getAdminPageAccess } from "@/lib/auth/admin-access";
import { AdminTopNav } from "./components/AdminTopNav";
import { AdminAccessDenied } from "./components/admin-ui";

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
      <main className="min-h-screen bg-[var(--admin-panel-muted)] px-4 py-10">
        <AdminAccessDenied inactive />
      </main>
    );
  }

  return (
    <AdminTopNav
      profile={{
        name: profile.name,
        roleName: profile.role_name,
      }}
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
