// C-22: the per-IP counter behind the public rate limits, as a Durable Object.
//
// Chosen after the two cheaper options were ruled out on this account: the
// Workers rate-limiting binding only accepts a 10s or 60s period (and counts
// per Cloudflare location, not globally), and Workers Free WAF rate limiting is
// a single 10-second rule — neither can express 3-per-10-minutes or 10-per-day.
// Deliberately NOT one of OpenNext's three internal DO classes; this is
// application state. Registered in wrangler.jsonc (new_sqlite_classes — the
// only Durable Object storage backend available on Workers Free) and
// re-exported from worker-entrypoint.ts.
//
// One instance per (scope, client IP): the caller derives the name, this class
// only counts. Typed structurally rather than against @cloudflare/workers-types,
// which this repo does not install (worker-entrypoint.ts takes the same route).

export interface RateLimitWindow {
  /** Requests allowed inside the window. */
  limit: number;
  /** Window length, in seconds. */
  windowSeconds: number;
}

interface WindowState {
  windowStart: number;
  count: number;
}

interface DurableObjectStorageLike {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  deleteAll(): Promise<void>;
  setAlarm(scheduledTime: number): Promise<void>;
}

interface DurableObjectStateLike {
  storage: DurableObjectStorageLike;
}

export class RateLimiter {
  private readonly storage: DurableObjectStorageLike;

  constructor(state: DurableObjectStateLike) {
    this.storage = state.storage;
  }

  async fetch(request: Request): Promise<Response> {
    const { windows } = (await request.json()) as { windows: RateLimitWindow[] };
    const allowed = await this.consume(windows, Date.now());

    return new Response(JSON.stringify({ allowed }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Fires once the object has been idle for the longest window (consume()
  // pushes the alarm forward on every request). Wiping storage is what keeps
  // counter state bounded — an IP that goes quiet leaves nothing behind and
  // the runtime can evict the object entirely.
  async alarm(): Promise<void> {
    await this.storage.deleteAll();
  }

  // Fixed windows: one counter per window length, reset once the window has
  // elapsed. The known trade-off — up to 2x the limit across a window boundary
  // — errs towards letting a request through, which is the right side to err on
  // here (brief §2.2: a false positive costs the business a real customer).
  async consume(windows: RateLimitWindow[], now: number): Promise<boolean> {
    let allowed = true;
    let longestWindowSeconds = 0;

    for (const window of windows) {
      const key = `window:${window.windowSeconds}`;
      const previous = await this.storage.get<WindowState>(key);
      const elapsed =
        !previous || now - previous.windowStart >= window.windowSeconds * 1000;
      const next: WindowState = elapsed
        ? { windowStart: now, count: 1 }
        : { windowStart: previous.windowStart, count: previous.count + 1 };

      await this.storage.put(key, next);

      if (next.count > window.limit) {
        allowed = false;
      }
      longestWindowSeconds = Math.max(longestWindowSeconds, window.windowSeconds);
    }

    if (longestWindowSeconds > 0) {
      await this.storage.setAlarm(now + longestWindowSeconds * 1000);
    }

    return allowed;
  }
}
