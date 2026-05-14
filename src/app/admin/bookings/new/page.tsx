import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile } from "@/lib/auth/rbac";
import { AdminAccessDenied, AdminPageScaffold, AdminPageHeader } from "../../components/admin-ui";
import { canManageAllBookings } from "../access";
import { ManualBookingForm } from "./ManualBookingForm";

export const metadata = {
  title: "New booking — Rahma Admin",
};

interface Props {
  searchParams: Promise<{ clientId?: string; enquiryId?: string }>;
}

export default async function NewAdminBookingPage({ searchParams }: Props) {
  const { clientId = "", enquiryId = "" } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) redirect("/admin/login");

  if (!canManageAllBookings(profile)) {
    return (
      <AdminAccessDenied
        title="You don't have access to this section."
        message="Bookings are created by coordinators and admins. Ask one of them if a client needs a new booking."
        variant="therapist"
      />
    );
  }

  const adminClient = createSupabaseAdminClient();

  const [servicesResult, prefillClientResult, enquiryResult] = await Promise.all([
    adminClient
      .from("services")
      .select("slug, name, price, duration_mins, gender_restrictions")
      .eq("is_active", true)
      .eq("is_visible_on_frontend", true)
      .order("display_order")
      .order("name"),
    clientId
      ? adminClient
          .from("clients")
          .select("id, full_name, email, phone, address, postcode, city, area")
          .eq("id", clientId)
          .single()
      : Promise.resolve({ data: null, error: null }),
    enquiryId
      ? adminClient
          .from("enquiries")
          .select("id, full_name, email, phone, source, service_interest, notes")
          .eq("id", enquiryId)
          .single()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const services = servicesResult.data ?? [];
  const prefillClient = prefillClientResult.data ?? null;
  const enquiry = enquiryResult.data ?? null;

  return (
    <AdminPageScaffold width="narrow">
      <AdminPageHeader title="New booking" />
      <ManualBookingForm
        services={services}
        prefillClient={prefillClient}
        enquiry={enquiry}
      />
    </AdminPageScaffold>
  );
}
