"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  sendBookingCreatedEmails,
  sendAssignedStaffBookingChangeEmails,
  sendBookingCancellationEmails,
  sendStaffAssignmentEmail,
} from "@/lib/email/notifications";
import { ensureBookingManageUrl } from "@/lib/booking/manage-token";
import { canAssignBookings, getStaffProfile } from "@/lib/auth/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  BookingCreationError,
  DuplicateClientError,
  createBookingTransaction,
  type BookingSource,
} from "@/app/api/bookings/createBookingTransaction";
import {
  canClaimAssignments,
  canManageAllBookings,
  canManageBookings,
} from "./access";
import {
  getClaimAssignmentEligibility,
  getStaffAssignmentPreviews,
} from "./assignment-eligibility";
import type { AssignmentStatus, BookingStatus, PaymentMethod, PaymentStatus } from "./types";

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
const BOOKING_SOURCES: BookingSource[] = [
  "phone",
  "whatsapp",
  "facebook",
  "instagram",
  "referral",
  "admin",
  "other",
];
const OWN_ASSIGNMENT_STATUSES: AssignmentStatus[] = ["completed", "no_show"];

interface AssignmentClaimRecord {
  id: string;
  booking_id: string;
  assigned_staff_id: string | null;
  required_therapist_gender: "male" | "female";
  status: AssignmentStatus;
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

function canReassignBookings(profile: NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>) {
  return canManageAllBookings(profile) && canAssignBookings(profile);
}

async function recomputeBookingAssignmentStatus(
  bookingId: string,
  adminClient: ReturnType<typeof createSupabaseAdminClient>
) {
  const { data: assignments, error } = await adminClient
    .from("booking_assignments")
    .select("assigned_staff_id, status")
    .eq("booking_id", bookingId)
    .returns<BookingAssignmentStatusRecord[]>();

  if (error || !assignments) {
    return { error: "Unable to update booking assignment status." };
  }

  const assignedCount = assignments.filter(
    (item) => item.assigned_staff_id && item.status !== "unassigned"
  ).length;
  const nextStatus =
    assignedCount === 0
      ? "unassigned"
      : assignedCount === assignments.length
        ? "fully_assigned"
        : "partially_assigned";

  const { error: bookingError } = await adminClient
    .from("bookings")
    .update({ assignment_status: nextStatus })
    .eq("id", bookingId);

  return bookingError ? { error: bookingError.message } : { status: nextStatus };
}

export async function updateBookingManagement(
  _previousState: BookingUpdateState,
  formData: FormData
): Promise<BookingUpdateState> {
  const actor = await requireBookingManager();
  if (!actor) return { error: "Insufficient permissions." };
  if (!canManageAllBookings(actor)) return { error: "Insufficient permissions." };

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
  const amountPaidValue = String(formData.get("amount_paid") ?? "").trim();
  const paymentNote = String(formData.get("payment_note") ?? "").trim();
  const fieldErrors: Record<string, string> = {};
  const amountPaid = amountPaidValue ? Number(amountPaidValue) : 0;

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
  if (!Number.isFinite(amountPaid) || amountPaid < 0) {
    fieldErrors.amount_paid = "Enter a valid amount paid.";
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

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
    amount_paid: amountPaid,
    paid_at:
      paymentStatus === "paid" && beforeState.payment_status !== "paid"
        ? new Date().toISOString()
        : paymentStatus === "paid"
          ? beforeState.paid_at
          : null,
    payment_note: paymentNote || null,
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
    await sendBookingCancellationEmails(bookingId, adminClient, {
      initiatedBy: "admin",
    }).catch((error) => {
      console.error("Unable to send booking cancellation emails.", error);
    });
  } else if (beforeState.status !== data.status) {
    await sendAssignedStaffBookingChangeEmails(
      bookingId,
      adminClient,
      `Booking status changed from ${beforeState.status} to ${data.status}.`
    ).catch((error) => {
      console.error("Unable to send assigned staff change emails.", error);
    });
  }

  updateTag("report-data");
  updateTag("dashboard-data");
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/calendar");

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

  const { data: booking } = await adminClient
    .from("bookings")
    .select("id, booking_date, start_time, end_time")
    .eq("id", assignment.booking_id)
    .single();

  if (!booking) return { error: "Booking not found." };

  const eligibility = await getClaimAssignmentEligibility({
    actor,
    assignment,
    booking,
    supabase: adminClient,
  });

  if (!eligibility.eligible) {
    return { error: eligibility.reason };
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

  await sendStaffAssignmentEmail(
    claimedAssignment.booking_id,
    actor.email,
    adminClient,
    actor.id
  ).catch((error) => {
    console.error("Unable to send staff assignment email.", error);
  });

  updateTag("report-data");
  updateTag("dashboard-data");
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${claimedAssignment.booking_id}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/calendar");

  return { success: true };
}

export async function quickUpdateBooking(formData: FormData) {
  const actor = await requireBookingManager();
  if (!actor || !canManageAllBookings(actor)) {
    return { error: "Insufficient permissions." };
  }

  const bookingId = String(formData.get("booking_id") ?? "").trim();
  const action = String(formData.get("action") ?? "").trim();
  if (!bookingId) return { error: "Booking is required." };

  const adminClient = createSupabaseAdminClient();
  const { data: beforeState } = await adminClient
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .single();

  if (!beforeState) return { error: "Booking not found." };

  const amountDue = Number(beforeState.amount_due ?? beforeState.total_price ?? 0);
  const payload =
    action === "confirm"
      ? { status: "confirmed" as BookingStatus }
      : action === "mark_paid"
        ? {
            payment_status: "paid" as PaymentStatus,
            payment_method: beforeState.payment_method ?? ("cash" as PaymentMethod),
            amount_paid: amountDue,
            paid_at: beforeState.paid_at ?? new Date().toISOString(),
          }
        : action === "cancel"
          ? { status: "cancelled" as BookingStatus }
          : action === "complete"
            ? { status: "completed" as BookingStatus }
            : null;

  if (!payload) return { error: "Unsupported booking action." };

  const { data: updatedBooking, error } = await adminClient
    .from("bookings")
    .update(payload)
    .eq("id", bookingId)
    .select()
    .single();

  if (error) return { error: error.message };

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: `booking_quick_${action}`,
    target_type: "bookings",
    target_id: bookingId,
    before_state: beforeState,
    after_state: updatedBooking,
  });

  if (beforeState.status !== "cancelled" && updatedBooking.status === "cancelled") {
    await sendBookingCancellationEmails(bookingId, adminClient, {
      initiatedBy: "admin",
    }).catch((error) => {
      console.error("Unable to send booking cancellation emails.", error);
    });
  } else if (beforeState.status !== updatedBooking.status) {
    await sendAssignedStaffBookingChangeEmails(
      bookingId,
      adminClient,
      `Booking status changed from ${beforeState.status} to ${updatedBooking.status}.`
    ).catch((error) => {
      console.error("Unable to send assigned staff change emails.", error);
    });
  }

  updateTag("report-data");
  updateTag("dashboard-data");
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/calendar");

  return { success: true };
}

export async function updateBookingAssignment(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const actor = await getStaffProfile(supabase);

  if (!actor || !actor.active || !canReassignBookings(actor)) {
    return { error: "Insufficient permissions." };
  }

  const assignmentId = String(formData.get("assignment_id") ?? "").trim();
  const staffId = String(formData.get("staff_id") ?? "").trim();
  const action = String(formData.get("action") ?? "").trim();
  if (!assignmentId) return { error: "Assignment is required." };

  const adminClient = createSupabaseAdminClient();
  const { data: assignment } = await adminClient
    .from("booking_assignments")
    .select("id, booking_id, participant_id, assigned_staff_id, required_therapist_gender, status")
    .eq("id", assignmentId)
    .single<AssignmentClaimRecord>();

  if (!assignment) return { error: "Assignment not found." };

  const { data: booking } = await adminClient
    .from("bookings")
    .select("id, booking_date, start_time, end_time")
    .eq("id", assignment.booking_id)
    .single();

  if (!booking) return { error: "Booking not found." };

  const beforeState = assignment;
  let nextPayload: {
    assigned_staff_id: string | null;
    status: AssignmentStatus;
  };

  if (action === "unassign") {
    nextPayload = {
      assigned_staff_id: null,
      status: "unassigned",
    };
  } else {
    if (!staffId) return { error: "Choose an eligible staff member." };

    const previews = await getStaffAssignmentPreviews({
      booking,
      requiredGender: assignment.required_therapist_gender as "male" | "female",
      supabase: adminClient,
    });
    const selected = previews.find((preview) => preview.staff.id === staffId);

    if (!selected) return { error: "Staff member not found." };
    if (!selected.eligible) return { error: selected.reason };

    nextPayload = {
      assigned_staff_id: staffId,
      status: "assigned",
    };
  }

  const { data: updatedAssignment, error } = await adminClient
    .from("booking_assignments")
    .update(nextPayload)
    .eq("id", assignmentId)
    .select("id, booking_id, assigned_staff_id, required_therapist_gender, status")
    .single<AssignmentClaimRecord>();

  if (error || !updatedAssignment) {
    return { error: error?.message ?? "Unable to update assignment." };
  }

  const assignmentStatusResult = await recomputeBookingAssignmentStatus(
    assignment.booking_id,
    adminClient
  );
  if (assignmentStatusResult.error) return assignmentStatusResult;

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: action === "unassign" ? "booking_assignment_unassigned" : "booking_assignment_reassigned",
    target_type: "booking_assignments",
    target_id: assignmentId,
    before_state: beforeState,
    after_state: updatedAssignment,
  });

  if (updatedAssignment.assigned_staff_id) {
    const { data: staff } = await adminClient
      .from("staff_profiles")
      .select("email")
      .eq("id", updatedAssignment.assigned_staff_id)
      .single<{ email: string }>();

    if (staff?.email) {
      await sendStaffAssignmentEmail(
        updatedAssignment.booking_id,
        staff.email,
        adminClient,
        updatedAssignment.assigned_staff_id
      ).catch((error) => {
        console.error("Unable to send staff assignment email.", error);
      });
    }
  }

  updateTag("report-data");
  updateTag("dashboard-data");
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${assignment.booking_id}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/calendar");

  return { success: true };
}

export async function updateOwnAssignmentStatus(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const actor = await getStaffProfile(supabase);

  if (!actor || !actor.active || !canManageBookings(actor)) {
    return { error: "Insufficient permissions." };
  }

  const assignmentId = String(formData.get("assignment_id") ?? "").trim();
  const status = String(formData.get("status") ?? "") as AssignmentStatus;
  if (!assignmentId) return { error: "Assignment is required." };
  if (!OWN_ASSIGNMENT_STATUSES.includes(status)) {
    return { error: "Choose a valid assignment status." };
  }

  const adminClient = createSupabaseAdminClient();
  const { data: beforeState } = await adminClient
    .from("booking_assignments")
    .select("id, booking_id, assigned_staff_id, required_therapist_gender, status")
    .eq("id", assignmentId)
    .single<AssignmentClaimRecord>();

  if (!beforeState || beforeState.assigned_staff_id !== actor.id) {
    return { error: "You can only update your own assigned work." };
  }

  const { data: updatedAssignment, error } = await adminClient
    .from("booking_assignments")
    .update({ status })
    .eq("id", assignmentId)
    .eq("assigned_staff_id", actor.id)
    .select("id, booking_id, assigned_staff_id, required_therapist_gender, status")
    .single<AssignmentClaimRecord>();

  if (error || !updatedAssignment) {
    return { error: error?.message ?? "Unable to update assignment." };
  }

  const assignmentStatusResult = await recomputeBookingAssignmentStatus(
    updatedAssignment.booking_id,
    adminClient
  );
  if (assignmentStatusResult.error) return assignmentStatusResult;

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: `booking_assignment_${status}`,
    target_type: "booking_assignments",
    target_id: assignmentId,
    before_state: beforeState,
    after_state: updatedAssignment,
  });

  updateTag("report-data");
  updateTag("dashboard-data");
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${updatedAssignment.booking_id}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/calendar");

  return { success: true };
}

// ─── H4 — reschedule response ───────────────────────────────────────────────
// Give admin a way to acknowledge a customer reschedule request so
// `reschedule_status` doesn't hang on "requested" forever (the cause of
// permanent attention inflation flagged by Agent 1). Decision is recorded
// on the booking row + audit trail; the actual move-of-booking-date is
// handled out-of-band per the existing operator workflow (no admin path
// currently edits booking_date, and adding one is a separate feature).
//
// Schema vocabulary: the `bookings.reschedule_status` CHECK constraint
// allows ['none','requested','reviewed','declined','completed']. "Accept"
// maps to 'reviewed' (admin has reviewed the request; the actual booking
// move is out-of-band). "Decline" maps to 'declined'. UI labels stay
// operator-friendly ("Accept request" / "Decline request") but the stored
// values match the schema's allowed vocabulary.
const RESCHEDULE_DECISIONS = ["reviewed", "declined"] as const;
type RescheduleDecision = (typeof RESCHEDULE_DECISIONS)[number];

export async function respondToCustomerReschedule(formData: FormData): Promise<void> {
  const actor = await requireBookingManager();
  if (!actor || !canManageAllBookings(actor)) return;

  const bookingId = String(formData.get("booking_id") ?? "").trim();
  const decisionRaw = String(formData.get("decision") ?? "") as RescheduleDecision;
  if (!bookingId || !RESCHEDULE_DECISIONS.includes(decisionRaw)) return;

  const adminClient = createSupabaseAdminClient();
  const { data: beforeState } = await adminClient
    .from("bookings")
    .select(
      "id, reschedule_status, reschedule_requested_at, reschedule_preferred_date, reschedule_preferred_time, reschedule_note"
    )
    .eq("id", bookingId)
    .single();
  if (!beforeState || beforeState.reschedule_status !== "requested") return;

  const { data: updated, error } = await adminClient
    .from("bookings")
    .update({ reschedule_status: decisionRaw })
    .eq("id", bookingId)
    .select("id, reschedule_status")
    .single();
  if (error) return;

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type:
      decisionRaw === "reviewed"
        ? "booking_reschedule_reviewed"
        : "booking_reschedule_declined",
    target_type: "bookings",
    target_id: bookingId,
    before_state: beforeState,
    after_state: updated,
  });

  updateTag("report-data");
  updateTag("dashboard-data");
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/calendar");
}

export interface ManualBookingState {
  error?: string;
  fieldErrors?: Record<string, string>;
  duplicateWarning?: string;
}

const manualBookingSchema = z.object({
  selectedPackageIds: z.array(z.string().trim().min(1)).min(1, "Choose at least one service."),
  bookingSource: z.enum(BOOKING_SOURCES),
  sendConfirmationEmail: z.boolean(),
  overrideAvailability: z.boolean().default(false),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a booking date."),
  preferredTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a booking time."),
  details: z.object({
    bookingFor: z.enum(["self", "someone_else", "group"]),
    fullName: z.string().trim().min(1, "Contact name is required."),
    phone: z.string().trim().min(1, "Phone is required."),
    email: z.email("A valid email is required."),
    notes: z.string(),
    healthNotes: z.string(),
    clientGender: z.enum(["male", "female", ""]),
    numberOfPeople: z.coerce.number().int().min(1).max(10),
    participantGenders: z.array(z.enum(["male", "female", ""])),
    participantNames: z.array(z.string()),
    participantNotes: z.array(z.string()),
    consentAcknowledged: z.boolean(),
    paymentAcknowledged: z.literal(true),
    manageAcknowledged: z.literal(true),
    postcode: z.string().trim().min(3, "Postcode is required."),
    address: z.string().trim().min(5, "Address is required."),
    city: z.string().trim().min(2, "City is required."),
    area: z.string(),
    accessNotes: z.string(),
    parkingNotes: z.string(),
  }),
});

export async function createManualBooking(
  _previousState: ManualBookingState,
  formData: FormData
): Promise<ManualBookingState> {
  const actor = await requireBookingManager();
  if (!actor || !canManageAllBookings(actor)) {
    return { error: "Insufficient permissions." };
  }

  const numberOfPeople = Number(formData.get("number_of_people") ?? 1);
  const participantIndexes = Array.from(
    { length: Number.isFinite(numberOfPeople) ? numberOfPeople : 1 },
    (_, index) => index
  );
  const selectedPackageIds = formData.getAll("service_slugs").map(String);
  const enquiryId = String(formData.get("enquiry_id") ?? "").trim();
  const clientId = String(formData.get("client_id") ?? "").trim() || null;
  const confirmDuplicate = formData.get("confirm_duplicate") === "on";
  const overrideAvailability = formData.get("override_availability") === "on";
  const participantServiceSlugs: string[][] = participantIndexes.map((index) =>
    formData.getAll(`participant_services_${index}[]`).map(String).filter(Boolean)
  );
  const parsed = manualBookingSchema.safeParse({
    selectedPackageIds,
    bookingSource: String(formData.get("booking_source") ?? ""),
    sendConfirmationEmail: formData.get("send_confirmation_email") === "on",
    overrideAvailability,
    preferredDate: String(formData.get("booking_date") ?? ""),
    preferredTime: String(formData.get("start_time") ?? ""),
    details: {
      bookingFor:
        numberOfPeople > 1
          ? "group"
          : String(formData.get("booking_for") ?? "self"),
      fullName: String(formData.get("full_name") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      email: String(formData.get("email") ?? ""),
      notes: String(formData.get("customer_notes") ?? ""),
      healthNotes: String(formData.get("health_notes") ?? ""),
      clientGender: String(formData.get("participant_gender_0") ?? ""),
      numberOfPeople,
      participantGenders: participantIndexes.map((index) =>
        String(formData.get(`participant_gender_${index}`) ?? "")
      ),
      participantNames: participantIndexes.map((index) =>
        String(formData.get(`participant_name_${index}`) ?? "")
      ),
      participantNotes: participantIndexes.map((index) =>
        String(formData.get(`participant_note_${index}`) ?? "")
      ),
      consentAcknowledged: formData.get("consent_acknowledged") === "on",
      paymentAcknowledged: true,
      manageAcknowledged: true,
      postcode: String(formData.get("postcode") ?? ""),
      address: String(formData.get("address") ?? ""),
      city: String(formData.get("city") ?? ""),
      area: String(formData.get("area") ?? ""),
      accessNotes: String(formData.get("access_notes") ?? ""),
      parkingNotes: String(formData.get("parking_notes") ?? ""),
    },
  });

  if (!parsed.success) {
    return {
      error: "Check the highlighted booking details.",
      fieldErrors: Object.fromEntries(
        Object.entries(z.flattenError(parsed.error).fieldErrors).map(
          ([key, value]) => [key, value?.[0] ?? "Invalid value."]
        )
      ),
    };
  }

  if (!parsed.data.details.consentAcknowledged) {
    return {
      error: "Record consent acknowledgement before creating the booking.",
      fieldErrors: { consentAcknowledged: "Consent acknowledgement is required." },
    };
  }

  const adminClient = createSupabaseAdminClient();

  try {
    const result = await createBookingTransaction(
      {
        selectedPackageIds: parsed.data.selectedPackageIds,
        details: parsed.data.details,
        preferredDate: parsed.data.preferredDate,
        preferredTime: parsed.data.preferredTime,
        bookingSource: parsed.data.bookingSource,
        overrideAvailability: parsed.data.overrideAvailability,
        participantServiceSlugs: participantServiceSlugs.some((s) => s.length > 0)
          ? participantServiceSlugs
          : undefined,
        clientId,
        confirmDuplicate,
      },
      adminClient
    );

    await adminClient.from("audit_logs").insert({
      actor_staff_id: actor.id,
      action_type: "manual_admin_booking_created",
      target_type: "bookings",
      target_id: result.bookingId,
      after_state: {
        bookingSource: parsed.data.bookingSource,
        participantCount: result.participantCount,
        itemCount: result.itemCount,
        assignmentCount: result.assignmentCount,
      },
    });

    // Inline assignment — apply therapist selections from step 4 if present
    try {
      const therapistAssignments = participantIndexes.map((i) =>
        String(formData.get(`therapist_assignment_${i}`) ?? "").trim()
      );
      const hasAnyAssignment = therapistAssignments.some((id) => id.length > 0);

      if (hasAnyAssignment) {
        const { data: participants } = await adminClient
          .from("booking_participants")
          .select("id")
          .eq("booking_id", result.bookingId)
          .order("created_at", { ascending: true });

        if (participants && participants.length > 0) {
          let appliedCount = 0;

          for (let i = 0; i < therapistAssignments.length; i++) {
            const staffId = therapistAssignments[i];
            if (!staffId || !participants[i]) continue;

            const { data: assignment } = await adminClient
              .from("booking_assignments")
              .select("id")
              .eq("participant_id", participants[i].id)
              .single();

            if (!assignment) continue;

            await adminClient
              .from("booking_assignments")
              .update({ assigned_staff_id: staffId, status: "assigned" })
              .eq("id", assignment.id);

            await adminClient.from("audit_logs").insert({
              actor_staff_id: actor.id,
              action_type: "booking_assignment_reassigned",
              target_type: "booking_assignments",
              target_id: assignment.id,
              after_state: { assigned_staff_id: staffId },
            });

            appliedCount++;
          }

          if (appliedCount > 0) {
            const newStatus =
              appliedCount >= result.participantCount
                ? "fully_assigned"
                : "partially_assigned";

            await adminClient
              .from("bookings")
              .update({ assignment_status: newStatus })
              .eq("id", result.bookingId);
          }
        }
      }
    } catch (assignmentError) {
      console.error("Inline assignment failed (booking was created):", assignmentError);
    }

    if (enquiryId) {
      const { data: beforeEnquiry } = await adminClient
        .from("enquiries")
        .select("*")
        .eq("id", enquiryId)
        .single();

      const { data: updatedEnquiry } = await adminClient
        .from("enquiries")
        .update({
          status: "booked",
          converted_booking_id: result.bookingId,
        })
        .eq("id", enquiryId)
        .select()
        .single();

      await adminClient.from("audit_logs").insert({
        actor_staff_id: actor.id,
        action_type: "enquiry_converted_to_booking",
        target_type: "enquiries",
        target_id: enquiryId,
        before_state: beforeEnquiry,
        after_state: updatedEnquiry,
      });

      updateTag("report-data");
      updateTag("dashboard-data");
      revalidatePath("/admin/enquiries");
    }

    if (parsed.data.sendConfirmationEmail) {
      const manageUrl = await ensureBookingManageUrl(
        {
          id: result.bookingId,
          booking_date: parsed.data.preferredDate,
        },
        adminClient
      ).catch((error) => {
        console.error("Unable to create booking manage link.", error);
        return null;
      });

      await sendBookingCreatedEmails(result.bookingId, adminClient, {
        manageUrl: manageUrl ?? undefined,
      }).catch((error) => {
        console.error("Unable to send manual booking emails.", error);
      });
    }

    updateTag("report-data");
    updateTag("dashboard-data");
    revalidatePath("/admin/bookings");
    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/calendar");
    redirect(`/admin/bookings/${result.bookingId}`);
  } catch (error) {
    // Checked before BookingCreationError — DuplicateClientError extends it.
    if (error instanceof DuplicateClientError) {
      const { data: match } = error.matchedClientId
        ? await adminClient
            .from("clients")
            .select("full_name, email, phone")
            .eq("id", error.matchedClientId)
            .maybeSingle()
        : { data: null };

      return {
        duplicateWarning: match
          ? `${match.full_name} (${match.email ?? match.phone ?? "no contact"})`
          : (error.matchedClientName ?? "An existing client already uses these contact details."),
      };
    }

    if (error instanceof BookingCreationError) {
      return { error: error.message };
    }

    throw error;
  }
}
