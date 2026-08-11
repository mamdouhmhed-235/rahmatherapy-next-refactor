# ITEM 1 deepening — review-request email cooldown, manual admin send, client classification

Audited: `redesign/plans/POST-BAND-C-FOLLOWUP-plan.md` lines 68-165 ("ITEM 1"), against HEAD (`86b8b22` at
session start; verified `src/` byte-identical to plan's base commit `33f895f` per handoff, and independently
re-confirmed every anchor below by direct file read, not by trusting the stored line number).

All SQL below was run against project `twzutkfgqclqurvkmvqz` via `mcp__supabase__execute_sql`, SELECT-only.
No file under `src/`, `scripts/`, `e2e/`, `supabase/` was modified. `src/lib/maintenance.ts` was never opened.

---

## 1. Headline — what an implementer must know that the plan currently gets wrong or omits

1. **`resendDeliveryEvent` does not exist.** The plan (line 143) tells the implementer to "reuse the existing
   middle-path guard from `resendDeliveryEvent`". The real function is **`resendEmail`**
   (`src/app/admin/emails/actions.ts:120`). A `grep -rn resendDeliveryEvent src` returns zero hits. The guard
   logic the plan describes is real and correctly characterised — only the name is wrong. An implementer who
   greps for `resendDeliveryEvent` to find "the pattern" will find nothing and may reinvent it worse.
2. **The UI placement instruction is unbuildable as literally stated.** Plan §1.6 says: "place it beside
   `ReminderResendForm` on `/admin/emails` (page.tsx:925), which is that form's established home, mirroring its
   structure. Only offer it for `completed` bookings." But the data feeding that row (`ReminderRow`, and the
   `upcomingBookings` array it's mapped over) comes from `getEmailsPageData`'s `remindersPromise`
   (`src/app/admin/emails/emails-data.ts:183-196`), which explicitly queries
   `.in("status", ["pending", "confirmed"])` and `.gte("booking_date", businessDate)` — i.e. **upcoming,
   not-yet-happened bookings only.** A `completed` booking can never appear in that list. The manual review-send
   control cannot literally sit "beside" `ReminderResendForm` inside the existing Reminders-tab row without a
   **new, separate data query** (completed bookings with a recipient, not yet cooled-down) and almost certainly
   a **new tab or a new sub-section**, since the page currently has exactly three tabs (`delivery`, `reminders`,
   `templates` — `page.tsx:78`) and none lists completed bookings. This is a real, unaddressed gap, not a
   nitpick — see §4.
3. **`src/app/admin/emails/format.ts`'s `DELIVERY_STATUSES` (line 31-39) is the wrong source of truth and will
   mislead an implementer who reaches for it.** It lists `accepted, delivered, opened, clicked, bounced, failed,
   complained` — none of `delivered/opened/clicked/bounced/complained` is ever written by any code path (no
   Resend webhook handler exists in this repo), and **none of them is even legal under the live DB CHECK
   constraint**. The DB constraint (see §3) is `accepted, failed, skipped, queued, sent, cancelled_by_restore,
   cancelled_manual` — `format.ts`'s list is missing 4 of those 7 real values and invents 5 that don't occur.
   The plan's instruction ("confirm the full set of values... do not hardcode from the single observed value")
   is exactly right, but the implementer must get that set from the DB CHECK constraint + `sendTrackedEmail`'s
   source, **not** from `format.ts`, which looks like a source of truth (it sits next to a comment claiming
   `EMAIL_EVENT_TYPES` is "sourced from notifications.ts") but isn't one for delivery status.
4. **Item 8 also edits `src/lib/email/notifications.ts`** — `BOOKING_EMAIL_SELECT` (`:123-138`),
   `getBookingTemplateInput` (`:216-265`), and `sendBookingCreatedEmails` (`:608-677`), per the plan's own
   §"Item 8" text (lines 1123-1125 of the plan). Item 1 edits the same file, in a different region
   (`sendReviewRequestEmail`, `:1356-1444`, plus new top-level exports). Not a logical conflict, but a **file
   collision**: whichever item lands second must re-locate anchors in a file the other item also changed, and
   if executed by two agents in parallel, both must not silently clobber each other's diff. See §5 (ordering).
5. **`review_email_sent` is not registered in `src/app/admin/audit/format.ts`'s `ACTIONS` map** (lines 22-98).
   It is registered in the *client detail page's own separate local label map*
   (`src/app/admin/clients/[clientId]/page.tsx:207-237`, confirmed correct, no drift), but the *global*
   `/admin/audit` timeline uses `describeAction` in `format.ts`, which falls through to the defensive fallback
   (`family: "operations_and_email", chip: "none"`, phrase `"review email sent"`) for any unregistered type.
   This is a **pre-existing gap**, not caused by item 1, but item 1 doubles the call sites writing this
   action_type (cron + new manual action) and the plan's own item 8 text explicitly cites the precedent
   ("If a distinct `action_type` is wanted, it must be registered in `src/app/admin/audit/format.ts:22-35` or
   the audit timeline renders it unlabelled" — plan line 1070). The deepened plan should decide explicitly
   whether to register it now, rather than leave the question implicit.

---

## 2. Claims tested

| # | Claim (plan line) | Verdict | Evidence |
|---|---|---|---|
| 1 | Candidate query is `status='completed' AND review_email_sent_at IS NULL AND completed_at BETWEEN (now-7d) AND (now-2h)` (line 74-77) | CONFIRMED | `src/app/api/cron/review-emails/route.ts:107-114` — `.eq("status","completed").is("review_email_sent_at",null).gte("completed_at",sevenDaysAgo).lte("completed_at",twoHoursAgo)` |
| 2 | 50-candidate cap (implicit throughout) | CONFIRMED | `route.ts:114` — `.limit(50)` |
| 3 | `bookings` has `client_id`, `recurring_template_id`, `review_email_sent_at`, `completed_at`; `clients` has no review-tracking column (line 81) | CONFIRMED | SQL: `information_schema.columns` for both tables (below); `clients` columns are address/area/city/client_source/created_at/deleted_at/email/full_name/gender_preference/id/notes/phone/postcode/source_detail/updated_at — no review column |
| 4 | `email_delivery_events` records `booking_id, event_type, delivery_status, created_at` (line 87) | CONFIRMED | `information_schema.columns` for `email_delivery_events` — also has `metadata`, `recipient_email`, `recipient_role`, `staff_id`, `provider_message_id`, `subject`, `html_payload`, `text_payload`, `scheduled_for`, `error_message`, `to_email`, `id` |
| 5 | Every review send writes an `email_delivery_events` row via `sendTrackedEmail` with `event_type='review_request_client'` (line 87) | CONFIRMED | `src/lib/email/notifications.ts:1412` — `eventType: "review_request_client"` inside the single `sendTrackedEmail` call in `sendReviewRequestEmail` |
| 6 | `review_email_sent_at` is written on the `no_email` branch without sending (line 89) | CONFIRMED | `notifications.ts:1376-1384` — the block updates `review_email_sent_at` and returns `{sent:false, reason:"no_email"}` with no call to `sendTrackedEmail`/`sendEmail` anywhere in that branch |
| 7 | "Live data currently shows only `accepted` for successful sends" (line 91) | CONFIRMED | SQL: `SELECT delivery_status, count(*) FROM email_delivery_events GROUP BY 1` → `[{"delivery_status":"accepted","count":43}]` — **every** row in the live table (all 43) is `accepted`; specifically for `event_type='review_request_client'`: `[{"accepted": 1}]` (only one real review email has ever been sent) |
| 8 | `sendReviewRequestEmail`'s early-return reasons are `no_email` / `already_sent` / `send_failed` (line 101) | CONFIRMED | `notifications.ts:1359` return type `{ sent: boolean; reason?: "no_email" \| "already_sent" \| "send_failed" }`; all three reachable (lines 1370, 1372, 1383) |
| 9 | `dispatchResend` has no `review_request_client` case (line 137) | CONFIRMED | `src/app/admin/emails/actions.ts:298-365` — the switch covers `booking_confirmation`, `booking_cancellation_customer/admin`, `booking_reminder`, `staff_assignment`, `staff_booking_change`, `booking_confirmed_client`, `staff_unassignment`, `claim`, `client_assigned_therapist`, `default: throw` — no `review_request_client` |
| 10 | `canResendBookingEmails` at `rbac.ts:221`, permission `resend_booking_emails` (line 142) | CONFIRMED, no drift | `src/lib/auth/rbac.ts:221-223` exactly |
| 11 | Permission held by Owner, Admin, Coordinator, Therapist (line 143) | CONFIRMED (role name is "Booking Coordinator", not bare "Coordinator") | SQL join of `role_permissions`/`roles`/`permissions` → exactly `{Admin, Booking Coordinator, Owner, Therapist}` hold `resend_booking_emails` |
| 12 | The middle-path scope check + `failed_resend_attempt` operational event exists in "`resendDeliveryEvent`" (line 143) | PARTIAL — logic confirmed, **name wrong** | `actions.ts:166-201` in `resendEmail` (not `resendDeliveryEvent`); `recordOperationalEvent(..., eventType: "failed_resend_attempt", ...)` at `:184` |
| 13 | `RESEND_RATE_LIMIT_SECONDS` reused (line 144) | CONFIRMED | `actions.ts:101` — `const RESEND_RATE_LIMIT_SECONDS = 60;` |
| 14 | `ReminderResendForm` rendered at `page.tsx:925`, that form's established home (line 146) | CONFIRMED, no drift | `src/app/admin/emails/page.tsx:925` exactly |
| 15 | "Only offer it for `completed` bookings with a recipient address" is achievable by placing it beside `ReminderResendForm` (line 146) | **FALSE as literally stated** | See §1 finding 2 — the row's data source structurally excludes `completed` bookings |
| 16 | `review_email_sent` action type already exists, labelled at `clients/[clientId]/page.tsx:222` (line 147) | CONFIRMED, no drift | `src/app/admin/clients/[clientId]/page.tsx:222` — `review_email_sent: "Review request email sent"` |
| 17 | "None exists today" — no manual send path (line 137) / every caller of `sendReviewRequestEmail` (implicit ask) | CONFIRMED | `grep -rn sendReviewRequestEmail src` → exactly one production call site, `route.ts:125`; every other hit is a test or the definition itself |
| 18 | `ReviewEmailSummary` / `emptySummary()` shape (implicit, plan §1.4 adds `skipped_client_cooldown`) | CONFIRMED current shape (field not yet added) | `route.ts:30-48` — `{candidates, sent, skipped_no_email, skipped_already_sent, skipped_quiet_hours, failed}`, no `skipped_client_cooldown` yet |
| 19 | Audit metadata the cron writes (line 131, "alongside `automated: true`") | CONFIRMED | `route.ts:131-140` — `action_type:"review_email_sent"`, `target_type:"bookings"`, `target_id`, `after_state:{booking_id, automated:true, cron_trigger:"review-emails-15min"}` |

### Additional verification not explicitly claimed by the plan text, but load-bearing for execution

- **The complete `sendTrackedEmail` write surface is 4 values in code, 7 allowed by the DB.** `sendTrackedEmail`
  itself (`notifications.ts:473-584`) writes exactly `"skipped"` (no recipient, `:499`), `"queued"` (delayed
  send, `:528`), `"accepted"` (immediate success, `:567`), `"failed"` (immediate failure, `:578`). Two more
  values are written **elsewhere**, not by `sendTrackedEmail`: `"sent"` (the scheduled-emails cron flips a
  queued row to sent — `src/app/api/cron/scheduled-emails/route.ts:116`) and `"cancelled_by_restore"` /
  `"cancelled_manual"` (booking-restore/cancel sweeps — `src/app/admin/bookings/actions.ts:479,1035`;
  `"cancelled_manual"` appears only in the TS union at `src/app/admin/bookings/types.ts:86`, not yet in any
  `.update()` call I found — plausibly reserved/future). The **live DB CHECK constraint**
  (`email_delivery_events_delivery_status_check`) is the authoritative union:
  `accepted, failed, skipped, queued, sent, cancelled_by_restore, cancelled_manual` (SQL below).
- **Review emails specifically can only ever produce 3 of those 7.** `sendReviewRequestEmail`'s call to
  `sendTrackedEmail` (`notifications.ts:1410-1425`) never passes `delaySeconds`, so the `queued`/`sent`/
  `cancelled_*` branches are unreachable for `event_type='review_request_client'`. The realistic set for this
  event type is `accepted` (success), `skipped` (no recipient — though `sendReviewRequestEmail` already
  short-circuits on `no_email` before ever calling `sendTrackedEmail`, so `skipped` should be structurally
  unreachable too, but do not rely on that without confirming — it's a defence-in-depth branch), `failed`
  (Resend error). **The cooldown filter should treat only `delivery_status = 'accepted'` as "asked" today**, but
  the deepened plan should say so explicitly (as a derived value from the CHECK constraint + code, per its own
  rule) rather than leave the implementer to guess between "the 7 DB-legal values" and "the 4 code-observed
  values" and "the 3 event-type-realistic values" — these are three different answers to three different
  questions, and the plan currently doesn't disambiguate.
- **FK exists for the batch cooldown join.** `email_delivery_events.booking_id → bookings.id`
  (`email_delivery_events_booking_id_fkey`, confirmed via `information_schema`), so
  `getClientsAskedForReviewSince` can be written as a single PostgREST embedded-filter query, e.g.
  `.from("email_delivery_events").select("bookings!inner(client_id)").eq("event_type","review_request_client").eq("delivery_status","accepted").gte("created_at", since).in("bookings.client_id", clientIds)`
  — the plan does not specify this query shape at all; "a reusable helper" is under-specified enough that an
  implementer could reach for an N-query-per-client loop instead, which is exactly what §1.4 says not to do for
  the cooldown check and what this helper must not do either.
- **No credential-adjacent risk in the query path**: both the cron and the manual action use
  `createSupabaseAdminClient()` (service role), so RLS on `email_delivery_events` (tightened per the comment at
  `actions.ts:164`) does not block the batch helper.

---

## 3. Schema verification (SQL run, SELECT-only, project `twzutkfgqclqurvkmvqz`)

```sql
SELECT delivery_status, count(*) FROM email_delivery_events GROUP BY delivery_status ORDER BY 1;
-- [{"delivery_status":"accepted","count":43}]

SELECT event_type, delivery_status, count(*) FROM email_delivery_events
WHERE event_type = 'review_request_client' GROUP BY 1,2 ORDER BY 1,2;
-- [{"event_type":"review_request_client","delivery_status":"accepted","count":1}]

SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'email_delivery_events'::regclass AND contype = 'c';
-- email_delivery_events_delivery_status_check:
-- CHECK ((delivery_status = ANY (ARRAY['accepted','failed','skipped','queued','sent',
--   'cancelled_by_restore','cancelled_manual'])))

SELECT column_name, data_type, is_nullable FROM information_schema.columns
WHERE table_name = 'bookings' AND column_name IN
  ('client_id','recurring_template_id','review_email_sent_at','completed_at','status','contact_email');
-- client_id uuid NOT NULL · completed_at timestamptz NULL · contact_email text NULL
-- recurring_template_id uuid NULL · review_email_sent_at timestamptz NULL · status USER-DEFINED NOT NULL

SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'clients';
-- address, area, city, client_source, created_at, deleted_at, email, full_name, gender_preference,
-- id, notes, phone, postcode, source_detail, updated_at  -- no review-tracking column, confirms plan

SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'email_delivery_events';
-- booking_id, created_at, delivery_status, error_message, event_type, html_payload, id, metadata,
-- provider_message_id, recipient_email, recipient_role, scheduled_for, staff_id, subject, text_payload, to_email

SELECT r.name role_name, p.name permission_name FROM role_permissions rp
JOIN roles r ON r.id=rp.role_id JOIN permissions p ON p.id=rp.permission_id
WHERE p.name = 'resend_booking_emails' ORDER BY r.name;
-- Admin, Booking Coordinator, Owner, Therapist

SELECT tc.constraint_name, kcu.column_name, ccu.table_name foreign_table, ccu.column_name foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'email_delivery_events' AND tc.constraint_type = 'FOREIGN KEY';
-- email_delivery_events_booking_id_fkey: booking_id -> bookings.id
-- email_delivery_events_staff_id_fkey: staff_id -> staff_profiles.id
```

---

## 4. Blast radius

### Files to edit (per plan §1.7, verified accurate as a *list*, incomplete as a *description* — see gaps below)

- `src/lib/email/notifications.ts` — add `REVIEW_REQUEST_CLIENT_COOLDOWN_MONTHS`, `getClientsAskedForReviewSince`,
  a new `"client_recently_asked"` reason, an `{ ignoreClientCooldown? }` option on `sendReviewRequestEmail`.
- `src/app/api/cron/review-emails/route.ts` — widen `.select("id")` to include `client_id, recurring_template_id`;
  batch-call the new helper; add `skipped_client_cooldown` to `ReviewEmailSummary`/`emptySummary()`; add
  classification to `after_state`.
- `src/app/admin/emails/actions.ts` — new sibling server action (name TBD, e.g. `sendManualReviewRequest`); do
  **not** touch `sendManualBookingReminder` (RECON-untouchable, confirmed live at `:31-97`) or `dispatchResend`
  (plan explicitly says don't build the `review_request_client` case unasked, line 145).
- `src/app/admin/emails/emails-data.ts` — **missing from the plan's file list.** A new data query is required
  (completed bookings, recipient present, eligible for a manual send) — see §1 finding 2. This is a new export
  alongside `getEmailsPageData`/`ReminderBooking`, following the same `unstable_cache` + RLS-bypassing
  `createSupabaseAdminClient()` pattern already used at `emails-data.ts:142-197`.
- `src/app/admin/emails/page.tsx` — **also add**: a new tab entry in the `tabs` array (`:263-291`) or a new
  section within the existing Reminders tab fed by the new query, plus wiring `resolveTab`/`TabKey`
  (`:78-88`) if a new tab is chosen. The plan's file list already names this file but under-describes the
  change (implies only "add a form next to the existing one").
- A new form component (client component), sibling to `ReminderResendForm.tsx`, per plan.
- Tests — see §6.

### Callers / consumers of everything touched

- `sendReviewRequestEmail` — **one** production caller today: `route.ts:125`. After item 1, a second caller
  (the new manual action) is added. No other file calls it (confirmed by full-repo grep).
- `sendTrackedEmail` — used by essentially every notification sender in `notifications.ts` (18 call sites);
  item 1 does not change its signature or behaviour, only adds a new caller-side guard *before* it's reached
  for the review-email path specifically. Every other caller is unaffected — none of item 1's changes touch
  `sendTrackedEmail`'s body.
- `dispatchResend` / `resendEmail` — untouched by item 1 per the plan's own decision (line 145); confirmed no
  edit is required to make item 1 work, only to extend resend coverage later (explicitly out of scope now).
- `canResendBookingEmails` — already consumed by `sendManualBookingReminder`, `resendEmail`,
  `getEmailsPageData` (`emails-data.ts` reminders gate), and `page.tsx`'s own `canResend` gate. The new manual
  action reuses it; no new consumer needs registering elsewhere.
- `ACTIONS` map in `src/app/admin/audit/format.ts` — currently has no entry for `review_email_sent`; the local
  `AUDIT_PHRASING` map in `clients/[clientId]/page.tsx` does. Both are read independently; item 1's writes are
  already correctly labelled on the client detail page and will render (unlabelled-but-not-broken) on
  `/admin/audit`.

### Shared with the public/customer site — explicit check, including the KNOWN TRAP

```
grep -rn "sendReviewRequestEmail|review_email|ReminderResendForm|sendManualBookingReminder|resendEmail|dispatchResend|RESEND_RATE_LIMIT_SECONDS|canResendBookingEmails" src/app/booking/manage
grep -rn "sendReviewRequestEmail|dispatchResend|resendEmail\(|ReminderResendForm|REVIEW_REQUEST_CLIENT_COOLDOWN" "src/app/(public)"
```
Both return **zero matches**. `src/app/booking/manage/` (the KNOWN TRAP — outside both `(public)` and `admin`)
renders none of item 1's touched symbols. No public or customer-facing surface is affected by item 1.

### Proven NOT affected (what I checked and found clean)

- `src/app/booking/manage/**` — zero references to any item-1 symbol (grep above).
- `src/app/(public)/**` — zero references to any item-1 symbol (grep above).
- `sendTrackedEmail`'s other 17 callers in `notifications.ts` — none call `sendReviewRequestEmail` or touch the
  new cooldown helper; verified by reading the full file (`notifications.ts`, all 1468 lines) — every other
  exported `send*` function is a self-contained booking/staff/enquiry notifier with no shared state with the
  review-email path beyond the generic `sendTrackedEmail`/`recordEmailDeliveryEvent` plumbing, which item 1
  does not modify.
- `email_delivery_events` RLS — both existing and new send paths go through `createSupabaseAdminClient()`
  (service role), so the tightened RLS policy referenced at `actions.ts:164` cannot block either.
- Existing test suites for the two files item 1 edits most heavily: ran
  `npx vitest run src/app/api/cron/__tests__/review-emails.test.ts src/lib/email/__tests__/sendReviewRequestEmail.test.ts`
  → **2 files, 18 tests, all passing**, confirming a clean baseline before any edit. Also ran
  `npx vitest run src/app/admin/emails/__tests__/resendEmail.test.ts src/app/admin/emails/__tests__/sendManualBookingReminder.test.ts src/app/admin/emails/__tests__/emails-data.test.ts src/lib/email/__tests__/pickReviewMessages.test.ts`
  → **4 files, 64 tests, all passing**. Combined item-1-adjacent baseline: **6 files / 82 tests / 0 failures**,
  none of which is in the repo's known baseline-failure list (`admin-access.test.ts` ×2,
  `ManualBookingForm.test.tsx` ×3), so none of this is masked flake.

### Snapshots affected

None found — this codebase's tests are behavioural (mocked Supabase chains + assertion-style), not
snapshot-based, for every file item 1 touches.

---

## 5. Ordering / prerequisites relative to the other 7 items

- **Item 7** (admin theming) explicitly touches `src/app/admin/emails/page.tsx` for its 17 `oklch(...)`
  literals (independently re-counted: `grep -c "oklch(" src/app/admin/emails/page.tsx` → **17**, matching the
  handoff's claim exactly). Item 1 also edits this file (new tab/section + form). **Recommend item 1 lands
  first** (it changes structure/markup, adding new elements) and item 7 lands second (it only retints existing
  `oklch(...)` literals in place) — landing item 7 first and then adding new markup in item 1 risks the new
  markup being written with fresh raw `oklch()` literals that item 7 never re-passes over, defeating item 7's
  purpose. If item 7 must land first for scheduling reasons, item 1's new form/section must use the same
  `var(--admin-*)` token discipline item 7 is establishing, not new literals.
- **Item 8** (travel-charge model) also edits `src/lib/email/notifications.ts`
  (`BOOKING_EMAIL_SELECT`, `getBookingTemplateInput`, `sendBookingCreatedEmails` — plan lines 1123-1125), in a
  different region of the file from item 1's edits (`sendReviewRequestEmail` and new top-of-file exports). No
  logical dependency either direction, but **do not run both items' notifications.ts edits in the same
  uncommitted working tree simultaneously without diffing carefully** — a large multi-hunk file edited by two
  independent plans is exactly the shape of change that produces silent clobbers. Land one, verify, commit (or
  at minimum fully diff-review) before starting the other's edits to this file.
- **Item 8** also references `src/app/admin/audit/format.ts:22-35` for its own new-action-type registration
  question (plan line 1070) — the same file and the same open question item 1 has (§1 finding 5). If both items
  land in the same session, resolve the "do we register `review_email_sent` in format.ts's ACTIONS map"
  question once, consistently, rather than have item 1 and item 8 make opposite calls on the same file.
- No dependency on items 2, 3, 4, 5, 6 — none touch any file item 1 touches (verified by grepping the full plan
  for `notifications.ts`, `review-emails`, `admin/emails/actions.ts`, `admin/emails/page.tsx`, `rbac.ts`,
  `clients/[clientId]`, `audit/format.ts` outside item 1's own block — the only other hits are item 8's, listed
  above, and one item-8 reference to `clients/[clientId]/page.tsx` in an unrelated context (a file list row,
  plan line 563, for a different field) that does not touch the `AUDIT_PHRASING` map item 1 relies on).
- Item 1 has **no Zone-2 component** — no migration, no schema change. It can execute independently of the
  Owner-gated items (4, 8) with no sequencing constraint from that direction.

---

## 6. Tests to add

All in the mocking style already established in this codebase — see §7 for the exact mailer-mock pattern.

### `src/lib/email/__tests__/sendReviewRequestEmail.test.ts` (existing file, 12 tests today — extend, don't replace)

- `"suppresses a send inside the 6-month cooldown window and returns reason: client_recently_asked"` — stub the
  cooldown-lookup query to report the client as recently-asked; assert `sendEmail` (mocked) is never called and
  `review_email_sent_at` is **not** written.
- `"permits a send once the cooldown window has elapsed"` — stub the lookup to report no recent ask; assert a
  normal send happens.
- `"does not write review_email_sent_at when suppressed for cooldown"` — explicit regression guard for the
  plan's named "easiest mistake" (line 104): assert `stub.find("bookings","update")` is empty after a
  cooldown-suppressed call (mirrors the existing `already_sent` test's assertion style at line 251-261).
- `"ignoreClientCooldown bypasses the cooldown but still honours the per-booking sentinel"` — cooldown lookup
  reports recently-asked, `{ ignoreClientCooldown: true }` passed, booking has no prior sentinel → sends;
  separately, same option with an already-`review_email_sent_at`-set booking → still `already_sent`.
- `"classifies a recurring_template_id booking as series"` / `"...a client with 2+ completed bookings as
  returning"` / `"...a client's first completed booking as first_time"` — for the classification helper
  (wherever it lands — plan says "small pure helper", but per §2's finding this needs a batched completed-count
  input, so test the pure classifier function directly with pre-computed counts, and separately test the
  batching query that produces those counts).

### `src/app/api/cron/__tests__/review-emails.test.ts` (existing file, 6 tests today — extend)

- `"counts a cooldown-suppressed candidate into skipped_client_cooldown, not sent"` — mirrors the existing
  `already_sent` test (line 250-271) but with `sendReviewRequestEmail` mocked to return
  `{ sent: false, reason: "client_recently_asked" }`.
- `"calls the cooldown batch helper once per tick regardless of candidate count"` — with 3+ candidates sharing
  overlapping client_ids, assert whatever the batch call surface is (mock and count invocations) is called
  exactly once, not once per candidate. This is the direct test for plan §1.4's core performance requirement.
- `"widens the candidate select to include client_id and recurring_template_id"` — extend the existing filter
  assertion (line 181-186) to check the select projection, not just the `.eq/.is/.gte/.lte/.limit` chain.
- `"records the client class in the audit row's after_state alongside automated: true"` — extend the existing
  audit-row assertion (line 207-247) with the new field.

### New file: `src/app/admin/emails/__tests__/sendManualReviewRequest.test.ts` (new — model on
`sendManualBookingReminder.test.ts`'s mocking shape, **not** on `resendEmail.test.ts`'s scope-check tests,
because — verified — `resendEmail.test.ts` does **not** actually exercise the `failed_resend_attempt` /
`recordOperationalEvent` path with a real assertion on the recorded event; its Therapist-no-assignment tests
(lines 243-256) only assert the return value, not the operational-event write. There is no existing precedent
test asserting the operational-event *content* to copy from — write it from the source, per RECON's own
guard.)

- `"refuses without resend_booking_emails permission"`.
- `"refuses an unassigned Therapist-class actor and records a failed_resend_attempt operational event"` —
  assert both the refusal **and** the actual `recordOperationalEvent` call args (event type, severity, booking
  id, staff id) — this is the gap the existing `resendEmail.test.ts` leaves uncovered.
- `"allows an assigned Therapist-class actor"`.
- `"bypasses the 6-month client cooldown (ignoreClientCooldown: true) but still respects the per-booking
  sentinel"`.
- `"respects RESEND_RATE_LIMIT_SECONDS"` if the new action reuses that same recent-send check (plan line 144
  says it does).
- `"writes an audit row with automated: false"`.
- `"only offers/accepts completed bookings with a recipient address"` (either at the action level, or as a
  page-level test if the eligibility filter lives server-side in the new `emails-data.ts` query — name it
  consistently with wherever that logic actually lands).

### `src/app/admin/emails/__tests__/emails-data.test.ts` (existing file — extend if a new export lands here per §4)

- A test for whatever new query/export surfaces completed, recipient-present, not-yet-cooled-down bookings for
  the manual-send UI — mirroring the existing `remindersPromise` tests' structure in this file.

---

## 7. THE HIGHEST RISK — how tests mock the mailer in this repo, and what must never run

Two established, layered mocking points, both confirmed live and in use today; a new test must use one of them
correctly and never fall through to a real network call:

1. **At the transport layer** (`src/lib/email/client.ts`), for tests that exercise `notifications.ts`'s own
   logic (e.g. `sendReviewRequestEmail.test.ts`):
   ```ts
   vi.mock("@/lib/email/client", () => ({
     sendEmail: vi.fn(),
     getFromEmail: vi.fn(() => "Rahma Therapy <no-reply@rahmatherapy.example.test>"),
     extractEmailAddress: vi.fn((value: string) => value),
   }));
   // then in beforeEach: vi.mocked(sendEmail).mockResolvedValue({ id: "resend-stub-id" } as never);
   ```
   `sendEmail` in `client.ts` is a thin, unconditional wrapper over the real `Resend` SDK
   (`resend.emails.send(...)`) — **there is no environment guard, no test-mode short-circuit, and no domain
   allowlist in the source.** If `RESEND_API_KEY` is set (it is, in this environment's `.env`, per the
   handoff), an unmocked call sends a real email through the Owner's real Resend account. This mock is the
   *only* thing standing between a test and a live send when testing at the `notifications.ts` layer.

2. **At the `notifications.ts` module boundary**, for tests that exercise callers one layer up (cron route,
   server actions):
   ```ts
   vi.mock("@/lib/email/notifications", () => ({
     sendReviewRequestEmail: vi.fn(),
     // ...every other notifications.ts export the file under test imports, or the mock factory
     // returns `undefined` for unlisted exports and any accidental call to a real one throws
     // "X is not a function" rather than sending mail — which is itself a safe failure mode.
   }));
   ```
   Confirmed live in `review-emails.test.ts:15-17` (mocks only `sendReviewRequestEmail`) and
   `sendManualBookingReminder.test.ts:33-41` / `resendEmail.test.ts:42-50` (mock the full set of `send*`
   exports those files call). **The new manual-send action's test must add `sendReviewRequestEmail` to this
   mock list** — the existing `sendManualBookingReminder.test.ts` mock object does not include it (it doesn't
   need to today), and copy-pasting that mock object without adding the new import is the most likely way this
   item accidentally lets a real send through in CI.

**What an implementer must never run, in this environment, for this item:**
- `curl` / any manual HTTP call to `POST /api/cron/review-emails` against the Owner's dev server, with or
  without the correct `X-Cron-Secret` — this is the real handler, backed by the real `RESEND_API_KEY`, and it
  would iterate real `completed` bookings if any exist in the 2h–7d window.
- Clicking the new manual-send button in the actual admin UI at `localhost:3000` during development/verification.
- Any integration/e2e test (Playwright) that exercises this flow without an equivalent mailer mock or a
  network-level block — none is proposed by this item, and none should be added, per the plan's rule 2
  ("No live sends... every test mocks the mailer").
- Any recipient address outside `*.example.test` in a fixture — an absolute stop per the binding rules (line
  43 of the plan).

**Post-hoc verification the plan's §1.8 already specifies and I confirm is sufficient:** a SELECT-only count on
`email_delivery_events` for the run window, filtered to `event_type = 'review_request_client'`, comparing before
and after the test/verification session. Given the live table currently has exactly **1** row of this type
(SQL above), any implementer running this check has an unusually clean, low-noise baseline to compare against —
a second row appearing here during a "test" session is unambiguous.

---

## 8. Stop conditions

- If `getClientsAskedForReviewSince`'s query returns a materially different result than expected against a
  quick manual spot-check (e.g. a client who should be inside the cooldown window comes back as eligible) —
  stop and re-derive the query rather than loosen the filter to "make it pass."
  a real send).
- If the new manual-send eligibility query (whatever form it takes) would return more than a handful of rows
  live in this database — the business has 12 real bookings total (per handoff §6); a query returning dozens
  of "completed, no review sent, eligible" bookings signals a logic error (e.g. an unbounded date range or a
  missing `contact_email`/`clients.email` filter), not real data volume.
- If implementing the UI placement literally as plan line 146 describes turns out to require reusing
  `upcomingBookings`/`reminderBookings` rather than a new query — stop; that would mean the eligibility rules
  (`completed` status) are being silently dropped to make the existing list "work," which is exactly the kind
  of scope-creep-via-shortcut rule 9 (plan line 50) warns against.
- If any test file under `src/app/admin/emails/__tests__/` or `src/lib/email/__tests__/` needs to remove or
  weaken an existing `vi.mock("@/lib/email/client", ...)` / `vi.mock("@/lib/email/notifications", ...)` block to
  make a new test pass — stop immediately. That is the one guard standing between the test suite and a real
  send.
- If `sendManualBookingReminder` (`actions.ts:31-97`) or the `ReminderResendForm.tsx` hidden `booking_id` input
  contract (lines 17-19, 85, 100) need to change to accommodate the new sibling action — stop; both are
  RECON-untouchable. Mirror the pattern in a new function/component instead.

## 9. Rollback

- No migrations, no schema changes — item 1 is pure application code (route handler, library function, server
  action, two React components) plus tests. Rollback is `git revert` of the relevant commit(s); no data
  migration or backfill exists to unwind.
- The one piece of state item 1 writes that outlives a single request is `bookings.review_email_sent_at`
  (already-existing column, unchanged write shape) and new `audit_logs` rows (`action_type: "review_email_sent"`,
  `after_state.automated: false` for manual sends) — both purely additive audit trail, nothing to roll back
  destructively; an incorrect manual send's only real-world consequence is one outbound email, which is exactly
  why rule 2 makes it the highest-risk item to test carefully rather than something needing a DB rollback plan.
- If the cooldown logic ships with a bug that over-suppresses (silently drops legitimate review requests): no
  rollback needed beyond a code fix and redeploy — no customer harm, mirrors current (worse) behaviour of asking
  too often, not too rarely.
- If the cooldown logic ships with a bug that under-suppresses (a client asked twice within 6 months): the
  guard is a soft business-logic guard, not a uniqueness constraint — no corrupted state, only a customer
  receiving one extra courteous email. Fix forward.
