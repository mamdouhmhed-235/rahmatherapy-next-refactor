import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canManageAllClients, getStaffProfile } from "@/lib/auth/rbac";
import { AdminAccessDenied, AdminPageHeader } from "../../components/admin-ui";
import { ClientCreateForm } from "./ClientCreateForm";

export const metadata = {
  title: "Create Client - Rahma Therapy Admin",
};

export default async function NewClientPage() {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  if (!canManageAllClients(profile)) {
    return (
      <AdminAccessDenied
        title="Client creation limited"
        message="Creating client records is restricted to admin staff with client management permission. Ask the owner if you need it."
        actions={
          <Link
            href="/admin/clients"
            className="inline-flex h-10 items-center rounded-[var(--admin-radius-control)] px-4 text-sm font-medium text-[var(--admin-body)] underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            View clients
          </Link>
        }
      />
    );
  }

  return (
    <div className="max-w-[640px]">
      <Link
        href="/admin/clients"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--admin-text-muted)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:text-[var(--admin-primary)] focus-visible:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Clients
      </Link>
      <AdminPageHeader
        title="Create client"
        description="Create a CRM profile without booking. Duplicate email or phone matches are flagged before save."
      />
      <ClientCreateForm />
    </div>
  );
}
