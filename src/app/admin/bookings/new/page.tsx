import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canAssignBookings, canClaimAssignments, getStaffProfile } from "@/lib/auth/rbac";
import { AdminAccessDenied, AdminPageScaffold, AdminPageHeader } from "../../components/admin-ui";
import { canManageAllBookings } from "../access";
import { ManualBookingForm } from "./ManualBookingForm";
import { fuzzyMatchService } from "@/lib/booking/service-fuzzy-match";

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
  const canAssign = canAssignBookings(profile);

  const [servicesResult, prefillClientResult, enquiryResult, assignableStaffResult, settingsResult] =
    await Promise.all([
      adminClient
        .from("services")
        .select("slug, name, price, duration_mins, gender_restrictions, allow_recurrence, group_category")
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
            .select("id, full_name, email, phone, source, service_interest, notes, converted_booking_id")
            .eq("id", enquiryId)
            .single()
        : Promise.resolve({ data: null, error: null }),
      // Pre-fetch bookable staff for the assignment panel (only when user can assign)
      canAssign
        ? adminClient
            .from("staff_profiles")
            .select("id, name, gender, can_take_bookings")
            .eq("active", true)
            .eq("can_take_bookings", true)
            .order("name")
        : Promise.resolve({ data: [], error: null }),
      // C-07 Step 5 (W02-E-1) — the whitelist create_booking_request checks
      // server-side; fetched here so the form can warn inline before submit.
      adminClient
        .from("business_settings")
        .select("free_travel_cities")
        .eq("id", 1)
        .single(),
    ]);

  const services = servicesResult.data ?? [];
  const prefillClient = prefillClientResult.data ?? null;
  const enquiry = enquiryResult.data ?? null;
  const assignableStaff = assignableStaffResult.data ?? [];
  const allowedCities = (settingsResult.data?.free_travel_cities ?? []) as string[];

  // C-03 B-106: re-conversion guard — a stale/bookmarked URL for an enquiry
  // that has already been converted must not let the operator create a
  // second booking from it. Redirect to the existing booking instead.
  if (enquiry?.converted_booking_id) {
    redirect(`/admin/bookings/${enquiry.converted_booking_id}?from_enquiry=already_converted`);
  }

  // C-03 — pre-select the service the enquiry mentioned, when confident.
  const matchedServiceSlug = enquiry?.service_interest
    ? fuzzyMatchService(enquiry.service_interest, services)
    : null;

  // Signal to the form when a requested pre-fill fetch failed (so it can toast a warning)
  const prefillFailed =
    (!!clientId && !prefillClient && !!prefillClientResult.error) ||
    (!!enquiryId && !enquiry && !!enquiryResult.error);

  // "Take myself" — uses canClaimAssignments which checks active + can_take_bookings + claim_assignments permission
  const currentUserIsBookable = canClaimAssignments(profile) && !!profile.gender;

  // C-02 Phase E (Step 15) — slug → services.allow_recurrence, so the form can
  // offer repeat visits only for services that permit them.
  const allowRecurrenceMap = Object.fromEntries(
    services.map((service) => [service.slug, service.allow_recurrence === true])
  );

  return (
    <AdminPageScaffold width="narrow">
      <AdminPageHeader title="New booking" />
      <ManualBookingForm
        services={services}
        prefillClient={prefillClient}
        enquiry={enquiry}
        matchedServiceSlug={matchedServiceSlug}
        prefillFailed={prefillFailed}
        canAssign={canAssign}
        assignableStaff={assignableStaff as Array<{ id: string; name: string; gender: string; can_take_bookings: boolean }>}
        currentUserId={profile.id}
        currentUserGender={profile.gender ?? ""}
        currentUserName={profile.name ?? ""}
        currentUserIsBookable={currentUserIsBookable}
        allowRecurrenceMap={allowRecurrenceMap}
        allowedCities={allowedCities}
      />
    </AdminPageScaffold>
  );
}
