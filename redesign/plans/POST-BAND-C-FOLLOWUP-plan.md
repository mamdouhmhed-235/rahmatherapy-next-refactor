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
| 6 | Adjustment lists: count and cap by **date**, not by segment row | Correctness | No *(on the recommended option)* |
| 7 | **Admin theming: colour, contrast and readability fixed at the root** — admin backend only | UI correctness | No |

### 0.2 Explicitly OUT of scope — do not touch

The Owner declined these. Leave them exactly as they are.

- **The Google Maps cookie label.** It stays `purpose: "essential"` in `src/lib/consent/cookie-registry.ts`. Confirmed by the Owner twice. Do not "correct" it to `functional` — that would make the Functional group's blanket promise false, which is precisely why it is filed as it is.
- **SEO:** no `sitemap.ts` / `robots.ts`, and 5 of 6 public pages emit no canonical tag.
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

## ITEM 4 — `bookings` indexes ⛔ (the only Zone-2 item, unless item 6 takes Option B)

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

## ITEM 6 — Adjustment lists must count and cap by DATE, not by segment row

*(Added 2026-08-10 at the Owner's confirmation — this replaces the mistaken "Maps cookie label" line in their list. §7 records the resolution.)*

### 6.1 The problem

Before C-14, a unique constraint guaranteed **one row per override date**, so "rows" and "dates" were the same number and every cap, count and badge could use rows interchangeably. **C-14 Phase C dropped those uniques.** A date with a break is now 2+ rows. Every row-based number on these surfaces silently became wrong:

- `AVAILABILITY_PAST_CAP = 25` now means "25 **segment rows**", so "25 past adjustments" can be as few as ~8 actual dates.
- The `count: "exact", head: true` totals count rows, so the "view all N" figure overstates how many dates exist.
- `.limit()` is row-based, so a cap boundary can fall **mid-date** and render a date with only some of its hours.

Both override tables hold **0 rows** today, so nothing is currently mis-displayed. This is a latent correctness bug, not a live one.

### 6.2 What is already correct — do not re-fix it

- The week-capacity chip on `/admin/availability` was fixed in `0bc2a02` (`weekAdjustmentsByDate.size`). **Leave it.**
- `resolveAvailabilityBannerState` and `resolveStaffAvailabilityBannerState` are **pure and unit-agnostic** — they take `pastTotal` / `pastShown` / `viewAll` and compare them. Feed them date counts and they behave correctly **with no change to the functions themselves**. Do not touch their logic; in particular do not reorder the `cappedOut`-before-`hidden` check, which is deliberate and has already regressed twice historically.
- Both managers already compute `groupByDate(...)` into `upcomingDays` / `pastDays`. **The date-grouped structure exists** — it is simply not the thing being counted.

### 6.3 Two options — recommendation first

**➤ OPTION A (RECOMMENDED) — group in code under a defensive row ceiling, with saturation disclosure. No migration, no Zone-2.**

Fetch override rows under a defensive **row** ceiling, group them by date in the page, slice to N **dates**, and pass the flattened rows plus honest date totals to the manager.

Why this is the right call here, rather than a bigger fix:

1. **Proportionate to the real data.** `availability-data.ts`'s own header projects **~25–100 overrides over 5 years**. Even at 3 segments each that is a few hundred rows. This is not `bookings`.
2. **It is the idiom this very file already established.** The header defines the upcoming bucket as *"a defensive ceiling, not a truly unbounded read"*, citing the `SCOPED_BRANCH_ROW_CAP` / `PRIVACY_NOTES_VIEW_ALL_CAP` precedent. Option A reuses that exact pattern rather than importing a new one.
3. **It matches how the codebase already resolved the identical trade-off.** C-16 accepted a capped-not-paginated `getClientCandidates` precisely because the exact fix required Zone-2. Same reasoning, same conclusion.
4. **It cannot silently lie** — see 6.5.

**OPTION B (escalation, only if the Owner wants exactness at any scale) — a grouped view per table.**

```sql
CREATE VIEW public.availability_override_dates
  WITH (security_invoker = true) AS
  SELECT override_date, count(*) AS segment_count
  FROM public.availability_overrides GROUP BY override_date;
```
…and a `(staff_id, override_date)` equivalent, each with `GRANT SELECT … TO service_role`. PostgREST would then `.limit()` and `count: "exact", head: true` over **dates** natively, exactly, forever.

`security_invoker = true` is not optional — it matches the deliberate `SECURITY INVOKER` choice made for the C-14 RPCs (service_role already holds every needed privilege, so a definer-rights object would add an escalation surface for nothing).

**Costs:** a Zone-2 migration, two new database objects, and a second query per bucket to fetch the segments for the visible dates. **Note PostgREST aggregates are disabled on this project** (`PGRST123`, confirmed by four agents during C-16) — which is *why* a view is the mechanism rather than a `count(distinct)` query, and also why Option B cannot be simplified further.

**Implement Option A unless the Owner explicitly asks for B.**

### 6.4 Option A — exact changes

**Constants** — `src/app/admin/availability/availability-data.ts` and, duplicated, `src/app/admin/staff/[staffId]/availability/lib.ts`:

- Keep `*_PAST_CAP = 25` and `*_PAST_VIEW_ALL_CAP = 200` with the same values, but **their unit changes from rows to dates**. Update the surrounding comments to say so explicitly — a constant whose meaning silently changed is exactly the trap this fix exists to remove.
- Add a row-fetch ceiling, e.g. `AVAILABILITY_PAST_ROW_FETCH_CEILING = 800`, with its reasoning in a comment: it must comfortably cover `PAST_VIEW_ALL_CAP` (200 dates) × a realistic worst-case segments-per-date (~4).
- Add a grouping/slicing helper (pure, no I/O — that is what this file is for).

**⚠️ Duplicate, do not share.** `availability-data.ts`'s header states the shape is *"duplicated (not shared)"* in the staff tree, and that the two directory trees deliberately keep independent Manager components. **Do not introduce a shared module** — that would be new cross-tree coupling the codebase explicitly chose against.

**Queries** — `src/app/admin/availability/page.tsx` and `src/app/admin/staff/[staffId]/availability/page.tsx`:

- Past bucket: replace `.limit(viewAll ? PAST_VIEW_ALL_CAP : PAST_CAP)` with `.limit(PAST_ROW_FETCH_CEILING)`, then group and slice to the date cap in code.
- Keep the existing `count: "exact", head: true` row-count queries. **Their role changes**: they are no longer the displayed total, they are the **saturation detector** (6.5).
- Upcoming bucket: leave the 500-row defensive fetch as-is. Only its *displayed* number changes to dates.
- Ordering must be `override_date` then `start_time` — **this is item 3**, and item 6 depends on it: grouping is only deterministic once segments of a date are contiguous and in time order. Do item 3 first.

**Managers** — `AvailabilityOverridesManager.tsx` and `StaffAvailabilityOverridesManager.tsx` (identical shape; sites at `33f895f`, re-locate by symbol):

| Site | Now | Becomes |
|---|---|---|
| `:153-155` / `:156-158` | `pastShown: past.length` | `pastShown: pastDays.length` |
| `:261-264` / `:272-275` | `upcoming.length` / `upcomingTotal` in the badge | date-based equivalents (`upcomingDays.length`) |
| `:264` / `:275` | `` `· ${pastTotal} past` `` | date-based `pastTotal` |
| `:421` / `:458` | `` `${past.length} of ${pastTotal}` `` | `` `${pastDays.length} of ${pastTotal}` `` |
| staff `:455` | `past.length > 0` | `pastDays.length > 0` |

`pastTotal` and `upcomingTotal` must arrive from the page already expressed in **dates**.

### 6.5 The failure mode this must not reproduce — and how it is prevented

A previous attempt at this was **correctly halted** on the grounds that shipping the totals half alone could make the "view all N" link **silently fail to appear** when older dates genuinely exist beyond the cap — trading a visible overcount for an invisible undercount. That reasoning was verified and stands.

Option A prevents it structurally:

- The date total is derived from rows actually fetched, so it is exact **whenever the fetch was complete**.
- Completeness is not assumed — it is **measured**. The existing exact row-count query gives the true row total; if `rowTotal > rowsFetched`, the fetch was truncated and the date total is a **lower bound**.
- In that case the UI must render it as a lower bound (e.g. `200+`) and never as an exact figure, and the condition must be logged. **A silent truncation here is a plan failure, not an acceptable simplification.**
- At the projected volume the saturated branch is unreachable — but it must still be implemented and unit-tested, because "unreachable" is what was said about one-row-per-date.

### 6.6 Verification

Unit tests, both trees:
- a date with 3 segments counts as **1** toward the cap and the total;
- exactly `PAST_CAP` dates render when more exist, and the banner offers "view all";
- `viewAll` raises the limit to `PAST_VIEW_ALL_CAP` **dates**;
- the `cappedOut` branch still fires beyond the view-all cap (guarding the bug that shipped twice);
- **the saturated branch** renders a lower bound rather than a wrong exact number;
- a date's segments are never split across the cap boundary.

`npx tsc --noEmit`; gates by identity per §8. Both tables hold **0 rows**, so there is nothing to observe live — state that rather than claiming a live check.

### 6.7 Relationship to item 3

Item 3 (secondary sort) is a **prerequisite**, not a duplicate. Item 3 alone leaves the cap able to split a date; item 6 removes that by paging in dates. Doing 6 without 3 would group non-contiguous rows. **Ship 3 first, then 6.** Once 6 lands, item 3's disclosed caveat ("does not stop a `.limit()` boundary falling mid-date") is fully resolved, and §3.4 should be read as superseded.

---

## ITEM 7 — Admin theming: colour, contrast and readability, fixed at the root

*(Added 2026-08-10 at the Owner's request. **Admin backend only** — the public customer site is explicitly out of scope, and measurement confirms it is already clean.)*

### 7.1 What was reported

Colours and contrast across the admin pages are poor and in places **outright unreadable** — persistently, in **both** dark and light mode, and down to button labels being unclear. The Owner wants it fixed everywhere, once, properly.

### 7.2 Root cause — measured, not guessed

**677 hardcoded `oklch(…)` colour literals across 99 files in `src/app/admin/`, plus 3 shared primitives in `src/components/ui/`. Zero in the public site** — which is exactly why the complaint is admin-only.

The admin design system is **not** the problem. `src/styles/tokens.css` defines **92 `--admin-*` tokens** across four blocks — `:root`, `[data-theme="dark"]`, `[data-theme="light"]`, and an `@media print` block — and several carry their measured contrast ratio in a comment (e.g. `--admin-danger-text-strong: … /* 9.21:1 vs danger-bg-strong */`). The system was designed correctly. **677 places bypass it.**

Theme is applied via `data-theme` on a `[data-admin-theme-root]` wrapper (`ThemeProvider.tsx:105`), so a literal simply cannot respond to it. **Dark is the effective default for staff accounts**, which is why the dark-mode failures dominate.

**The problem is far more tractable than 677 suggests:** those occurrences are only **94 distinct colour values**, and the **top ten account for ~483 of them — roughly 71% of the entire problem is ten colours.**

| Occurrences | Literal | Note |
|---|---|---|
| **171** | `oklch(26% 0.14 25)` | byte-identical to `--admin-status-cancelled-text`'s **light** value |
| 74 | `oklch(95.5% 0.028 20)` | byte-identical to `--admin-status-cancelled-bg`'s **light** value |
| 58 | `oklch(26% 0.13 55)` | |
| 40 | `oklch(95% 0.05 65)` | |
| 33 | `oklch(22% 0.085 155)` | |
| 30 | `oklch(93.5% 0.038 155)` | |
| 24 | `oklch(30% 0.02 280)` | |
| 21 | `oklch(94% 0.008 280)` | |
| 16 | `oklch(88% 0.045 20)` · `oklch(28% 0.12 55)` · `oklch(12% 0.01 165)` | |

**The critical property, verified directly:** the highest-frequency literals are **byte-identical to the light-mode value of an existing token**. `--admin-status-cancelled-text` is `oklch(26% 0.14 25)` in light (`tokens.css:155`) and `oklch(88% 0.058 25)` in dark (`:393`). So replacing the literal with `var(--admin-status-cancelled-text)` renders **pixel-identically in light mode** and **correctly in dark**. For the bulk of this work, *"no visual change in light mode"* is a provable fact, not a hope.

### 7.2a Measured live, before any code was written — `redesign/evidence/admin-contrast/baseline-owner-2026-08-10.md`

The static analysis above predicted the failures; the live DOM was then audited on the Owner's own session, both themes, and **confirmed them**. This is the baseline the fix must beat.

| Page | Nodes | **Dark** fails | **Light** fails | Worst |
|---|---|---|---|---|
| `/admin/dashboard` | 89 | **8** | **15** | **1.01:1** |
| `/admin/bookings` | 147 | **8** | **8** | 1.88:1 |
| `/admin/staff` | 177 | **41** | 1 | **1.05:1** |
| `/admin/emails` | 72 | **13** | 2 | 1.88:1 |
| `/admin/settings` | 56 | **9** | 1 | **1.15:1** |
| `/admin/bookings/new` | 28 | **7** | 1 | **1.15:1** |
| **Total** | **569** | **86** | **28** | |

**1.0:1 is identical colour.** These are not low-contrast, they are invisible.

- **`/admin/staff` fails on 23% of its text in dark mode.**
- **The dashboard's KPI figures (`0`, `£0.00`, `—`) are invisible in dark mode** at 1.05:1 — the most-read content on the most-visited page.
- **Light mode is worse than dark on the dashboard** (15 vs 8), worst 1.01:1, on a surface that is still *dark* while in light mode. Literals fail in **both** directions.
- **The failing selector names its own cause:** `1.15:1 "*" span.ml-0.5.text-[oklch(26%_0.14_25)]` — `input.tsx:116` verbatim, on every form.
- **`"New booking"` — a primary CTA — fails in both themes** (1.88:1 dark, 2.51:1 light).
- The header notification badge is 3.65:1 **on every page, in both themes**.

*Method and its one disclosed limitation (clipped `.sr-only` nodes are counted and must be excluded by the production auditor) are in the evidence file. Theme was switched via the `data-theme` attribute, so no `theme_preference` write reached the database.*

### 7.2b FULL SWEEP COMPLETE — every route, every role, both themes *(2026-08-10)*

`e2e/admin-contrast.spec.ts` ran end to end: **6 tests, 3.8 minutes, all four contrast roles plus the unauthenticated surfaces.** This supersedes §7.2a's six-page baseline.

| Role | Theme | Routes audited | Denied inline | Unreachable | **Failures** |
|---|---|---|---|---|---|
| OWNER | dark / light | 24 | 0 | 5 | **595 / 467** |
| ADMIN | dark / light | 22 | 1 | 6 | **577 / 441** |
| COORDINATOR | dark / light | 15 | 8 | 6 | **202 / 216** |
| THERAPIST_A | dark / light | 8 | 12 | 9 | **59 / 56** |
| UNAUTHENTICATED | dark / light | 2 | 0 | 0 | 2 / 0 |
| | | | | **TOTAL** | **2,615** |

**82 findings sit at exactly 1.01:1 — identical foreground and background.** Not low contrast: invisible.

**The single biggest offender is the navigation.** Ranked by frequency across every role and both themes, the most-failing text is: **"Clients" ×23, "Bookings" ×15, "Enquiries" ×7, "Dashboard" ×6, "Team" ×5, "Staff" ×3, "My bookings" ×3** — the *active* nav item, at 1.01:1, `rgb(49,55,49)` on `rgb(34,56,75)`. It is on every admin page, for every role, in both themes. Whichever section a user is currently in, its label is the one they cannot read.

**Every role is affected, proportionally.** Therapist shows 59 dark failures across only 8 reachable routes — the same density as Owner's 595 across 24. **This is not an Owner-only or a dark-mode-only problem.** Coordinator is in fact *worse in light* (216) than dark (202).

**The sweep doubles as an RBAC coverage map** — Owner reaches 24 routes, Admin 22 (1 denied inline), Coordinator 15 (8 denied), Therapist 8 (12 denied); 5–9 dynamic routes per role are unreachable for lack of data, recorded as such rather than counted as passes. That is the per-role variant coverage the Owner asked for, captured as data.

**Evidence:** `redesign/evidence/admin-contrast/<ROLE>-<theme>.md` (8 files) + `summary.md`, each with a per-route table, the worst findings with full CSS selector paths, and explicit unreachable/denied lists.

**This is the number the fix must move: 2,615 → 0.**

### 7.3 The four failure classes — this is what "unreadable" actually is

Every complaint reduces to one of four mechanical patterns. Naming them matters, because each has a different fix and only two of them are true readability failures.

**Class 1 — themed foreground + hardcoded light background → text disappears in dark mode.** The worst class, and it is in the shared button primitive, so it is on every admin page simultaneously:

```
// src/components/ui/button.tsx — outline and ghost variants
"... text-[var(--admin-body)] hover:bg-[oklch(95.5%_0.012_155)] ..."
```

`--admin-body` flips to a light colour in dark mode; the hover background stays near-white at 95.5% lightness. **Hovering an outline or ghost button in dark mode paints light text on a near-white fill.** This is precisely the reported "even buttons have unclear text in them".

**Class 2 — hardcoded dark foreground on a themed dark surface → text disappears in dark mode.**

```
// src/components/ui/input.tsx
:116  className="ml-1 text-[oklch(26%_0.14_25)]"                     // required asterisk
:143  className="... text-xs text-[oklch(26%_0.14_25)]"              // field error message
```

A 26%-lightness red on the dark admin panel. Independently rated **"functionally invisible, not merely low-contrast"** during drift checkpoint #3. This is a shared primitive: **it is every admin form's error text**. A user can be blocked by a validation error they cannot see.

**Class 3 — hardcoded light background + hardcoded dark foreground → legible, but a glaring light island in dark mode.** All 11 badge variants (`src/components/ui/badge.tsx`) pair a ~95% background with a ~26% foreground. Internally high-contrast, so not unreadable — but theme-blind, and the main source of "looks wrong / inconsistent". C-14 logged the same shape in `AvailabilityRulesManager.tsx` ("a **light** day-row background pair in a dark-default admin theme").

**Class 4 — `var(--token, <light literal>)` fallbacks.** e.g. `input.tsx:27-38`. Harmless while the token exists, but it hides the real dependency and inflates the literal count. Cleanup, not a defect.

**Classes 1 and 2 are the readability bugs. Class 3 is the ugliness. Class 4 is noise.** Fix 1 and 2 first — they are the ones that make the product unusable.

### 7.4 On roles — what the measurement shows, and what it means for the sweep

The Owner asked for every role to be signed into and checked top to bottom. Two facts change the shape of that:

**(a) The role-variant surfaces are already clean.** `BusinessDashboard.tsx`, `CoordinatorDashboard.tsx`, `TherapistDashboard.tsx`, `PractitionerTodaySection.tsx` and `dashboard-variant-shared.tsx` contain **zero** `oklch` literals between them. The whole `dashboard/` directory holds only 10, all in shared support files. The debt is concentrated in **role-independent** surfaces:

| Literals | File |
|---|---|
| 57 | `bookings/new/ManualBookingForm.tsx` |
| 22 | `settings/SettingsForm.tsx` |
| 19 | `staff/page.tsx` |
| 17 | `emails/page.tsx` |
| 15 | `clients/[clientId]/page.tsx` |
| 13 | `components/AdminTopNav.tsx` · `calendar/page.tsx` · `bookings/[bookingId]/page.tsx` |

**(b) Once the literals are gone, contrast becomes a property of the 92 token pairs, not of any page or role.** Every compliant component draws its colours from the same tokens, so proving the token pairs meet WCAG AA in both themes proves it **for every page and every role at once** — exhaustively, and without a single login.

**Therefore the role sweep is a *coverage confirmation*, not the discovery mechanism.** Its job is to catch role-exclusive UI that still holds a literal, and to sanity-check the result with human eyes. That is a far cheaper and more reliable use of it than hunting for the bug by looking.

**(c) The role sweep is automated, and no agent ever handles a password.** An agent may not type credentials — that limit does not lift on request. It does not need to: **the repo already has the mechanism**, and using it is both permitted and better than manual sweeps.

`e2e/helpers.ts` provides `getCredentials(prefix)`, which reads `E2E_<PREFIX>_EMAIL` / `E2E_<PREFIX>_PASSWORD` **from the environment**, and `loginAs(page, credentials)`, which performs a real Supabase `signInWithPassword` and injects the resulting auth cookies into the Playwright context. `e2e/admin-roles.spec.ts` already drives all of this. The **Owner** puts real values in an untracked env file; the **harness** authenticates; the agent writes only `getCredentials("THERAPIST_A")` and never sees a secret.

Prefixes already supported: **`OWNER`, `ADMIN`, `COORDINATOR`, `THERAPIST_A`, `THERAPIST_B`, `REPORTING`, `INACTIVE`, `NON_STAFF`.**

This is strictly better than a human clicking through:
- **repeatable** — re-run after the fix to prove the baseline moved from 86 failures to 0;
- **exhaustive** — every route × every role × both themes, with no attention fatigue;
- **self-documenting** — evidence files are a build artefact, not a chore;
- **permanent** — it can gate CI, so contrast cannot silently regress the way the literals did.

### 7.4a Verification tooling — BUILT, before any fix *(2026-08-10)*

All three verification layers exist and run **before** a single colour is changed, so the fix has a baseline to be measured against rather than an opinion to be judged by.

| Layer | Artefact | State |
|---|---|---|
| 1 — static source analyser | `scripts/measure-admin-contrast.mjs` + `.test.ts` (10 tests) | ✅ `d2efdfb` |
| 2 — token-pair proof | `scripts/verify-admin-token-contrast.mjs` + `.test.ts` | ✅ `b97e707` |
| 3 — live per-role sweep | `e2e/admin-contrast.spec.ts` | in progress |
| Layer 3 setup | `.env.example` documents the per-role variables | ✅ `6800fce` |

**Layer 1 current reading: 456 failures (377 dark / 79 light), 76 explicit-pair, 380 assumed-surface, and 239 `unresolvedElements`.** That last metric is the honest one — class strings it cannot resolve statically are counted and reported rather than silently skipped.

AST pairing (TypeScript compiler API, no new dependency) both **removed** false positives and **found true positives line-based pairing could not reach** — notably `admin-ui-interactions.tsx:342`, a destructive confirm button at **1.47:1 / 1.91:1 dark**, missed previously only because the formatter had split the foreground and its ternary-branch background across physical lines. Ternary branches are treated as distinct rendering states and never paired with each other.

**Role coverage is complete, and this was verified against the database rather than assumed.** Only five roles exist — Owner, Admin, Booking Coordinator, Therapist, Inactive — and all five have credentials. **There is no Reporting role in this system**, so `E2E_REPORTING_*` can never resolve and the corresponding e2e test has always been skipping; that is not a coverage gap. `THERAPIST_B` serves two-therapist claim scenarios only, and `NON_STAFF`/`INACTIVE` are negative-path accounts with no admin UI to audit.

### 7.5 The solution — eliminate, prove, prevent

A durable fix needs all three. Substitution alone would be undone within weeks: **11 brand-new files created during Band C carried this debt from their first commit**, each citing the match-the-surrounding-style rule. There is currently **no guard of any kind** against adding another literal.

### 7.5a Layer 2 built and run — one token pair genuinely fails AA *(2026-08-10, `b97e707`)*

`scripts/verify-admin-token-contrast.mjs` now proves the token layer. 92 tokens resolved in both themes; **83 unique pairs × 2 themes = 166 checks**, derived by naming convention, by documented pairings, and by every foreground-ish token against the four real surfaces.

**Two results that change Phase A:**

1. **All 14 self-declared ratio comments are accurate** (max delta ±0.03). The design system's claims about itself hold — good news, and it means those comments can be trusted as intent when choosing substitutions.

2. **⚠️ One real AA failure in the tokens themselves: `--admin-warning` on `--admin-warning-bg` = 3.41:1 in the light theme** (needs 4.5:1). **This means ITEM 7 is not purely mechanical.** Substitution alone would faithfully reproduce a genuinely non-compliant pair. Fixing it is a **token value change** — design work, not find-and-replace — and per §7.10 it must be its own reviewed change with the before/after ratio quoted, not folded into a substitution commit.

**Known coverage gap, logged not closed:** the verifier checks the **14 machine-readable inline comments** (`/* N:1 vs X */`). `tokens.css` contains a further **16 contrast claims written in prose** that nothing verifies — several load-bearing, e.g. *"fails WCAG text contrast at 1.42:1 on canvas; **never use as body text**"*, *"danger 5.39:1, warning 4.71:1, info 7.18:1"*, and *"all six sit 5.55–9.75:1 against `--admin-panel`"*. A prose safety warning that silently stops being true is exactly the defect class this programme keeps finding. **Worth extending the verifier to parse these too** — a contained follow-up, and the natural next increment.

*(Correction for the record: this plan previously said "18 such comments". That was a loose line-count and was wrong; the verifiable inline form numbers 14 across the four blocks. The executing agent caught the discrepancy and reported it rather than quietly adjusting — the correct behaviour.)*

### 7.6 Phase A — complete the token vocabulary

For each of the 94 distinct literals, classify:

1. **Byte-identical to an existing token's light value** → substitute directly. Provably no light-mode change. This covers the bulk.
2. **Near-identical to an existing token** → substitute, and record the delta explicitly in the commit. Example: the button hover literal `oklch(95.5% 0.012 155)` has **no token**, while `--admin-hover-mist` is `oklch(95.5% 0.022 247)` — same lightness, different hue.
3. **No reasonable token** → add a new token **pair**, with light and dark values, and a comment recording the measured contrast ratio against its intended background, matching the existing convention.

**Recommendation for the button hover case specifically:** add a dedicated token pair rather than reusing `--admin-hover-mist`, so the light-mode rendering stays **byte-identical**. Reusing hover-mist shifts the hue green→blue; imperceptible in all likelihood, but "imperceptible" is a judgement and "byte-identical" is a fact — and this programme prefers the fact.

**⚠️ Any new token must be added to every block that needs it** — `:root`, `[data-theme="dark"]`, `[data-theme="light"]`, and `@media print`. The print block deliberately forces light values; a token missing there will print wrong. This is the easiest omission to make.

### 7.7 Phase B — substitute, in risk order, in reviewable batches

**Order by user impact, not by file size:**

1. **`src/components/ui/{input,button,badge}.tsx`** — 3 files, 25 literals, and they fix Classes 1 and 2 **everywhere at once**. Ship this first and alone: the biggest readability win in the smallest, most reviewable diff.
2. The top-10 literal values across `src/app/admin/**` — ~71% of remaining occurrences.
3. The long tail, batched by directory so each commit is reviewable.

**Rules for the executing agent:**
- **Never change a colour's appearance and its location in the same step.** Substitution only — if a token's value seems wrong, log it, do not tune it here.
- **Light mode is the control.** For every byte-identical substitution, light-mode rendering must be unchanged. Any light-mode difference means a mis-mapping.
- Do **not** touch `src/app/(public)/**` or `src/features/**` — verified zero literals, and out of scope.
- `AdminTopNav.tsx` (13 literals) also carries the C-10 padding fix from item 3/6's neighbourhood — re-grep anchors before editing.

### 7.8 Phase C — the guard, so this is fixed *once*

Add a **guard test**, matching the idiom this codebase already uses for exactly this purpose (C-21's anti-drift domain test; C-17's recursive GA-import guard). It should fail if a new `oklch(` literal appears in `src/app/admin/**` or `src/components/ui/**`.

- Start it at the **current count as a ratchet** if the sweep lands in stages, so the number can only go down; flip to zero-tolerance on completion.
- A guard test is preferred over an ESLint rule: no config risk, it runs in the existing suite, and the precedent exists. An ESLint rule can follow later if wanted.
- **Disclose its limit in a comment:** it is a source-text match, so a computed string or an alias would evade it. Say so rather than implying it is airtight — the C-17 guard makes exactly this disclosure.

### 7.9 Phase D — prove it objectively, in both themes

**Do not sign this off by eye.** Two complementary checks:

**(a0) Static SOURCE analyser — the exhaustive layer, and the only one that needs no authentication at all.** *(Prototyped 2026-08-10; findings below are real output, not a proposal.)*

Parse `tokens.css` into `{token: {light, dark}}`, walk every `.tsx`/`.ts` under `src/app/admin/**` and `src/components/ui/**`, extract Tailwind arbitrary colour utilities (`text-[…]`, `bg-[…]`, including `hover:`/`active:`/`focus-visible:`/`data-[…]:` prefixes **and `/NN` alpha modifiers**), resolve each to sRGB — implementing oklch→oklab→linear-sRGB→sRGB — composite alpha, and compute the WCAG ratio **per theme**.

**Prototype result: 309 files scanned, 92 tokens resolved, 495 pairings below 4.5:1 (411 dark / 84 light).** It independently reproduced the failures found by code reading and by the live audit, including `button.tsx:29` and `:35` at **1.07:1 in dark** (`var(--admin-body)` on `oklch(92% 0.022 155)` — the outline/ghost `active:` state), the `operations/event-row.tsx:171-173` status-text-on-hardcoded-light cluster at 1.01–1.10:1, and the same shape at `calendar/page.tsx:650,660`.

**Why this layer is essential, not redundant:** it is the **only** method that reaches **interaction states**. A live DOM audit measures the resting page; it can never see `hover:`, `active:`, `focus-visible:` or `data-[error=true]:` colours unless every such state is driven on every element. The analyser found `ManualBookingForm.tsx:1486` — `hover:bg-[var(--admin-panel-muted)] hover:text-[oklch(26%_0.14_25)]`, **1.02:1 on hover in dark mode** — which the live sweep had no way to surface.

**Two accuracy limits, both real and both to be closed in the production version:**
1. **Same-line pairing is a heuristic.** Colours on one source line are assumed to belong to one element. Usually true in Tailwind, not always — validation found `badge.tsx:56` (`bg-[var(--admin-primary)]/12` beside `text-[var(--admin-primary)]`) reported as `1:1` before alpha support was added, and a residue of same-line/different-element artifacts remains. **The production version should parse the JSX `className` expression via AST rather than by line**, which removes this class entirely.
2. **416 of the 495 are "assumed-surface"** — a foreground with no background on the same line, evaluated against `--admin-panel` and `--admin-canvas`. Directionally right, since those are the real admin surfaces, but not proof for any specific element.

**Treat (a0) as the exhaustive *finder* and (b) as the *confirmer*.** Neither alone is sufficient; together they cover breadth, states, and runtime truth.

**(a) Static token-pair proof — exhaustive, role-independent, no browser.** Parse `tokens.css`, compute the WCAG contrast ratio for every foreground/background token pair the design system actually uses, in **both** `[data-theme="dark"]` and `[data-theme="light"]`, and assert **AA: ≥4.5:1 for normal text, ≥3:1 for large text and UI boundaries**. Several tokens already document their ratio in a comment — **verify those comments are true**, since a stale comment is worse than none. This is the check that covers every page and every role at once.

**(b) Automated live sweep — every route × every role × both themes.** This is the item the Owner asked for, built as a **new Playwright spec, `e2e/admin-contrast.spec.ts`**, reusing the existing harness rather than inventing one.

Shape:

1. Gate with `requireCredentials([...])` so the spec **skips cleanly** when a role's credentials are absent — never fails the suite for a missing secret, exactly as the existing role specs do.
2. For each role in `OWNER`, `ADMIN`, `COORDINATOR`, `THERAPIST_A`, `THERAPIST_B`, `REPORTING`: `loginAs(page, getCredentials(role))`.
3. For each admin route (**all 31 `page.tsx` routes**, dynamic ones fed real ids — reuse the `E2E_CLAIMABLE_BOOKING_PATH` convention for anything id-dependent):
   - navigate; **skip and record** any route this role cannot reach — a 307 to login or a permission redirect is *expected* coverage data, not a failure;
   - for **each theme** (`dark`, `light`): set `data-theme` on `[data-admin-theme-root]` directly — **never** through the theme control, so **no `theme_preference` write reaches the database**;
   - run the audit function via `page.evaluate`.
4. The audit function itself: walk visible text nodes; effective foreground from computed style; effective background by walking ancestors to the first opaque `background-color`, compositing alpha; resolve **every** colour by painting to a 1×1 canvas and reading the pixel — this handles `oklch`, `lab`, `oklab` and anything else exactly, with no hand-written colour maths to get wrong; then compute the WCAG ratio and flag against **4.5:1 normal / 3:1 large (≥24px, or ≥18.66px bold)**.
   - **Exclude `.sr-only` and otherwise clipped nodes.** The baseline audit counted them and said so; the production auditor must not.
5. Also assert, cheap and worth having: focus-visible rings meet **3:1** against their adjacent surface, and no state is signalled by colour alone.

**Two modes:** *report-only* while the fix is in progress (captures the ratchet), then *asserting* once complete, so the suite fails on any new failure.

**Output:** `redesign/evidence/admin-contrast/<role>-<theme>.md` — one file per role/theme, unique names so parallel runs cannot clobber each other.

**Owner setup, one time — verified against this repo, not assumed:**

- **`.gitignore` already protects this.** It carries `.env*` with a `!.env.example` exception, and `git ls-files` shows `.env.example` as the only tracked env file. Real credentials in `.env.e2e` **cannot** be committed by accident. *(Re-confirm before writing secrets; if that ever changes, stop.)*
- **⚠️ `playwright.config.ts` loads no env file.** It only reads `process.env.E2E_BASE_URL`. Creating `.env.e2e` alone will **not** work — the variables must reach the Playwright process.
- **`dotenv` is not installed and must not be added** (a package install is Zone-2). It is unnecessary: **Node 24 supports `--env-file` natively** (confirmed on the installed v24.16.0). Run the sweep as:

```bash
node --env-file=.env.e2e ./node_modules/playwright/cli.js test e2e/admin-contrast.spec.ts
```

- Contents of `.env.e2e` — the Owner fills the values; **no agent reads, echoes or logs them**:

```
E2E_BASE_URL=http://localhost:3000
E2E_OWNER_EMAIL=…            E2E_OWNER_PASSWORD=…
E2E_ADMIN_EMAIL=…            E2E_ADMIN_PASSWORD=…
E2E_COORDINATOR_EMAIL=…      E2E_COORDINATOR_PASSWORD=…
E2E_THERAPIST_A_EMAIL=…      E2E_THERAPIST_A_PASSWORD=…
E2E_THERAPIST_B_EMAIL=…      E2E_THERAPIST_B_PASSWORD=…
E2E_REPORTING_EMAIL=…        E2E_REPORTING_PASSWORD=…
```

- **Add the variable *names* to `.env.example`** as documentation. **Never the values** — `.env.example` is the one tracked env file.
- **Standing prohibition, unchanged:** no agent may type a credential into a form, echo one to a log, or paste one into a report. The harness authenticates; agents reference `getCredentials(prefix)` only. A spec that would print a credential on failure is a defect — assert on the *role name*, never on the secret.

### 7.10 Explicitly NOT in scope

- **No redesign.** No new palette, no layout, spacing or typography changes, no component restructuring. This is "make the existing design render correctly in both themes".
- **No public-site changes** — measured at zero literals.
- **No token *value* changes** unless a pair provably fails AA, and then as its own reviewed change with the ratio quoted.
- Not an accessibility programme (no ARIA/keyboard/screen-reader audit) — colour and contrast only.

### 7.11 Risks

| Risk | Mitigation |
|---|---|
| A mis-mapped token silently changes light mode | Light mode is the control; byte-identical substitutions must render identically. Any diff = mis-map |
| 677 edits is a large diff to review | Batch by risk (7.7); primitives ship alone first |
| A new token missing from the print block | Explicit checklist item in 7.6 |
| The sweep is undone by future code | Phase C guard, ratcheted |
| Tuning colours while moving them | Forbidden in 7.7 — substitution only |
| Role-exclusive UI missed | Phase D role passes, plus the static token proof that is role-independent by construction |

### 7.12 Verification

Gates by identity per §8, plus: the guard test passes at zero; the static token-pair proof reports no AA failure in either theme; the live audit reports no failure on any swept page in either theme; and light-mode screenshots of the three primitives are unchanged before/after.

**Suggested commits** — never one giant commit:

```
fix(admin-ui): token-drive colour in the shared input, button and badge primitives
fix(admin): replace the ten highest-frequency colour literals with tokens
fix(admin): token-drive remaining colour literals in <area>      (repeated per area)
test(admin): guard against new hardcoded oklch literals
docs(redesign): admin contrast audit evidence, both themes, all roles
```

---

## Suggested order and commits

Items 2, 4 and 5 are independent of everything else. **Items 3 and 6 are ordered — 3 is a prerequisite for 6** (§6.7). Item 1 goes last because it is the only one that can reach a customer.

| Order | # | Commit |
|---|---|---|
| 1 | 3 | `fix(availability): order override lists by start_time within a date` |
| 2 | 6 | `fix(availability): count and cap adjustment lists by date, not segment row` |
| 3 | 2 | `fix(privacy): describe retention by criteria rather than a schedule we do not enforce` |
| 4 | 5 | `chore(tooling): auto-discover routes in the bundle measurement script + re-baseline` |
| 5 | 4 | `chore(supabase): bookings indexes for projected query shapes` ⛔ *(migration file only; Owner approves, orchestrator applies)* |
| 6 | 1 | `feat(email): cap review requests to once per client per 6 months + manual admin send` |
| 7 | 7 | Admin theming — **multiple commits**, see §7.12. Largest item; runs last so it rebases over a settled tree |

One coherent unit per commit. Never batch items. Items 3 and 6 touch the same files, so they must not run concurrently with each other. **Item 7 touches `AdminTopNav.tsx`, which item 3's neighbourhood also touched — run item 7 after items 3 and 6 have landed**, and re-grep anchors. Everything else is disjoint.

---

## 7 — ✅ RESOLVED: the ambiguous instruction

The Owner's list of items to fix opened with **"The Maps cookie label"**, while an earlier instruction in the same message said to leave that label alone. The two could not both be actioned.

**Owner confirmed, 2026-08-10:** the Maps line was a mistake. The earlier instruction stands — **the Google Maps cookie-registry entry is NOT to be touched** (§0.2) — and the intended item was **"Adjustment lists count segments, not dates"**, now specified in full as **ITEM 6**.

This was flagged rather than guessed at because the two readings led to materially different work: one meant leaving a compliance-facing label alone, the other meant a correctness fix that (on its rejected option) would have added database objects. Recorded here so the resolution is part of the plan rather than lost in chat.

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

- Which of the seven items shipped, with commit SHAs.
- The item 4 migration: exact SQL applied, and the post-apply `pg_indexes` output.
- Item 5: the new baseline figures, and whether C-20's `+3 kB` and C-23's `+6 kB` ceilings can now finally be evaluated.
- Item 1: explicit confirmation that **zero real emails** were sent at any point.
- Item 6: which option was taken (A or B), and — if the saturated branch was implemented as specified — confirmation that it renders a lower bound rather than a wrong exact number.
- Item 7: the literal count before and after (target **0**); the guard test's state (ratchet or zero-tolerance); the static token-pair proof result for **both** themes; which roles were live-swept and by whom; and any token whose documented contrast comment turned out to be stale.
- The state of `src/lib/maintenance.ts` (expected: working copy `false`, `HEAD` `true`, unstaged).
