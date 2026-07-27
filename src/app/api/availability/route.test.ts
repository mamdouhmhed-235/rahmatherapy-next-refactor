import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  calculateAvailableDays,
  calculateAvailableSlots,
} from "@/lib/booking/availability";
import { RATE_LIMITED_AVAILABILITY_MESSAGE } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { POST } from "./route";
import { POST as MONTH_POST } from "./month/route";

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/booking/availability", () => ({
  calculateAvailableSlots: vi.fn(),
  calculateAvailableDays: vi.fn(),
}));

const getCloudflareContextMock = getCloudflareContext as unknown as Mock;
const stubFetch = vi.fn();

const dayRequestBody = {
  date: "2026-06-01",
  serviceIds: ["hijama-package"],
  participantGenders: ["female"],
  city: "Luton",
};

const monthRequestBody = {
  month: "2026-06",
  serviceIds: ["hijama-package"],
  participantGenders: ["female"],
  city: "Luton",
};

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

function post(
  handler: (request: Request) => Promise<Response>,
  path: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {}
) {
  return handler(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    })
  );
}

describe("availability endpoints rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      {} as unknown as ReturnType<typeof createSupabaseAdminClient>
    );
    vi.mocked(calculateAvailableSlots).mockResolvedValue(
      { slots: [] } as unknown as Awaited<
        ReturnType<typeof calculateAvailableSlots>
      >
    );
    vi.mocked(calculateAvailableDays).mockResolvedValue(
      { days: [] } as unknown as Awaited<
        ReturnType<typeof calculateAvailableDays>
      >
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 429 from /api/availability before reaching the service-role client", async () => {
    withLimiter(false);

    const response = await post(POST, "/api/availability/", dayRequestBody, {
      "CF-Connecting-IP": "203.0.113.7",
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(429);
    expect(body.error).toBe(RATE_LIMITED_AVAILABILITY_MESSAGE);
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(calculateAvailableSlots).not.toHaveBeenCalled();
  });

  it("returns 429 from /api/availability/month before reaching the service-role client", async () => {
    withLimiter(false);

    const response = await post(
      MONTH_POST,
      "/api/availability/month/",
      monthRequestBody,
      { "CF-Connecting-IP": "203.0.113.7" }
    );

    expect(response.status).toBe(429);
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(calculateAvailableDays).not.toHaveBeenCalled();
  });

  it("fails open on both endpoints without CF-Connecting-IP", async () => {
    withLimiter(false);

    const day = await post(POST, "/api/availability/", dayRequestBody);
    const month = await post(
      MONTH_POST,
      "/api/availability/month/",
      monthRequestBody
    );

    expect(day.status).toBe(200);
    expect(month.status).toBe(200);
    expect(stubFetch).not.toHaveBeenCalled();
    expect(calculateAvailableSlots).toHaveBeenCalledTimes(1);
    expect(calculateAvailableDays).toHaveBeenCalledTimes(1);
  });

  it("fails open when the durable object binding is unavailable", async () => {
    getCloudflareContextMock.mockImplementation(() => {
      throw new Error("no cloudflare context");
    });

    const response = await post(POST, "/api/availability/", dayRequestBody, {
      "CF-Connecting-IP": "203.0.113.7",
    });

    expect(response.status).toBe(200);
    expect(calculateAvailableSlots).toHaveBeenCalledTimes(1);
  });

  it("counts the two endpoints against separate scopes", async () => {
    withLimiter(true);
    const idFromName = vi.fn();
    getCloudflareContextMock.mockImplementation(() => ({
      env: {
        RATE_LIMITER: { idFromName, get: () => ({ fetch: stubFetch }) },
      },
    }));

    await post(POST, "/api/availability/", dayRequestBody, {
      "CF-Connecting-IP": "203.0.113.7",
    });
    await post(MONTH_POST, "/api/availability/month/", monthRequestBody, {
      "CF-Connecting-IP": "203.0.113.7",
    });

    expect(idFromName).toHaveBeenNthCalledWith(1, "availability:203.0.113.7");
    expect(idFromName).toHaveBeenNthCalledWith(
      2,
      "availability-month:203.0.113.7"
    );
  });
});
