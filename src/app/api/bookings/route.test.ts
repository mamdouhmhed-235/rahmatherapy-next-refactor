import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureBookingManageUrl } from "@/lib/booking/manage-token";
import { sendBookingCreatedEmails } from "@/lib/email/notifications";
import { RATE_LIMITED_BOOKING_MESSAGE } from "@/lib/rate-limit";
import { POST } from "./route";

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(),
}));

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

function postBooking(
  body: Record<string, unknown>,
  headers: Record<string, string> = {}
) {
  return POST(
    new Request("http://localhost/api/bookings/", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
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

    // createBookingTransaction builds the RPC argument by enumerating p_-prefixed
    // keys, so the meaningful claim is not "company_website is absent" (no
    // client key of any name could appear) but that the argument really is that
    // closed allow-list — a spread of the client payload would break this.
    const rpcArgs = rpc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(Object.keys(rpcArgs).every((key) => key.startsWith("p_"))).toBe(true);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("ignores a honeypot key smuggled inside details", async () => {
    const response = await postBooking({
      ...validRequestBody,
      details: {
        ...validRequestBody.details,
        company_website: "https://spam.example.test",
      },
    });

    // Nested is not the top-level decoy the guard reads, so this is an ordinary
    // booking: the unknown key must not fail server validation, and its value
    // must not survive anywhere into what the RPC receives.
    expect(response.status).toBe(200);
    expect(console.warn).not.toHaveBeenCalled();
    expect(sendBookingCreatedEmails).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(rpc.mock.calls[0]?.[1])).not.toContain(
      "spam.example.test"
    );
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

describe("POST /api/bookings rate limiting", () => {
  const getCloudflareContextMock = getCloudflareContext as unknown as Mock;
  const stubFetch = vi.fn();

  function withLimiter(allowed: boolean) {
    stubFetch.mockResolvedValue(
      new Response(JSON.stringify({ allowed }), {
        headers: { "Content-Type": "application/json" },
      })
    );
    getCloudflareContextMock.mockImplementation(() => ({
      env: {
        RATE_LIMITER: {
          idFromName: vi.fn(),
          get: () => ({ fetch: stubFetch }),
        },
      },
    }));
  }

  beforeEach(() => {
    vi.clearAllMocks();
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

  it("returns 429 with the phone-inclusive message once the limit is exceeded", async () => {
    withLimiter(false);

    const response = await postBooking(validRequestBody, {
      "CF-Connecting-IP": "203.0.113.7",
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(429);
    expect(body.error).toBe(RATE_LIMITED_BOOKING_MESSAGE);
    expect(body.error).toContain("call us on");

    // The whole point: rejection happens before any real work.
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(sendBookingCreatedEmails).not.toHaveBeenCalled();
  });

  it("fails open when CF-Connecting-IP is absent", async () => {
    withLimiter(false);

    const response = await postBooking(validRequestBody);

    expect(response.status).toBe(200);
    expect(stubFetch).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(sendBookingCreatedEmails).toHaveBeenCalledTimes(1);
  });

  it("fails open when the durable object binding is unavailable", async () => {
    getCloudflareContextMock.mockImplementation(() => {
      throw new Error("no cloudflare context");
    });

    const response = await postBooking(validRequestBody, {
      "CF-Connecting-IP": "203.0.113.7",
    });

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(sendBookingCreatedEmails).toHaveBeenCalledTimes(1);
  });
});
