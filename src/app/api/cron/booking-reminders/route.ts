// Cron handler — daily booking reminders (24h ahead).
//
// Invoked by the Cloudflare scheduled() trigger via the WORKER_SELF_REFERENCE
// service binding (see worker-entrypoint.ts). Also reachable via curl during
// local development for smoke testing.
//
// The X-Cron-Secret header gate is defense-in-depth — under normal operation
// the Worker self-fetches and forwards the secret, so the only way to reach
// this route from outside the Worker is to know the secret too. The Worker is
// the only intended client.
//
// The handler reuses sendBookingReminderEmail from src/lib/email/notifications.ts:520
// (template render + Resend send + email_delivery_events row via sendTrackedEmail).
// The handler itself does the audit-log insert with metadata.automated=true to
// distinguish cron-driven sends from operator-driven manual ones in the existing
// manual_booking_reminder_sent action type. See ENGINEERING-LOG.md for the
// temporary-measure note on this conflation.

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendBookingReminderEmail } from "@/lib/email/notifications";

interface ReminderSummary {
  candidates: number;
  sent: number;
  skipped_cancelled: number;
  skipped_already_sent: number;
  failed: number;
}

function emptySummary(): ReminderSummary {
  return {
    candidates: 0,
    sent: 0,
    skipped_cancelled: 0,
    skipped_already_sent: 0,
    failed: 0,
  };
}

// Tomorrow's date in UTC. The cron fires at 08:00 UTC daily (per wrangler.jsonc).
// At fire time, NOW() + 24h = same time tomorrow UTC, .toISOString().slice(0,10)
// gives YYYY-MM-DD of tomorrow's UTC day. Bookings are filtered to that day.
function tomorrowDateUtc(): string {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function POST(request: Request): Promise<Response> {
  // Auth gate — X-Cron-Secret must match CRON_SECRET env var.
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    // Configuration error — Sentry-capture and fail loudly.
    const err = new Error("CRON_SECRET not configured.");
    Sentry.captureException(err);
    return NextResponse.json(
      { error: "Server misconfigured.", summary: emptySummary() },
      { status: 500 }
    );
  }
  const headerSecret = request.headers.get("X-Cron-Secret");
  if (headerSecret !== expectedSecret) {
    return NextResponse.json(
      { error: "Unauthorized.", summary: emptySummary() },
      { status: 401 }
    );
  }

  // SITE_URL validation — the reminder email body links to {SITE_URL}/booking/manage.
  // Fail loudly here if missing (Bonus #4 from the plan's "what can go wrong").
  if (!process.env.NEXT_PUBLIC_SITE_URL) {
    const err = new Error(
      "NEXT_PUBLIC_SITE_URL not configured — reminder emails would carry a broken manage link."
    );
    Sentry.captureException(err);
    return NextResponse.json(
      { error: err.message, summary: emptySummary() },
      { status: 500 }
    );
  }

  const supabase = createSupabaseAdminClient();
  const summary = emptySummary();

  // Batch fetch — every pending/confirmed booking for tomorrow's UTC date that
  // has an address to remind. Since C-06, `contact_email` is nullable: an admin
  // can book a phone-only client, and those bookings must never be targeted.
  // C-01's review-email cron needs the same `contact_email IS NOT NULL` filter
  // on its candidate query when it ships.
  const targetDate = tomorrowDateUtc();
  const { data: candidates, error: queryError } = await supabase
    .from("bookings")
    .select("id")
    .eq("booking_date", targetDate)
    .in("status", ["pending", "confirmed"])
    .not("contact_email", "is", null);

  if (queryError) {
    Sentry.captureException(queryError);
    return NextResponse.json(
      { error: queryError.message, summary },
      { status: 500 }
    );
  }

  summary.candidates = candidates?.length ?? 0;

  for (const candidate of candidates ?? []) {
    // Cancellation guard — fresh re-read covers the race where the booking is
    // cancelled between batch fetch and per-booking send. Belt-and-braces over
    // the IN ('pending','confirmed') filter above.
    const { data: fresh } = await supabase
      .from("bookings")
      .select("status")
      .eq("id", candidate.id)
      .single();
    if (!fresh) {
      summary.failed++;
      Sentry.captureMessage(
        `[cron/booking-reminders] booking ${candidate.id} disappeared between fetch and re-read.`
      );
      continue;
    }
    if (fresh.status !== "pending" && fresh.status !== "confirmed") {
      summary.skipped_cancelled++;
      continue;
    }

    // Idempotency check — has a reminder already been logged for this booking?
    const { data: existing } = await supabase
      .from("email_delivery_events")
      .select("id")
      .eq("booking_id", candidate.id)
      .eq("event_type", "booking_reminder")
      .limit(1)
      .maybeSingle();
    if (existing) {
      summary.skipped_already_sent++;
      continue;
    }

    // Send. sendBookingReminderEmail wraps template render + Resend +
    // email_delivery_events insert via sendTrackedEmail. We do NOT double-write
    // the delivery row.
    try {
      await sendBookingReminderEmail(candidate.id, supabase);
      summary.sent++;
      // Audit — automated=true flag disambiguates from operator-driven manual
      // sends under the same action_type. Temporary measure pending a future
      // taxonomy split (see ENGINEERING-LOG.md).
      const auditResult = await supabase.from("audit_logs").insert({
        action_type: "manual_booking_reminder_sent",
        target_type: "bookings",
        target_id: candidate.id,
        after_state: {
          booking_id: candidate.id,
          automated: true,
          cron_trigger: "daily-booking-reminders",
        },
      });
      if (auditResult.error) {
        Sentry.captureException(auditResult.error);
      }
    } catch (error) {
      summary.failed++;
      Sentry.captureException(error);
      // The failure row in email_delivery_events was already written by
      // sendTrackedEmail's catch block. No action needed here beyond logging.
    }
  }

  return NextResponse.json({ summary, target_date: targetDate }, { status: 200 });
}
