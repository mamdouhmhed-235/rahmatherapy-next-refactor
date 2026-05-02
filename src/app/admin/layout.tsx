import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile } from "@/lib/auth/rbac";
import { AdminSidebar } from "./AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  // Belt-and-braces server guard — middleware handles this first,
  // but we add it here as a fallback for direct server component renders.
  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--rahma-ivory)]">
      <AdminSidebar profile={profile} />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
