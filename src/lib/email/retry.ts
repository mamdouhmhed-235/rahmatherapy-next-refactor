// D-047 — retry a failed email, ONCE OR TWICE, then stop.
//
// ⛔ THE GAP THIS CLOSES: `sendEmail` had no retry, so one provider hiccup lost
// that message permanently. The failure was always VISIBLE — `sendTrackedEmail`
// records a row in `email_delivery_events` in every case — but nobody was going
// to notice in time. ⚠️ The Owner's stated reason for asking for this: a customer
// who never receives their confirmation usually just does not turn up.
//
// ── ⛔ WHY THIS RE-USES THE QUEUE INSTEAD OF LOOPING ─────────────────────
//
// There is already a working retry-shaped mechanism: `sendTrackedEmail`'s
// `delaySeconds` path parks a row as `queued` with a `scheduled_for`, and the
// `scheduled-emails` cron drains it every minute with an ATOMIC CONDITIONAL
// CLAIM. ⛔ A retry is just another queued row, so it inherits that claim for
// free — and the claim is the only thing standing between a retry and a double
// send when two workers overlap.
//
// ⚠️ The `booking-reminders` cron does check-then-act instead and is recorded in
// this run as able to double-email. That is the mistake this file must not copy.
//
// ── ⛔ WHY THE CAP IS SMALL, AND WHY THAT IS A JUDGEMENT NOT AN OVERSIGHT ─
//
// Two attempts after the original. That is deliberate and the reasoning matters:
//
//  • ⛔ AN UNBOUNDED RETRY IS WORSE THAN NO RETRY. Against a hard-bouncing
//    address it would hammer the clinic's sending domain for ever, and against
//    an exhausted daily allowance (D-053) it would burn the NEXT day's
//    allowance too. The Owner owns that allowance and asked not to have it
//    spent for them.
//
//  • ⚠️ EVERY RETRY CARRIES A DUPLICATE RISK THAT CANNOT BE DESIGNED AWAY. If
//    the provider accepted the message but the response was lost, the send
//    "failed" from here and the retry delivers a second copy. Nothing in this
//    file can tell those apart. A small cap bounds that to at most two extra
//    copies in the worst case, which is the trade the Owner accepted when they
//    chose "add a retry" over "leave it".
//
// ⛔ So the cap is not a placeholder to be raised later. Raising it makes both
// of those worse.

import type { SupabaseClient } from "@supabase/supabase-js";

/** Attempts AFTER the original send. Read the file header before changing. */
export const MAX_EMAIL_RETRIES = 2;

/**
 * How long to wait before each retry, in seconds.
 *
 * ⚠️ The first is deliberately short — a provider hiccup is usually over in
 * seconds, and a customer confirmation is worth little an hour late. The second
 * is long enough to outlast a brief outage without pretending it will outlast a
 * spent daily allowance, which no backoff can fix.
 */
const RETRY_DELAYS_SECONDS = [120, 900];

export interface RetryableEmail {
  bookingId: string | null;
  eventType: string;
  recipientEmail: string;
  recipientRole: string;
  staffId?: string | null;
  subject: string;
  html: string;
  text: string;
  /** How many retries have already been attempted for this message. */
  priorAttempts: number;
}

export interface RetryOutcome {
  queued: boolean;
  reason?: string;
  scheduledFor?: string;
  attempt?: number;
}

/**
 * Read how many times this message has already been retried.
 *
 * ⛔ Stored in the existing `metadata` jsonb rather than a new column, so this
 * needed no migration. A missing or malformed value reads as ZERO, which is the
 * safe direction: the worst case is one extra attempt, whereas treating it as
 * "already at the cap" would silently disable the retry this decision exists to
 * add.
 */
export function priorAttemptsOf(metadata: unknown): number {
  if (!metadata || typeof metadata !== "object") return 0;
  const raw = (metadata as Record<string, unknown>).retry_attempt;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * Park a failed email for one more try, unless it has had enough.
 *
 * ⛔ NEVER THROWS. Every caller is already inside a failure path — an exception
 * here would replace a recorded email failure with an unrecorded crash, which is
 * strictly worse than not retrying.
 */
export async function queueEmailRetry(
  supabase: SupabaseClient,
  email: RetryableEmail
): Promise<RetryOutcome> {
  try {
    if (!email.recipientEmail) {
      // ⛔ A message with no recipient is `skipped`, not `failed`. Retrying it
      // would queue an undeliverable row every minute for ever.
      return { queued: false, reason: "no recipient to retry" };
    }

    const attempt = email.priorAttempts + 1;
    if (attempt > MAX_EMAIL_RETRIES) {
      // ⚠️ Deliberately quiet. The FAILURE is already recorded by the caller and
      // already raises an operational event; saying "gave up" a second time
      // would double-count on /admin/operations.
      return { queued: false, reason: `already retried ${email.priorAttempts} time(s)` };
    }

    const delay = RETRY_DELAYS_SECONDS[attempt - 1] ?? RETRY_DELAYS_SECONDS[RETRY_DELAYS_SECONDS.length - 1];
    const scheduledFor = new Date(Date.now() + delay * 1000).toISOString();

    // ⛔ A NEW `queued` ROW, not an edit of the failed one. The failed row is the
    // clinic's record that an attempt did not land, and it must stay readable on
    // /admin/emails exactly as it is — a retry that overwrote its own history
    // would make a repeatedly-failing address look like a single blip.
    const { error } = await supabase.from("email_delivery_events").insert({
      booking_id: email.bookingId,
      event_type: email.eventType,
      recipient_email: email.recipientEmail,
      recipient_role: email.recipientRole,
      staff_id: email.staffId ?? null,
      to_email: email.recipientEmail,
      subject: email.subject,
      html_payload: email.html,
      text_payload: email.text,
      scheduled_for: scheduledFor,
      delivery_status: "queued",
      metadata: { retry_attempt: attempt, retry_reason: "previous attempt failed" },
    });

    if (error) {
      return { queued: false, reason: `could not queue the retry: ${error.message}` };
    }

    return { queued: true, scheduledFor, attempt };
  } catch (error) {
    return {
      queued: false,
      reason: error instanceof Error ? error.message : "retry could not be queued",
    };
  }
}
