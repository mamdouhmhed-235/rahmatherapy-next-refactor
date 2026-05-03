"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendBookingCancellationEmail } from "@/lib/email/notifications";
import { getStaffProfile } from "@/lib/auth/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  canAccessBooking,
  canClaimAssignments,
  canManageBookings,
} from "./access";
import type { BookingStatus, PaymentMethod, PaymentStatus } from "./types";

export interface BookingUpdateState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
}

const BOOKING_STATUSES: BookingStatus[] = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
];
const PAYMENT_STATUSES: PaymentStatus[] = ["paid", "unpaid"];
const PAYMENT_METHODS: PaymentMethod[] = ["cash", "card"];

interface AssignmentClaimRecord {
  id: string;
  booking_id: string;
  assigned_staff_id: string | null;
  required_therapist_gender: string;
  status: string;
}

interface BookingAssignmentStatusRecord {
  assigned_staff_id: string | null;
  status: string;
}

async function requireBookingManager() {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active || !canManageBookings(profile)) {
    return null;
  }

  return profile;
}

export async function updateBookingManagement(
  _previousState: BookingUpdateState,
  formData: FormData
): Promise<BookingUpdateState> {
  const actor = await requireBookingManager();
  if (!actor) return { error: "Insufficient permissions." };

  const bookingId = String(formData.get("booking_id") ?? "").trim();
  const status = String(formData.get("status") ?? "") as BookingStatus;
  const paymentStatus = String(
    formData.get("payment_status") ?? ""
  ) as PaymentStatus;
  const paymentMethodValue = String(formData.get("payment_method") ?? "");
  const paymentMethod = paymentMethodValue as PaymentMethod;
  const adminNotes = String(formData.get("admin_notes") ?? "").trim();
  const treatmentNotes = String(formData.get("treatment_notes") ?? "").trim();
  const customerManageNotes = String(
    formData.get("customer_manage_notes") ?? ""
  ).trim();
  const fieldErrors: Record<string, string> = {};

  if (!bookingId) fieldErrors.booking_id = "Booking is required.";
  if (!BOOKING_STATUSES.includes(status)) {
    fieldErrors.status = "Choose a valid booking status.";
  }
  if (!PAYMENT_STATUSES.includes(paymentStatus)) {
    fieldErrors.payment_status = "Choose a valid payment status.";
  }
  if (
    paymentStatus === "paid" &&
    !PAYMENT_METHODS.includes(paymentMethod)
  ) {
    fieldErrors.payment_method = "Choose cash or card for paid bookings.";
  }
  if (
    paymentMethodValue &&
    !PAYMENT_METHODS.includes(paymentMethod)
  ) {
    fieldErrors.payment_method = "Choose a valid payment method.";
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const canAccess = await canAccessBooking(bookingId, actor);
  if (!canAccess) return { error: "Insufficient permissions." };

  const adminClient = createSupabaseAdminClient();
  const { data: beforeState } = await adminClient
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .single();

  if (!beforeState) return { error: "Booking not found." };

  const payload = {
    status,
    payment_status: paymentStatus,
    payment_method:
      paymentStatus === "paid" && paymentMethodValue ? paymentMethod : null,
    admin_notes: adminNotes || null,
    treatment_notes: treatmentNotes || null,
    customer_manage_notes: customerManageNotes || null,
  };

  const { data, error } = await adminClient
    .from("bookings")
    .update(payload)
    .eq("id", bookingId)
    .select()
    .single();

  if (error) return { error: error.message };

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "booking_management_updated",
    target_type: "bookings",
    target_id: bookingId,
    before_state: beforeState,
    after_state: data,
  });

  if (beforeState.status !== "cancelled" && data.status === "cancelled") {
    await sendBookingCancellationEmail(bookingId, adminClient).catch((error) => {
      console.error("Unable to send booking cancellation email.", error);
    });
  }

  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);

  return { success: true };
}

export async function claimBookingAssignment(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const actor = await getStaffProfile(supabase);

  if (!actor || !canClaimAssignments(actor)) {
    return { error: "Insufficient permissions." };
  }

  const assignmentId = String(formData.get("assignment_id") ?? "").trim();
  if (!assignmentId) return { error: "Assignment is required." };

  const adminClient = createSupabaseAdminClient();
  const { data: assignment, error: assignmentError } = await adminClient
    .from("booking_assignments")
    .select("id, booking_id, assigned_staff_id, required_therapist_gender, status")
    .eq("id", assignmentId)
    .single<AssignmentClaimRecord>();

  if (assignmentError || !assignment) {
    return { error: "Assignment not found." };
  }

  if (assignment.status !== "unassigned" || assignment.assigned_staff_id) {
    return { error: "This assignment has already been claimed." };
  }

  if (assignment.required_therapist_gender !== actor.gender) {
    return { error: "You cannot claim an assignment for another therapist gender." };
  }

  const { data: claimedAssignment, error: claimError } = await adminClient
    .from("booking_assignments")
    .update({
      assigned_staff_id: actor.id,
      status: "assigned",
    })
    .eq("id", assignmentId)
    .eq("status", "unassigned")
    .is("assigned_staff_id", null)
    .select("id, booking_id, assigned_staff_id, required_therapist_gender, status")
    .single<AssignmentClaimRecord>();

  if (claimError || !claimedAssignment) {
    return { error: "This assignment has already been claimed." };
  }

  const { data: bookingAssignments, error: bookingAssignmentsError } =
    await adminClient
      .from("booking_assignments")
      .select("assigned_staff_id, status")
      .eq("booking_id", claimedAssignment.booking_id)
      .returns<BookingAssignmentStatusRecord[]>();

  if (bookingAssignmentsError || !bookingAssignments) {
    return { error: "Unable to update booking assignment status." };
  }

  const assignedCount = bookingAssignments.filter(
    (item) => item.assigned_staff_id && item.status !== "unassigned"
  ).length;
  const nextBookingAssignmentStatus =
    assignedCount === 0
      ? "unassigned"
      : assignedCount === bookingAssignments.length
        ? "fully_assigned"
        : "partially_assigned";

  const { data: updatedBooking, error: bookingError } = await adminClient
    .from("bookings")
    .update({ assignment_status: nextBookingAssignmentStatus })
    .eq("id", claimedAssignment.booking_id)
    .select()
    .single();

  if (bookingError) {
    return { error: bookingError.message };
  }

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "booking_assignment_claimed",
    target_type: "booking_assignments",
    target_id: assignmentId,
    before_state: assignment,
    after_state: {
      assignment: claimedAssignment,
      booking: updatedBooking,
    },
  });

  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${claimedAssignment.booking_id}`);

  return { success: true };
}
