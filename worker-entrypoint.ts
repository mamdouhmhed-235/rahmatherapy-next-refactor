// Cloudflare Worker entrypoint — wraps OpenNext's generated worker so we can
// add a scheduled() handler alongside the default fetch handler.
//
// OpenNext (v1.19) ships `.open-next/worker.js` after `opennextjs-cloudflare build`.
// That file exports `default { fetch }` plus three named Durable Object classes
// (DOQueueHandler, DOShardedTagCache, BucketCachePurge). This wrapper re-exports
// everything so the deployed Worker preserves OpenNext's HTTP behaviour, and
// adds scheduled() that fires the booking-reminders cron via the existing
// WORKER_SELF_REFERENCE service binding (see wrangler.jsonc).
//
// wrangler.jsonc's `main` points to this file. The deploy chain is:
//   1. `opennextjs-cloudflare build` regenerates `.open-next/worker.js`.
//   2. `wrangler deploy` bundles from this file, following the import below.

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — `.open-next/worker.js` is generated at build time and not in src.
import openNextWorker, {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  DOQueueHandler,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  DOShardedTagCache,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  BucketCachePurge,
} from "./.open-next/worker.js";

export { DOQueueHandler, DOShardedTagCache, BucketCachePurge };

// C-22: our own Durable Object — the per-IP rate-limit counter for the public
// booking + availability endpoints. Bound as RATE_LIMITER in wrangler.jsonc.
export { RateLimiter } from "./src/lib/rate-limit-durable-object";

// Minimal local typing for the Cloudflare Worker `Fetcher` binding shape so
// this file compiles under the Next.js tsc pass without pulling in the full
// `@cloudflare/workers-types` lib. The actual binding object is provided by
// the Cloudflare runtime via WORKER_SELF_REFERENCE (see wrangler.jsonc).
interface FetcherLike {
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
}

interface CronEnv {
  WORKER_SELF_REFERENCE: FetcherLike;
  CRON_SECRET?: string;
}

interface ScheduledControllerLike {
  scheduledTime: number;
  cron: string;
}

interface ExecutionCtxLike {
  waitUntil(promise: Promise<unknown>): void;
}

async function fireBookingReminders(env: CronEnv): Promise<void> {
  if (!env.CRON_SECRET) {
    console.error(
      "[scheduled/booking-reminders] CRON_SECRET not set on the Worker; aborting."
    );
    return;
  }
  try {
    const res = await env.WORKER_SELF_REFERENCE.fetch(
      "https://internal.invalid/api/cron/booking-reminders",
      {
        method: "POST",
        headers: {
          "X-Cron-Secret": env.CRON_SECRET,
          "Content-Type": "application/json",
        },
      }
    );
    const bodyText = await res.text().catch(() => "<no body>");
    if (!res.ok) {
      console.error(
        `[scheduled/booking-reminders] non-ok status=${res.status} body=${bodyText}`
      );
      return;
    }
    console.log(
      `[scheduled/booking-reminders] ok status=${res.status} body=${bodyText}`
    );
  } catch (error) {
    console.error("[scheduled/booking-reminders] threw:", error);
  }
}

// C-04a: drains the delayed-email queue (email_delivery_events rows parked with
// delivery_status='queued'). Mirrors fireBookingReminders — same self-fetch, same
// X-Cron-Secret transport, same logging shape.
async function fireScheduledEmails(env: CronEnv): Promise<void> {
  if (!env.CRON_SECRET) {
    console.error(
      "[scheduled/scheduled-emails] CRON_SECRET not set on the Worker; aborting."
    );
    return;
  }
  try {
    const res = await env.WORKER_SELF_REFERENCE.fetch(
      "https://internal.invalid/api/cron/scheduled-emails",
      {
        method: "POST",
        headers: {
          "X-Cron-Secret": env.CRON_SECRET,
          "Content-Type": "application/json",
        },
      }
    );
    const bodyText = await res.text().catch(() => "<no body>");
    if (!res.ok) {
      console.error(
        `[scheduled/scheduled-emails] non-ok status=${res.status} body=${bodyText}`
      );
      return;
    }
    console.log(
      `[scheduled/scheduled-emails] ok status=${res.status} body=${bodyText}`
    );
  } catch (error) {
    console.error("[scheduled/scheduled-emails] threw:", error);
  }
}

// C-01: fires the "leave us a review" cron, 2h+ after a booking completes.
// Mirrors fireBookingReminders/fireScheduledEmails — same self-fetch, same
// X-Cron-Secret transport, same logging shape.
async function fireReviewEmails(env: CronEnv): Promise<void> {
  if (!env.CRON_SECRET) {
    console.error(
      "[scheduled/review-emails] CRON_SECRET not set on the Worker; aborting."
    );
    return;
  }
  try {
    const res = await env.WORKER_SELF_REFERENCE.fetch(
      "https://internal.invalid/api/cron/review-emails",
      {
        method: "POST",
        headers: {
          "X-Cron-Secret": env.CRON_SECRET,
          "Content-Type": "application/json",
        },
      }
    );
    const bodyText = await res.text().catch(() => "<no body>");
    if (!res.ok) {
      console.error(
        `[scheduled/review-emails] non-ok status=${res.status} body=${bodyText}`
      );
      return;
    }
    console.log(
      `[scheduled/review-emails] ok status=${res.status} body=${bodyText}`
    );
  } catch (error) {
    console.error("[scheduled/review-emails] threw:", error);
  }
}

// C-02: rolls every active recurring series' materialisation horizon forward and
// creates the visits that fall into the newly-covered window. Mirrors
// fireBookingReminders/fireScheduledEmails/fireReviewEmails — same self-fetch,
// same X-Cron-Secret transport, same logging shape.
async function fireExtendRecurringHorizons(env: CronEnv): Promise<void> {
  if (!env.CRON_SECRET) {
    console.error(
      "[scheduled/extend-recurring-horizons] CRON_SECRET not set on the Worker; aborting."
    );
    return;
  }
  try {
    const res = await env.WORKER_SELF_REFERENCE.fetch(
      "https://internal.invalid/api/cron/extend-recurring-horizons",
      {
        method: "POST",
        headers: {
          "X-Cron-Secret": env.CRON_SECRET,
          "Content-Type": "application/json",
        },
      }
    );
    const bodyText = await res.text().catch(() => "<no body>");
    if (!res.ok) {
      console.error(
        `[scheduled/extend-recurring-horizons] non-ok status=${res.status} body=${bodyText}`
      );
      return;
    }
    console.log(
      `[scheduled/extend-recurring-horizons] ok status=${res.status} body=${bodyText}`
    );
  } catch (error) {
    console.error("[scheduled/extend-recurring-horizons] threw:", error);
  }
}

const workerEntrypoint = {
  // Re-export OpenNext's fetch handler verbatim.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetch: (openNextWorker as any).fetch.bind(openNextWorker),

  async scheduled(
    event: ScheduledControllerLike,
    env: CronEnv,
    ctx: ExecutionCtxLike
  ): Promise<void> {
    // Cloudflare fires this one handler for EVERY entry in wrangler.jsonc's
    // triggers.crons, passing the triggering expression verbatim as event.cron.
    // Dispatch on it, so each cron runs only its own job.
    //
    // Adding a cron is two edits and touches no existing case: append the
    // expression to triggers.crons in wrangler.jsonc, add a matching case here
    // with its own fireX(env) helper. The two lists must agree exactly — a
    // wrangler entry with no case here lands in `default` and does nothing but
    // log, which is the failure this switch is designed to make visible.
    //
    // The Cloudflare scheduled() invocation context is short-lived; ctx.waitUntil
    // keeps the runtime alive until our async fetch resolves.
    switch (event.cron) {
      case "0 8 * * *": // booking-reminders — daily 08:00 UTC
        ctx.waitUntil(fireBookingReminders(env));
        break;
      case "* * * * *": // scheduled-emails — every minute (C-04a)
        ctx.waitUntil(fireScheduledEmails(env));
        break;
      case "*/15 * * * *": // review-emails — every 15 min (C-01)
        ctx.waitUntil(fireReviewEmails(env));
        break;
      case "0 3 * * *": // extend-recurring-horizons — daily 03:00 UTC (C-02)
        ctx.waitUntil(fireExtendRecurringHorizons(env));
        break;
      default:
        // Never throw: an unrecognised cron must not take down the invocation
        // for the ones that ARE handled.
        console.error(`[scheduled] no handler for cron "${event.cron}"`);
    }
  },
};

export default workerEntrypoint;
