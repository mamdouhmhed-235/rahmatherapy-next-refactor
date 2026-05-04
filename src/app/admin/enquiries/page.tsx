import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageSquareText, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
import {
  AdminAccessDenied,
  AdminEmptyState,
  AdminPageHeader,
  AdminStatusBadge,
} from "../components/admin-ui";
import { cn } from "@/lib/utils";
import { formatDateTime, formatLabel } from "../clients/format";
import { EnquiryForm } from "./EnquiryForm";
import { EnquiryStatusButton } from "./EnquiryStatusButton";

export const metadata = {
  title: "Enquiries - Rahma Therapy Admin",
};

interface EnquiryRecord {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  source: string;
  status: string;
  service_interest: string | null;
  notes: string | null;
  client_id: string | null;
  converted_booking_id: string | null;
  assigned_staff_id: string | null;
  created_at: string;
}

export default async function EnquiriesPage() {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  if (!profile.permissions.has(PERMISSIONS.MANAGE_CLIENTS)) {
    return (
      <AdminAccessDenied
        title="Enquiry access limited"
        message="You need client management permission to manage enquiries."
        permission="manage_clients"
      />
    );
  }

  const adminClient = createSupabaseAdminClient();
  const [{ data: enquiries }, { data: staff }] = await Promise.all([
    adminClient
      .from("enquiries")
      .select("id, full_name, phone, email, source, status, service_interest, notes, client_id, converted_booking_id, assigned_staff_id, created_at")
      .order("created_at", { ascending: false })
      .returns<EnquiryRecord[]>(),
    adminClient
      .from("staff_profiles")
      .select("id, name")
      .eq("active", true)
      .order("name"),
  ]);

  const openCount = (enquiries ?? []).filter(
    (enquiry) => enquiry.status === "new"
  ).length;
  const staffNames = new Map((staff ?? []).map((member) => [member.id, member.name]));

  return (
    <div>
      <AdminPageHeader
        title="Enquiries"
        description="Track phone, WhatsApp, Instagram, referral, and website leads before they become bookings."
        actions={
          <Badge
            variant="secondary"
            className="border-none bg-orange-50 text-orange-700"
          >
            {openCount} new
          </Badge>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[24rem_minmax(0,1fr)]">
        <EnquiryForm staff={staff ?? []} />

        {(enquiries ?? []).length === 0 ? (
          <AdminEmptyState
            icon={MessageSquareText}
            title="No enquiries yet"
            message="Record phone or WhatsApp enquiries here before they become bookings."
          />
        ) : (
          <div className="grid gap-3">
            {(enquiries ?? []).map((enquiry) => (
              <article
                key={enquiry.id}
                className="rounded-lg border border-[var(--rahma-border)] bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-[var(--rahma-charcoal)]">
                        {enquiry.full_name}
                      </h2>
                      <AdminStatusBadge
                        value={enquiry.status}
                        tone={enquiry.status === "new" ? "warning" : "muted"}
                      />
                      <AdminStatusBadge value={enquiry.source} tone="muted" />
                    </div>
                    <p className="text-sm text-[var(--rahma-muted)]">
                      {enquiry.phone ?? "No phone"} - {enquiry.email ?? "No email"}
                    </p>
                    <p className="mt-1 text-sm text-[var(--rahma-muted)]">
                      {enquiry.service_interest ?? "No service interest"} -{" "}
                      {enquiry.assigned_staff_id
                        ? staffNames.get(enquiry.assigned_staff_id) ?? "Unknown owner"
                        : "Unassigned"}
                    </p>
                    {enquiry.notes ? (
                      <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--rahma-charcoal)]">
                        {enquiry.notes}
                      </p>
                    ) : null}
                    <p className="mt-3 text-xs text-[var(--rahma-muted)]">
                      Created {formatDateTime(enquiry.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {enquiry.converted_booking_id ? (
                      <Link
                        href={`/admin/bookings/${enquiry.converted_booking_id}`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8")}
                      >
                        Booking
                      </Link>
                    ) : (
                      <Link
                        href={`/admin/bookings/new?enquiryId=${enquiry.id}`}
                        className={cn(buttonVariants({ size: "sm" }), "h-8")}
                      >
                        <Plus className="size-3" />
                        Convert
                      </Link>
                    )}
                    {["contacted", "closed"].map((status) => (
                      <EnquiryStatusButton
                        key={status}
                        enquiryId={enquiry.id}
                        status={status}
                      >
                        {formatLabel(status)}
                      </EnquiryStatusButton>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
