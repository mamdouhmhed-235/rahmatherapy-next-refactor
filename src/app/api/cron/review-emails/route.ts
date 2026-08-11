// Cron handler — "leave us a review" emails, 2h+ after a booking completes
// (C-01).
//
// Invoked every 15 minutes by the Cloudflare scheduled() trigger via the
// WORKER_SELF_REFERENCE service binding (see worker-entrypoint.ts). Also
// reachable via curl during local development for smoke testing.
//
// Transport mirrors /api/cron/booking-reminders — POST + X-Cron-Secret. Unlike
// that route, this one does NOT validate NEXT_PUBLIC_SITE_URL: the review
// email's only link is the hardcoded Google review URL in
// renderReviewRequestEmail (src/lib/email/templates.ts), so there is nothing
// here that depends on the site's own origin.
//
// The handler reuses sendReviewRequestEmail from src/lib/email/notifications.ts
// (template render + Resend send + email_delivery_events row via
// sendTrackedEmail, plus the review_email_sent_at sentinel write). The handler
// itself does the audit-log insert with metadata.automated=true, same pattern
// as booking-reminders' manual_booking_reminder_sent entries.
//
// Quiet-hours guard: 21:00-08:00 Europe/London, computed fresh on every
// invocation via Intl.DateTimeFormat (DST-safe by construction — no manual
// BST/GMT offset math). Skips before any DB work, so a quiet-hours tick never
// claims candidates it won't act on.

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  classifyReviewClient,
  getClientsAskedForReviewSince,
  getCompletedBookingCountsByClient,
  reviewCooldownStart,
  sendReviewRequestEmail,
} from "@/lib/email/notifications";

interface ReviewEmailSummary {
  candidates: number;
  sent: number;
  skipped_no_email: number;
  skipped_already_sent: number;
  skipped_quiet_hours: number;
  skipped_client_cooldown: number;
  failed: number;
}

function emptySummary(): ReviewEmailSummary {
  return {
    candidates: 0,
    sent: 0,
    skipped_no_email: 0,
    skipped_already_sent: 0,
    skipped_quiet_hours: 0,
    skipped_client_cooldown: 0,
    failed: 0,
  };
}

interface ReviewCandidateRow {
  id: string;
  client_id: string | null;
  recurring_template_id: string | null;
}

const QUIET_HOURS_START = 21; // 21:00 Europe/London
const QUIET_HOURS_END = 8; // 08:00 Europe/London

// DST-safe by construction: Intl resolves the Europe/London wall-clock hour
// for "now" directly, so this needs no manual BST/GMT offset bookkeeping.
function isQuietHourLondon(): boolean {
  const londonHour = parseInt(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
    10
  );
  return londonHour >= QUIET_HOURS_START || londonHour < QUIET_HOURS_END;
}

export async function POST(request: Request): Promise<Response> {
  // Auth gate — X-Cron-Secret must match CRON_SECRET env var. Same defense-in-
  // depth reasoning as booking-reminders: the Worker self-fetches and forwards
  // the secret, so the only way in from outside is to know it too.
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
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

  const summary = emptySummary();

  // Quiet-hours guard — return early without claiming candidates.
  if (isQuietHourLondon()) {
    return NextResponse.json(
      { summary, skipped_reason: "quiet_hours" },
      { status: 200 }
    );
  }

  const supabase = createSupabaseAdminClient();
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  // Batch fetch — completed bookings that haven't had a review email yet,
  // at least 2h post-completion (the delay), and not older than 7 days (don't
  // resurface ancient completions the backfill or a long outage left behind).
  // client_id and recurring_template_id are selected for the two batch
  // lookups below — the cooldown filter and the repeat/one-off classification.
  // Widening this select is load-bearing: the admin client is untyped, so
  // omitting a column here surfaces as `undefined` at runtime, not as a
  // compile error.
  const { data: candidateRows, error: queryErr } = await supabase
    .from("bookings")
    .select("id, client_id, recurring_template_id")
    .eq("status", "completed")
    .is("review_email_sent_at", null)
    .gte("completed_at", sevenDaysAgo)
    .lte("completed_at", twoHoursAgo)
    .limit(50);

  if (queryErr) {
    Sentry.captureException(queryErr);
    return NextResponse.json({ error: queryErr.message, summary }, { status: 500 });
  }

  const candidates = (candidateRows ?? []) as ReviewCandidateRow[];
  summary.candidates = candidates.length;

  // Two batch lookups for the whole tick, never one per candidate. Both
  // answer a per-client question over the same candidate set, so batching one
  // and looping the other would reintroduce exactly the N+1 this avoids.
  const candidateClientIds = Array.from(
    new Set(candidates.map((c) => c.client_id).filter((id): id is string => !!id))
  );
  const [recentlyAsked, completedCounts] = await Promise.all([
    getClientsAskedForReviewSince(candidateClientIds, reviewCooldownStart(), supabase),
    getCompletedBookingCountsByClient(candidateClientIds, supabase),
  ]);

  for (const candidate of candidates) {
    if (candidate.client_id && recentlyAsked.has(candidate.client_id)) {
      summary.skipped_client_cooldown++;
      continue;
    }
    const clientClass = classifyReviewClient({
      recurringTemplateId: candidate.recurring_template_id,
      completedBookingCount: candidate.client_id
        ? completedCounts.get(candidate.client_id) ?? 0
        : 0,
    });
    try {
      const result = await sendReviewRequestEmail(candidate.id, supabase);
      if (result.sent) {
        summary.sent++;

        // Audit — automated=true flag disambiguates from any future
        // operator-driven manual send under the same action_type.
        const auditResult = await supabase.from("audit_logs").insert({
          action_type: "review_email_sent",
          target_type: "bookings",
          target_id: candidate.id,
          after_state: {
            booking_id: candidate.id,
            automated: true,
            cron_trigger: "review-emails-15min",
            client_class: clientClass,
          },
        });
        if (auditResult.error) {
          Sentry.captureException(auditResult.error);
        }
      } else if (result.reason === "no_email") {
        summary.skipped_no_email++;
      } else if (result.reason === "already_sent") {
        summary.skipped_already_sent++;
      } else if (result.reason === "client_recently_asked") {
        // The batch filter above should have caught this; the per-booking
        // guard firing here means the two disagreed, which is worth counting
        // in the same bucket rather than silently as a failure.
        summary.skipped_client_cooldown++;
      } else {
        summary.failed++;
      }
    } catch (error) {
      summary.failed++;
      Sentry.captureException(error);
      // The failure row in email_delivery_events was already written by
      // sendTrackedEmail's catch block, if the throw happened past that point.
      // No action needed here beyond logging.
    }
  }

  return NextResponse.json({ summary }, { status: 200 });
}
