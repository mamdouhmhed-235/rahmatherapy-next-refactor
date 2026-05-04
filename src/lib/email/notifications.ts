// SERVER ONLY - do not import from client components.
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureBookingManageUrl } from "@/lib/booking/manage-token";
import {
  extractEmailAddress,
  getFromEmail,
  sendEmail,
} from "./client";
import {
  renderAdminBookingNotificationEmail,
  renderAdminBookingCancellationEmail,
  renderAdminRescheduleRequestEmail,
  renderBookingCancellationEmail,
  renderBookingConfirmationEmail,
  renderBookingPlainText,
  renderBookingReminderEmail,
  renderStaffAssignmentEmail,
  renderStaffBookingChangeEmail,
  type BookingEmailTemplateInput,
  type EmailParticipant,
} from "./templates";
import { recordOperationalEvent } from "@/lib/ops/operational-events";

type ParticipantGender = "male" | "female";

interface BookingClient {
  full_name: string;
  phone: string | null;
  email: string | null;
}

interface BookingParticipant {
  id: string;
  participant_gender: ParticipantGender;
  required_therapist_gender: ParticipantGender;
  is_main_contact: boolean;
  display_name: string | null;
}

interface BookingItem {
  id: string;
  booking_participant_id: string | null;
  service_name_snapshot: string;
  service_price_snapshot: number | string;
  service_duration_snapshot: number;
}

interface BookingAssignment {
  id: string;
  participant_id: string;
  assigned_staff_id: string | null;
  required_therapist_gender: ParticipantGender;
  status: string;
  staff_profiles: { name: string } | null;
}

interface AssignedStaffEmailRecord {
  assigned_staff_id: string | null;
  staff_profiles: { email: string | null } | null;
}

interface BookingEmailRecord {
  id: string;
  contact_full_name: string;
  contact_email: string;
  contact_phone: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  total_price: number | string | null;
  group_booking: boolean;
  service_address_line1: string | null;
  service_address_line2: string | null;
  service_city: string | null;
  service_postcode: string | null;
  access_notes: string | null;
  customer_notes: string | null;
  clients: BookingClient | null;
  booking_participants: BookingParticipant[];
  booking_items: BookingItem[];
  booking_assignments: BookingAssignment[];
}

interface BusinessSettings {
  company_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
}

const BOOKING_EMAIL_SELECT = `
  id,
  contact_full_name,
  contact_email,
  contact_phone,
  booking_date,
  start_time,
  end_time,
  total_price,
  group_booking,
  service_address_line1,
  service_address_line2,
  service_city,
  service_postcode,
  access_notes,
  customer_notes,
  clients(full_name, phone, email),
  booking_participants(id, participant_gender, required_therapist_gender, is_main_contact, display_name),
  booking_items(id, booking_participant_id, service_name_snapshot, service_price_snapshot, service_duration_snapshot),
  booking_assignments(id, participant_id, assigned_staff_id, required_therapist_gender, status, staff_profiles(name))
`;

function getAddressLines(booking: BookingEmailRecord) {
  return [
    booking.service_address_line1,
    booking.service_address_line2,
    booking.service_city,
    booking.service_postcode,
    booking.access_notes ? `Access notes: ${booking.access_notes}` : null,
  ].filter((value): value is string => Boolean(value));
}

function getParticipantRows(booking: BookingEmailRecord): EmailParticipant[] {
  return booking.booking_participants.map((participant, index) => {
    const services = booking.booking_items
      .filter((item) => item.booking_participant_id === participant.id)
      .map((item) => item.service_name_snapshot);
    const assignment = booking.booking_assignments.find(
      (item) => item.participant_id === participant.id
    );

    return {
      label: participant.display_name
        ?? (participant.is_main_contact ? `Main contact` : `Participant ${index + 1}`),
      participantGender: participant.participant_gender,
      requiredTherapistGender: participant.required_therapist_gender,
      services,
      assignedStaffName: assignment?.staff_profiles?.name ?? null,
    };
  });
}

async function getBusinessSettings(
  supabase: SupabaseClient
): Promise<BusinessSettings> {
  const { data } = await supabase
    .from("business_settings")
    .select("company_name, contact_email, contact_phone")
    .eq("id", 1)
    .maybeSingle<BusinessSettings>();

  return {
    company_name: data?.company_name ?? "Rahma Therapy",
    contact_email: data?.contact_email ?? null,
    contact_phone: data?.contact_phone ?? null,
  };
}

async function getBookingEmailRecord(bookingId: string, supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_EMAIL_SELECT)
    .eq("id", bookingId)
    .single<BookingEmailRecord>();

  if (error || !data) {
    throw new Error("Unable to load booking email context.");
  }

  if (!data.contact_email && !data.clients?.email) {
    throw new Error("Booking has no contact email address.");
  }

  return data;
}

async function getBookingTemplateInput(
  bookingId: string,
  supabase: SupabaseClient,
  options: { includeManageUrl?: boolean; manageUrl?: string } = {}
) {
  const [booking, settings] = await Promise.all([
    getBookingEmailRecord(bookingId, supabase),
    getBusinessSettings(supabase),
  ]);
  const manageUrl = options.manageUrl
    ?? (options.includeManageUrl
      ? await ensureBookingManageUrl(booking, supabase)
      : undefined);

  const input: BookingEmailTemplateInput = {
    companyName: settings.company_name ?? "Rahma Therapy",
    clientName: booking.contact_full_name || booking.clients?.full_name || "Client",
    bookingDate: booking.booking_date,
    startTime: booking.start_time,
    endTime: booking.end_time,
    addressLines: getAddressLines(booking),
    totalPrice: Number(booking.total_price ?? 0),
    participantCount: booking.booking_participants.length,
    participants: getParticipantRows(booking),
    manageUrl,
    customerNotes: booking.customer_notes,
    contactEmail: settings.contact_email,
    contactPhone: settings.contact_phone,
  };

  return { booking, settings, input };
}

function getAdminRecipient(settings: BusinessSettings) {
  return settings.contact_email ?? extractEmailAddress(getFromEmail());
}

function getProviderMessageId(data: unknown) {
  return typeof data === "object" &&
    data !== null &&
    "id" in data &&
    typeof data.id === "string"
    ? data.id
    : null;
}

async function recordEmailDeliveryEvent(
  supabase: SupabaseClient,
  input: {
    bookingId: string;
    eventType: string;
    recipientEmail: string | null;
    recipientRole: string;
    deliveryStatus: "accepted" | "failed" | "skipped";
    staffId?: string | null;
    providerMessageId?: string | null;
    errorMessage?: string | null;
  }
) {
  await supabase.from("email_delivery_events").insert({
    booking_id: input.bookingId,
    staff_id: input.staffId ?? null,
    event_type: input.eventType,
    recipient_email: input.recipientEmail,
    recipient_role: input.recipientRole,
    delivery_status: input.deliveryStatus,
    provider_message_id: input.providerMessageId ?? null,
    error_message: input.errorMessage ?? null,
  });

  if (input.deliveryStatus === "failed") {
    await recordOperationalEvent(supabase, {
      eventType: "failed_email_send",
      severity: "error",
      summary: `Email ${input.eventType} failed for ${input.recipientRole}.`,
      bookingId: input.bookingId,
      staffId: input.staffId ?? null,
      safeContext: {
        event_type: input.eventType,
        recipient_role: input.recipientRole,
        delivery_status: input.deliveryStatus,
      },
    }).catch(() => undefined);
  }
}

async function sendTrackedEmail(
  supabase: SupabaseClient,
  input: {
    bookingId: string;
    eventType: string;
    recipientRole: string;
    staffId?: string | null;
    to: string | null;
    subject: string;
    html: string;
    text: string;
  }
) {
  if (!input.to) {
    await recordEmailDeliveryEvent(supabase, {
      bookingId: input.bookingId,
      eventType: input.eventType,
      recipientEmail: null,
      recipientRole: input.recipientRole,
      deliveryStatus: "skipped",
      staffId: input.staffId ?? null,
      errorMessage: "Missing recipient email.",
    }).catch(() => undefined);
    return { status: "skipped" as const };
  }

  try {
    const data = await sendEmail({
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    await recordEmailDeliveryEvent(supabase, {
      bookingId: input.bookingId,
      eventType: input.eventType,
      recipientEmail: input.to,
      recipientRole: input.recipientRole,
      deliveryStatus: "accepted",
      staffId: input.staffId ?? null,
      providerMessageId: getProviderMessageId(data),
    }).catch(() => undefined);
    return { status: "accepted" as const };
  } catch (error) {
    await recordEmailDeliveryEvent(supabase, {
      bookingId: input.bookingId,
      eventType: input.eventType,
      recipientEmail: input.to,
      recipientRole: input.recipientRole,
      deliveryStatus: "failed",
      staffId: input.staffId ?? null,
      errorMessage: error instanceof Error ? error.message : "Email failed.",
    }).catch(() => undefined);
    return { status: "failed" as const };
  }
}

async function getAssignedStaffEmails(bookingId: string, supabase: SupabaseClient) {
  const { data } = await supabase
    .from("booking_assignments")
    .select("assigned_staff_id, staff_profiles(email)")
    .eq("booking_id", bookingId)
    .not("assigned_staff_id", "is", null)
    .returns<AssignedStaffEmailRecord[]>();

  const records = new Map<string, { staffId: string; email: string }>();
  for (const assignment of data ?? []) {
    if (!assignment.assigned_staff_id || !assignment.staff_profiles?.email) {
      continue;
    }
    records.set(assignment.staff_profiles.email, {
      staffId: assignment.assigned_staff_id,
      email: assignment.staff_profiles.email,
    });
  }

  return [...records.values()];
}

export async function sendBookingCreatedEmails(
  bookingId: string,
  supabase: SupabaseClient,
  options: { manageUrl?: string } = {}
) {
  const { booking, settings, input } = await getBookingTemplateInput(
    bookingId,
    supabase,
    { includeManageUrl: true, manageUrl: options.manageUrl }
  );
  const customerEmail = booking.contact_email || booking.clients?.email;
  if (!customerEmail) {
    throw new Error("Booking client has no email address.");
  }

  await Promise.all([
    sendTrackedEmail(supabase, {
      bookingId,
      eventType: "booking_confirmation",
      recipientRole: "customer",
      to: customerEmail,
      subject: `${input.companyName} booking request received`,
      html: renderBookingConfirmationEmail(input),
      text: renderBookingPlainText("Booking request received", input),
    }),
    sendTrackedEmail(supabase, {
      bookingId,
      eventType: "admin_booking_notification",
      recipientRole: "admin",
      to: getAdminRecipient(settings),
      subject: `New booking request - ${input.clientName}`,
      html: renderAdminBookingNotificationEmail({
        ...input,
        bookingId: booking.id,
        clientEmail: booking.contact_email || booking.clients?.email || null,
        clientPhone: booking.contact_phone || booking.clients?.phone || null,
      }),
      text: renderBookingPlainText("New booking request", input),
    }),
  ]);

  return { manageUrl: input.manageUrl ?? null };
}

export async function sendBookingCancellationEmails(
  bookingId: string,
  supabase: SupabaseClient,
  options: {
    initiatedBy: "customer" | "admin";
    cancellationNote?: string | null;
  } = { initiatedBy: "admin" }
) {
  const { booking, settings, input } = await getBookingTemplateInput(bookingId, supabase);
  const customerEmail = booking.contact_email || booking.clients?.email;
  if (!customerEmail) {
    throw new Error("Booking client has no email address.");
  }

  await Promise.all([
    sendTrackedEmail(supabase, {
      bookingId,
      eventType: "booking_cancellation_customer",
      recipientRole: "customer",
      to: customerEmail,
      subject: `${input.companyName} booking cancelled`,
      html: renderBookingCancellationEmail(input),
      text: renderBookingPlainText("Booking cancelled", input),
    }),
    sendTrackedEmail(supabase, {
      bookingId,
      eventType: "booking_cancellation_admin",
      recipientRole: "admin",
      to: getAdminRecipient(settings),
      subject: `Booking cancelled - ${input.clientName}`,
      html: renderAdminBookingCancellationEmail({
        ...input,
        bookingId,
        initiatedBy: options.initiatedBy,
        cancellationNote: options.cancellationNote,
      }),
      text: renderBookingPlainText("Booking cancelled", input),
    }),
    sendAssignedStaffBookingChangeEmails(
      bookingId,
      supabase,
      "An assigned booking has been cancelled."
    ),
  ]);
}

export async function sendBookingCancellationEmail(
  bookingId: string,
  supabase: SupabaseClient
) {
  await sendBookingCancellationEmails(bookingId, supabase, {
    initiatedBy: "admin",
  });
}

export async function sendBookingRescheduleRequestEmails(
  bookingId: string,
  supabase: SupabaseClient,
  input: {
    requestedDate: string;
    requestedTime: string;
    requestNote: string | null;
  }
) {
  const { settings, input: templateInput } = await getBookingTemplateInput(
    bookingId,
    supabase
  );

  await sendTrackedEmail(supabase, {
    bookingId,
    eventType: "booking_reschedule_request_admin",
    recipientRole: "admin",
    to: getAdminRecipient(settings),
    subject: `Reschedule request - ${templateInput.clientName}`,
    html: renderAdminRescheduleRequestEmail({
      ...templateInput,
      bookingId,
      requestedDate: input.requestedDate,
      requestedTime: input.requestedTime,
      requestNote: input.requestNote,
    }),
    text: renderBookingPlainText("Reschedule request", templateInput),
  });
}

export async function sendStaffAssignmentEmail(
  bookingId: string,
  staffEmail: string | null,
  supabase: SupabaseClient,
  staffId?: string | null
) {
  const { input } = await getBookingTemplateInput(bookingId, supabase);

  await sendTrackedEmail(supabase, {
    bookingId,
    eventType: "staff_assignment",
    recipientRole: "staff",
    staffId: staffId ?? null,
    to: staffEmail,
    subject: `${input.companyName} booking assignment`,
    html: renderStaffAssignmentEmail(input),
    text: renderBookingPlainText("Booking assignment", input),
  });
}

export async function sendAssignedStaffBookingChangeEmails(
  bookingId: string,
  supabase: SupabaseClient,
  changeSummary: string
) {
  const [staffEmails, { input }] = await Promise.all([
    getAssignedStaffEmails(bookingId, supabase),
    getBookingTemplateInput(bookingId, supabase),
  ]);

  await Promise.all(
    staffEmails.map((staff) =>
      sendTrackedEmail(supabase, {
        bookingId,
        eventType: "staff_booking_change",
        recipientRole: "staff",
        staffId: staff.staffId,
        to: staff.email,
        subject: `${input.companyName} assigned booking changed`,
        html: renderStaffBookingChangeEmail({
          ...input,
          changeSummary,
        }),
        text: renderBookingPlainText("Assigned booking changed", input),
      })
    )
  );
}

export async function sendBookingReminderEmail(
  bookingId: string,
  supabase: SupabaseClient
) {
  const { booking, input } = await getBookingTemplateInput(bookingId, supabase);
  const customerEmail = booking.contact_email || booking.clients?.email;
  if (!customerEmail) {
    throw new Error("Booking client has no email address.");
  }

  await sendTrackedEmail(supabase, {
    bookingId,
    eventType: "booking_reminder",
    recipientRole: "customer",
    to: customerEmail,
    subject: `${input.companyName} booking reminder`,
    html: renderBookingReminderEmail(input),
    text: renderBookingPlainText("Booking reminder", input),
  });
}
