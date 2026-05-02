import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateAvailableSlots } from "@/lib/booking/availability";

type ParticipantGender = "male" | "female";

interface CreateBookingTransactionInput {
  selectedPackageIds: string[];
  details: {
    fullName: string;
    phone: string;
    email: string;
    notes: string;
    clientGender: ParticipantGender | "";
    numberOfPeople: number;
    participantGenders: Array<ParticipantGender | "">;
    postcode: string;
    address: string;
    city: string;
    area: string;
  };
  preferredDate: string;
  preferredTime: string;
}

interface ServiceRecord {
  id: string;
  slug: string;
  name: string;
  price: number | string;
  duration_mins: number;
}

interface IdRecord {
  id: string;
}

interface InsertedParticipantRecord {
  id: string;
  required_therapist_gender: ParticipantGender;
}

export class BookingCreationError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message);
  }
}

function addMinutesToTime(time: string, minutesToAdd: number) {
  const [hours, minutes] = time.split(":").map(Number);
  const totalMinutes = hours * 60 + minutes + minutesToAdd;
  const endHours = Math.floor(totalMinutes / 60);
  const endMinutes = totalMinutes % 60;

  return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;
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

async function createOrFindClient(
  input: CreateBookingTransactionInput,
  supabase: SupabaseClient
) {
  const email = input.details.email.trim().toLowerCase();
  const existingClient = await supabase
    .from("clients")
    .select("id")
    .eq("email", email)
    .maybeSingle<IdRecord>();

  if (existingClient.error) {
    throw new BookingCreationError("Unable to check existing client.", 500);
  }

  if (existingClient.data) {
    return existingClient.data.id;
  }

  const createdClient = await supabase
    .from("clients")
    .insert({
      full_name: input.details.fullName.trim(),
      phone: input.details.phone.trim(),
      email,
      address: input.details.address.trim(),
      postcode: input.details.postcode.trim(),
      notes: input.details.notes.trim() || null,
    })
    .select("id")
    .single<IdRecord>();

  if (createdClient.error?.code === "23505") {
    const racedClient = await supabase
      .from("clients")
      .select("id")
      .eq("email", email)
      .single<IdRecord>();

    if (!racedClient.error && racedClient.data) {
      return racedClient.data.id;
    }
  }

  if (createdClient.error || !createdClient.data) {
    throw new BookingCreationError("Unable to create client record.", 500);
  }

  return createdClient.data.id;
}

async function getSelectedServices(
  serviceIds: string[],
  supabase: SupabaseClient
) {
  const servicesResult = await supabase
    .from("services")
    .select("id, slug, name, price, duration_mins")
    .in("slug", serviceIds)
    .eq("is_active", true)
    .eq("is_visible_on_frontend", true)
    .returns<ServiceRecord[]>();

  const servicesBySlug = new Map(
    (servicesResult.data ?? []).map((service) => [service.slug, service])
  );
  const selectedServices = serviceIds.flatMap((serviceId) => {
    const service = servicesBySlug.get(serviceId);
    return service ? [service] : [];
  });

  if (servicesResult.error || selectedServices.length !== serviceIds.length) {
    throw new BookingCreationError("Selected service is unavailable.");
  }

  return selectedServices;
}

export async function createBookingTransaction(
  input: CreateBookingTransactionInput,
  supabase: SupabaseClient
) {
  const participantGenders = getParticipantGenders(input.details);
  const availability = await calculateAvailableSlots(
    {
      date: input.preferredDate,
      serviceIds: input.selectedPackageIds,
      participantGenders,
      city: input.details.city,
    },
    supabase
  );

  const requestedSlotAvailable = availability.slots.some(
    (slot) => slot.time === input.preferredTime
  );

  if (!requestedSlotAvailable) {
    throw new BookingCreationError(
      availability.reason ?? "Selected appointment time is no longer available."
    );
  }

  const services = await getSelectedServices(input.selectedPackageIds, supabase);
  const clientId = await createOrFindClient(input, supabase);
  const totalPrice = services.reduce(
    (total, service) => total + Number(service.price) * participantGenders.length,
    0
  );
  const endTime = addMinutesToTime(input.preferredTime, availability.durationMins);

  const bookingResult = await supabase
    .from("bookings")
    .insert({
      client_id: clientId,
      booking_date: input.preferredDate,
      start_time: input.preferredTime,
      end_time: endTime,
      total_duration_mins: availability.durationMins,
      total_price: totalPrice,
      status: "pending",
      assignment_status: "unassigned",
      group_booking: participantGenders.length > 1,
      service_address_line1: input.details.address.trim(),
      service_city: input.details.city.trim(),
      service_postcode: input.details.postcode.trim(),
      access_notes: input.details.area.trim(),
      customer_notes: input.details.notes.trim() || null,
    })
    .select("id")
    .single<IdRecord>();

  if (bookingResult.error || !bookingResult.data) {
    throw new BookingCreationError("Unable to create booking record.", 500);
  }

  const bookingId = bookingResult.data.id;
  const participantsResult = await supabase
    .from("booking_participants")
    .insert(
      participantGenders.map((gender, index) => ({
        booking_id: bookingId,
        participant_gender: gender,
        required_therapist_gender: gender,
        is_main_contact: index === 0,
      }))
    )
    .select("id, required_therapist_gender")
    .returns<InsertedParticipantRecord[]>();

  const participants = participantsResult.data ?? [];
  if (participantsResult.error || participants.length !== participantGenders.length) {
    throw new BookingCreationError("Unable to create booking participants.", 500);
  }

  const bookingItemsResult = await supabase.from("booking_items").insert(
    participants.flatMap((participant) =>
      services.map((service) => ({
        booking_id: bookingId,
        booking_participant_id: participant.id,
        service_id: service.id,
        service_name_snapshot: service.name,
        service_price_snapshot: Number(service.price),
        service_duration_snapshot: service.duration_mins,
      }))
    )
  );

  if (bookingItemsResult.error) {
    throw new BookingCreationError("Unable to create booking item snapshots.", 500);
  }

  const assignmentsResult = await supabase.from("booking_assignments").insert(
    participants.map((participant) => ({
      booking_id: bookingId,
      participant_id: participant.id,
      assigned_staff_id: null,
      required_therapist_gender: participant.required_therapist_gender,
      status: "unassigned",
    }))
  );

  if (assignmentsResult.error) {
    throw new BookingCreationError("Unable to create booking assignments.", 500);
  }

  return {
    bookingId,
    participantCount: participants.length,
    itemCount: participants.length * services.length,
    assignmentCount: participants.length,
  };
}
