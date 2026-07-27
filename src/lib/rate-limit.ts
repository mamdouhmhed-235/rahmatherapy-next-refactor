import { getCloudflareContext } from "@opennextjs/cloudflare";
import { contactLinks } from "@/content/site/contact";
import type { RateLimitWindow } from "./rate-limit-durable-object";

// C-22: every rate-limit constant lives here so tuning is one edit.
//
// Deliberately generous — shared/NAT addresses are normal (a family, an office,
// a hotel, a mobile carrier) and a false positive costs the business a real
// customer (brief §2.2). The 429 copy always offers the phone number so a
// limited customer is never stranded.

// Raised 3 → 5 (Owner-approved): this window counts ATTEMPTS, not successful
// bookings. A customer whose submit fails server-side — a BookingCreationError
// because the slot was taken while they were filling the form — retries, and
// can plausibly reach four attempts inside ten minutes without doing anything
// wrong. Brief §4's top risk row is "a real customer gets rate-limited and
// gives up", and 5 stops a flood exactly as well as 3 does: a flood is
// thousands of requests, not four.
/** Public booking submissions — 5 per 10 minutes. */
export const RATE_LIMIT_BURST: RateLimitWindow = { limit: 5, windowSeconds: 600 };
/** Public booking submissions — 10 per day. */
export const RATE_LIMIT_SUSTAINED: RateLimitWindow = {
  limit: 10,
  windowSeconds: 86_400,
};

// Step 4a (D23): the two public availability endpoints are read-only and the
// booking dialog calls them per month-switch and per day-pick, so their limits
// sit far above the submission limits. A single dialog session tops out around
// 35 calls per endpoint (every month browsed is one call, cached per mount and
// refetched after a step-back; every date pick is one call, plus one more when
// a time is picked). The admin create-booking form also calls
// /api/availability, from a shared clinic IP. These numbers leave roughly 3x
// headroom over that ceiling while still capping a script at 12 calls/minute.
/** Availability lookups — 120 per 10 minutes. */
export const AVAILABILITY_RATE_LIMIT_BURST: RateLimitWindow = {
  limit: 120,
  windowSeconds: 600,
};
/** Availability lookups — 1000 per day. */
export const AVAILABILITY_RATE_LIMIT_SUSTAINED: RateLimitWindow = {
  limit: 1_000,
  windowSeconds: 86_400,
};

// A rate-limit check is a storage read behind a Durable Object round trip —
// sub-millisecond work, single-digit milliseconds on the wire, tens of
// milliseconds if the object is cold. This ceiling sits an order of magnitude
// above that, so a healthy limiter never trips it (which would silently switch
// rate limiting off), but a degraded one cannot stall the caller: this call
// fronts every public availability lookup and every booking submit.
/** Longest a limiter round trip may take before the request is let through. */
export const RATE_LIMITER_TIMEOUT_MS = 500;

export const BOOKING_RATE_LIMIT: RateLimitWindow[] = [
  RATE_LIMIT_BURST,
  RATE_LIMIT_SUSTAINED,
];

export const AVAILABILITY_RATE_LIMIT: RateLimitWindow[] = [
  AVAILABILITY_RATE_LIMIT_BURST,
  AVAILABILITY_RATE_LIMIT_SUSTAINED,
];

export const RATE_LIMITED_BOOKING_MESSAGE = `Too many booking attempts. Please try again in a few minutes, or call us on ${contactLinks.phone.value}.`;

export const RATE_LIMITED_AVAILABILITY_MESSAGE = `Too many availability checks. Please try again in a few minutes, or call us on ${contactLinks.phone.value}.`;

// The Durable Object ignores the URL; it only needs a valid absolute one.
const RATE_LIMITER_URL = "https://rate-limiter.invalid/consume";

interface DurableObjectStubLike {
  fetch(input: string, init?: RequestInit): Promise<Response>;
}

interface DurableObjectNamespaceLike {
  idFromName(name: string): unknown;
  get(id: unknown): DurableObjectStubLike;
}

// Turns an abort into a rejection the caller can race against, so a stub that
// ignores the signal cannot keep the request waiting anyway.
function rejectOnAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), {
      once: true,
    });
  });
}

// The RATE_LIMITER binding only exists inside the deployed Worker. Under
// `next dev` (no Workers bindings) and in tests getCloudflareContext() throws,
// which is exactly the fail-open path we want.
function getRateLimiterNamespace(): DurableObjectNamespaceLike | null {
  try {
    const env = getCloudflareContext().env as Record<string, unknown>;
    const namespace = env.RATE_LIMITER as DurableObjectNamespaceLike | undefined;
    return typeof namespace?.idFromName === "function" ? namespace : null;
  } catch {
    return null;
  }
}

/**
 * Returns false only when the caller has provably exceeded a window. Every
 * other outcome allows the request: rate limiting is a nuisance-reducer, not a
 * security boundary, and breaking bookings would be the worse failure (brief
 * §3.3).
 */
export async function checkRateLimit(
  request: Request,
  scope: string,
  windows: RateLimitWindow[]
): Promise<boolean> {
  // Cloudflare sets this and clients cannot forge it. X-Forwarded-For is
  // spoofable and must never be the identity source.
  const ip = request.headers.get("CF-Connecting-IP");
  if (!ip) return true;

  const namespace = getRateLimiterNamespace();
  if (!namespace) return true;

  try {
    const stub = namespace.get(namespace.idFromName(`${scope}:${ip}`));
    // A hung limiter must fail open like a thrown one: the existing escape
    // hatches only cover an error and a non-ok response, so without this a
    // degraded durable object would stall the live customer calendar with no
    // way out. The signal cancels the round trip; racing it means the escape
    // hatch holds even if the stub never honours the signal.
    const timeout = AbortSignal.timeout(RATE_LIMITER_TIMEOUT_MS);
    const response = await Promise.race([
      stub.fetch(RATE_LIMITER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ windows }),
        signal: timeout,
      }),
      rejectOnAbort(timeout),
    ]);

    if (!response.ok) return true;

    const result = (await response.json()) as { allowed?: boolean };
    return result.allowed !== false;
  } catch (error) {
    console.error(
      "[C-22] rate limiter unreachable or too slow; allowing request.",
      error
    );
    return true;
  }
}
