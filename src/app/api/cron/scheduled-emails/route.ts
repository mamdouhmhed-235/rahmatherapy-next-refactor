// Cron handler — drains the delayed-email queue (C-04a Change 13c).
//
// Invoked every minute by the Cloudflare scheduled() trigger via the
// WORKER_SELF_REFERENCE service binding (see worker-entrypoint.ts). Also
// reachable via curl during local development for smoke testing.
//
// Transport mirrors /api/cron/booking-reminders exactly — POST + X-Cron-Secret,
// not GET + Bearer as the plan's Step 12 sketch shows (orchestrator decision 4,
// 2026-07-27). The worker's fireScheduledEmails() sends the matching pair.
//
// What it drains: rows sendTrackedEmail parked with delivery_status='queued' and
// a scheduled_for in the past (src/lib/email/notifications.ts). Those rows carry
// their own rendered payload — to_email / subject / html_payload / text_payload —
// so this handler never re-renders a template or re-reads the booking. That also
// means a booking cancelled and then restored inside the undo window leaves a row
// restoreBooking has already flipped to 'cancelled_by_restore', which this query
// no longer matches: the email simply never goes out.
//
// That query is only half the guarantee, though — it is a snapshot, and a restore
// can land after it. What actually settles the race is the conditional claim in
// the loop below: each row is moved out of 'queued' BEFORE it is sent, so the
// cron and restoreBooking contend on one UPDATE and exactly one of them wins.
//
// The queued row IS the delivery event. This handler UPDATEs it in place to
// 'sent' or 'failed' rather than writing a second row, so /admin/emails shows one
// row per email whichever path it took.

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/client";
import {
  MAX_EMAIL_RETRIES,
  priorAttemptsOf,
  queueEmailRetry,
} from "@/lib/email/retry";
import { recordOperationalEvent } from "@/lib/ops/operational-events";

// One tick's worth. At the ~1-5 cancellations/day this queue is sized for, the
// cap is only ever reached if the cron has been down; the next tick takes the
// remainder, oldest scheduled_for first.
const BATCH_LIMIT = 50;

export async function POST(request: Request): Promise<Response> {
  // Auth gate — X-Cron-Secret must match CRON_SECRET env var. Same defense-in-
  // depth reasoning as booking-reminders: the Worker self-fetches and forwards
  // the secret, so the only way in from outside is to know it too.
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    const err = new Error("CRON_SECRET not configured.");
    Sentry.captureException(err);
    return NextResponse.json(
      { error: "Server misconfigured.", sent: 0, total: 0 },
      { status: 500 }
    );
  }
  const headerSecret = request.headers.get("X-Cron-Secret");
  if (headerSecret !== expectedSecret) {
    return NextResponse.json(
      { error: "Unauthorized.", sent: 0, total: 0 },
      { status: 401 }
    );
  }

  const supabase = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  const { data: queued, error } = await supabase
    .from("email_delivery_events")
    .select("*")
    .lte("scheduled_for", nowIso)
    .eq("delivery_status", "queued")
    .order("scheduled_for", { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) {
    Sentry.captureException(error);
    return NextResponse.json(
      { error: error.message, sent: 0, total: 0 },
      { status: 500 }
    );
  }
  if (!queued?.length) {
    return NextResponse.json({ sent: 0, total: 0 });
  }

  let sent = 0;
  let skipped = 0;
  // Claim writes that failed outright, kept separate from `skipped` so a broken
  // UPDATE can never read as a healthy lost race in the log stream.
  let errored = 0;
  const failures: string[] = [];

  for (const row of queued) {
    // ⛔ THE ROW'S PAYLOAD IS RESOLVED BEFORE THE CLAIM, NOT AFTER.
    //
    // Every payload column on `email_delivery_events` is nullable, and that is
    // not defensive over-typing — the same table also holds the rows
    // recordEmailDeliveryEvent writes for immediate sends, which carry a
    // `recipient_email` and no rendered payload at all. (At the time of writing
    // every row in the live table has a null `to_email` for exactly that
    // reason.) Only the two writers that PARK a row — sendTrackedEmail's delay
    // branch and queueEmailRetry — fill to_email / subject / html_payload /
    // text_payload, so a 'queued' row missing any of them is malformed, not
    // ordinary, and something upstream is broken.
    //
    // The address falls back to `recipient_email`, the column every writer
    // populates. The retry path below already read it that way and the send
    // path did not; that inconsistency is what this resolves.
    //
    // ⛔ It happens BEFORE the claim because the claim writes the terminal
    // 'sent'. Finding a malformed row after claiming would mean writing 'sent'
    // for an email that can never go and then correcting it — and if the
    // correction failed (a missing UPDATE grant is exactly how this route broke
    // once already) /admin/emails would show a success that is a lie, for ever.
    // Resolving first lets a bad row go 'queued' -> 'failed' in ONE conditional
    // write, on the same predicate, so restoreBooking can still win the race.
    const recipient = row.to_email ?? row.recipient_email;
    const { subject, html_payload: html, text_payload: text } = row;

    // `recipient_role` only labels the record — the operational-event summary
    // and the retry row. A null there is not a delivery risk, so it degrades to
    // a word rather than blocking the send or printing "null" into the summary.
    const recipientRole = row.recipient_role ?? "unknown";

    // ⛔ NOT `?? ""`. An empty address is not a fallback, it is an email that
    // cannot be delivered; an empty subject or body is a broken message a real
    // client receives and cannot un-receive. Both are worse than a failure the
    // clinic can see on /admin/emails and act on, so a row that cannot produce
    // a whole email is recorded as failed and never handed to the provider.
    if (!recipient || subject === null || html === null || text === null) {
      const missing: string[] = [];
      if (!recipient) missing.push("recipient address");
      if (subject === null) missing.push("subject");
      if (html === null) missing.push("html body");
      if (text === null) missing.push("text body");
      const reason = `malformed queued row, no ${missing.join(", no ")}`;

      // Same conditional predicate as the claim below, for the same reason: a
      // restore may still be moving this row, and a suppressed email must not
      // be overwritten with 'failed' any more than it may be sent.
      const { data: failed, error: failError } = await supabase
        .from("email_delivery_events")
        .update({ delivery_status: "failed", error_message: reason })
        .eq("id", row.id)
        .eq("delivery_status", "queued")
        .select("id");

      if (failError) {
        // Outcome 1, as below: the write never happened, the row is still
        // 'queued', and the next tick will look at it again.
        Sentry.captureException(failError);
        failures.push(
          `${row.id}: could not mark malformed row failed: ${failError.message}`
        );
        errored++;
        continue;
      }
      if (!failed?.length) {
        // Outcome 2, as below: another writer got there first.
        skipped++;
        continue;
      }

      // A malformed queued row means a writer upstream is broken, which is a
      // different class of problem from a provider refusing a send — so it is
      // raised to Sentry as well as recorded on the row.
      Sentry.captureException(new Error(`Scheduled email ${row.id}: ${reason}`));
      // "not retried" is stated rather than left implied: a retry would copy the
      // same missing payload and fail identically, which is the undeliverable
      // loop queueEmailRetry's own no-recipient guard exists to prevent.
      failures.push(`${row.id}: ${reason} — not sent, not retried`);
      // Same operational event a failed send records, so a row that never left
      // reaches /admin/operations and the nav failure counter like any other.
      await recordOperationalEvent(supabase, {
        eventType: "failed_email_send",
        severity: "error",
        summary: `Email ${row.event_type} could not be sent to ${recipientRole}: ${reason}.`,
        bookingId: row.booking_id,
        staffId: row.staff_id ?? null,
        safeContext: {
          event_type: row.event_type,
          recipient_role: recipientRole,
          delivery_status: "failed",
        },
      }).catch(() => undefined);
      continue;
    }

    // Claim before sending, not after. restoreBooking's suppression sweep flips
    // queued rows to 'cancelled_by_restore'; if we sent first and wrote the
    // status after, a restore landing mid-send would be overwritten by 'sent'
    // and the customer would get a cancellation for a booking that is confirmed
    // again. Claiming first turns that into one conditional UPDATE the two
    // writers race on, and the loser does nothing.
    //
    // The claim writes the terminal 'sent' rather than an intermediate 'sending'
    // because the applied CHECK constraint has no such value and adding one
    // would need another migration. The trade: if this worker dies between the
    // claim and the send, that row reads 'sent' but never went. Accepted at this
    // volume (~1-5 cancellations/day).
    //
    // The claim has three outcomes, and they are NOT interchangeable:
    //   1. it errors           — the write never happened (a missing grant, a
    //                            dropped connection, a constraint). Nothing is
    //                            known about the row and nothing may be sent.
    //   2. it matches no rows  — another writer moved the row out of 'queued'
    //                            first: restoreBooking's suppression sweep, or
    //                            an overlapping tick of this same cron.
    //   3. it matches the row  — ours to send.
    // Collapsing 1 into 2 is how this route shipped a version that answered
    // 200 {sent: 0, skipped: N, failures: []} while service_role held no UPDATE
    // privilege and not one email ever left.
    const { data: claimed, error: claimError } = await supabase
      .from("email_delivery_events")
      .update({ delivery_status: "sent" })
      .eq("id", row.id)
      .eq("delivery_status", "queued")
      .select("id");

    if (claimError) {
      // Outcome 1. The row is still 'queued', so the next tick retries it; what
      // must not happen is that this failure passes for a healthy skip.
      Sentry.captureException(claimError);
      failures.push(`${row.id}: claim failed: ${claimError.message}`);
      errored++;
      continue;
    }

    if (!claimed?.length) {
      // Outcome 2. Either writer winning is the mechanism working, not a
      // failure — but counted so a lost claim is visible in the log stream.
      skipped++;
      continue;
    }

    try {
      await sendEmail({
        to: recipient,
        subject,
        html,
        text,
      });
      sent++;
    } catch (err) {
      const reason = (err as Error).message;
      failures.push(`${row.id}: ${reason}`);
      // Corrective flip. The row was claimed to 'sent' BEFORE the send, so if
      // this write fails the row stays 'sent' for an email that never went —
      // /admin/emails would show a success that is a lie. Reported alongside
      // the send failure above, never instead of it.
      const { error: flipError } = await supabase
        .from("email_delivery_events")
        .update({ delivery_status: "failed", error_message: reason })
        .eq("id", row.id);
      if (flipError) {
        Sentry.captureException(flipError);
        failures.push(`${row.id}: could not mark failed: ${flipError.message}`);
      }
      // Same operational event the immediate-send path records via
      // recordEmailDeliveryEvent, so a failed scheduled send reaches
      // /admin/operations and the nav failure counter like any other.
      await recordOperationalEvent(supabase, {
        eventType: "failed_email_send",
        severity: "error",
        summary: `Email ${row.event_type} failed for ${recipientRole}.`,
        bookingId: row.booking_id,
        staffId: row.staff_id ?? null,
        safeContext: {
          event_type: row.event_type,
          recipient_role: recipientRole,
          delivery_status: "failed",
        },
      }).catch(() => undefined);

      // D-047 — one more try, if it has not had its two.
      //
      // ⛔ THE COUNT COMES OFF THE ROW ITSELF (`metadata.retry_attempt`), not
      // from anything held in memory here. This worker runs every minute and
      // may not be the same worker that queued the row, so a counter that did
      // not travel WITH the message would reset on every tick and retry for
      // ever — which is precisely the failure D-047 warned about.
      //
      // The payload handed over is the one that was actually sent, not a re-read
      // of the row with `?? ""` patched over the gaps: the guard at the top of
      // the loop already proved every field is present, so there is no gap left
      // to paper over.
      const priorAttempts = priorAttemptsOf(row.metadata);
      const retry = await queueEmailRetry(supabase, {
        bookingId: row.booking_id,
        eventType: row.event_type,
        recipientEmail: recipient,
        recipientRole,
        staffId: row.staff_id ?? null,
        subject,
        html,
        text,
        priorAttempts,
      });
      // Reported in the worker's log body either way, so "we gave up" is as
      // visible in Cloudflare's stream as "we tried again".
      failures.push(
        retry.queued
          ? `${row.id}: retry ${retry.attempt} of ${MAX_EMAIL_RETRIES} queued for ${retry.scheduledFor}`
          : `${row.id}: not retried (${retry.reason})`,
      );
    }
  }

  // The worker logs this body verbatim, so `failures` is how a bad send or a
  // broken write surfaces in Cloudflare's log stream, `skipped` is how a lost
  // race does, and `errored` is what keeps those two apart.
  return NextResponse.json({ sent, skipped, errored, total: queued.length, failures });
}
