// SERVER ONLY - do not import from client components.
import { createHash, randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  extractEmailAddress,
  getFromEmail,
  getSiteUrl,
  sendEmail,
} from "./client";
import {
  renderAdminBookingNotificationEmail,
  renderBookingCancellationEmail,
  renderBookingConfirmationEmail,
  renderBookingPlainText,
  renderBookingReminderEmail,
  type BookingEmailTemplateInput,
  type EmailParticipant,
} from "./templates";

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

interface BookingEmailRecord {
  id: string;
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
  booking_participants(id, participant_gender, required_therapist_gender, is_main_contact),
  booking_items(id, booking_participant_id, service_name_snapshot, service_price_snapshot, service_duration_snapshot),
  booking_assignments(id, participant_id, assigned_staff_id, required_therapist_gender, status, staff_profiles(name))
`;

function getManageTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getManageTokenExpiry(bookingDate: string) {
  return new Date(`${bookingDate}T23:59:59.000Z`).toISOString();
}

async function createManageUrl(booking: BookingEmailRecord, supabase: SupabaseClient) {
  const token = randomUUID();
  const { error } = await supabase
    .from("bookings")
    .update({
      manage_token_hash: getManageTokenHash(token),
      manage_token_expires_at: getManageTokenExpiry(booking.booking_date),
    })
    .eq("id", booking.id);

  if (error) {
    throw new Error("Unable to create booking manage link.");
  }

  return `${getSiteUrl()}/booking/manage?token=${token}`;
}

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
      label: participant.is_main_contact
        ? `Main contact`
        : `Participant ${index + 1}`,
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

  if (!data.clients?.email) {
    throw new Error("Booking client has no email address.");
  }

  return data;
}

async function getBookingTemplateInput(
  bookingId: string,
  supabase: SupabaseClient,
  options: { includeManageUrl?: boolean } = {}
) {
  const [booking, settings] = await Promise.all([
    getBookingEmailRecord(bookingId, supabase),
    getBusinessSettings(supabase),
  ]);
  const manageUrl = options.includeManageUrl
    ? await createManageUrl(booking, supabase)
    : undefined;

  const input: BookingEmailTemplateInput = {
    companyName: settings.company_name ?? "Rahma Therapy",
    clientName: booking.clients?.full_name ?? "Client",
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

export async function sendBookingCreatedEmails(
  bookingId: string,
  supabase: SupabaseClient
) {
  const { booking, settings, input } = await getBookingTemplateInput(
    bookingId,
    supabase,
    { includeManageUrl: true }
  );
  const customerEmail = booking.clients?.email;
  if (!customerEmail) {
    throw new Error("Booking client has no email address.");
  }

  await Promise.all([
    sendEmail({
      to: customerEmail,
      subject: `${input.companyName} booking request received`,
      html: renderBookingConfirmationEmail(input),
      text: renderBookingPlainText("Booking request received", input),
    }),
    sendEmail({
      to: getAdminRecipient(settings),
      subject: `New booking request - ${input.clientName}`,
      html: renderAdminBookingNotificationEmail({
        ...input,
        bookingId: booking.id,
        clientEmail: booking.clients?.email ?? null,
        clientPhone: booking.clients?.phone ?? null,
      }),
      text: renderBookingPlainText("New booking request", input),
    }),
  ]);
}

export async function sendBookingCancellationEmail(
  bookingId: string,
  supabase: SupabaseClient
) {
  const { booking, input } = await getBookingTemplateInput(bookingId, supabase);
  const customerEmail = booking.clients?.email;
  if (!customerEmail) {
    throw new Error("Booking client has no email address.");
  }

  await sendEmail({
    to: customerEmail,
    subject: `${input.companyName} booking cancelled`,
    html: renderBookingCancellationEmail(input),
    text: renderBookingPlainText("Booking cancelled", input),
  });
}

export async function sendBookingReminderEmail(
  bookingId: string,
  supabase: SupabaseClient
) {
  const { booking, input } = await getBookingTemplateInput(bookingId, supabase);
  const customerEmail = booking.clients?.email;
  if (!customerEmail) {
    throw new Error("Booking client has no email address.");
  }

  await sendEmail({
    to: customerEmail,
    subject: `${input.companyName} booking reminder`,
    html: renderBookingReminderEmail(input),
    text: renderBookingPlainText("Booking reminder", input),
  });
}
