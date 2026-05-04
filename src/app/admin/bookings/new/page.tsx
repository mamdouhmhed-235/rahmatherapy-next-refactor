import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile } from "@/lib/auth/rbac";
import { AdminAccessDenied } from "../../components/admin-ui";
import { canManageAllBookings, canManageBookings } from "../access";
import { ManualBookingForm } from "./ManualBookingForm";

export const metadata = {
  title: "Create Booking - Rahma Therapy Admin",
};

interface NewAdminBookingPageProps {
  searchParams: Promise<{ clientId?: string; enquiryId?: string }>;
}

export default async function NewAdminBookingPage({
  searchParams,
}: NewAdminBookingPageProps) {
  const { clientId = "", enquiryId = "" } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  if (!canManageBookings(profile) || !canManageAllBookings(profile)) {
    return (
      <AdminAccessDenied
        title="Booking creation limited"
        message="You need all-bookings management permission to create manual admin bookings."
        permission="manage_bookings_all"
      />
    );
  }

  const adminClient = createSupabaseAdminClient();
  const [{ data: services }, { data: clients }, { data: enquiry }] = await Promise.all([
    adminClient
      .from("services")
      .select("slug, name, price, duration_mins, gender_restrictions")
      .eq("is_active", true)
      .order("display_order")
      .order("name"),
    adminClient
      .from("clients")
      .select("id, full_name, email, phone, address, postcode")
      .order("updated_at", { ascending: false })
      .limit(50),
    enquiryId
      ? adminClient
          .from("enquiries")
          .select("id, full_name, email, phone, source, service_interest, notes")
          .eq("id", enquiryId)
          .single()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/bookings"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--rahma-muted)] transition-colors hover:text-[var(--rahma-green)]"
        >
          <ArrowLeft className="size-4" />
          Back to bookings
        </Link>
        <h1 className="font-display text-2xl font-semibold text-[var(--rahma-charcoal)]">
          Create admin booking
        </h1>
        <p className="mt-1 text-sm text-[var(--rahma-muted)]">
          Create phone, WhatsApp, referral, repeat-customer, or walk-in bookings
          through the same transactional availability checks as public bookings.
        </p>
      </div>

      <ManualBookingForm
        services={services ?? []}
        clients={clients ?? []}
        initialClientId={clientId}
        enquiry={
          enquiry
            ? {
                id: enquiry.id,
                full_name: enquiry.full_name,
                email: enquiry.email,
                phone: enquiry.phone,
                source: enquiry.source,
                service_interest: enquiry.service_interest,
                notes: enquiry.notes,
              }
            : null
        }
      />
    </div>
  );
}
