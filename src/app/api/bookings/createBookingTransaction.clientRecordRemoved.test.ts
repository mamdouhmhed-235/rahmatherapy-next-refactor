import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { contactLinks } from "@/content/site/contact";
import {
  BookingCreationError,
  DuplicateClientError,
  createBookingTransaction,
  type CreateBookingTransactionInput,
} from "./createBookingTransaction";

/**
 * Covers only the `client_record_removed` mapping added in C-06 Phase E. The
 * RPC raises it when the submitted email belongs to a soft-deleted client — a
 * state C-06's own delete primitive creates. Unmapped, `route.ts` would echo the
 * raw code (or, before the RPC guard, a raw 23502) straight to a customer.
 */
const baseInput: CreateBookingTransactionInput = {
  selectedPackageIds: ["hijama-package"],
  details: {
    bookingFor: "self",
    fullName: "Aisha Khan",
    phone: "07123 456 789",
    email: "aisha@example.test",
    notes: "",
    healthNotes: "",
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
    accessNotes: "",
    parkingNotes: "",
  },
  preferredDate: "2026-06-01",
  preferredTime: "10:00",
};

function supabaseWithRpcError(error: unknown): SupabaseClient {
  return {
    rpc: async () => ({ data: null, error }),
  } as unknown as SupabaseClient;
}

describe("createBookingTransaction — client_record_removed", () => {
  it("maps the RPC exception to a customer-safe message offering the clinic phone", async () => {
    const supabase = supabaseWithRpcError({
      code: "P0001",
      message: "client_record_removed",
      hint: "This email belongs to a removed client record. Link the client explicitly or use a different address.",
    });

    const error = await createBookingTransaction(baseInput, supabase).catch(
      (thrown: unknown) => thrown
    );

    expect(error).toBeInstanceOf(BookingCreationError);
    expect(error).not.toBeInstanceOf(DuplicateClientError);
    const bookingError = error as BookingCreationError;
    expect(bookingError.status).toBe(409);
    expect(bookingError.message).toContain(contactLinks.phone.value);
    // Never leak that the address was ever on file, or the RPC's HINT wording.
    expect(bookingError.message).not.toContain("client_record_removed");
    expect(bookingError.message).not.toContain("removed client record");
    expect(bookingError.message).not.toContain(baseInput.details.email);
  });

  it("still classifies a duplicate as DuplicateClientError, not a removal", async () => {
    const supabase = supabaseWithRpcError({
      code: "P0001",
      message: "duplicate_client_exists: client-1",
      hint: "Sara Mohamed",
    });

    const error = await createBookingTransaction(baseInput, supabase).catch(
      (thrown: unknown) => thrown
    );

    expect(error).toBeInstanceOf(DuplicateClientError);
  });

  it("leaves ordinary P0001 validation failures on the generic path", async () => {
    const supabase = supabaseWithRpcError({
      code: "P0001",
      message: "Contact full name is required",
      hint: null,
    });

    const error = await createBookingTransaction(baseInput, supabase).catch(
      (thrown: unknown) => thrown
    );

    expect(error).toBeInstanceOf(BookingCreationError);
    const bookingError = error as BookingCreationError;
    expect(bookingError.status).toBe(400);
    expect(bookingError.message).toBe("Contact full name is required");
  });
});
