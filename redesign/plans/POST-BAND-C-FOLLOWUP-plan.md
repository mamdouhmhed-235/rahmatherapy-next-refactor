# POST-BAND-C FOLLOW-UP — implementation plan

**Written:** 2026-08-10 · **Author:** C-C orchestrator, after Band C closed at 23/23
**Base commit:** `33f895f` on `master`
**Audience:** the agent(s) executing these fixes, and the Owner reviewing them.

Every item below was raised with the Owner after the programme closed, and each one here was **explicitly chosen by the Owner for action**. Items the Owner explicitly declined are listed in §0.2 so nobody re-opens them.

This is a **post-programme plan**. The Band C execution protocol (`redesign/plans/C-phase/C-C-EXECUTION-PROTOCOL.md`) is no longer running as a programme, but its safety rules still bind — they are restated in §1 so this document stands alone.

---

## 0 — Scope

### 0.1 In scope (5 items)

| # | Item | Type | Zone-2? |
|---|---|---|---|
| 1 | Review-request emails: cap at once per client per 6 months, add a manual admin send, and distinguish repeat from one-off clients | Behaviour | No |
| 2 | Privacy policy: stop promising a retention schedule the code does not enforce | Content | No |
| 3 | Override lists: add the missing secondary sort | Correctness | No |
| 4 | `bookings` table: add the indexes it will need before real volume | Migration | **YES** |
| 5 | Bundle measurement: make the existing script able to answer the question | Tooling | No |

### 0.2 Explicitly OUT of scope — do not touch

The Owner declined these. Leave them exactly as they are.

- **The Google Maps cookie label.** It stays `purpose: "essential"` in `src/lib/consent/cookie-registry.ts`. Confirmed by the Owner twice. Do not "correct" it to `functional` — that would make the Functional group's blanket promise false, which is precisely why it is filed as it is.
- **Override list caps counting segment rows instead of distinct dates.** Needs a database view or RPC; deferred. *(See §7 — one line in the Owner's instruction was ambiguous here. Read §7 before assuming.)*
- **SEO:** no `sitemap.ts` / `robots.ts`, and 5 of 6 public pages emit no canonical tag.
- **The `pastShown` / `pastTotal` unit mismatch** in both override managers.
- **Non-atomic global override save**, and the **staff duplicate-date TOCTOU**. Both verified low-severity and disclosed.
- **The `area == city` duplication** on unitary-authority addresses, and the `autoComplete` choice on the booking address field.
- **Automatic data deletion / retention enforcement.** The Owner will handle retention manually — which is exactly why item 2 exists.

---

## 1 — Binding rules for the executing agent

1. **⛔ Zone-2 actions are Owner-approved, orchestrator-performed, and NEVER done by a subagent.** In this plan that means: **item 4's migration only**. Do not call `mcp__supabase__apply_migration`. Do not run any `INSERT` / `UPDATE` / `DELETE` / DDL. `mcp__supabase__execute_sql` is **SELECT-only**, for verification, against project `twzutkfgqclqurvkmvqz`.
2. **⛔ Never send a real email.** Item 1 touches the email system. No live sends, no triggering the cron against production, no admin-UI send. Every test mocks the mailer. Any recipient outside `*.example.test` is an absolute stop. **This is the highest-risk rule in this plan** — item 1's whole subject is an outbound email path.
3. **Never touch `src/lib/maintenance.ts`.** Working copy is `false`, `HEAD` is `true`, deliberately. Never stage it.
4. **Git:** never push. Never `git add .` or `-A`. Never stash/checkout/restore to "clean" the tree — it is intentionally dirty (untracked evidence screenshots and design folders from earlier plans). Stage explicitly by path.
5. **RECON untouchables:** `sendManualBookingReminder` and the `ReminderResendForm` hidden-input contract are marked untouchable. **Mirror them; do not edit them.**
6. **Anchors drift.** Every line number in this document is "at time of writing, `33f895f`". **Re-locate by symbol before editing.** This bit the programme repeatedly.
7. **No `pnpm build`** except where item 5 explicitly requires one.
8. **Baselines are BY IDENTITY, not by count.** See §8.
9. If reality contradicts this plan, **stop and report** — do not improvise around it. Several items below exist precisely because an earlier plan's premise turned out to be false.

---

## 2 — Pre-flight

```bash
git branch --show-current            # master
git log --oneline -1                 # 33f895f or a descendant
git status --porcelain -- src/ supabase/   # only ' M src/lib/maintenance.ts'
```

Dev server is **Owner-run** at `localhost:3000` — never spawn, restart or kill it. Use `localhost`, not `127.0.0.1`.

Record the baseline gates (§8) before touching anything.

---

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

**Success statuses:** live data currently shows only `accepted` for successful sends, and the code treats `skipped` as "no content". **Confirm the full set of values `sendTrackedEmail` can write before authoring the filter** — do not hardcode from the single observed value. An ask counts as "made" only for a status representing a real handoff to the provider.

### 1.3 Where the guard lives

Put the guard in **`sendReviewRequestEmail`** (`src/lib/email/notifications.ts`), not only in the cron. Reason: it then protects *every* caller, including item 1.4's new manual path and anything added later. A guard that lives only in the cron is one new caller away from being bypassed.

Add:

- An exported constant, e.g. `REVIEW_REQUEST_CLIENT_COOLDOWN_MONTHS = 6`, so tests and callers reference one value.
- A reusable helper, e.g. `getClientsAskedForReviewSince(clientIds: string[], since: string, supabase): Promise<Set<string>>`, returning the subset of client ids already asked inside the window.
- A new early-return reason on `sendReviewRequestEmail`: `"client_recently_asked"`, alongside the existing `no_email` / `already_sent` / `send_failed`.
- An options parameter, `{ ignoreClientCooldown?: boolean }`, defaulting to **false**. Only the manual admin action passes `true`.

**Do NOT write the `review_email_sent_at` sentinel when suppressing for cooldown.** The booking has not been handled — it has been *skipped for now*. Writing the sentinel would permanently retire a booking that a later manual send might legitimately want. This is the single easiest mistake to make in this item.

### 1.4 Performance — batch in the cron, guard per-booking

The cron takes up to 50 candidates per tick. Do **not** issue two extra queries per candidate.

In `route.ts`, after fetching candidates (widen the `select` to include `client_id` and `recurring_template_id`):

1. Collect the distinct `client_id`s.
2. Call the batch helper **once** to get the set of recently-asked clients.
3. Filter those candidates out, counting them into a new summary field `skipped_client_cooldown`.
4. Call `sendReviewRequestEmail` only for survivors — where its own per-booking guard is a cheap re-check, not a duplicate cost.

Add `skipped_client_cooldown` to `ReviewEmailSummary` and `emptySummary()`. The summary is the operator's only window into this cron; a silent skip is the failure mode this codebase keeps producing.

### 1.5 Repeat vs one-off clients

Classify each candidate. Suggested shape — a small pure helper so it is unit-testable:

| Class | Test |
|---|---|
| `series` | the booking has `recurring_template_id IS NOT NULL` |
| `returning` | not a series booking, but the client has ≥2 completed bookings |
| `first_time` | the client's first completed booking |

**Note that the 6-month cap already solves the "every week forever" problem on its own** — the `series` class does not need a second, stricter rule. Its value is (a) making the behaviour visible and (b) enabling copy variation.

Record the class in the audit metadata the cron already writes (`after_state`, alongside `automated: true`), so the audit trail answers "why did/didn't this client get asked?" without re-deriving it.

**Step 1e — OPTIONAL, Owner's call, implement only if the Owner says yes.** Vary the email copy by class — a standing client should not read the same "we hope you enjoyed your first visit" line as a newcomer. The natural seam already exists: `pickReviewMessages({ groupCategory, city, overrides })` in `sendReviewRequestEmail`. **Do not change customer-facing copy without explicit approval** — the template also has admin-editable overrides (`resolveTemplateOverrides`) whose interaction must be preserved.

### 1.6 The manual admin send

**None exists today.** `dispatchResend` in `src/app/admin/emails/actions.ts` has no `review_request_client` case, so even the existing resend feature cannot send one.

Mirror the established pattern exactly:

- **Server action:** a new sibling of `sendManualBookingReminder` in `src/app/admin/emails/actions.ts`. **Do not modify `sendManualBookingReminder` itself — it is RECON-untouchable.** Copy its idiom: `getStaffProfile()` first, then `createSupabaseAdminClient()`.
- **Permission:** `canResendBookingEmails(profile)` (`src/lib/auth/rbac.ts:221`, permission `resend_booking_emails`).
- **⚠️ Scope check — do not skip this.** That permission is held by Owner, Admin, Coordinator **and Therapist**, and a flat check has no concept of *which* booking. Reuse the existing middle-path guard from `resendDeliveryEvent`: if the actor lacks `canViewAllBookings`/`canManageAllBookings`, confirm they hold a `booking_assignments` row for that booking, and on failure record a `failed_resend_attempt` operational event exactly as that function does. **Without this, a Therapist could trigger customer email for any booking in the clinic.**
- **Rate limit:** reuse the same `RESEND_RATE_LIMIT_SECONDS` recent-send check already in that file.
- **Semantics:** the manual send bypasses the **6-month client cooldown** (`ignoreClientCooldown: true`) but still respects the **per-booking `review_email_sent_at` sentinel** — one review request per booking. If the Owner later wants a true duplicate for the same booking, the coherent route is adding a `review_request_client` case to `dispatchResend`, which is a few lines in an existing switch. Note it; do not build it unasked.
- **UI:** place it beside `ReminderResendForm` on `/admin/emails` (`src/app/admin/emails/page.tsx:925`), which is that form's established home, mirroring its structure. Only offer it for `completed` bookings with a recipient address.
- **Audit:** write an audit row with `automated: false`, distinguishing it from the cron's `automated: true`. The existing `review_email_sent` action type already exists (`src/app/admin/clients/[clientId]/page.tsx:222` labels it) — reuse it, don't invent one.

### 1.7 Files

| File | Change |
|---|---|
| `src/lib/email/notifications.ts` | cooldown constant, batch helper, guard + `ignoreClientCooldown` option, new reason |
| `src/app/api/cron/review-emails/route.ts` | batched pre-filter, widened select, `skipped_client_cooldown` in the summary, class in audit metadata |
| `src/app/admin/emails/actions.ts` | **new sibling action** (do not edit `sendManualBookingReminder`) |
| `src/app/admin/emails/page.tsx` + a new form component | the manual control |
| tests alongside each | see below |

### 1.8 Verification

- Unit: cooldown suppresses inside the window and permits outside it; a `no_email` sentinel does **not** suppress a later booking; the sentinel is **not** written on a cooldown skip; `ignoreClientCooldown` bypasses; classification returns the right class for series / returning / first-time.
- Cron: `skipped_client_cooldown` counted; one batch query, not N.
- Manual action: refuses without the permission; refuses an unassigned Therapist **and** records the operational event; respects the per-booking sentinel; mailer mocked throughout.
- **Zero real emails.** Confirm afterwards with a SELECT-only count on `email_delivery_events` for the run window.

---

## ITEM 2 — Privacy policy: stop promising what the code doesn't do

### 2.1 The problem

`src/app/(public)/privacy/page.tsx:165-173`, section **"6. How long we keep it"**, states booking and treatment records are kept **7 years**, enquiries **around 12 months**. **Nothing in the codebase deletes anything.** A `src/` sweep during C-19 found no pruning process for bookings, clients or enquiries. The page asserts a retention schedule that does not exist.

### 2.2 Recommended change — rewrite generically, do not delete the section

The Owner said "delete that section". **I recommend rewriting it instead, and here is the honest reason:** UK GDPR Article 13(2)(a) expects a privacy notice to state either a retention period **or the criteria used to determine it**. Deleting the section outright removes a disclosure the page is expected to carry — trading an over-promise for an omission. A criteria-based statement satisfies both the Owner's instruction ("generic, not so specific in promising anything") and the requirement.

**Rewrite section 6** to say, in the page's existing plain-English voice and without naming any duration:
- records are kept only as long as necessary for the care provided and for legal, insurance and accounting obligations;
- how long that is depends on the type of record and the obligation that applies;
- anyone can ask what is held about them, or ask for it to be deleted, using the contact details in section 1 — which points at rights the page already describes and which are genuinely operable via `/admin/privacy`.

Keep the heading, the `id="how-long-we-keep-it"` anchor, and the section number.

### 2.3 If the Owner insists on deletion instead

Then the sections **must be renumbered**. The headings are hardcoded ordinals — "6. How long we keep it", "7. Your rights", "8. Concerns and complaints", "9. No automated decision-making". Removing 6 without renumbering leaves the page jumping 5 → 7. Verified: **no table of contents or internal link references `#how-long-we-keep-it`**, so the anchor can go; only the visible numbering matters.

### 2.4 Nothing else on the page over-promises — checked, not assumed

- §2 "What we collect" was exhaustively field-mapped against `bookingRequestSchema` **and** `manualBookingSchema` during C-19's closeout, in both directions. **Do not touch it.**
- §7 "Your rights" promises no response time.
- §9 "No automated decision-making" holds — bookings arrive `pending` and require a human.
- §5 international transfers is a factual statement about providers, unaffected.

**Change section 6 only.**

### 2.5 Verification

`npx tsc --noEmit`; the privacy page's existing tests still pass; no duration string (`7 year`, `12 month`) survives in `src/app/(public)/privacy/`; the page renders and section numbering is contiguous.

---

## ITEM 3 — The missing secondary sort on override lists

### 3.1 The problem

C-14 Phase C dropped the unique constraints on `availability_overrides(override_date)` and `staff_availability_overrides(staff_id, override_date)`, so one date can now hold several segment rows. Five list queries order by `override_date` **only**, which was a total ordering when one row per date was guaranteed and is not any more.

### 3.2 Exact sites (re-locate by symbol; line numbers at `33f895f`)

`src/app/admin/availability/page.tsx`:
- `:270-274` week window — `.order("override_date", { ascending: true })`
- `:276-280` upcoming — ascending, `.limit(AVAILABILITY_UPCOMING_DEFENSIVE_CAP)`
- `:287-292` past — **descending**, `.limit(...)`

`src/app/admin/staff/[staffId]/availability/page.tsx`:
- `:150-155` upcoming — ascending
- `:163-169` past — **descending**

The `count: "exact", head: true` queries need no ordering — leave them.

### 3.3 The change

Add `.order("start_time", { ascending: true })` as a **secondary** key to those five.

**On the two descending queries, the date stays descending and `start_time` stays ascending.** The list reads newest date first, but within a date the segments must read 08:00 before 15:00. Getting this backwards would display a day's hours in reverse — an easy and invisible mistake.

### 3.4 Be honest about what this does and does not fix

Adding the sort makes the ordering **total and deterministic**, so a date's segments are contiguous and its hours render in the right order. **It does not stop a `.limit()` boundary falling mid-date** — a capped list can still show a date with only some of its segments. That is the caps/date-counting problem, which is **out of scope** (§0.2) and needs a view or RPC. Do not attempt it here, and do not claim this fix closes it.

### 3.5 Verification

Unit tests for both orderings; `npx tsc --noEmit`. Both override tables currently hold **0 rows**, so there is nothing to observe live — say so rather than claiming a live check.

---

## ITEM 4 — `bookings` indexes ⛔ (the only Zone-2 item)

### 4.1 The problem

`getBookingViewCounts` fans out **11 `count: "exact", head: true` queries per clinic-wide page render**, and the list query orders by `booking_date DESC, start_time DESC, id DESC` with `.range()` pagination.

Live index state on `bookings` — verified, not assumed:

| Index | Definition |
|---|---|
| `bookings_pkey` | `(id)` |
| `bookings_client_status_completed_idx` | `(client_id, status) WHERE status = 'completed'` |
| `idx_bookings_recurring_template` | `(recurring_template_id) WHERE recurring_template_id IS NOT NULL` |

**Nothing on `booking_date`, `start_time`, unqualified `status`, `assignment_status`, `reschedule_status`, `customer_cancelled_at` or `payment_status`.**

Column usage across the chip predicates (`buildBookingPredicatePlan`): `status` ×12, `booking_date` ×5, `assignment_status` ×4, `recurring_template_id` ×2, and one each of `reschedule_status`, `payment_status`, `customer_cancelled_at`, `client_id`.

**15 rows today; the brief projects 10–15k.** At 15 rows every plan is a sequential scan and the planner will ignore any index added — which is exactly why adding them now is free, and why *verifying* them by query plan now is meaningless.

### 4.2 Proposed indexes — justify each or drop it

```sql
-- Serves the list's ORDER BY booking_date DESC, start_time DESC, id DESC
-- plus .range() pagination. btree scans backwards, so an ascending
-- definition serves the descending order too.
CREATE INDEX IF NOT EXISTS bookings_date_time_id_idx
  ON public.bookings (booking_date, start_time, id);

-- status is in 12 of the chip predicates, almost always alongside a date
-- bound. Leading with the equality column and trailing the range column is
-- the standard composite shape.
CREATE INDEX IF NOT EXISTS bookings_status_date_idx
  ON public.bookings (status, booking_date);

-- assignment_status drives the claimable/assigned chips.
CREATE INDEX IF NOT EXISTS bookings_assignment_status_date_idx
  ON public.bookings (assignment_status, booking_date);

-- The client detail page lists a client's bookings; the existing composite is
-- partial on status='completed' and cannot serve the unfiltered history.
CREATE INDEX IF NOT EXISTS bookings_client_id_idx
  ON public.bookings (client_id);
```

**Deliberately NOT indexed:** `reschedule_status`, `payment_status`, `customer_cancelled_at` — one predicate each, and all low-cardinality. Indexing them would add write cost for no realistic read benefit. If profiling later says otherwise, add them then.

### 4.3 Critical execution notes

- **Do NOT use `CREATE INDEX CONCURRENTLY`.** It cannot run inside a transaction block, and `apply_migration` wraps the statement. On a 15-row table a plain `CREATE INDEX` is instantaneous, so there is nothing to gain. Using `CONCURRENTLY` here will simply fail.
- `IF NOT EXISTS` on every statement, so re-running is safe.
- **This is Zone-2.** The executing agent writes the migration file and stops. The Owner approves the exact SQL in chat; the orchestrator applies it.
- **Rollback** is `DROP INDEX` ×4. Adding an index changes no data.
- **Post-apply verification:** re-query `pg_indexes` for `tablename='bookings'` and confirm the four new names; confirm `bookings` row count is unchanged.

### 4.4 Honest expectation

Do not claim a measured performance improvement. At 15 rows there will be none. The correct claim is: *the indexes the projected query shapes will need are in place before the data arrives.*

---

## ITEM 5 — Make the bundle measurement actually work

### 5.1 Correcting the record first

The backlog says this needs a bundle analyzer, i.e. a package install. **That is wrong, and this plan corrects it.** `scripts/measure-admin-bundles.mjs` **already** solves the hard part: Next 16 Turbopack omits per-route First Load JS from the CLI table, and the script reconstructs it from `.next/build-manifest.json` (`rootMainFiles` + `polyfillFiles`) unioned with each route's `entryJSFiles` from `.next/server/app/<route>/page_client-reference-manifest.js`, then gzips to get real numbers.

Verified against the current build: **46 per-route client-reference manifests exist**, including `admin/bookings/new`, `admin/bookings`, `(public)/services` and `(public)/home` — every route the outstanding ceilings care about. **No package install is needed. This item is not Zone-2.**

### 5.2 The two real gaps

1. **`ROUTES` is a hardcoded list of six** (`scripts/measure-admin-bundles.mjs:31-44`) — dashboard, reports, clients/[clientId], staff/[staffId], me, staff/[staffId]/performance. It contains **no `/admin/bookings*` route and no public route**, which is why C-20's `+3 kB` and C-23's `+6 kB` ceilings were never measurable, along with nine earlier plans'.
2. **The only baseline is `redesign/baselines/bundle-pre-B1.json`, captured 2026-05-24 at `d2e6512`, before Band B.** Every delta it reports is cumulative across Band B *and* Band C, so it can never attribute a change to the plan under test.

### 5.3 The change

**a. Auto-discover routes instead of hardcoding them.** Walk `.next/server/app/**/page_client-reference-manifest.js` and derive each route from its path. This removes the failure mode permanently — no future plan can add a route the script silently ignores. Keep the ability to pass an explicit route filter for focused runs.

**b. Re-baseline at a known SHA.** Write `redesign/baselines/bundle-post-band-c.json` recording the commit it was taken at, and have the script prefer it when present while keeping the pre-B1 comparison available. **Do not delete or overwrite `bundle-pre-B1.json`** — it is the historical record for Band B.

**c. Document the one-command workflow** at the top of the script: build, run, diff.

### 5.4 The build

This item needs **one `pnpm build`** to populate `.next/` before the script can read anything. That is expected and permitted **for this item only**. Everything else in this plan must not build.

### 5.5 Verification

The script runs clean and emits every discovered route with non-zero gzip figures; the four ceiling-relevant routes appear by name; the new baseline file is written and re-running produces zero deltas against itself.

**Anchor from the end-of-programme build at `aca7c18`, for sanity-checking the totals:** 102 client JS chunk files, 4,800,796 bytes (4.58 MiB) total client JS, 326,313 bytes (318.7 KiB) CSS. Those are **uncompressed on-disk** bytes for the whole build — not comparable with the script's per-route gzip figures, only useful as a magnitude check.

---

## 6 — Suggested order and commits

Items 1–5 are independent and touch disjoint files. Recommended order is smallest-risk-first, with the email work last because it is the only one that can reach a customer:

| # | Commit |
|---|---|
| 3 | `fix(availability): order override lists by start_time within a date` |
| 2 | `fix(privacy): describe retention by criteria rather than a schedule we do not enforce` |
| 5 | `chore(tooling): auto-discover routes in the bundle measurement script + re-baseline` |
| 4 | `chore(supabase): bookings indexes for projected query shapes` ⛔ *(migration file only; Owner approves, orchestrator applies)* |
| 1 | `feat(email): cap review requests to once per client per 6 months + manual admin send` |

One coherent unit per commit. Never batch items.

---

## 7 — ⚠️ One instruction to confirm before executing item 3

The Owner's list of items to fix opened with **"The Maps cookie label"** — but an earlier instruction in the same message said to **leave the Maps label exactly as it is**. §0.2 treats the "leave it" instruction as authoritative.

The likely intent is that the first bullet was meant to be **"Adjustment lists count segments, not dates"**, because the Owner's next bullet reads "a missing sort on **the same lists**" — a phrase that only parses if the preceding item concerned those same lists.

**This has not been assumed either way.** The date-counting fix is currently **out of scope** (§0.2) because it needs a database view or RPC — a Zone-2 change materially larger than a sort. **If the Owner confirms they meant it, it should be added as a sixth item with its own ⛔ approval**, and it pairs naturally with item 3 since both touch the same queries.

Until confirmed: **implement item 3 only, and change nothing about the Maps registry entry.**

---

## 8 — Verification gate (whole plan)

**Baselines BY IDENTITY at `33f895f`** — a matching total with a different failure swapped in is a **FAIL**:

- `npx tsc --noEmit` → **0**
- `npx vitest run` → **5 failed / 2214 passed (2219)**, the failures being exactly:
  - `src/lib/auth/admin-access.test.ts` ×2
  - `src/app/admin/bookings/new/ManualBookingForm.test.tsx` ×3
- `pnpm lint` → **59 errors / 7 warnings** in exactly:
  - `design_handoff_area_pages/prototype/{area-page,shared,site-chrome}.jsx`
  - `src/features/booking/{BookingExperience.tsx,BookingExperienceLoader.tsx,utils/returning-customer.ts}`
- `git status --porcelain -- src/ supabase/` → only ` M src/lib/maintenance.ts`

**Known flake, already investigated — do not report it as a regression:** under full-suite load, 1–2 extra `ManualBookingForm.test.tsx > optional email` sub-tests intermittently time out at 5000ms. Run in isolation the file reproduces exactly its 3 baseline failures every time. It is resource contention, not a code fault.

**Additionally, for item 1 specifically:** confirm by SELECT-only query that no new `email_delivery_events` rows were created during development and testing.

---

## 9 — Final report should state

- Which of the five items shipped, with commit SHAs.
- The item 4 migration: exact SQL applied, and the post-apply `pg_indexes` output.
- Item 5: the new baseline figures, and whether C-20's `+3 kB` and C-23's `+6 kB` ceilings can now finally be evaluated.
- Item 1: explicit confirmation that **zero real emails** were sent at any point.
- Whether §7's ambiguity was resolved, and how.
- The state of `src/lib/maintenance.ts` (expected: working copy `false`, `HEAD` `true`, unstaged).
