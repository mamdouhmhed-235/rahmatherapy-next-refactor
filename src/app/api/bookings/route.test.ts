import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureBookingManageUrl } from "@/lib/booking/manage-token";
import { sendBookingCreatedEmails } from "@/lib/email/notifications";
import { POST } from "./route";

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/booking/manage-token", () => ({
  ensureBookingManageUrl: vi.fn(),
}));

vi.mock("@/lib/email/notifications", () => ({
  sendBookingCreatedEmails: vi.fn(),
}));

vi.mock("@/lib/ops/operational-events", () => ({
  recordOperationalEvent: vi.fn(),
}));

const rpc = vi.fn();

const validRequestBody = {
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
  company_website: "",
};

function postBooking(body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/bookings/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

describe("POST /api/bookings honeypot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    rpc.mockResolvedValue({
      data: {
        bookingId: "booking-a",
        participantCount: 1,
        itemCount: 1,
        assignmentCount: 1,
      },
      error: null,
    });
    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      rpc,
    } as unknown as ReturnType<typeof createSupabaseAdminClient>);
    vi.mocked(ensureBookingManageUrl).mockResolvedValue(
      "https://booking.example.test/booking/manage?token=abc"
    );
    vi.mocked(sendBookingCreatedEmails).mockResolvedValue(
      {} as Awaited<ReturnType<typeof sendBookingCreatedEmails>>
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("silently drops a submission with the honeypot filled", async () => {
    const response = await postBooking({
      ...validRequestBody,
      company_website: "https://spam.example.test",
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.status).toBe("submitted");
    expect(typeof body.bookingId).toBe("string");

    // No booking row, no email — and no admin client is even constructed.
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(sendBookingCreatedEmails).not.toHaveBeenCalled();

    expect(console.warn).toHaveBeenCalledWith(
      "[C-22] honeypot tripped",
      expect.objectContaining({ at: expect.any(String) })
    );
  });

  it("creates the booking normally when the honeypot is empty", async () => {
    const response = await postBooking(validRequestBody);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.bookingId).toBe("booking-a");
    expect(rpc).toHaveBeenCalledWith(
      "create_booking_request",
      expect.objectContaining({ p_contact_email: "aisha@example.test" })
    );
    expect(sendBookingCreatedEmails).toHaveBeenCalledTimes(1);

    // The honeypot key is stripped by the server schema, so it can never
    // reach the RPC payload.
    expect(rpc.mock.calls[0]?.[1]).not.toHaveProperty("company_website");
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("returns the same response shape whether or not the honeypot trips", async () => {
    const dropped = await (
      await postBooking({ ...validRequestBody, company_website: "bot" })
    ).json();
    const real = await (await postBooking(validRequestBody)).json();

    expect(Object.keys(dropped as object).sort()).toEqual(
      Object.keys(real as object).sort()
    );
  });
});
