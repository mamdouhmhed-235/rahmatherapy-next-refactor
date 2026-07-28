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
        to: row.to_email,
        subject: row.subject,
        html: row.html_payload,
        text: row.text_payload,
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
        summary: `Email ${row.event_type} failed for ${row.recipient_role}.`,
        bookingId: row.booking_id,
        staffId: row.staff_id ?? null,
        safeContext: {
          event_type: row.event_type,
          recipient_role: row.recipient_role,
          delivery_status: "failed",
        },
      }).catch(() => undefined);
    }
  }

  // The worker logs this body verbatim, so `failures` is how a bad send or a
  // broken write surfaces in Cloudflare's log stream, `skipped` is how a lost
  // race does, and `errored` is what keeps those two apart.
  return NextResponse.json({ sent, skipped, errored, total: queued.length, failures });
}
