import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  canManageAllClients,
  canManageClientIdentityFields,
  getStaffProfile,
} from "@/lib/auth/rbac";
import { AdminAccessDenied, AdminPageHeader } from "../../../components/admin-ui";
import { ClientEditForm, type ClientEditRecord } from "./ClientEditForm";

export const metadata = {
  title: "Edit Client - Rahma Therapy Admin",
};

const CLIENT_EDIT_SELECT = `
  id,
  full_name,
  phone,
  email,
  gender_preference,
  address,
  postcode,
  city,
  area,
  client_source,
  source_detail,
  notes,
  updated_at,
  deleted_at
`;

/**
 * `deleted_at` is read here but stays off `ClientEditRecord`, which describes
 * the fields the form edits — the column gates the route, it is never a field.
 */
type ClientEditRow = ClientEditRecord & { deleted_at: string | null };

interface EditClientPageProps {
  params: Promise<{ clientId: string }>;
}

export default async function EditClientPage({ params }: EditClientPageProps) {
  const { clientId } = await params;
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  if (!canManageAllClients(profile)) {
    return (
      <AdminAccessDenied
        title="Client editing limited"
        message="Editing client records is restricted to admin staff with client management permission. Ask the owner if you need it."
        actions={
          <Link
            href={`/admin/clients/${clientId}`}
            className="inline-flex h-10 items-center rounded-[var(--admin-radius-control)] px-4 text-sm font-medium text-[var(--admin-body)] underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            View client
          </Link>
        }
      />
    );
  }

  const adminClient = createSupabaseAdminClient();
  const { data: client } = await adminClient
    .from("clients")
    .select(CLIENT_EDIT_SELECT)
    .eq("id", clientId)
    .single<ClientEditRow>();

  // Editing a record that has been erased would resurrect it: `updateClient`
  // writes the patch and bumps `updated_at` without ever looking at
  // `deleted_at`. The route is the gate (brief §5.3).
  if (!client || client.deleted_at) notFound();

  return (
    <div className="max-w-[640px]">
      <Link
        href={`/admin/clients/${clientId}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--admin-text-muted)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:text-[var(--admin-primary)] focus-visible:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to client
      </Link>
      <AdminPageHeader
        title="Edit client"
        description={`Correct ${client.full_name}'s details. Changes are recorded in the audit log.`}
      />
      <ClientEditForm
        client={client}
        canEditIdentityFields={canManageClientIdentityFields(profile)}
      />
    </div>
  );
}
