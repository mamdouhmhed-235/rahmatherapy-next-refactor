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
// The queued row IS the delivery event. This handler UPDATEs it in place to
// 'sent' or 'failed' rather than writing a second row, so /admin/emails shows one
// row per email whichever path it took.

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/client";

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
  const failures: string[] = [];

  for (const row of queued) {
    try {
      await sendEmail({
        to: row.to_email,
        subject: row.subject,
        html: row.html_payload,
        text: row.text_payload,
      });
      await supabase
        .from("email_delivery_events")
        .update({ delivery_status: "sent" })
        .eq("id", row.id);
      sent++;
    } catch (err) {
      failures.push(`${row.id}: ${(err as Error).message}`);
      await supabase
        .from("email_delivery_events")
        .update({ delivery_status: "failed" })
        .eq("id", row.id);
    }
  }

  // The worker logs this body verbatim, so `failures` is how a bad send surfaces
  // in Cloudflare's log stream.
  return NextResponse.json({ sent, total: queued.length, failures });
}
