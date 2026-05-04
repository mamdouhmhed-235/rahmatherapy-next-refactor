// SERVER ONLY - do not import from client components.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { toBusinessDateTime } from "@/lib/time/london";
import { getManageTokenHash } from "./manage-token";

type ParticipantGender = "male" | "female";
type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";

interface ManagedBookingParticipant {
  id: string;
  display_name: string | null;
  participant_gender: ParticipantGender;
  required_therapist_gender: ParticipantGender;
  is_main_contact: boolean;
  participant_notes: string | null;
  consent_acknowledged: boolean;
}

interface ManagedBookingItem {
  id: string;
  booking_participant_id: string | null;
  service_name_snapshot: string;
  service_price_snapshot: number | string;
  service_duration_snapshot: number;
}

interface ManagedBookingRecord {
  id: string;
  contact_full_name: string;
  contact_email: string;
  contact_phone: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  total_duration_mins: number | null;
  total_price: number | string | null;
  amount_due: number | string | null;
  amount_paid: number | string | null;
  booking_source: string;
  status: BookingStatus;
  payment_status: "paid" | "unpaid";
  group_booking: boolean;
  service_address_line1: string | null;
  service_address_line2: string | null;
  service_city: string | null;
  service_postcode: string | null;
  access_notes: string | null;
  customer_notes: string | null;
  customer_manage_notes: string | null;
  customer_cancelled_at: string | null;
  customer_cancellation_note: string | null;
  reschedule_requested_at: string | null;
  reschedule_preferred_date: string | null;
  reschedule_preferred_time: string | null;
  reschedule_note: string | null;
  reschedule_status: string;
  booking_participants: ManagedBookingParticipant[];
  booking_items: ManagedBookingItem[];
}

interface BusinessSettingsRecord {
  company_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  customer_cancellation_cutoff_hours: number;
}

export interface CustomerManageBooking {
  id: string;
  contactFullName: string;
  contactEmail: string;
  contactPhone: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  durationMins: number | null;
  totalPrice: number;
  amountDue: number;
  amountPaid: number;
  bookingSource: string;
  status: BookingStatus;
  paymentStatus: "paid" | "unpaid";
  groupBooking: boolean;
  addressLines: string[];
  customerNotes: string | null;
  customerManageNotes: string | null;
  customerCancelledAt: string | null;
  customerCancellationNote: string | null;
  rescheduleRequestedAt: string | null;
  reschedulePreferredDate: string | null;
  reschedulePreferredTime: string | null;
  rescheduleNote: string | null;
  rescheduleStatus: string;
  participants: Array<{
    id: string;
    label: string;
    participantGender: ParticipantGender;
    requiredTherapistGender: ParticipantGender;
    participantNotes: string | null;
    services: string[];
    consentAcknowledged: boolean;
  }>;
  cancellation: {
    allowed: boolean;
    reason: string | null;
    cutoffAt: string;
  };
  settings: {
    companyName: string;
    contactEmail: string | null;
    contactPhone: string | null;
  };
}

const MANAGED_BOOKING_SELECT = `
  id,
  contact_full_name,
  contact_email,
  contact_phone,
  booking_date,
  start_time,
  end_time,
  total_duration_mins,
  total_price,
  amount_due,
  amount_paid,
  booking_source,
  status,
  payment_status,
  group_booking,
  service_address_line1,
  service_address_line2,
  service_city,
  service_postcode,
  access_notes,
  customer_notes,
  customer_manage_notes,
  customer_cancelled_at,
  customer_cancellation_note,
  reschedule_requested_at,
  reschedule_preferred_date,
  reschedule_preferred_time,
  reschedule_note,
  reschedule_status,
  booking_participants(id, display_name, participant_gender, required_therapist_gender, is_main_contact, participant_notes, consent_acknowledged),
  booking_items(id, booking_participant_id, service_name_snapshot, service_price_snapshot, service_duration_snapshot)
`;

function toAmount(value: number | string | null) {
  return Number(value ?? 0);
}

function getCancellationWindow(
  booking: ManagedBookingRecord,
  cutoffHours: number
) {
  const bookingStart = toBusinessDateTime(booking.booking_date, booking.start_time);
  return new Date(bookingStart.getTime() - cutoffHours * 60 * 60 * 1000);
}

function getCancellationStatus(
  booking: ManagedBookingRecord,
  cutoffHours: number,
  now = new Date()
) {
  const cutoffAt = getCancellationWindow(booking, cutoffHours);

  if (!["pending", "confirmed"].includes(booking.status)) {
    return {
      allowed: false,
      reason: "This booking can no longer be cancelled from this link.",
      cutoffAt: cutoffAt.toISOString(),
    };
  }

  if (now > cutoffAt) {
    return {
      allowed: false,
      reason: "The cancellation cutoff has passed.",
      cutoffAt: cutoffAt.toISOString(),
    };
  }

  return {
    allowed: true,
    reason: null,
    cutoffAt: cutoffAt.toISOString(),
  };
}

function toCustomerManageBooking(
  booking: ManagedBookingRecord,
  settings: BusinessSettingsRecord
): CustomerManageBooking {
  return {
    id: booking.id,
    contactFullName: booking.contact_full_name,
    contactEmail: booking.contact_email,
    contactPhone: booking.contact_phone,
    bookingDate: booking.booking_date,
    startTime: booking.start_time,
    endTime: booking.end_time,
    durationMins: booking.total_duration_mins,
    totalPrice: toAmount(booking.total_price),
    amountDue: toAmount(booking.amount_due ?? booking.total_price),
    amountPaid: toAmount(booking.amount_paid),
    bookingSource: booking.booking_source,
    status: booking.status,
    paymentStatus: booking.payment_status,
    groupBooking: booking.group_booking,
    addressLines: [
      booking.service_address_line1,
      booking.service_address_line2,
      booking.service_city,
      booking.service_postcode,
      booking.access_notes ? `Access: ${booking.access_notes}` : null,
    ].filter((value): value is string => Boolean(value)),
    customerNotes: booking.customer_notes,
    customerManageNotes: booking.customer_manage_notes,
    customerCancelledAt: booking.customer_cancelled_at,
    customerCancellationNote: booking.customer_cancellation_note,
    rescheduleRequestedAt: booking.reschedule_requested_at,
    reschedulePreferredDate: booking.reschedule_preferred_date,
    reschedulePreferredTime: booking.reschedule_preferred_time,
    rescheduleNote: booking.reschedule_note,
    rescheduleStatus: booking.reschedule_status,
    participants: booking.booking_participants.map((participant, index) => ({
      id: participant.id,
      label:
        participant.display_name ??
        (participant.is_main_contact ? "Main contact" : `Participant ${index + 1}`),
      participantGender: participant.participant_gender,
      requiredTherapistGender: participant.required_therapist_gender,
      participantNotes: participant.participant_notes,
      services: booking.booking_items
        .filter((item) => item.booking_participant_id === participant.id)
        .map((item) => item.service_name_snapshot),
      consentAcknowledged: participant.consent_acknowledged,
    })),
    cancellation: getCancellationStatus(
      booking,
      settings.customer_cancellation_cutoff_hours
    ),
    settings: {
      companyName: settings.company_name ?? "Rahma Therapy",
      contactEmail: settings.contact_email,
      contactPhone: settings.contact_phone,
    },
  };
}

async function getBusinessSettings(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("business_settings")
    .select("company_name, contact_email, contact_phone, customer_cancellation_cutoff_hours")
    .eq("id", 1)
    .single<BusinessSettingsRecord>();

  if (error || !data) {
    throw new Error("Unable to load customer manage settings.");
  }

  return data;
}

export async function getCustomerManageBooking(
  token: string,
  supabase = createSupabaseAdminClient()
) {
  const normalizedToken = token.trim();
  if (!normalizedToken) return null;

  const tokenHash = getManageTokenHash(normalizedToken);
  const [{ data: booking, error }, settings] = await Promise.all([
    supabase
      .from("bookings")
      .select(MANAGED_BOOKING_SELECT)
      .eq("manage_token_hash", tokenHash)
      .gt("manage_token_expires_at", new Date().toISOString())
      .maybeSingle<ManagedBookingRecord>(),
    getBusinessSettings(supabase),
  ]);

  if (error) {
    throw new Error("Unable to validate booking manage token.");
  }

  if (!booking) return null;

  return toCustomerManageBooking(booking, settings);
}
