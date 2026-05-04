import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
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

  if (!profile.permissions.has(PERMISSIONS.MANAGE_CLIENTS)) {
    return (
      <AdminAccessDenied
        title="Client creation limited"
        message="You need client management permission to create clients."
        permission="manage_clients"
      />
    );
  }

  return (
    <div>
      <Link
        href="/admin/clients"
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--rahma-muted)] transition-colors hover:text-[var(--rahma-green)]"
      >
        <ArrowLeft className="size-4" />
        Back to clients
      </Link>
      <AdminPageHeader
        title="Create client"
        description="Create a CRM profile without creating a booking. Duplicate email or phone matches are flagged before save."
      />
      <ClientCreateForm />
    </div>
  );
}
