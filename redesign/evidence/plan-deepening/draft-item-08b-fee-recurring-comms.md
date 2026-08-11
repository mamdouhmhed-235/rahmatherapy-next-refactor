*§8.6–§8.14 were re-verified against the live schema and current source on 2026-08-11; anchors are stated as file:line **as of that date** — re-locate every symbol before editing, don't trust the number.*

### 8.6 Phase 3 — The fee on a single booking

**Schema.** `bookings.total_price` is `numeric(10,2)`; `amount_due` and `amount_paid` are bare `numeric`
with **no scale constraint** — nothing stops either column from silently accumulating more than 2 decimal
places once application code starts computing them, which Phase 3 is the first thing to do. `amount_paid`
is `not null default 0`; the other two are nullable. No rounding helper exists anywhere in this codebase —
`amount()` (`reporting.ts:735`), `toAmount()` (`customer-manage.ts:150`), `toNumber()`
(`client-metrics.ts:109`) are all a bare `Number(value ?? 0)`. Phase 3 must introduce its own rounding
discipline (below); do not assume float subtraction is safe.

**Storage.** `bookings.travel_fee numeric(10,2) not null default 0` — new column, new migration, matching
`total_price`'s existing precision rather than `amount_due`'s unscaled convention (that convention is a
pre-existing gap, not a pattern worth propagating).

```sql
-- supabase/migrations/<timestamp>_item8_bookings_travel_fee.sql
alter table public.bookings add column travel_fee numeric(10,2) not null default 0;
```

Rollback: `alter table public.bookings drop column travel_fee;` — additive, `not null default 0`, no
rewrite of existing rows, zero effect on any existing `total_price`/`amount_due` value. Nothing about this
migration is irreversible.

**The fee is written as a delta, in integer pence, in application code — not in floating-point pounds:**

```ts
const toPence = (v: number | string | null) => Math.round(Number(v ?? 0) * 100);
const newTotalPence = toPence(beforeState.total_price) - toPence(beforeState.travel_fee) + toPence(newFeeInput);
const newTotal = newTotalPence / 100;
// identical arithmetic, same oldFee/newFee pair, for amount_due
```

Plain float subtraction (`45.30 - 14.30 + 20.10`) can yield `51.099999999999994` in JS; `total_price` would
survive because Postgres rounds `numeric(10,2)` on write, but `amount_due` (unscaled) would not, and the
two columns could silently diverge by a fraction of a penny. Factor this pence-delta helper out as a
standalone function — Phase 4's series action and the cron both need the identical arithmetic; do not
duplicate it.

**Why folding into `total_price`/`amount_due` (rather than storing the fee separately and summing at read
time) is the decisive design call — extend the fee column ONLY as a delta, never leave it to be summed by
a reader.** `travel_fee` is retained on the row solely so the UI and emails can print a labelled line; it
is not itself the number any balance/revenue calculation reads.

**Symbols to edit** — every anchor below is "currently at", re-locate by symbol before touching it:

| Symbol | Currently at | Change |
|---|---|---|
| `updateBookingManagement` | `src/app/admin/bookings/actions.ts:284` (function open) | add `travel_fee` parsing; add the completed/fully-paid lock (new logic — no existing precedent in this function does a payment-field guard; the closest analogue to copy the *shape* of, not the content, is `isCompletedReversal` at `_helpers.ts:148`, which gates a status transition, not a field edit) |
| `payload` object | `actions.ts:417–455` | extend with delta-computed `total_price`/`amount_due` via the pence-rounding helper above |
| `canManageAllBookings` gate | `actions.ts:290`, permission defined `rbac.ts:86–88` (`MANAGE_BOOKINGS_ALL`) | unchanged — already this action's gate, reuse it, don't add a second one |
| audit row insert | `actions.ts:500–526`, `action_type: "booking_management_updated"` | unchanged — already registered in `src/app/admin/audit/format.ts:24`; no new registration needed for the single-booking fee write |
| `getBookingDetailData` | `src/app/admin/bookings/[bookingId]/booking-detail-data.ts:330` | **currently fetches no `business_settings` / town list at all** (grep-confirmed, zero hits outside the function declaration) — add the free-travel town-list read here, or the alert in the next row has nothing to render against |
| `StatusAndPaymentSection` | `src/app/admin/bookings/BookingManagementForm.tsx:689–938` | add the travel-fee input and the outside-zone alert |
| `AmountPaidInput` | `BookingManagementForm.tsx:443–515` | pattern to mirror exactly for the new travel-fee input: £ prefix, live state, and the `total > 0` preview idiom at line 491 (`{total > 0 ? (` — "Match total · £X" quick-fill) |
| `QUICK_ACTIONS` (`confirm` entry) | `BookingManagementForm.tsx:336` (array opens 336, runs to 372 across 4 actions; the `confirm` entry is the first) | consumed at `:784`; gating logic lands here for the bypass close, below |
| `total` variable | `BookingManagementForm.tsx:696`, `const total = Number(booking.total_price ?? 0);` | read by the new input's preview |
| `quickUpdateBooking` | `actions.ts:732` (function open, body runs to ~909) | **not edited for the fee** — see bypass note below |
| confirm branch | `actions.ts:777–778`, `action === "confirm" ? { status: "confirmed" as BookingStatus }` | payload has no `travel_fee` field and none is added — this is why the chip must be hidden, not made fee-aware |

**The completed/fully-paid lock, specified precisely (Owner-decided, this is the implementation of that
decision, not a new one):**

- **Locked when** `status = 'completed'` **or** `amount_paid >= amount_due` with `amount_due > 0`.
- **Not locked when** `cancelled` — assert this explicitly in a test (§8.10) so a later reader doesn't
  "fix" it into a blanket lock.
- Reject **server-side**, in the action, not just by disabling the input. Return a field-level error
  (e.g. *"This booking is completed — the travel charge can no longer be changed."*), never a thrown 500.
- Enforce **only when** `newTravelFee !== beforeState.travel_fee` — an unchanged fee submitted alongside
  another edit (e.g. a payment note) on a completed booking must still succeed.
- Evaluate the lock against the booking's state **before this submit** — setting the fee and marking it
  paid in the same save must be allowed; the guard must not block its own natural flow.

**Close the bypass.** `QUICK_ACTIONS`'s `confirm` chip → `quickUpdateBooking`'s `confirm` branch
(`actions.ts:777–778`) confirms and sends the confirmation email with **no form fields at all** — verified
by reading the full function body, not assumed. This path cannot become fee-aware because it has no fee
input to fold in. **Hide the chip** when the booking's address is outside the free-travel zone and
`travel_fee = 0`. This is the only correct fix given the current code; making the one-click action
fee-aware would require inventing a fee prompt inside a quick-action, which does not exist anywhere else
in this UI.

**Email timing — verified, not assumed.** In `updateBookingManagement`, `.update(payload)` fires at
`actions.ts:457–462`; the confirmation email (`sendBookingConfirmedClientEmail`) fires at `:561–565`,
strictly after, in the same request, gated by `beforeState.status === "pending" && data.status ===
"confirmed"`. The email's own data comes from a **fresh** `SELECT` via `getBookingTemplateInput`, not a
reuse of `data` — so once `travel_fee` is in `payload`, the confirmation email will read the fee-inclusive
row automatically. `quickUpdateBooking`'s second confirm path (`:893–898`) has the identical guard shape —
gate that path by hiding the chip, not by adding fee logic to it.

**Blast radius — every reader of `total_price`/`amount_due`, verified by direct read, none summing:**

Command used: `grep -rn "total_price\|amount_due" src --include=*.ts --include=*.tsx | grep -v __tests__
| grep -v "\.test\.t"`, then every hit opened and classified. **17 genuine production readers**, all flat
scalar reads — folding the fee in makes every one of them correct with **zero code changes**:

| # | Site | What it does |
|---|---|---|
| 1 | `nav-notifications.ts:287` | `Number(amount_due) - Number(amount_paid)` |
| 2 | `reporting.ts` `summarizeReports` (402–480, esp. 413–450) | 6 flat accumulators |
| 3 | `reporting.ts` `getRevenueSeries` (499–518) | 3 flat accumulators |
| 4 | `actions.ts:764,783` — `quickUpdateBooking` `mark_paid` | flat read |
| 5 | `reporting.ts` `getNetCollectionRate` (1313–1323) | flat read |
| 6 | `reporting.ts` `getAvgBookingValue` (1329–1338) | flat read |
| 7 | `client-metrics.ts:73,84` | LTV, average booking value |
| 8 | `dashboard-data.ts:75,597` | select + conditional pass-through |
| 9 | `export/route.ts:70–86,104,155` | CSV export |
| 10 | `customer-manage.ts:206` | flat read (**/booking/manage** — see below) |
| 11 | `booking/manage/page.tsx:227`, `Row label="Total"` | flat read (**/booking/manage**) |
| 12 | `BookingCard.tsx:229–230,436–437` | display |
| 13 | `[bookingId]/page.tsx:1439,1458`, `BookingDetailSidebar.tsx:141` | display |
| 14 | `reporting.ts` `getNoShowRate` (1232–1254), `lostRevenue += amount(booking.total_price)` at 1245, 1248 | flat read |
| 15 | `reporting.ts` `getSourceAttribution` (1287–1307), line 1293 | flat read |
| 16 | `clients-list-data.ts:313` — `current.outstanding += Math.max(0, due - paid)` | flat read |
| 17 | `admin/clients/[clientId]/page.tsx:1674`, `{formatMoney(booking.total_price)}` | display |

*Correction: an earlier pass of this section cited "at least 15 read sites"; direct enumeration finds 17.
Rows 14–17 (two `reporting.ts` functions, the clients-list outstanding accumulator, and the client-detail
page's booking row) were previously unlisted. The design conclusion is unchanged — none of the 17 sums a
sub-component or re-derives from `booking_items` — but an implementer sweeping "every reader" (§8.9B) must
check against this list of 17, not the old count of ~15.*

**Proven NOT affected — `booking_items` / `service_price_snapshot` readers.** Command: read
`reporting.ts:534–547` (`getServicePerformance`) and `:566–588` (`getStaffRevenueAttribution`) directly.
Both iterate `data.bookingItems` and accumulate `amount(item.service_price_snapshot)` — never
`total_price`/`amount_due`. `client-metrics.ts` `preferredService` (`:76–79`) is the same shape. **⛔ Never
put the fee in `booking_items`** — a fee row would have no valid `service_id` (an FK a mileage charge
cannot satisfy) and would corrupt per-service/per-therapist analytics with a fake service line.

**Proven NOT affected — the public/customer site.** `grep -rn "total_price|amount_due|travel_fee"
src/app/(public)` returns zero matches (re-run 2026-08-11). Marketing and area pages carry no money
reference of any kind; Phase 3 (and Phase 5, below) touch only `src/features/booking/**` — the booking
*flow*, which is customer-facing but not the marketing site.

**`/booking/manage`, checked by name.** `customer-manage.ts:206` and `booking/manage/page.tsx:227` (row 10
and 11 above) are flat reads — numerically correct automatically once the fee is folded in, zero edits
required for correctness. `ManageBookingForms.tsx` itself has **zero** direct `total_price`/`amount_due`
references (re-checked 2026-08-11) — it consumes the already-computed total via `customer-manage.ts`.
`badge.tsx`, this route's only styled-component import with zero admin exposure, is untouched — nothing in
Phase 3–5 imports or edits it. The only planned edit to this route is Phase 5's optional line-item-split
copy (below); it is copy-only and does not change what number is displayed.

**Ordering and collisions.**
- Phase 3 has no hard technical dependency on Phases 1–2 (the free-travel gate removal) — the `travel_fee`
  column and write path can ship independently. But shipping it before Phase 2 makes out-of-area bookings
  possible means the field exists with no real trigger case; the recommended sequence is still 1→2→3,
  not required except where §8.8 states otherwise (chip-gating must land with Phase 3, see below).
- `src/app/admin/bookings/actions.ts`, `BookingManagementForm.tsx`, `bookings/[bookingId]/page.tsx`, and
  `SeriesActions.tsx` are also touched by **item 7** (admin colour/contrast tokens). Item 7's edits are
  `className`/token substitutions only; item 8's are new fields/logic — file-level overlap, not
  logic-level. Per the plan's global ordering note, item 7 runs **after** items 3/6 land and should also
  run after item 8's Phase 3 UI ships, so item 7 tokenises against the final markup rather than needing a
  second pass.
- `src/app/admin/bookings/new/ManualBookingForm.tsx` also collides with item 7 (57 oklch lines) but is
  **not** touched by Phase 3 — Phase 3 only reaches `BookingManagementForm.tsx` (the existing-booking edit
  form), not `ManualBookingForm.tsx` (new-booking creation). Confirm this stays true: if a travel-fee field
  is ever added to manual-booking creation, it becomes a second collision with item 7 on that file too.

**Verification for this batch — exact commands:**
```
npx tsc --noEmit                                                          # must stay 0
npx vitest run src/app/admin/bookings/__tests__/updateBookingManagement-completed-guard.test.ts
                                                                            # baseline: exact file, currently exists
npx vitest run                                                             # full suite — total MUST still be
                                                                            # exactly the baseline 5 failed / 2236 passed
                                                                            # PLUS the new tests below, all passing.
                                                                            # A 6th ManualBookingForm timeout under
                                                                            # full-suite load is the documented flake —
                                                                            # re-run that file alone to confirm 3/33/36.
pnpm lint                                                                  # MUST still be exactly the six-file
                                                                            # {file, ruleId} multiset. actions.ts and
                                                                            # BookingManagementForm.tsx are NOT in that
                                                                            # baseline — if either gains a lint error,
                                                                            # that is a 7th file and a REGRESSION, stop.
git status --porcelain -- src/ supabase/                                  # shows exactly this batch's files
                                                                            # (actions.ts, booking-detail-data.ts,
                                                                            # BookingManagementForm.tsx, the new
                                                                            # migration, the new/extended test files)
                                                                            # plus the pre-existing M src/lib/maintenance.ts
                                                                            # — nothing else.
```
Numbers that **must move**: vitest total test count (new tests added), migration file count in
`supabase/migrations/`. Numbers that **must not move**: `tsc` exit code, the six-file lint identity, the
five pre-existing vitest failures (same tests, same names).

---

### 8.7 Phase 4 — Recurring series: the charge must repeat

**Verified problem.** `recurring_booking_templates` has **26 columns** and **zero money columns** —
re-confirmed live via `information_schema.columns` on 2026-08-11 (id, client_id, service_id,
bound_therapist_id, open_to_any_therapist, anchor_day_of_week, anchor_day_of_month, anchor_start_time,
total_duration_mins, participant_gender, required_therapist_gender, cadence, end_type, end_count, end_date,
service_address_line1, service_postcode, service_city, service_area, created_by, created_at, cancelled_at,
cancelled_by, cancelled_reason, horizon_through_date, notes — 26 by hand-count). *Correction: an earlier
pass of this section stated 24 columns; the live count is 26. The substantive claim — no money column of
any kind — is unaffected and re-confirmed.* The template stores the address but nothing about price.

The horizon cron rebuilds every future occurrence from scratch, `extend-recurring-horizons/route.ts:406–433`
(re-verified line-exact 2026-08-11):
```ts
total_price: service.price,   // line 419
amount_due: service.price,    // line 420
amount_paid: 0,
group_booking: false,          // line 425 — no participant multiply on this path, confirmed
```
So a fee set on occurrence #1 of a standing out-of-area series silently vanishes from every occurrence
thereafter, even though the address — and the reason for the charge — is unchanged.

**Three live writers of a `bookings` row exist, confirmed by grep across all migrations plus a multiline
grep for `.from("bookings")…insert(` across `src/`, no fourth found:**
1. `create_booking_request` (SQL, live definition `c06…sql`) — single/group bookings, multiplies by
   participant count.
2. `create_recurring_booking_series` (SQL, `20260802122636_c02_recurring_bookings.sql:784–829`) — first
   materialised batch, `group_booking: false` (~line 823), no multiply.
3. `extend-recurring-horizons/route.ts:406–433` (TS, the daily cron) — no multiply.

**Design — the template carries the standing charge:**

1. `recurring_booking_templates.travel_fee numeric(10,2) not null default 0` — new migration.
2. The cron adds it: `total_price: service.price + template.travel_fee`, same for `amount_due`
   (`route.ts:419–420`). Verify `travel_fee` is included in whatever upstream `select` populates `template`
   before editing these two lines — it currently is not, since the column doesn't exist yet.
3. `create_recurring_booking_series` must accept and apply the same fee for the first materialised batch.
   **Do not edit `20260802122636_c02_recurring_bookings.sql` in place** — this repo's own convention (three
   successive `CREATE OR REPLACE FUNCTION create_booking_request` definitions across migration history) is
   to replace a function's body via a **new** migration, never edit a historical one. This is a **second**
   migration for this phase (`CREATE OR REPLACE FUNCTION create_recurring_booking_series(..., p_travel_fee
   numeric default 0)`), adding the parameter and applying it to `v_service.price` at the two `VALUES` price
   lines (currently ~817–818).
4. **Setting the series fee must also update already-materialised future occurrences.** The cron creates a
   batch ahead (12 weekly / 6 fortnightly / 3 monthly), so those bookings already exist by the time an
   admin sets or changes the series fee. Apply the same delta to occurrences where `status IN
   ('pending','confirmed')` **and** `booking_date >= today`. Never touch past, completed, or cancelled
   occurrences — they are financial history.
5. Per-occurrence override remains possible for free: the template fee is the default for occurrences not
   yet created; a fee set on an individual booking (§8.6) is the actual for that visit.

*Correction to the effort table (§8.12): Phase 4 needs **2 migrations**, not 1 — the `travel_fee` column
plus the `CREATE OR REPLACE FUNCTION` for `create_recurring_booking_series`. This also means item 8's
total migration count across all five phases is **6** (Phase 1: 2, Phase 2: 1, Phase 3: 1, Phase 4: 2,
Phase 5: 0), not the "4 migrations" figure the previous revision quoted. §10 and §0.1 are corrected to match.*

**Series-level control — Owner-decided, on `/admin/bookings/series/[templateId]`.** This page exists
(`page.tsx`, 544 lines) and its `TEMPLATE_SELECT` (lines 48–71) selects no money column, consistent with
§8.7's schema finding. **A concrete trap:** `SeriesActions.tsx` already has an "Edit series" button
(lines 87–95) that is `disabled`, with copy directly beneath it (lines 160–164): *"Editing isn't available
yet for repeat visits. Cancel this series and create a new one if cadence, address, or therapist need to
change."* `recurring-actions.ts` has exactly two exported actions today — `createRecurringSeries` (93) and
`cancelRecurringSeries` (237) — **no edit/update action exists**. **Do not extend the disabled "Edit
series" button** — its own copy scopes it to cadence/address/therapist, not price. Build:
- a **new** server action in `recurring-actions.ts` (e.g. `setSeriesTravelFee`), mirroring
  `cancelRecurringSeries`'s shape: same auth gate (`getStaffProfile` → `actor.active &&
  canManageAllBookings(actor)`), same template-update idempotency style, same hand-built audit row (no RPC
  on this path), same revalidate/updateTag footer;
- a **new**, separate UI panel (e.g. "Travel charge", between "Schedule" and "Client", or folded into
  "Actions") backed by a **new** sibling client component (e.g. `SeriesTravelChargeForm.tsx`, alongside
  `SeriesActions.tsx`), not an extension of the disabled button.

**The fully-paid skip cannot be expressed as a single PostgREST filter — this is the part most likely to
be gotten wrong.** `cancelRecurringSeries`'s own filter (`status IN ('pending','confirmed')`) is a complete
lock for cancellation, but the fee lock also needs `amount_paid >= amount_due`, and PostgREST compares a
column to a **literal**, not to another column — there is no `.filter("amount_paid", "lt", "amount_due")`
that works column-to-column through the JS client. Use this two-step shape:
1. `SELECT id, amount_due, amount_paid, status FROM bookings WHERE recurring_template_id = $1 AND status
   IN ('pending','confirmed') AND booking_date >= $2` — fetch candidates.
2. Partition in application code: `toUpdate = candidates.filter(b => Number(b.amount_paid) <
   Number(b.amount_due))`; the rest are `skipped`.
3. `UPDATE bookings SET total_price = total_price - $oldFee + $newFee, amount_due = amount_due - $oldFee +
   $newFee WHERE id IN (toUpdate.map(b => b.id))` — using the same pence-rounding helper from §8.6.
4. Report `{ updated: toUpdate.length, skipped: candidates.length - toUpdate.length }`, matching how
   `cancelRecurringSeries` already reports `cancelledOccurrenceCount`.

**Audit registration.** `booking_management_updated` (Phase 3's action type) is already registered in
`src/app/admin/audit/format.ts:24`. `recurring_series_cancelled` — the action type `cancelRecurringSeries`
already writes today for a shipped feature — is **not** registered anywhere in `format.ts`. Its fallback
(`describeAction`, lines 100–110) renders it as a readable phrase (`actionType.replace(/_/g, " ")`, not
blank) but mis-files it into family `operations_and_email` (should be `bookings_and_assignments`) with chip
tone `"none"`. *Correction: "unlabelled" was the wrong description in an earlier pass — the fallback is
readable-but-miscategorised, not blank.* This is a pre-existing, out-of-scope defect worth a one-line
footnote; the **new** series-fee action type (e.g. `recurring_series_travel_fee_updated`) must be
registered in `format.ts` with the correct family and chip so it doesn't inherit the same miscategorisation.

**Symbols to edit** — re-locate by symbol:

| Symbol | Currently at |
|---|---|
| Cron occurrence-build block | `src/app/api/cron/extend-recurring-horizons/route.ts:406–433`, price lines `:419–420`, `group_booking: false` at `:425` |
| `create_recurring_booking_series` price snapshot | `supabase/migrations/20260802122636_c02_recurring_bookings.sql`, INSERT column list opens `:784`, price VALUES `~:817–818` — **do not edit this file; replace via new migration** |
| `SeriesActions.tsx` disabled edit button | `:87–95`, explanatory copy `:160–164` |
| `recurring-actions.ts` exports | `createRecurringSeries` at `:93`, `cancelRecurringSeries` at `:237` |
| `TEMPLATE_SELECT` | `series/[templateId]/page.tsx:48–71` |
| `format.ts` action-type map | `booking_management_updated` registered `:24`; `recurring_series_cancelled` absent; `describeAction` fallback `:100–110` |

**Blast radius.** New surface, not an existing one — the risk is *omission* (a caller that still writes
occurrences without the fee), not corruption of an existing reader. Proven exhaustive: the three-writer
grep above is the complete list; nothing else creates a `bookings` row. Proven NOT affected: none of the
17 read sites in §8.6 change behaviour for Phase 4 — they read the row's `total_price`/`amount_due`
regardless of whether those values came from a single booking or a recurring occurrence.

**Verification for this batch:**
```
npx tsc --noEmit
npx vitest run src/app/api/cron/__tests__/extend-recurring-horizons.test.ts   # existing file
npx vitest run src/app/admin/bookings/__tests__/cancelRecurringSeries.test.ts # existing file — mirror shape
npx vitest run src/app/admin/bookings/__tests__/createRecurringSeries.test.ts # existing file — p_travel_fee param
npx vitest run                                                                 # full suite, same rule as Phase 3
pnpm lint                                                                       # same six-file identity check
git status --porcelain -- src/ supabase/                                      # this batch's files only, plus maintenance.ts
```

---

### 8.8 Phase 5 — Telling everyone, consistently

**Customer, before sending the request** — `src/features/booking/components/AboutYouStep.tsx`.
`COVERED_TOWNS` (`:56–58`) and `isCovered`/`isOutsideCoverage` (`isCovered` `:125–130`, `isOutsideCoverage`
`:131`) must read the **live** free-travel list (threaded in Phase 2), not the hardcoded constant. The
outside-coverage notice (`:520–529`) currently reads, verbatim:

> **Outside current home visit area:** We currently cover Luton, Dunstable, Houghton Regis, Harpenden and
> St Albans. Use a covered town before choosing a time.

This is a **command to pick a different town**, which becomes actively wrong once out-of-zone is bookable
— it needs full replacement, not a tone change. Restyle it as informational (the same treatment as the
covered notice at `:510–518`, not `styles.noticeError`), reading roughly: *"This address is outside our
free-travel areas. A travel charge applies, measured from {origin}. We'll confirm the exact amount before
your booking is confirmed."*

**A required checkbox the earlier pass of this plan did not name** —
`src/features/booking/components/ConfirmStep.tsx:232–236`, inside the required `paymentAcknowledged`
checkbox (block `:225–243`):

> I understand payment is taken in person by cash or card and the amount due is based on the selected
> service and participant count.

Once a travel fee can apply, this is incomplete — it must become something like *"...based on the selected
service, participant count, and any travel charge for your area."* This is a **correction to existing
copy**, distinct from the "restate it plainly beside the existing payment reassurance" instruction (which
targets the `.reassurance` divs at `:266–280` and is *new* text) — both edits are needed, in the same file,
and are easy to conflate into just one.

**Admin, on the booking** — `BookingManagementForm.tsx`, `StatusAndPaymentSection` (`:689–938`). Add an
alert that the address is outside the free-travel zone (fed by `getBookingDetailData`'s new fetch, §8.6)
and a travel-fee input mirroring `AmountPaidInput` (§8.6). **This must land in the same commit/release as
Phase 3's fee field** — the bypass (`QUICK_ACTIONS` confirm chip) exists the instant the fee field ships
without the chip-gating, so Phase 5's chip-hiding cannot trail Phase 3.

**Emails — one shared renderer covers everything, once the fee is folded in.** `renderSummary`
(`templates.ts:243–259`, total at `:255–257`) is called from **13 sites** (grep-confirmed: 444, 470, 494,
517, 539, 560, 588, 612, 629, 1017, 1082, 1141, 1209). `renderBookingPlainText` (`:635–674`, total at `:668`)
is called from **9** production sites in `notifications.ts` (650, 671, 728, 750, 792, 981, 1003, 1040,
1065). **13 + 9 = 22 send sites, all numerically correct with zero email edits**, because both functions
read `input.totalPrice`, a value already inclusive of the fee once it's folded.

For a **labelled** *"Travel charge: £X"* line — recommended for transparency — the touch points are
**8, not 7**:

| # | Symbol | Currently at |
|---|---|---|
| 1 | `renderSummary` | `templates.ts:243–259` |
| 2 | `renderBookingPlainText` | `templates.ts:635–674` |
| 3 | `BookingEmailTemplateInput` interface | `templates.ts:16–30` |
| 4 | `buildVarMap` | `templates.ts:87–107` (function closes at 107; `totalPrice:` is at `:102`) |
| 5 | `BOOKING_EMAIL_SELECT` | `notifications.ts:123–138` — add `travel_fee` |
| 6 | `getBookingTemplateInput` | `notifications.ts:216–265`, total at `:255` — add `travelFee: Number(booking.travel_fee ?? 0)` |
| 7 | `SAMPLE_TEMPLATE_INPUT` | `sample-data.ts:46–67`, `totalPrice: 65` at `:53` — add a sibling `travelFee:` line |
| 8 | `BOOKING_SUMMARY_FIXED_PART` | `src/app/admin/emails/components/templates-data.ts:137–140` |

*Correction: the earlier pass of this section cited "7 spots" including `sample-data.ts:173`. Line 173 is
`renderBookingPlainText("Booking confirmation", SAMPLE_TEMPLATE_INPUT, overrides)` — a dispatch-table entry
that forwards the whole input object and needs **no edit**. The real touch point in that file is
`SAMPLE_TEMPLATE_INPUT` itself, lines 46–67 (row 7 above). Separately, `BOOKING_SUMMARY_FIXED_PART`
(row 8) was entirely missing from the earlier list: it's a shared constant reused by 13 template registry
entries (grep-confirmed lines 574, 593, 615, 647, 662, 675, 694, 713, 767, 781, 793, 812, 859 — the same 13
templates that call `renderSummary`) and reads *"Built from the booking's date, time, address and total
price."* — it drives the admin editor's "Filled automatically" panel and goes stale the moment a labelled
travel-charge line is added to the HTML it describes. Update it in the same commit.*

**⛔ Guardrail — where the labelled line must live.** `resolveTemplateOverrides` (`templates.ts:689–711`)
returns a `{field_key: value}` map consumed only by `substituteVars` against a fixed catalogue of
overridable `SafeField` kinds (`greeting_intro`, `body_intro`, etc. — see `templates-data.ts`'s header
comment, lines 22–24). **`renderSummary` and `renderBookingPlainText` are not on that list** — confirmed by
reading both bodies: they embed `formatMoney(input.totalPrice)` directly in a fixed HTML/text literal, not
through any override. **The travel-charge line must be added inside these fixed functions, never as a new
overridable `SafeField`.** If it were ever added as an overridable field instead — especially appended to
an *existing* field's default text (e.g. `greeting_intro`) — any template with a saved override on that
field would never render the new line, silently, because overrides replace the whole field's rendered
text. This risk does not materialise as long as the implementation follows this instruction; it is a stop
condition (below) if a future change proposes the alternative.

**The request-received email shows the pre-fee total — this is correct behaviour, reword don't refactor.**
`sendBookingCreatedEmails` (`notifications.ts:608–677`) sends at booking creation, before any admin action
can set `travel_fee` — verified: the fee only exists via `updateBookingManagement`'s payload, which
requires an existing row. The customer sees £45, then £59 on confirmation. This is lawful (a request, not a
contract) but reads badly — reword the request-received copy to say a travel charge will be confirmed,
rather than implying the total shown is final. No code change to the send timing.

**Customer's manage page** — `booking/manage/page.tsx:206–243`, `Row label="Total"` at `:227`, fed by
`customer-manage.ts:37,206`. Numerically correct automatically (§8.6); this phase adds the same line-item
split to explain *why*, copy-only.

**Symbols to edit, full list for this phase:**
`AboutYouStep.tsx` (`:56–58`, `:123–131`, `:520–529`) · `ConfirmStep.tsx` (`:232–236` **and** `:266–280`) ·
`booking-detail-data.ts` (`getBookingDetailData`, already listed under Phase 3) ·
`BookingManagementForm.tsx` (`StatusAndPaymentSection`, already listed under Phase 3) ·
`templates.ts` (`renderSummary`, `renderBookingPlainText`, `BookingEmailTemplateInput`, `buildVarMap`) ·
`notifications.ts` (`BOOKING_EMAIL_SELECT`, `getBookingTemplateInput`) · `sample-data.ts:46–67` ·
`templates-data.ts:137–140` · `customer-manage.ts` / `booking/manage/page.tsx:227` (copy-only).

**Blast radius — proven NOT affected.** Every `renderSummary`/`renderBookingPlainText` caller not in the
touch-point list (all 22 − the ones edited directly = the remaining call sites) needs **zero** changes,
because both functions are called with an `input` object built by the touch points above — editing the
function body and the input-builders is sufficient; the call sites themselves pass the object through
unchanged. Confirmed by reading both function signatures: neither takes a fee parameter separately from
`input`.

**Verification for this batch:**
```
npx tsc --noEmit
npx vitest run src/lib/email/__tests__/sendBookingConfirmedClientEmail.test.ts   # existing file
npx vitest run src/lib/email/__tests__/sample-data.test.ts                       # existing file, sample input shape
npx vitest run src/app/admin/bookings/BookingManagementForm.test.tsx             # existing file
npx vitest run                                                                    # full suite, same rule as Phase 3
pnpm lint
git status --porcelain -- src/ supabase/
```

---

### 8.9 Pre-implementation review — the sweep that must happen FIRST

**Do not start coding from §8.6–8.8 alone.** Their file:line references were re-verified 2026-08-11 and
this repo has repeatedly proven anchors drift. Run this review first and reconcile any difference before
the first edit.

**A.** Re-derive the enforcement map (Phases 1–2's three gates). Re-run
`SELECT proname FROM pg_proc WHERE prosrc ILIKE '%allowed_cities%'` — if it returns anything besides
`create_booking_request`, **stop and re-plan**.

**B.** Enumerate every reader of `total_price`/`amount_due`, diff against the **17-site list in §8.6**
(not the earlier "~15" figure). Anything present in the code and absent from that list is a gap in the
plan — report it before proceeding.

**C.** Trace the money path end-to-end for one worked example: £45 service, 2 participants, £14 travel fee.
`v_total_price := 45 × 2 = 90` at creation (`create_booking_request`, one-time). The fee is then applied as
a delta on the already-multiplied stored value: `total_price = 90 − 0 + 14 = 104`. **Assert `total_price =
104`, not `(45 + 14) × 2 = 118`.** This holds only because the fee delta operates on `total_price` as
stored, never on a fresh `service_price × participant_count` recompute — no such recompute path exists
today (the only writers are the three in §8.7 plus the Phase-3/4 deltas), but if one is ever added, it must
add `travel_fee` strictly after the multiply. This example, with the pence-rounding rule from §8.6, belongs
in the test suite permanently (§8.10).

**D.** Audit every customer-facing statement about service area or travel charges, before changing
behaviour. The confirmed list: `AboutYouStep.tsx:520–529` (full replacement, not tone change),
`AboutYouStep.tsx:56–58`/`:123–131` (must read the live list), `ConfirmStep.tsx:232–236` (the payment
acknowledgement checkbox — **not the same edit** as the new restatement at `:266–280`), the
request-received email (`notifications.ts:608–677`, reword only), the manage page (copy-only).
Marketing/area pages are out of scope per the Owner — recorded so the omission is deliberate; several such
statements are already false today, independently of this work.

**E.** Confirm the email-timing guarantee still holds by reading both confirm paths at their current lines
(`actions.ts:561–565` and `:893–898`). If the send ever moves before the DB write, the design breaks
silently.

**F.** Verify the recurring cron's shape — whether it still bypasses the participant multiply
(`group_booking: false`), and whether any other writer creates occurrences (the three-writer grep in §8.7
is the check).

**G.** Record the live `business_settings` row before touching anything, so the semantic flip in Phases
1–2 can be reversed exactly. (Recorded already, 2026-08-11: `allowed_cities = ["Luton","Dunstable"]`.)

### 8.10 Tests and guards

**Guards against re-introducing the contradiction (Phases 1–2, unchanged from the existing plan):**
- A test that fails if a hardcoded town/city list appears under `src/features/booking/` or
  `src/lib/booking/`.
- A test asserting the public booking form's town list and `business_settings` agree.

**Named tests for Phases 3–5, each with its exact file:**

| Test (`it()` text) | File |
|---|---|
| `"folds the fee into total_price using (service × participants) + fee, not (service + fee) × participants"` | New: `src/app/admin/bookings/__tests__/updateBookingManagement-travelFee.test.ts` |
| `"rejects a travel-fee change on a completed booking"` | Extend `src/app/admin/bookings/__tests__/updateBookingManagement-completed-guard.test.ts` |
| `"rejects a travel-fee change on a fully-paid booking (amount_paid >= amount_due)"` | Same file |
| `"allows an unchanged travel fee submitted alongside another edit on a completed booking"` | Same file |
| `"allows setting the fee and marking the booking paid in the same save"` | Same file |
| `"does not lock the travel fee on a cancelled booking"` | Same file |
| `"tracks total_price and amount_due through set, change, and clear of a travel fee, and never moves amount_paid"` | `updateBookingManagement-travelFee.test.ts` |
| `"remains correct for outstanding balance and mark-paid after a fee is added to a part-paid booking"` | `updateBookingManagement-travelFee.test.ts` |
| `"hides the quick-confirm chip when the address is outside the free-travel zone and travel_fee is 0"` | `src/app/admin/bookings/BookingManagementForm.test.tsx` (existing file) |
| `"shows the quick-confirm chip when travel_fee is non-zero or the address is inside the zone"` | Same file |
| `"propagates the template's travel fee to newly generated occurrences"` | `src/app/api/cron/__tests__/extend-recurring-horizons.test.ts` (existing file) |
| `"applies a series travel-fee change to future pending/confirmed occurrences and skips completed or fully-paid ones, reporting both counts"` | New: `src/app/admin/bookings/__tests__/setSeriesTravelFee.test.ts`, mirroring `cancelRecurringSeries.test.ts`'s structure |
| `"never updates past, completed, or cancelled occurrences when the series fee changes"` | Same new file |
| `"applies p_travel_fee to the first materialised batch of a new series"` | Extend `src/app/admin/bookings/__tests__/createRecurringSeries.test.ts` (existing file) |
| `"sends the confirmation email with the fee-inclusive total"` (mailer mocked, no real sends) | Extend `src/lib/email/__tests__/sendBookingConfirmedClientEmail.test.ts` (existing file) |
| `"includes travelFee in the sample template input used for admin preview"` | Extend `src/lib/email/__tests__/sample-data.test.ts` (existing file) |
| `"parses and generates slots for an out-of-zone city (Manchester) instead of rejecting it"` | Rewrite the existing assertion in `booking-schema.test.ts:39–47` |

**Tests for the Owner-decided guards, each proving rather than assuming:**
- Owner-only mileage origin: Admin change rejected server-side; Owner change succeeds; Admin submitting the
  form with the origin *unchanged* still succeeds (the regression that would otherwise lock Admins out of
  settings entirely).
- Minimum one free-travel area: submitting an empty list fails with the reworded message.
- Series control: writing the series fee updates the template and future occurrences, skips
  completed/fully-paid ones without failing the batch, reports counts; a per-booking override still wins
  for that visit; the UI marks an inherited fee as coming from the series.
- Changing the free-travel list in settings changes the booking-page notice without a deploy (cache-tag
  invalidation, `TAGS.SETTINGS`, already proven to work for `getPublicBookingWindow`).

### 8.11 Non-goals and recorded decisions

Unchanged from the existing plan — no distance calculation/API/geocoding, no hard outer service boundary,
`mileage_origin` is descriptive only, marketing/area-page copy is out of scope, no travel-time-aware
availability. Nothing in this deepening pass changes any of these.

### 8.12 Effort and commit shape

| Phase | Scope | Files | Migrations |
|---|---|---|---|
| 1 | Settings: rename, origin field, Owner-only permission, copy rewrite | ~6–8 | **2** (rename + new permission) |
| 2 | Remove 3 gates, single source of truth, prop threading | ~8–10 | 1 |
| 3 | `travel_fee` on bookings, write path, lock, audit | ~4–5 | 1 |
| 4 | Recurring propagation + series-level control | ~5–7 | **2** (column + `CREATE OR REPLACE FUNCTION create_recurring_booking_series`) |
| 5 | Customer notice, admin field, chip gating, emails | ~10–12 | 0 |

*Correction: Phase 4's file count moves from "~4–6" to "~5–7" to include the new
`SeriesTravelChargeForm.tsx` component and the `format.ts` registration; its migration count moves from 1
to 2 (§8.7). Item 8's total migration count across all five phases is **6** (2 + 1 + 1 + 2 + 0), not the
"4 migrations" the previous revision quoted.*

**Realistically 2–3 days.** Phases 1–2 are worth doing on their own merits: they fix a live defect that
turns away customers in towns the site says it covers.

```
feat(settings): free-travel areas + mileage origin, replacing the allowed-cities gate
feat(booking): out-of-area addresses are bookable, with one source of truth for the town list
feat(bookings): admin-set travel charge folded into the booking total
feat(bookings): recurring series carry their travel charge to every occurrence
feat(booking): communicate the travel charge on the booking page, admin view and emails
test(booking): guards against a second hardcoded town list
```

**Ordering note:** Phase 2 must not ship before Phase 1 (the form needs the setting to read). Phase 5's
chip-gating must land with Phase 3, not after — the bypass exists in between otherwise.

### 8.13 Stop conditions (Phases 3–5)

1. `SELECT proname FROM pg_proc WHERE prosrc ILIKE '%allowed_cities%'` returns anything besides
   `create_booking_request` when re-run at implementation time — a second consumer has appeared since this
   audit.
2. `information_schema.columns` shows `bookings.travel_fee` or `recurring_booking_templates.travel_fee`
   already exists before the corresponding migration runs — something added it out-of-band.
3. The fully-paid skip in the series action is about to be implemented as a single PostgREST
   `.update().filter("amount_paid","lt","amount_due")` call instead of the two-step
   fetch-then-partition-then-update shape in §8.7 — this cannot work as a single call.
4. A labelled travel-charge line is proposed for an *overridable* email field (a new `SafeField` kind)
   rather than inside the fixed `renderSummary`/`renderBookingPlainText` bodies — this reintroduces the
   silent-override-drops-it risk described in §8.8.
5. Any "recalculate total_price from scratch" code path is proposed anywhere in the codebase — it must add
   `travel_fee` strictly after `service_price × participant_count`, never fold it into the multiply (§8.9C).
6. `pnpm lint` gains a lint error in any file outside the current six-file baseline as a direct result of
   this work — the six-file `{file, ruleId}` identity is the gate, not a bare pass/fail.
7. The full vitest suite shows a failure in a test **not** among the five documented baseline failures (or
   the documented sixth flake) — treat as a real regression, not more flake, until proven otherwise by
   isolating the file.

### 8.14 Rollback (Phases 3–5)

Nothing in Phases 3–5 is irreversible.
- Both `travel_fee` migrations (bookings, recurring_booking_templates) are single `ADD COLUMN` /
  `DROP COLUMN` pairs — additive, `not null default 0`, no rewrite of existing rows, no data loss on
  rollback.
- `create_recurring_booking_series`'s `CREATE OR REPLACE FUNCTION` migration rolls back via a further
  `CREATE OR REPLACE FUNCTION` restoring the prior body verbatim from `c02…sql` — standard for this
  codebase's existing multi-generation function history.
- Every application-code change (write paths, UI, emails) is an ordinary reversible commit. None are
  irreversible once the `travel_fee` columns exist and default to `0` — a full revert simply stops
  writing/reading them, and every one of the 17 flat-scalar read sites in §8.6 continues to work unchanged,
  since none of them ever depended on `travel_fee` existing.
- No email is sent, no financial write occurs, and no migration is applied by drafting or reviewing this
  plan — all of the above describes what an implementer will do, not anything done in this pass.
