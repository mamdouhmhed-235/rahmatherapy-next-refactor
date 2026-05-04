import type { SupabaseClient } from "@supabase/supabase-js";

type ParticipantGender = "male" | "female";
export type BookingSource =
  | "website"
  | "phone"
  | "whatsapp"
  | "instagram"
  | "referral"
  | "admin"
  | "manual"
  | "other";

export interface CreateBookingTransactionInput {
  selectedPackageIds: string[];
  details: {
    bookingFor: "self" | "someone_else" | "group";
    fullName: string;
    phone: string;
    email: string;
    notes: string;
    healthNotes: string;
    clientGender: ParticipantGender | "";
    numberOfPeople: number;
    participantGenders: Array<ParticipantGender | "">;
    participantNames: string[];
    participantNotes: string[];
    consentAcknowledged: boolean;
    paymentAcknowledged: boolean;
    manageAcknowledged: boolean;
    postcode: string;
    address: string;
    city: string;
    area: string;
    accessNotes: string;
    parkingNotes: string;
  };
  preferredDate: string;
  preferredTime: string;
  bookingSource?: BookingSource;
}

export class BookingCreationError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message);
  }
}

function getParticipantGenders(details: CreateBookingTransactionInput["details"]) {
  const genders =
    details.numberOfPeople > 1
      ? details.participantGenders.slice(0, details.numberOfPeople)
      : [details.clientGender];

  if (
    genders.length !== details.numberOfPeople ||
    !genders.every((gender): gender is ParticipantGender => gender === "male" || gender === "female")
  ) {
    throw new BookingCreationError("Select a gender for every participant.");
  }

  return genders;
}

function getParticipantNames(details: CreateBookingTransactionInput["details"]) {
  if (details.numberOfPeople === 1) {
    return [
      details.bookingFor === "someone_else" && details.participantNames[0]?.trim()
        ? details.participantNames[0].trim()
        : details.fullName,
    ];
  }

  return Array.from({ length: details.numberOfPeople }, (_, index) => {
    const name = details.participantNames[index]?.trim();
    if (!name) {
      throw new BookingCreationError("Enter a name or label for every participant.");
    }
    return name;
  });
}

function getParticipantNotes(details: CreateBookingTransactionInput["details"]) {
  return Array.from({ length: details.numberOfPeople }, (_, index) =>
    details.participantNotes[index]?.trim() ?? ""
  );
}

function getAccessNotes(details: CreateBookingTransactionInput["details"]) {
  return [
    details.area.trim() ? `Area: ${details.area.trim()}` : "",
    details.accessNotes.trim() ? `Access: ${details.accessNotes.trim()}` : "",
    details.parkingNotes.trim() ? `Parking: ${details.parkingNotes.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function createBookingTransaction(
  input: CreateBookingTransactionInput,
  supabase: SupabaseClient
) {
  const participantGenders = getParticipantGenders(input.details);
  const participantNames = getParticipantNames(input.details);
  const participantNotes = getParticipantNotes(input.details);

  const { data, error } = await supabase.rpc("create_booking_request", {
    p_service_slugs: input.selectedPackageIds,
    p_contact_full_name: input.details.fullName,
    p_contact_email: input.details.email,
    p_contact_phone: input.details.phone,
    p_customer_notes: input.details.notes,
    p_health_notes: input.details.healthNotes,
    p_consent_acknowledged: input.details.consentAcknowledged,
    p_service_address_line1: input.details.address,
    p_service_city: input.details.city,
    p_service_postcode: input.details.postcode,
    p_access_notes: getAccessNotes(input.details),
    p_booking_date: input.preferredDate,
    p_start_time: input.preferredTime,
    p_participant_genders: participantGenders,
    p_participant_display_names: participantNames,
    p_participant_notes: participantNotes,
    p_booking_source: input.bookingSource ?? "website",
  });

  if (error || !data || typeof data !== "object") {
    throw new BookingCreationError(
      error?.message ?? "Unable to create booking request.",
      error?.code === "42501" ? 403 : 400
    );
  }

  const result = data as {
    bookingId?: string;
    participantCount?: number;
    itemCount?: number;
    assignmentCount?: number;
  };

  if (!result.bookingId) {
    throw new BookingCreationError("Booking request returned no reference.", 500);
  }

  return {
    bookingId: result.bookingId,
    participantCount: result.participantCount ?? participantGenders.length,
    itemCount: result.itemCount ?? 0,
    assignmentCount: result.assignmentCount ?? participantGenders.length,
  };
}
