import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  AVAILABILITY_RATE_LIMIT_BURST,
  AVAILABILITY_RATE_LIMIT_SUSTAINED,
  BOOKING_RATE_LIMIT,
  RATE_LIMITED_BOOKING_MESSAGE,
  RATE_LIMITER_TIMEOUT_MS,
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
  it("allows five attempts in the burst window and denies the sixth", async () => {
    const storage = fakeStorage();
    const limiter = new RateLimiter({ storage });
    const now = Date.UTC(2026, 5, 1, 10, 0, 0);

    const verdicts = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      verdicts.push(await limiter.consume([RATE_LIMIT_BURST], now + attempt));
    }

    expect(verdicts).toEqual([true, true, true, true, true, false]);
  });

  it("starts a fresh window once the previous one has elapsed", async () => {
    const storage = fakeStorage();
    const limiter = new RateLimiter({ storage });
    const now = Date.UTC(2026, 5, 1, 10, 0, 0);

    for (let attempt = 0; attempt <= RATE_LIMIT_BURST.limit; attempt += 1) {
      await limiter.consume([RATE_LIMIT_BURST], now + attempt);
    }

    const windowMs = RATE_LIMIT_BURST.windowSeconds * 1000;
    expect(await limiter.consume([RATE_LIMIT_BURST], now + windowMs)).toBe(true);
  });

  it("holds the window open until the last millisecond before it elapses", async () => {
    const storage = fakeStorage();
    const limiter = new RateLimiter({ storage });
    const now = Date.UTC(2026, 5, 1, 10, 0, 0);

    for (let attempt = 0; attempt <= RATE_LIMIT_BURST.limit; attempt += 1) {
      await limiter.consume([RATE_LIMIT_BURST], now + attempt);
    }

    // The exclusive side of the boundary the test above covers inclusively:
    // one millisecond early the window is still the same window, so the
    // over-limit attempt is still denied.
    const windowMs = RATE_LIMIT_BURST.windowSeconds * 1000;
    expect(await limiter.consume([RATE_LIMIT_BURST], now + windowMs - 1)).toBe(
      false
    );
  });

  it("keeps denying once the longer window is exhausted", async () => {
    const storage = fakeStorage();
    const limiter = new RateLimiter({ storage });
    const burstMs = RATE_LIMIT_BURST.windowSeconds * 1000;
    let now = Date.UTC(2026, 5, 1, 10, 0, 0);

    // A bot pacing itself inside the burst limit: three full burst windows of
    // five, so nothing is ever denied by the burst window, and the 10-per-day
    // window is the only thing that can stop it. It does, on attempt 11.
    const verdicts = [];
    for (let round = 0; round < 3; round += 1) {
      for (let attempt = 0; attempt < RATE_LIMIT_BURST.limit; attempt += 1) {
        verdicts.push(await limiter.consume(BOOKING_RATE_LIMIT, now + attempt));
      }
      now += burstMs;
    }

    expect(verdicts.slice(0, 10).every(Boolean)).toBe(true);
    expect(verdicts.slice(10)).toEqual([false, false, false, false, false]);
  });

  it("spares the daily budget when the burst window is the one denying", async () => {
    const storage = fakeStorage();
    const limiter = new RateLimiter({ storage });
    const burstMs = RATE_LIMIT_BURST.windowSeconds * 1000;
    const start = Date.UTC(2026, 5, 1, 10, 0, 0);

    // Eleven attempts inside one minute: five allowed, six denied by the burst
    // window. If a denied request still counted against the 24-hour window,
    // those eleven would exhaust the whole daily allowance of ten — one flood
    // would lock every customer behind that NAT out of booking for the day.
    const flood: boolean[] = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      flood.push(
        await limiter.consume(BOOKING_RATE_LIMIT, start + attempt * 5_000)
      );
    }

    expect(flood).toEqual([
      true,
      true,
      true,
      true,
      true,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);

    // Exactly five of the ten daily requests were spent, so five remain. Paced
    // four per fresh burst window, the burst limit can never be what denies —
    // so every verdict below is the sustained window, and the position of the
    // first `false` IS the remaining daily allowance.
    const paced: boolean[] = [];
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const windowIndex = Math.floor(attempt / 4) + 1;
      paced.push(
        await limiter.consume(
          BOOKING_RATE_LIMIT,
          start + windowIndex * burstMs + (attempt % 4) * 1_000
        )
      );
    }

    expect(paced).toEqual([true, true, true, true, true, false, false, false]);
  });

  it("never extends the window while it is blocking", async () => {
    const storage = fakeStorage();
    const limiter = new RateLimiter({ storage });
    const windowMs = RATE_LIMIT_BURST.windowSeconds * 1000;
    const start = Date.UTC(2026, 5, 1, 10, 0, 0);

    for (let attempt = 0; attempt <= RATE_LIMIT_BURST.limit; attempt += 1) {
      await limiter.consume([RATE_LIMIT_BURST], start + attempt);
    }

    // Hammer the blocked window right up to its final millisecond...
    expect(
      await limiter.consume([RATE_LIMIT_BURST], start + windowMs - 1)
    ).toBe(false);

    // ...and it still opens on time. The window is anchored at its FIRST
    // request and denied requests must never move that anchor, or a bot could
    // hold the lockout open indefinitely and the customer sharing that address
    // would never be released.
    expect(await limiter.consume([RATE_LIMIT_BURST], start + windowMs)).toBe(
      true
    );
  });

  it("bounds its own state: the alarm slides forward and wipes storage", async () => {
    const storage = fakeStorage();
    const limiter = new RateLimiter({ storage });
    const now = Date.UTC(2026, 5, 1, 10, 0, 0);
    const later = now + 60_000;
    const sustainedMs = RATE_LIMIT_SUSTAINED.windowSeconds * 1000;

    await limiter.consume(BOOKING_RATE_LIMIT, now);
    await limiter.consume(BOOKING_RATE_LIMIT, later);

    expect(storage.values.size).toBe(2);
    // Sliding, not set-once: each request re-arms the wipe to the longest
    // window measured from its own timestamp, so an active IP never has its
    // counters cleared out from under it.
    expect(storage.alarms).toEqual([now + sustainedMs, later + sustainedMs]);
    expect(storage.alarms[1]).toBeGreaterThan(storage.alarms[0]);

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

  it("allows the request when the binding exists but is not a durable object namespace", async () => {
    getCloudflareContextMock.mockImplementation(() => ({
      // Present, but without idFromName — a misconfigured or shadowed binding.
      env: { RATE_LIMITER: { get: () => ({ fetch: stubFetch }) } },
    }));

    await expect(
      checkRateLimit(
        limitedRequest({ "CF-Connecting-IP": "203.0.113.7" }),
        "bookings",
        BOOKING_RATE_LIMIT
      )
    ).resolves.toBe(true);

    expect(stubFetch).not.toHaveBeenCalled();
  });

  it("allows the request when the limiter answers with a non-ok status", async () => {
    // Body says deny; the status says the answer is not trustworthy. Fail open
    // wins — the response is never even read.
    stubFetch.mockResolvedValue(
      new Response(JSON.stringify({ allowed: false }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    );

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

  it(
    "allows the request when the limiter never answers",
    async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      // A durable object that accepted the call and then hung. Every other
      // fail-open path needs the limiter to actually fail; this one needs it to
      // do nothing at all, in front of a live customer's calendar call.
      stubFetch.mockImplementation(() => new Promise<Response>(() => {}));

      await expect(
        checkRateLimit(
          limitedRequest({ "CF-Connecting-IP": "203.0.113.7" }),
          "bookings",
          BOOKING_RATE_LIMIT
        )
      ).resolves.toBe(true);
    },
    // Fails fast rather than hanging the suite if the timeout ever regresses.
    RATE_LIMITER_TIMEOUT_MS * 4
  );

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

describe("checkRateLimit and RateLimiter, wired together", () => {
  // Every other spec in this file exercises one side of the durable-object
  // payload with the other side mocked, so nothing proves the two agree. If
  // the request or response shape ever diverged, the durable object would
  // throw, checkRateLimit would fail open, and rate limiting would be silently
  // inert in production behind a fully green suite. So: a fake namespace whose
  // stub invokes the REAL RateLimiter.fetch over fake storage — no hand-written
  // JSON literal anywhere between the two sides.
  function realLimiterNamespace() {
    const limiters = new Map<string, RateLimiter>();

    return {
      idFromName: (name: string) => name,
      get: (id: unknown) => {
        const name = String(id);
        const existing = limiters.get(name);
        const limiter = existing ?? new RateLimiter({ storage: fakeStorage() });
        if (!existing) limiters.set(name, limiter);

        return {
          fetch: (input: string, init?: RequestInit) =>
            limiter.fetch(new Request(input, init)),
        };
      },
    };
  }

  function bookingRequest(ip: string) {
    return new Request("http://localhost/api/bookings/", {
      method: "POST",
      headers: { "CF-Connecting-IP": ip },
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("denies the over-limit request through the real durable object", async () => {
    const namespace = realLimiterNamespace();
    getCloudflareContextMock.mockImplementation(() => ({
      env: { RATE_LIMITER: namespace },
    }));

    const verdicts: boolean[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      verdicts.push(
        await checkRateLimit(bookingRequest("203.0.113.7"), "bookings", [
          RATE_LIMIT_BURST,
        ])
      );
    }

    // A shape mismatch on either side surfaces here as an all-allowed run:
    // checkRateLimit swallows the durable object's error and fails open.
    expect(verdicts).toEqual([true, true, true, true, true, false]);
  });

  it("gives each client IP its own counter through the real durable object", async () => {
    const namespace = realLimiterNamespace();
    getCloudflareContextMock.mockImplementation(() => ({
      env: { RATE_LIMITER: namespace },
    }));

    for (let attempt = 0; attempt < 6; attempt += 1) {
      await checkRateLimit(bookingRequest("203.0.113.7"), "bookings", [
        RATE_LIMIT_BURST,
      ]);
    }

    await expect(
      checkRateLimit(bookingRequest("203.0.113.8"), "bookings", [
        RATE_LIMIT_BURST,
      ])
    ).resolves.toBe(true);
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
