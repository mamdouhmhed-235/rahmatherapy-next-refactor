import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BookingCreationError,
  createBookingTransaction,
  type CreateBookingTransactionInput,
} from "./createBookingTransaction";

const baseInput: CreateBookingTransactionInput = {
  selectedPackageIds: ["hijama-package"],
  details: {
    bookingFor: "self",
    fullName: "Aisha Khan",
    phone: "07123 456 789",
    email: "aisha@example.test",
    notes: "Please call before arrival.",
    healthNotes: "Sensitive note",
    clientGender: "female",
    numberOfPeople: 1,
    participantGenders: ["female"],
    participantNames: [""],
    participantNotes: [""],
    consentAcknowledged: true,
    paymentAcknowledged: true,
    manageAcknowledged: true,
    postcode: "LU1 1AA",
    address: "10 Test Street",
    city: "Luton",
    area: "Bedfordshire",
    accessNotes: "Side entrance",
    parkingNotes: "Driveway available",
  },
  preferredDate: "2026-06-01",
  preferredTime: "10:00",
};

function supabaseWithRpc(
  response: Awaited<ReturnType<SupabaseClient["rpc"]>>
): SupabaseClient {
  return {
    rpc: vi.fn().mockResolvedValue(response),
  } as unknown as SupabaseClient;
}

describe("createBookingTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes a single public booking into the RPC payload", async () => {
    const supabase = supabaseWithRpc({
      data: {
        bookingId: "booking-a",
        participantCount: 1,
        itemCount: 1,
        assignmentCount: 1,
      },
      error: null,
    });

    await expect(createBookingTransaction(baseInput, supabase)).resolves.toEqual({
      bookingId: "booking-a",
      participantCount: 1,
      itemCount: 1,
      assignmentCount: 1,
    });

    expect(supabase.rpc).toHaveBeenCalledWith("create_booking_request", {
      p_service_slugs: ["hijama-package"],
      p_contact_full_name: "Aisha Khan",
      p_contact_email: "aisha@example.test",
      p_contact_phone: "07123 456 789",
      p_customer_notes: "Please call before arrival.",
      p_health_notes: "Sensitive note",
      p_consent_acknowledged: true,
      p_service_address_line1: "10 Test Street",
      p_service_city: "Luton",
      p_service_postcode: "LU1 1AA",
      p_access_notes:
        "Area: Bedfordshire\nAccess: Side entrance\nParking: Driveway available",
      p_booking_date: "2026-06-01",
      p_start_time: "10:00",
      p_participant_genders: ["female"],
      p_participant_display_names: ["Aisha Khan"],
      p_participant_notes: [""],
      p_booking_source: "website",
    });
  });

  it("sends participant-level group labels, notes, genders, and admin source", async () => {
    const supabase = supabaseWithRpc({
      data: { bookingId: "booking-group" },
      error: null,
    });

    await createBookingTransaction(
      {
        ...baseInput,
        bookingSource: "phone",
        details: {
          ...baseInput.details,
          bookingFor: "group",
          numberOfPeople: 2,
          participantGenders: ["female", "male"],
          participantNames: ["Aisha", "Omar"],
          participantNotes: ["Prefers female therapist", "Shoulder issue"],
        },
      },
      supabase
    );

    expect(supabase.rpc).toHaveBeenCalledWith(
      "create_booking_request",
      expect.objectContaining({
        p_participant_genders: ["female", "male"],
        p_participant_display_names: ["Aisha", "Omar"],
        p_participant_notes: ["Prefers female therapist", "Shoulder issue"],
        p_booking_source: "phone",
      })
    );
  });

  it("fails before the RPC when participant gender or label data is incomplete", async () => {
    const supabase = supabaseWithRpc({ data: null, error: null });

    await expect(
      createBookingTransaction(
        {
          ...baseInput,
          details: {
            ...baseInput.details,
            bookingFor: "group",
            numberOfPeople: 2,
            participantGenders: ["female", ""],
            participantNames: ["Aisha", "Omar"],
          },
        },
        supabase
      )
    ).rejects.toThrow("Select a gender for every participant.");

    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("maps database permission errors to forbidden booking creation errors", async () => {
    const supabase = supabaseWithRpc({
      data: null,
      error: { message: "permission denied", code: "42501" },
    } as Awaited<ReturnType<SupabaseClient["rpc"]>>);

    await expect(createBookingTransaction(baseInput, supabase)).rejects.toMatchObject({
      message: "permission denied",
      status: 403,
    } satisfies Partial<BookingCreationError>);
  });

  it("requires the RPC to return a booking reference", async () => {
    const supabase = supabaseWithRpc({ data: {}, error: null });

    await expect(createBookingTransaction(baseInput, supabase)).rejects.toMatchObject({
      message: "Booking request returned no reference.",
      status: 500,
    } satisfies Partial<BookingCreationError>);
  });
});
