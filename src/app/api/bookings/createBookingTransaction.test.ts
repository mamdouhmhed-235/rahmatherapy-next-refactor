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

// Test-only helper: the runtime Supabase client returns rich response
// metadata (status, count, statusText, …) that the production code path
// never reads. The mock keeps only the shape that the production code
// destructures (`data`, `error`), so it accepts a loose object literal.
/**
 * ⛔ D-033 — createBookingTransaction now verifies, before calling the RPC,
 * that every requested service is active AND visible (assertServicesBookable).
 * The stub must therefore model a `services` read as well as the RPC, or every
 * booking here is refused before it reaches the assertion under test.
 *
 * Returns all requested slugs as bookable, which is the ordinary state — all
 * five real services are active and visible. The REFUSAL path has its own
 * dedicated coverage in src/lib/booking/__tests__/bookable-services.test.ts.
 */
function bookableServicesStub() {
  const chain: Record<string, unknown> = {};
  let requested: string[] = [];
  Object.assign(chain, {
    select: () => chain,
    in: (_col: string, values: string[]) => {
      requested = values;
      return chain;
    },
    eq: () => chain,
    returns: () => chain,
    then: (resolve: (value: unknown) => unknown) =>
      resolve({ data: requested.map((slug) => ({ slug })), error: null }),
  });
  return chain;
}

function supabaseWithRpc(
  response: { data: unknown; error: unknown }
): SupabaseClient {
  return {
    rpc: vi.fn().mockResolvedValue(response),
    from: () => bookableServicesStub(),
  } as unknown as SupabaseClient;
}

describe("createBookingTransaction — D-033 service visibility", () => {
  // ⛔ THE WIRING, not the helper. bookable-services.test.ts proves
  // assertServicesBookable refuses correctly; this proves createBookingTransaction
  // ACTUALLY CALLS IT. Deleting the call site would leave that file green while
  // every hidden service became bookable again — a guard tested in isolation and
  // connected to nothing.
  it("⛔ refuses a hidden service, and NEVER reaches the booking RPC", async () => {
    const rpc = vi.fn();
    const supabase = {
      rpc,
      // An empty result is what a hidden service looks like: it fails the
      // is_visible_on_frontend filter, so the row simply does not come back.
      from: () => ({
        select: function () { return this; },
        in: function () { return this; },
        eq: function () { return this; },
        returns: function () { return this; },
        then: (resolve: (value: unknown) => unknown) =>
          resolve({ data: [], error: null }),
      }),
    } as unknown as SupabaseClient;

    await expect(
      createBookingTransaction(baseInput, supabase)
    ).rejects.toThrow(/not available to book/i);

    // ⛔ The half that matters: the refusal happens BEFORE the RPC that would
    // charge the customer and write no line item (PR-011).
    expect(rpc, "no booking may be attempted for a hidden service").not.toHaveBeenCalled();
  });
});

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
      p_override_availability: false,
      p_participant_service_slugs: null,
      p_area: "Bedfordshire",
      p_client_id: null,
      p_confirm_duplicate: false,
      p_raise_on_duplicate: false,
    });
  });

  it("passes an empty contact email straight through when the admin omits it", async () => {
    const supabase = supabaseWithRpc({
      data: { bookingId: "booking-no-email" },
      error: null,
    });

    await createBookingTransaction(
      {
        ...baseInput,
        bookingSource: "phone",
        details: { ...baseInput.details, email: "" },
      },
      supabase
    );

    // "" is sent rather than the key being dropped: the RPC normalises it to
    // NULL, and keeping the argument-key set identical for both callers is
    // what PostgREST resolves the overload on.
    expect(supabase.rpc).toHaveBeenCalledWith(
      "create_booking_request",
      expect.objectContaining({ p_contact_email: "" })
    );
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
