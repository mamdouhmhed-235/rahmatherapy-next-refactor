import { getCloudflareContext } from "@opennextjs/cloudflare";
import { contactLinks } from "@/content/site/contact";
import type { RateLimitWindow } from "./rate-limit-durable-object";

// C-22: every rate-limit constant lives here so tuning is one edit.
//
// Deliberately generous — shared/NAT addresses are normal (a family, an office,
// a hotel, a mobile carrier) and a false positive costs the business a real
// customer (brief §2.2). The 429 copy always offers the phone number so a
// limited customer is never stranded.

/** Public booking submissions — 3 per 10 minutes. */
export const RATE_LIMIT_BURST: RateLimitWindow = { limit: 3, windowSeconds: 600 };
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
    const response = await stub.fetch(RATE_LIMITER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ windows }),
    });

    if (!response.ok) return true;

    const result = (await response.json()) as { allowed?: boolean };
    return result.allowed !== false;
  } catch (error) {
    console.error("[C-22] rate limiter unreachable; allowing request.", error);
    return true;
  }
}
