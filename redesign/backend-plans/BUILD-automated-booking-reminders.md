# Automated Booking Reminders (24h cron) — Backend Plan
**Action:** BUILD
**Safety label:** ADDITIVE
**Blocks redesign:** YES
**Triggered by:** BUSINESS-COMPLETENESS.md 2A-16 · Zone 2 · Confirmed in scope by user during Phase 1 Step 3 review
**Owner:** Phase 6 implementer   **Target handled by:** Before Phase 6 session for `emails` (manual reminder queue must ship first; this cron replaces the "someone must sign in daily" workaround)

## 2026-05-19 Architecture amendment

**The original plan below assumed a Supabase Edge Function + `pg_cron` + `pg_net`. Session 3 of the engineering pause pivoted to Cloudflare Cron Triggers.**

Why the pivot: this codebase ships as a single Cloudflare Worker via `@opennextjs/cloudflare` v1.19.4. Cloudflare Workers have first-class native cron triggers (the `scheduled()` export on the Worker module). Reusing the existing Resend client (`src/lib/email/client.ts`), the existing `sendBookingReminderEmail` (`src/lib/email/notifications.ts:520`), the Session 2 override-resolution path (`resolveTemplateOverrides` in `src/lib/email/templates.ts`), and Cloudflare's built-in cron scheduling is dramatically simpler than rewriting all of that in Deno for a Supabase Edge Function and enabling `pg_cron` + `pg_net` extensions on the database side. The pivot also avoids duplicating `RESEND_API_KEY` (which would otherwise be set once in the Worker env and again in the Edge Function secret store).

What landed (see Session 3 commits + `/redesign/backend-smoke-tests/automated-booking-reminders-2026-05-19.txt`):
- `src/app/api/cron/booking-reminders/route.ts` — the cron handler logic (gated by `X-Cron-Secret` header).
- `worker-entrypoint.ts` — custom Cloudflare Worker entry that re-exports OpenNext's fetch handler and Durable Objects plus a `scheduled()` handler that fires the cron via the `WORKER_SELF_REFERENCE` service binding.
- `wrangler.jsonc` — `main` points at the wrapper; `triggers.crons` = `["0 8 * * *"]` (08:00 UTC daily = 09:00 BST / 08:00 GMT).
- `.env.example` — new `CRON_SECRET` placeholder.

The "original architecture" section below is kept verbatim for audit purposes; treat the deliverables it lists (Supabase Edge Function code, extensions migration, cron-schedule migration in pg_cron) as **superseded — not built**.

## Original architecture (superseded — kept for reference)

## What this is
A Supabase Edge Function deployed on a daily `pg_cron` schedule (09:00 Europe/London) that selects all bookings 24 hours ahead in `status IN ('pending', 'confirmed')`, checks that no reminder has already been sent for each (via `email_delivery_events`), calls `sendBookingReminderEmail` for each candidate, and writes an `email_delivery_events` row per send. Idempotent by design: running the function twice on the same day produces no duplicate sends.

## Why it's needed
The current reminder system is manual: an admin must visit `/admin/emails` → Reminders tab and click "Send reminder" per booking. This does not scale past a handful of daily bookings. PRODUCT.md establishes that the team manages bookings proactively; an automated 24h-before reminder is a baseline operational expectation for any professional clinic booking system. Item 2A-16 in BUSINESS-COMPLETENESS.md was confirmed as BLOCKS-REDESIGN by the user during Phase 1 Step 3 review.

## What it does (user story)
"As a client who booked a session for tomorrow, I want to receive a reminder email today without anyone on the clinic team having to manually send it, so my appointment doesn't slip my mind."

## What information it stores or retrieves
**Reads:** `bookings` where `status IN ('pending', 'confirmed')` AND `booking_date = CURRENT_DATE + INTERVAL '1 day'`. For each candidate, checks `email_delivery_events` where `booking_id = <id>` AND `event_type = 'booking_reminder'` — if a row exists, skips the send (idempotency guard).

**Writes:** One `email_delivery_events` row per sent reminder with `booking_id`, `event_type = 'booking_reminder'`, `recipient_email`, `delivery_status`, `provider_message_id`, `sent_at`. One `audit_logs` row per send with `action_type = 'manual_booking_reminder_sent'` (reusing the existing audit type since there is no distinct `auto_booking_reminder_sent` type yet — add one if the audit taxonomy is extended in Phase 7).

**Does NOT write:** Any `account_password_requests`, `staff_availability_rules`, or other unrelated tables. The function is strictly additive to `email_delivery_events` and `audit_logs`.

## Who can use it
Invoked by the Supabase `pg_cron` scheduler (system-level, no RBAC check). The function runs as the service-role key and therefore has full DB access — scope is intentionally limited in code to the two SELECT+INSERT operations above. The function never exposes its output to any HTTP endpoint.

## What can go wrong
- **Function invoked when no bookings qualify:** function exits early with zero sends. Safe.
- **Resend API rate limit hit mid-run:** the function should catch per-send Resend errors (not throw the entire run), log the failure row to `email_delivery_events` with `delivery_status = 'failed'`, and continue to the next booking. The `/admin/emails` Delivery tab will surface the failed row for manual follow-up.
- **Duplicate send (function runs twice in one day):** the idempotency check (`SELECT FROM email_delivery_events WHERE booking_id = <id> AND event_type = 'booking_reminder'`) prevents a second send to the same booking on the same calendar day. However if the cron fires twice with different `CURRENT_DATE` values (e.g. a 23:59 run and a 00:01 run on either side of midnight), it may correctly send for the second day's bookings. This is acceptable behaviour.
- **Booking cancelled between function start and Resend call:** the function reads `status` at query time. If a booking is cancelled after the query but before the email sends, the client receives a reminder for a cancelled booking. Mitigation: re-read `status` per booking immediately before calling Resend and skip if `status = 'cancelled'`.
- **`SITE_URL` env var missing in Edge Function context:** the reminder email contains a manage-booking link (`{SITE_URL}/booking/manage?...`). If the env var is absent, the link is broken. The function should validate this var at startup and fail loudly (non-zero exit code, Sentry capture) rather than silently sending emails with broken links.
- **Europe/London timezone edge:** `pg_cron` schedules in UTC. A 09:00 London cron must account for BST (+1h) vs GMT (+0h). Either (a) schedule at `08:00 UTC` and accept the reminder fires at 08:00 GMT / 09:00 BST, or (b) use a 08:00 UTC schedule year-round and document the seasonal shift. Recommend (a) for simplicity.
- **Sentry not capturing Edge Function errors:** confirm `sentry.edge.config.ts` captures errors from Supabase Edge Functions. If not, add explicit `Sentry.captureException` calls to the function's error handler.

## How to verify it works
1. Insert a booking with `booking_date = CURRENT_DATE + INTERVAL '1 day'` and `status = 'confirmed'`; trigger the function manually (Supabase Studio → Edge Functions → Invoke). Confirm the client's inbox receives the reminder; confirm one `email_delivery_events` row written; confirm one `audit_logs` row written.
2. Trigger the function a second time without adding new bookings. Confirm zero new `email_delivery_events` rows (idempotency guard worked).
3. Cancel the booking after inserting but before triggering. Trigger the function. Confirm zero emails sent for the cancelled booking.
4. Remove `SITE_URL` env var from the function's environment and invoke. Confirm the function exits with a non-zero code and a Sentry event is captured; confirm zero emails sent.

## Safe implementation order
1. Write the Edge Function code locally (`supabase/functions/send-booking-reminders/index.ts`). Hard-code a test booking ID and confirm the function compiles and runs against the dev DB.
2. Add the idempotency check and the cancellation re-read before calling Resend.
3. Add `SITE_URL` startup validation.
4. Deploy the function to the Supabase project (`supabase functions deploy send-booking-reminders`). Test with a manual `supabase functions invoke send-booking-reminders`.
5. Add the `pg_cron` schedule: `SELECT cron.schedule('daily-reminders', '0 8 * * *', $$SELECT net.http_post(...)$$)` (exact invocation pattern per Supabase pg_cron docs for Edge Functions). Confirm it appears in `cron.job` table.
6. Monitor the `/admin/emails` Delivery tab the next morning for the first automatic send.

## How to undo it if something breaks
Delete the `pg_cron` job: `SELECT cron.unschedule('daily-reminders')`. The Edge Function file remains deployed but will not fire. Manual sends via `/admin/emails` Reminders tab continue to work as before. No schema changes to undo (all writes are to `email_delivery_events` and `audit_logs`, which accept new rows without issue).

## Safety confirmations
- [ ] A database backup taken in the last 24 hours has been test-restored to a throwaway dev database, the restored data is intact, and the restore time is acceptable for production rollback (record the time: ___ minutes)
- [ ] I am implementing on staging/dev, not the live site
- [ ] I am implementing one item at a time with a test after each
