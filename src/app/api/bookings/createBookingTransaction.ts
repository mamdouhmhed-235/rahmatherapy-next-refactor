import type { SupabaseClient } from "@supabase/supabase-js";

type ParticipantGender = "male" | "female";
export type BookingSource =
  | "website"
  | "phone"
  | "whatsapp"
  | "facebook"
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
  overrideAvailability?: boolean;
  participantServiceSlugs?: string[][];
  clientId?: string | null;
  confirmDuplicate?: boolean;
  /**
   * Opt in to the RPC's `duplicate_client_exists` exception. Only the admin
   * flow wants it — the public flow leaves it off so a returning customer is
   * silently linked to their existing client row instead of getting a 409.
   * This never controls whether the row is overwritten: the RPC's
   * `on conflict (email) do nothing` means existing client fields are never
   * modified either way.
   */
  raiseOnDuplicate?: boolean;
}

export class BookingCreationError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message);
  }
}

/**
 * Raised when `create_booking_request` refuses to reuse an existing client row
 * because the caller didn't explicitly acknowledge the match. The generic
 * message stays PII-free for the public route; the matched client's details
 * ride along for the admin flow's duplicate-warning banner.
 */
export class DuplicateClientError extends BookingCreationError {
  constructor(
    public readonly matchedClientId: string | null,
    public readonly matchedClientName: string | null
  ) {
    super("A client with these contact details already exists.", 409);
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
    p_override_availability: input.overrideAvailability ?? false,
    p_participant_service_slugs: input.participantServiceSlugs?.map((services) =>
      services.join(",")
    ) ?? null,
    p_area: input.details.area || null,
    p_client_id: input.clientId ?? null,
    p_confirm_duplicate: input.confirmDuplicate ?? false,
    p_raise_on_duplicate: input.raiseOnDuplicate ?? false,
  });

  // The RPC raises `duplicate_client_exists: <client id>` with the matching
  // client's name in HINT. Every other RAISE in that function is a bare
  // P0001 too, so the message prefix — not the SQLSTATE — is the discriminator.
  if (error && error.code === "P0001" && error.message.startsWith("duplicate_client_exists")) {
    throw new DuplicateClientError(
      error.message.split(":")[1]?.trim() || null,
      error.hint ? error.hint.trim() : null
    );
  }

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
