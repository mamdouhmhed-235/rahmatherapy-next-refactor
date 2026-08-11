## ITEM 1 — Review-request email frequency, manual override, and client type

### 1.1 The problem, precisely

`src/app/api/cron/review-emails/route.ts` selects candidates as:

```
status = 'completed'  AND  review_email_sent_at IS NULL
AND completed_at BETWEEN (now - 7 days) AND (now - 2 hours)
```

There is **no per-client frequency rule anywhere on this path**. The sentinel `review_email_sent_at` lives on the **booking**, not the client and not the series template. A client on a weekly standing series therefore generates one review request per completed visit, **indefinitely**.

Verified: `bookings` has `client_id`, `recurring_template_id`, `review_email_sent_at`, `completed_at`. `clients` has **no** review-tracking column.

### 1.2 Design decision — derive the cap, do not add a column

**Do NOT add a `last_review_email_at` column to `clients`.** That would be a migration (Zone-2), and it would create a second source of truth that can drift from the delivery log.

The data already exists. `email_delivery_events` records `booking_id`, `event_type`, `delivery_status`, `created_at`, and every review send writes one via `sendTrackedEmail` with `event_type = 'review_request_client'`. Joining through `bookings.client_id` answers "when did we last actually ask this client?" exactly.

**Why the delivery log and not `bookings.review_email_sent_at`:** that column is *also* written as a "handled" sentinel when a booking has no email address (`sendReviewRequestEmail`'s `no_email` branch writes the timestamp without sending). Deriving the cap from it would mean a client who had no email on file in March is wrongly suppressed in June once they add one. The delivery log has no such false positive.

### 1.3 Success statuses — derive from the schema, not from `format.ts`

**Do not treat `src/app/admin/emails/format.ts`'s `DELIVERY_STATUSES` constant (currently `format.ts:31-39`) as a source of truth for this filter.** It lists `accepted, delivered, opened, clicked, bounced, failed, complained` — none of `delivered/opened/clicked/bounced/complained` is ever written anywhere in this repo (there is no Resend webhook handler), and the list is missing 4 of the 7 values the database actually permits. It sits next to a comment claiming lineage from `notifications.ts`, which makes it look authoritative for delivery status; it isn't.

The authoritative set is the live `email_delivery_events_delivery_status_check` CHECK constraint: `accepted, failed, skipped, queued, sent, cancelled_by_restore, cancelled_manual` (7 values). Of those, `sendTrackedEmail` itself (symbol `sendTrackedEmail`, currently `notifications.ts:473-584` — RELOCATE BY SYMBOL) only ever writes 4: `skipped` (no recipient), `queued` (delayed send), `accepted` (immediate success), `failed` (immediate failure). The other 3 are written by unrelated callers — a scheduled-emails cron flips `queued` → `sent`, and booking-restore/cancel sweeps write `cancelled_by_restore` / `cancelled_manual` — and are structurally unreachable from the review-request path.

Narrower still: `sendReviewRequestEmail`'s call to `sendTrackedEmail` never passes `delaySeconds`, so `queued`/`sent`/`cancelled_*` cannot occur for `event_type = 'review_request_client'` at all, and `sendReviewRequestEmail` already short-circuits on `no_email` *before* ever calling `sendTrackedEmail`, so `skipped` should also be structurally unreachable for this event type (defence-in-depth only — don't rely on that without confirming it against the actual code at implementation time). **The cooldown filter should treat only `delivery_status = 'accepted'` as "asked."** Live data corroborates this: every row in `email_delivery_events` today (43/43) is `accepted`, and exactly 1 of those is `event_type = 'review_request_client'`.

### 1.4 Where the guard lives

Put the guard in **`sendReviewRequestEmail`** (symbol `sendReviewRequestEmail`, currently `src/lib/email/notifications.ts:1356-1444` — RELOCATE BY SYMBOL), not only in the cron. Reason: it then protects *every* caller, including §1.7's new manual path and anything added later. A guard that lives only in the cron is one new caller away from being bypassed.

Add:

- An exported constant, e.g. `REVIEW_REQUEST_CLIENT_COOLDOWN_MONTHS = 6`, so tests and callers reference one value.
- A reusable helper, e.g. `getClientsAskedForReviewSince(clientIds: string[], since: string, supabase): Promise<Set<string>>`. `email_delivery_events.booking_id → bookings.id` is a real FK, so this can be a single PostgREST embedded-filter query — e.g. `.from("email_delivery_events").select("bookings!inner(client_id)").eq("event_type","review_request_client").eq("delivery_status","accepted").gte("created_at", since).in("bookings.client_id", clientIds)` — not an N-query-per-client loop.
- A new early-return reason on `sendReviewRequestEmail`: `"client_recently_asked"`, alongside the existing `no_email` / `already_sent` / `send_failed`.
- An options parameter, `{ ignoreClientCooldown?: boolean }`, defaulting to **false**. Only the manual admin action passes `true`.

**Do NOT write the `review_email_sent_at` sentinel when suppressing for cooldown.** The booking has not been handled — it has been *skipped for now*. Writing the sentinel would permanently retire a booking that a later manual send might legitimately want. This is the single easiest mistake to make in this item.

### 1.5 Performance — batch in the cron, guard per-booking

The cron takes up to 50 candidates per tick. Do **not** issue two extra queries per candidate.

In `route.ts` (POST handler, currently `route.ts:67-`; candidate query currently `:107-114`), after fetching candidates (widen the `.select("id")` to include `client_id` and `recurring_template_id`):

1. Collect the distinct `client_id`s.
2. Call the cooldown batch helper **once** to get the set of recently-asked clients.
3. Call the classification batch query (§1.6) **once**, alongside it — not per candidate.
4. Filter cooldown-suppressed candidates out, counting them into a new summary field `skipped_client_cooldown`.
5. Call `sendReviewRequestEmail` only for survivors — where its own per-booking guard is a cheap re-check, not a duplicate cost.

**This one-query-per-tick rule binds both the cooldown lookup and §1.6's classification count equally.** They are two different questions answered from the same shape of data (a per-client aggregate over `completed` bookings / delivery events), and an implementer who batches the cooldown correctly but then reaches for a per-candidate `count()` call for classification has reintroduced the exact N+1 this section forbids, just in the sibling feature.

Add `skipped_client_cooldown` to `ReviewEmailSummary` (currently `route.ts:30-37`) and `emptySummary()` (currently `route.ts:39-48`). The summary is the operator's only window into this cron; a silent skip is the failure mode this codebase keeps producing.

### 1.6 Repeat vs one-off clients

Classify each candidate with a small, pure, unit-testable helper:

| Class | Test |
|---|---|
| `series` | the booking has `recurring_template_id IS NOT NULL` |
| `returning` | not a series booking, and the client has ≥2 completed bookings |
| `first_time` | not a series booking, and the client has exactly 1 completed booking |

**Boundary rule, made explicit (this was unspecified in the prior draft and is easy to get off by one):** the completed-booking count used for `returning` vs `first_time` is **inclusive of the candidate booking itself**. By the time the cron reads a candidate, that booking's own `status` is already `completed` — it is one of the rows any `count(*) WHERE client_id = ? AND status = 'completed'` would return. So a client having their very first completed visit gets count `1` → `first_time`; a client having their second gets count `2` → `returning`. Do not subtract the candidate before comparing, and do not write two different counting conventions in the classifier vs. the batching query — one convention, applied consistently.

Compute this count in the **same batched query** as §1.5's cooldown lookup (one `GROUP BY client_id` count query per tick, not one per candidate) — see §1.5's amended rule.

**Note that the 6-month cap already solves the "every week forever" problem on its own** — the `series` class does not need a second, stricter rule. Its value is (a) making the behaviour visible and (b) enabling copy variation.

Record the class in the audit metadata the cron already writes (`after_state`, alongside `automated: true`, currently `route.ts:131-140`), so the audit trail answers "why did/didn't this client get asked?" without re-deriving it.

**Step 1e — OPTIONAL, Owner's call, implement only if the Owner says yes.** Vary the email copy by class — a standing client should not read the same "we hope you enjoyed your first visit" line as a newcomer. The natural seam already exists: `pickReviewMessages({ groupCategory, city, overrides })` inside `sendReviewRequestEmail`. **Do not change customer-facing copy without explicit approval** — the template also has admin-editable overrides (`resolveTemplateOverrides`) whose interaction must be preserved.

### 1.7 The manual admin send

**None exists today.** `dispatchResend` in `src/app/admin/emails/actions.ts` has no `review_request_client` case, so even the existing resend feature cannot send one.

Mirror the established pattern exactly:

- **Server action:** a new sibling of `sendManualBookingReminder` in `src/app/admin/emails/actions.ts`. **Do not modify `sendManualBookingReminder` itself — it is RECON-untouchable.** Copy its idiom: `getStaffProfile()` first, then `createSupabaseAdminClient()`.
- **Permission:** `canResendBookingEmails(profile)` (`src/lib/auth/rbac.ts:221`, permission `resend_booking_emails`). Live DB confirms this permission is held by exactly `{Owner, Admin, Booking Coordinator, Therapist}`.
- **⚠️ Scope check — do not skip this. Corrected: the function to mirror is `resendEmail`, not `resendDeliveryEvent` — the latter does not exist anywhere in this codebase.** `resendEmail` is exported from `src/app/admin/emails/actions.ts:120`; its H11 middle-path scope check runs at roughly `:159-201` (RELOCATE BY SYMBOL, don't trust these numbers past today). The permission is flat and has no concept of *which* booking, so: if the actor lacks `canViewAllBookings`/`canManageAllBookings`, confirm they hold a `booking_assignments` row for that booking, and on failure record a `failed_resend_attempt` operational event exactly as `resendEmail` does (event type, severity `"warning"`, `bookingId`, `staffId`, a `safeContext` object). **Without this, a Therapist could trigger customer email for any booking in the clinic.**
- **Rate limit:** reuse the same `RESEND_RATE_LIMIT_SECONDS` (currently `actions.ts:101`, value `60`) recent-send check already in that file.
- **Quiet hours — decided, state it explicitly rather than leaving it a silent asymmetry.** The cron's quiet-hours guard (`isQuietHourLondon`, currently `route.ts:55-65`, window 21:00–08:00 Europe/London) lives only in the cron route, before any DB work; `sendReviewRequestEmail` itself has no quiet-hours logic. **The manual send is therefore not subject to quiet hours, by design:** a human actively choosing to send right now is overriding the automated night-suppression heuristic, the same way `resendEmail`'s existing manual resend path has no quiet-hours check either. Say this in the action's own comment so a future reader doesn't "fix" it as a bug.
- **Semantics:** the manual send bypasses the **6-month client cooldown** (`ignoreClientCooldown: true`) but still respects the **per-booking `review_email_sent_at` sentinel** — one review request per booking. If the Owner later wants a true duplicate for the same booking, the coherent route is adding a `review_request_client` case to `dispatchResend`, which is a few lines in an existing switch. Note it; do not build it unasked.
- **UI — corrected placement.** The plan previously said "place it beside `ReminderResendForm` on `/admin/emails` (`page.tsx:925`)... Only offer it for `completed` bookings." That is not literally buildable: the row `ReminderResendForm` renders inside is fed by `remindersPromise` (`src/app/admin/emails/emails-data.ts`, currently `:175-197`), which queries `.in("status", ["pending","confirmed"]).gte("booking_date", businessDate)` — upcoming, not-yet-happened bookings only. A `completed` booking can never appear there. **Corrected instruction:** add a new export to `emails-data.ts`, sibling to `getEmailsPageData`/`remindersPromise`, for completed bookings with a recipient address and no `review_email_sent_at`, using the same `unstable_cache` + `createSupabaseAdminClient()` pattern already established at `emails-data.ts:142-197`. Surface it either as a new subsection within the existing Reminders tab or as a new tab — if a new tab, wire `TabKey` (currently `page.tsx:78`) and `resolveTab` (currently `:80-88`) and the tabs array (currently roughly `:263-291`). Only render the control for rows the new query returns (which is already the `completed` + recipient-present filter — don't re-derive eligibility in the component).
- **Audit:** write an audit row with `automated: false`, distinguishing it from the cron's `automated: true`. The `review_email_sent` action type already exists and is labelled on the client detail page's local map (`src/app/admin/clients/[clientId]/page.tsx:222`) — reuse it, don't invent a new one. See §1.8 for the separate, previously-unaddressed question of whether it's also registered in the *global* audit timeline.

### 1.8 Files

| File | Change |
|---|---|
| `src/lib/email/notifications.ts` | cooldown constant, batch helper, classifier, guard + `ignoreClientCooldown` option, new reason. Symbol `sendReviewRequestEmail` is the edit anchor. |
| `src/app/api/cron/review-emails/route.ts` | batched pre-filter (cooldown + classification, one query each), widened select, `skipped_client_cooldown` in the summary, class in audit metadata |
| `src/app/admin/emails/actions.ts` | **new sibling action** (do not edit `sendManualBookingReminder`); mirror `resendEmail`'s scope-check pattern, not edit it |
| `src/app/admin/emails/emails-data.ts` | **new export** — completed, recipient-present, not-yet-cooled-down bookings for the manual-send UI. Not in the original plan's file list; required by the UI correction in §1.7. |
| `src/app/admin/emails/page.tsx` | new tab entry or new subsection wiring, plus the manual-send form's placement |
| a new form component, sibling to `ReminderResendForm.tsx` | the manual control |
| `src/app/admin/audit/format.ts` | **register `review_email_sent`** in the `ACTIONS` map (currently `:22-98`), mirroring the existing `manual_booking_reminder_sent: { phrase: "sent a booking reminder", family: "operations_and_email", chip: "pending" }` entry's shape. Decided here because item 1 doubles the write sites for this action type (cron + manual) and item 8 raises the identical open question independently for its own action types — resolve it once, here, rather than twice, inconsistently. |
| tests alongside each | see §1.11 |

### 1.9 Blast radius

**Callers / consumers of everything touched:**

- `sendReviewRequestEmail` — one production caller today (`route.ts:125`). Item 1 adds a second (the new manual action). No other file calls it.
- `sendTrackedEmail` — used by roughly 18 call sites across `notifications.ts`. Item 1 does not change its signature or behaviour, only adds a caller-side guard *before* it's reached, for the review-email path specifically. Every other caller is unaffected.
- `dispatchResend` / `resendEmail` — untouched by item 1 (per §1.7's explicit decision not to add a `review_request_client` case unasked). No edit to either is required for item 1 to work.
- `canResendBookingEmails` — already consumed by `sendManualBookingReminder`, `resendEmail`, `emails-data.ts`'s reminders gate, and `page.tsx`'s own `canResend` gate. The new manual action reuses it; nothing else needs registering.
- `ACTIONS` map in `src/app/admin/audit/format.ts` — see §1.8; the client-detail page's own `AUDIT_PHRASING` map is unaffected and stays correct either way.

**Proven NOT affected — what was checked, and the command used:**

```
grep -rn "sendReviewRequestEmail|review_email|ReminderResendForm|sendManualBookingReminder|resendEmail|dispatchResend|RESEND_RATE_LIMIT_SECONDS|canResendBookingEmails" src/app/booking/manage
grep -rn "sendReviewRequestEmail|dispatchResend|resendEmail\(|ReminderResendForm|REVIEW_REQUEST_CLIENT_COOLDOWN" "src/app/(public)"
```
Both return **zero matches**. `src/app/booking/manage/` — the route that sits outside both `(public)` and `admin`, easy to forget — renders none of item 1's touched symbols. No public or customer-facing surface is affected.

- `sendTrackedEmail`'s other ~17 callers in `notifications.ts` — none call `sendReviewRequestEmail` or the new cooldown helper (confirmed by reading the full file); every other exported `send*` function is a self-contained notifier sharing only the generic `sendTrackedEmail` plumbing, which item 1 does not modify.
- `email_delivery_events` RLS — both the existing cron path and the new manual path go through `createSupabaseAdminClient()` (service role), so the tightened RLS policy referenced at `actions.ts:164` cannot block either.
- Baseline test health before any edit: `npx vitest run src/app/api/cron/__tests__/review-emails.test.ts src/lib/email/__tests__/sendReviewRequestEmail.test.ts` → 2 files, 18 tests (12 + 6, independently counted), all passing. `npx vitest run src/app/admin/emails/__tests__/resendEmail.test.ts src/app/admin/emails/__tests__/sendManualBookingReminder.test.ts src/app/admin/emails/__tests__/emails-data.test.ts src/lib/email/__tests__/pickReviewMessages.test.ts` → 4 files, 64 tests, all passing. Neither set overlaps the repo's known baseline failures (`admin-access.test.ts` ×2, `ManualBookingForm.test.tsx` ×3), so none of this is masked flake.

**Snapshots:** none. This codebase's tests are behavioural (mocked Supabase chains + assertions), not snapshot-based, for every file item 1 touches.

### 1.10 Ordering / prerequisites relative to the other items

- **Item 7** (admin theming) touches `src/app/admin/emails/page.tsx` for its raw `oklch(...)` literals — 17 lines / **29 occurrences** (standardised on occurrences per the handoff's counting note). Item 1 also edits this file (new tab/section + form). **Item 1 should land first** (it adds structure/markup) and item 7 second (it only retints existing literals in place) — landing item 7 first, then adding new markup for item 1, risks that new markup shipping with fresh raw `oklch()` literals item 7 never revisits. If item 7 must land first for scheduling reasons, item 1's new form/section must use item 7's `var(--admin-*)` token discipline from the start, not new literals.
- **Item 8** also edits `src/lib/email/notifications.ts` (`BOOKING_EMAIL_SELECT`, `getBookingTemplateInput`, `sendBookingCreatedEmails`), in a different region of the file from item 1's edits (`sendReviewRequestEmail` and new top-of-file exports). No logical dependency either direction, but do not run both items' `notifications.ts` edits in the same uncommitted working tree without diffing carefully — land one, verify, commit (or at minimum fully diff-review) before starting the other's edits to this file.
- **Item 8** also touches `src/app/admin/audit/format.ts:22-35`'s new-action-type registration question. §1.8 resolves this for `review_email_sent` — register it. Item 8 should follow the same precedent for its own new action types rather than making an independent call on the same file.
- No dependency on items 2, 3, 4, 5, 6 — none touch any file item 1 touches.
- Item 1 has **no Zone-2 component** — no migration, no schema change. It can execute independently of the Owner-gated items (4, 8) with no sequencing constraint from that direction; the only sequencing constraints are the file collisions above.

### 1.11 Verification — exact commands, per batch

**Batch A — `notifications.ts` + `route.ts` (cooldown, classification, guard):**
```
npx vitest run src/lib/email/__tests__/sendReviewRequestEmail.test.ts src/app/api/cron/__tests__/review-emails.test.ts
```
Before: 2 files / 18 tests passing (12 + 6). **MUST move:** total passing count rises to 2 files / 27 tests (12 + 5 new in `sendReviewRequestEmail.test.ts`, 6 + 4 new in `review-emails.test.ts`, per §1.12), all passing. **MUST NOT move:** 0 failures in either file.
```
npx tsc --noEmit
```
**MUST NOT move:** exit 0, silent, ~5s — same identity as baseline.

**Batch B — `actions.ts` + `emails-data.ts` + `page.tsx` + new form:**
```
npx vitest run src/app/admin/emails/__tests__/resendEmail.test.ts src/app/admin/emails/__tests__/sendManualBookingReminder.test.ts src/app/admin/emails/__tests__/emails-data.test.ts src/lib/email/__tests__/pickReviewMessages.test.ts src/app/admin/emails/__tests__/sendManualReviewRequest.test.ts
```
Before: 4 files / 64 tests. **MUST move:** file count to 5 (new `sendManualReviewRequest.test.ts` added), and `emails-data.test.ts`'s count rises by however many tests §1.12 adds there. **MUST NOT move:** `resendEmail.test.ts`, `sendManualBookingReminder.test.ts`, and `pickReviewMessages.test.ts` individual pass counts — item 1 does not edit `sendManualBookingReminder` (RECON-untouchable) or `pickReviewMessages`, and only reads `resendEmail`'s pattern without editing it, so these three files' test counts and pass status must be byte-identical to baseline.

**Full-suite gate (run once, at the end of item 1):**
```
npx vitest run
```
**MUST move:** total passed count increases by exactly the number of new tests added in §1.12 (no more, no fewer — a smaller increase means a test silently didn't get added or is failing/skipped; a larger increase means something unrelated changed). **MUST NOT move:** the 5 documented baseline failures (`admin-access.test.ts` ×2 named tests, `ManualBookingForm.test.tsx` ×3 named tests) stay exactly those 5 (or 6 under full-suite load, the documented flake) — no new failures anywhere, and none of the existing 5/6 should disappear either (a baseline failure vanishing without item 1 having touched that file is itself suspicious and should be reported, not silently accepted as a bonus).
```
pnpm lint
```
**MUST NOT move:** the six-file lint identity (multiset of `{file, ruleId}` — not `file:line:column`, per the standing counting rule). None of item 1's touched or new files (`notifications.ts`, `route.ts`, `actions.ts`, `emails-data.ts`, `page.tsx`, the new form component, the new test files) is in that six-file set today, and none should appear in it afterward. A new lint error in a previously-clean file is a regression item 1 introduced, not baseline noise — stop and fix it, don't fold it into the identity.
```
git status --porcelain -- src/ supabase/
```
Before: exactly `" M src/lib/maintenance.ts"`. After item 1's edits (uncommitted): that line unchanged, plus `M` on the five touched files above and untracked/added entries for the new form component and new test files. **`maintenance.ts`'s line must be present, unchanged, and touched by nothing item 1 does.**
```sql
SELECT count(*) FROM email_delivery_events WHERE event_type = 'review_request_client';
```
Before any verification work: **1**. **MUST NOT move at any point during this item's implementation or test runs.** This is the one number in this whole item that must never change by accident — a change means a real email went out.

### 1.12 Tests to add

All follow this repo's established mailer-mock discipline (§1.13) — mock at `@/lib/email/client` for tests exercising `notifications.ts` directly, and mock `@/lib/email/notifications`'s exports for tests exercising callers one layer up.

**`src/lib/email/__tests__/sendReviewRequestEmail.test.ts`** (existing file, 12 tests today — extend):
- `it("suppresses a send inside the 6-month cooldown window and returns reason: client_recently_asked")`
- `it("permits a send once the cooldown window has elapsed")`
- `it("does not write review_email_sent_at when suppressed for cooldown")` — explicit regression guard for the named "easiest mistake" in §1.4; mirror the existing `already_sent` test's assertion style.
- `it("ignoreClientCooldown bypasses the cooldown but still honours the per-booking sentinel")` — two sub-cases: bypass sends when no prior sentinel exists; bypass still returns `already_sent` when the sentinel is already set.
- `it("classifies as series when recurring_template_id is set, regardless of completed-booking count")`
- `it("classifies as first_time when the client's completed-booking count, including this booking, is 1")`
- `it("classifies as returning when the client's completed-booking count, including this booking, is 2 or more")`

**`src/app/api/cron/__tests__/review-emails.test.ts`** (existing file, 6 tests today — extend):
- `it("counts a cooldown-suppressed candidate into skipped_client_cooldown, not sent")` — mirror the existing `already_sent` test, with `sendReviewRequestEmail` mocked to return `{ sent: false, reason: "client_recently_asked" }`.
- `it("calls the cooldown batch helper once per tick regardless of candidate count")` — 3+ candidates sharing overlapping `client_id`s; assert the batch call is invoked exactly once.
- `it("computes the classification count in the same batched query as the cooldown lookup, not once per candidate")` — direct test of §1.5's amended batching rule.
- `it("widens the candidate select to include client_id and recurring_template_id")` — extend the existing filter-chain assertion to check the select projection too.
- `it("records the client class in the audit row's after_state alongside automated: true")` — extend the existing audit-row assertion.

**New file: `src/app/admin/emails/__tests__/sendManualReviewRequest.test.ts`** (model the mocking shape on `sendManualBookingReminder.test.ts`, not on `resendEmail.test.ts`'s scope-check tests — see the correction below):
- `it("refuses without resend_booking_emails permission")`
- `it("refuses an unassigned Therapist-class actor and records a failed_resend_attempt operational event with the booking id and staff id")` — assert both the refusal **and** the actual `recordOperationalEvent` call arguments (event type, severity, `bookingId`, `staffId`). **Corrected note:** the prior draft claimed no precedent test asserts the operational-event write at all; that's wrong — `resendEmail.test.ts`'s Therapist-no-assignment test (around `:243-256`) does assert `stub.inserts.some(i => i.table === "operational_events")` is `true`. What's actually missing from that precedent is an assertion on the event's *content* (type/severity/ids), not its existence — this new test is what fills that specific gap, not a from-scratch gap.
- `it("allows an assigned Therapist-class actor")`
- `it("bypasses the 6-month client cooldown (ignoreClientCooldown: true) but still respects the per-booking review_email_sent_at sentinel")`
- `it("respects RESEND_RATE_LIMIT_SECONDS")`
- `it("writes an audit row with automated: false")`
- `it("is not subject to the cron's quiet-hours guard")` — regression guard for the §1.7 decision; assert a send proceeds regardless of mocked "now" time.

**`src/app/admin/emails/__tests__/emails-data.test.ts`** (existing file — extend):
- `it("returns completed bookings with a recipient and no review_email_sent_at, for the manual review-send list")` — mirror the existing `remindersPromise` tests' structure; name the new export consistently and use that exact name here, in `page.tsx`, and in the new form component.

**`src/app/admin/audit/__tests__/format.test.ts`** (existing file — extend):
- `it("labels review_email_sent instead of falling back to the generic operations_and_email phrase")` — regression guard for §1.8's registration decision.

### 1.13 THE HIGHEST RISK — how tests mock the mailer, and what must never run

Two established, layered mocking points; a new test must use one of them correctly and never fall through to a real network call:

1. **At the transport layer** (`src/lib/email/client.ts`), for tests exercising `notifications.ts`'s own logic:
   ```ts
   vi.mock("@/lib/email/client", () => ({
     sendEmail: vi.fn(),
     getFromEmail: vi.fn(() => "Rahma Therapy <no-reply@rahmatherapy.example.test>"),
     extractEmailAddress: vi.fn((value: string) => value),
   }));
   // beforeEach: vi.mocked(sendEmail).mockResolvedValue({ id: "resend-stub-id" } as never);
   ```
   `sendEmail` in `client.ts` is a thin, unconditional wrapper over the real Resend SDK — **no environment guard, no test-mode short-circuit, no domain allowlist in the source.** If `RESEND_API_KEY` is set (it is, in this environment), an unmocked call sends a real email through the Owner's real Resend account.

2. **At the `notifications.ts` module boundary**, for tests exercising callers one layer up (cron route, server actions):
   ```ts
   vi.mock("@/lib/email/notifications", () => ({
     sendReviewRequestEmail: vi.fn(),
     // every other notifications.ts export the file under test imports
   }));
   ```
   **The new manual-send action's test must add `sendReviewRequestEmail` to this mock list.** `sendManualBookingReminder.test.ts`'s existing mock object does not include it (it doesn't need to today) — copy-pasting that mock without adding this import is the most likely way this item accidentally lets a real send through in CI.

**What must never run, in this environment, for this item:**
- Any manual HTTP call to `POST /api/cron/review-emails` against the Owner's dev server — real handler, real `RESEND_API_KEY`.
- Clicking the new manual-send button in the actual admin UI at `localhost:3000` during development or verification.
- Any e2e/Playwright test exercising this flow without an equivalent mailer mock — none is proposed here, and none should be added, per the binding rule "every test mocks the mailer."
- Any recipient address outside `*.example.test` in a fixture.

**Post-hoc check:** the `email_delivery_events` SELECT-only count in §1.11 (before/after, filtered to `event_type = 'review_request_client'`) is sufficient given the live table's current single row of that type — a second row appearing during a "test" session is unambiguous.

### 1.14 Stop conditions

1. If `getClientsAskedForReviewSince` returns a materially different result than a quick manual spot-check expects (e.g. a client who should be inside the cooldown window comes back as eligible) — stop and re-derive the query; do not loosen the filter to make a test pass.
2. If the new manual-send eligibility query returns more than a handful of rows against the live database (15 bookings total today) — a query returning dozens of "completed, no review sent, eligible" rows signals a logic error (unbounded date range, missing recipient filter), not real data volume. Stop and re-check the query.
3. If any test needs to remove or weaken an existing `vi.mock("@/lib/email/client", ...)` or `vi.mock("@/lib/email/notifications", ...)` block to pass — stop immediately. That mock is the only thing standing between the suite and a real send.
4. If `sendManualBookingReminder` (`actions.ts`) or the `ReminderResendForm.tsx` hidden `booking_id` input contract need to change to accommodate the new sibling action or the new UI — stop; both are RECON-untouchable. Mirror the pattern in new code instead.
5. If building the manual-send UI as a genuinely new tab (rather than a subsection of Reminders) turns out to require more than wiring `TabKey`/`resolveTab`/the tabs array — e.g. it would require restructuring how `searchParams` flow through the page — stop and report; that is scope beyond what this item authorizes.
6. If registering `review_email_sent` in `audit/format.ts`'s `ACTIONS` map conflicts with a choice item 8 has already made for the same file in a concurrently-running session — stop and reconcile rather than let the two edits fight.

### 1.15 Rollback

No migrations, no schema changes — item 1 is pure application code (route handler, library function, server action, new React components) plus tests. Rollback is `git revert` of the relevant commit(s); nothing to unwind at the data layer.

The only state item 1 writes that outlives a single request is `bookings.review_email_sent_at` (existing column, unchanged write shape) and new `audit_logs` rows (`action_type: "review_email_sent"`, `after_state.automated: false` for manual sends) — both purely additive audit trail, nothing to roll back destructively. An incorrect manual send's only real-world consequence is one outbound email — which is exactly why §1.13's mailer-mock discipline, not a DB rollback plan, is the real safeguard here.

- A cooldown bug that over-suppresses (drops a legitimate review request): fix forward, no rollback needed — no customer harm, and it mirrors current (worse) behaviour of never suppressing at all, just in the opposite direction.
- A cooldown bug that under-suppresses (a client asked twice within 6 months): the guard is a soft business-logic check, not a uniqueness constraint — no corrupted state, only one extra courteous email. Fix forward.
