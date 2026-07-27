import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  AVAILABILITY_RATE_LIMIT_BURST,
  AVAILABILITY_RATE_LIMIT_SUSTAINED,
  BOOKING_RATE_LIMIT,
  RATE_LIMITED_BOOKING_MESSAGE,
  RATE_LIMIT_BURST,
  RATE_LIMIT_SUSTAINED,
  checkRateLimit,
} from "./rate-limit";
import { RateLimiter } from "./rate-limit-durable-object";

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(),
}));

const getCloudflareContextMock = getCloudflareContext as unknown as Mock;

function fakeStorage() {
  const values = new Map<string, unknown>();
  const alarms: number[] = [];

  return {
    values,
    alarms,
    async get<T>(key: string) {
      return values.get(key) as T | undefined;
    },
    async put<T>(key: string, value: T) {
      values.set(key, value);
    },
    async deleteAll() {
      values.clear();
    },
    async setAlarm(scheduledTime: number) {
      alarms.push(scheduledTime);
    },
  };
}

describe("RateLimiter durable object", () => {
  it("allows requests up to the limit and denies the next one", async () => {
    const storage = fakeStorage();
    const limiter = new RateLimiter({ storage });
    const now = Date.UTC(2026, 5, 1, 10, 0, 0);

    const verdicts = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      verdicts.push(await limiter.consume([RATE_LIMIT_BURST], now + attempt));
    }

    expect(verdicts).toEqual([true, true, true, false]);
  });

  it("starts a fresh window once the previous one has elapsed", async () => {
    const storage = fakeStorage();
    const limiter = new RateLimiter({ storage });
    const now = Date.UTC(2026, 5, 1, 10, 0, 0);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await limiter.consume([RATE_LIMIT_BURST], now + attempt);
    }

    const windowMs = RATE_LIMIT_BURST.windowSeconds * 1000;
    expect(await limiter.consume([RATE_LIMIT_BURST], now + windowMs)).toBe(true);
  });

  it("keeps denying once the longer window is exhausted", async () => {
    const storage = fakeStorage();
    const limiter = new RateLimiter({ storage });
    const burstMs = RATE_LIMIT_BURST.windowSeconds * 1000;
    let now = Date.UTC(2026, 5, 1, 10, 0, 0);

    // Four full burst windows: 12 attempts, so the 10-per-day window runs out
    // even though every burst window is freshly reset.
    const verdicts = [];
    for (let round = 0; round < 4; round += 1) {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        verdicts.push(await limiter.consume(BOOKING_RATE_LIMIT, now + attempt));
      }
      now += burstMs;
    }

    expect(verdicts.slice(0, 10).every(Boolean)).toBe(true);
    expect(verdicts.slice(10)).toEqual([false, false]);
  });

  it("bounds its own state: the alarm slides forward and wipes storage", async () => {
    const storage = fakeStorage();
    const limiter = new RateLimiter({ storage });
    const now = Date.UTC(2026, 5, 1, 10, 0, 0);

    await limiter.consume(BOOKING_RATE_LIMIT, now);

    expect(storage.values.size).toBe(2);
    expect(storage.alarms).toEqual([
      now + RATE_LIMIT_SUSTAINED.windowSeconds * 1000,
    ]);

    await limiter.alarm();
    expect(storage.values.size).toBe(0);
  });
});

describe("checkRateLimit", () => {
  const stubFetch = vi.fn();
  const idFromName = vi.fn();
  const namespace = {
    idFromName,
    get: () => ({ fetch: stubFetch }),
  };

  function limitedRequest(headers: Record<string, string> = {}) {
    return new Request("http://localhost/api/bookings/", {
      method: "POST",
      headers,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    getCloudflareContextMock.mockImplementation(() => ({
      env: { RATE_LIMITER: namespace },
    }));
    stubFetch.mockResolvedValue(
      new Response(JSON.stringify({ allowed: true }), {
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows the request and never consults the limiter without CF-Connecting-IP", async () => {
    await expect(
      checkRateLimit(limitedRequest(), "bookings", BOOKING_RATE_LIMIT)
    ).resolves.toBe(true);

    expect(idFromName).not.toHaveBeenCalled();
    expect(stubFetch).not.toHaveBeenCalled();
  });

  it("allows the request when the durable object binding is unavailable", async () => {
    getCloudflareContextMock.mockImplementation(() => {
      throw new Error("no cloudflare context");
    });

    await expect(
      checkRateLimit(
        limitedRequest({ "CF-Connecting-IP": "203.0.113.7" }),
        "bookings",
        BOOKING_RATE_LIMIT
      )
    ).resolves.toBe(true);
  });

  it("allows the request when the limiter itself throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubFetch.mockRejectedValue(new Error("durable object unreachable"));

    await expect(
      checkRateLimit(
        limitedRequest({ "CF-Connecting-IP": "203.0.113.7" }),
        "bookings",
        BOOKING_RATE_LIMIT
      )
    ).resolves.toBe(true);
  });

  it("denies the request when the limiter says the window is exhausted", async () => {
    stubFetch.mockResolvedValue(
      new Response(JSON.stringify({ allowed: false }), {
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(
      checkRateLimit(
        limitedRequest({ "CF-Connecting-IP": "203.0.113.7" }),
        "bookings",
        BOOKING_RATE_LIMIT
      )
    ).resolves.toBe(false);
  });

  it("keys the counter by scope and client IP", async () => {
    await checkRateLimit(
      limitedRequest({ "CF-Connecting-IP": "203.0.113.7" }),
      "availability-month",
      BOOKING_RATE_LIMIT
    );

    expect(idFromName).toHaveBeenCalledWith("availability-month:203.0.113.7");
  });
});

describe("rate limit constants", () => {
  it("offers the clinic phone number in the 429 copy", () => {
    expect(RATE_LIMITED_BOOKING_MESSAGE).toContain("07798897222");
  });

  it("keeps the availability limits well above the booking limits", () => {
    expect(AVAILABILITY_RATE_LIMIT_BURST.limit).toBeGreaterThan(
      RATE_LIMIT_BURST.limit
    );
    expect(AVAILABILITY_RATE_LIMIT_SUSTAINED.limit).toBeGreaterThan(
      RATE_LIMIT_SUSTAINED.limit
    );
  });
});
