# Z1 — Money correctness, Item 8 Phase 3 App

Read-only derivation. Lens: **money correctness only**. Everything below was
independently re-read from source after the three prior derivation reports
(Q1-actions.md, Q2-form.md, Q3-data-and-tests.md) — those reports were read
first for context, then every line number and every arithmetic claim was
re-verified against the live file, not trusted from the reports or from the
plan.

**Repo state at read time**: the implementation is materially further along
than any of the three prior reports captured. `git status --porcelain`
shows the feature essentially complete and under its own test coverage:

```
 M src/app/admin/bookings/BookingManagementForm.test.tsx
 M src/app/admin/bookings/BookingManagementForm.tsx
 M src/app/admin/bookings/[bookingId]/booking-detail-data.ts
 M src/app/admin/bookings/[bookingId]/page.tsx
 M src/app/admin/bookings/__tests__/BookingCard.test.tsx
 M src/app/admin/bookings/__tests__/view-predicates-parity.test.ts
 M src/app/admin/bookings/actions.ts
 M src/app/admin/bookings/bookings-list-data.ts
 M src/app/admin/bookings/types.ts
 M src/lib/maintenance.ts   (pre-existing baseline dirty path, unrelated)
?? src/app/admin/bookings/__tests__/updateBookingManagement-travelFee.test.ts
?? src/lib/booking/__tests__/travel-fee.test.ts
?? src/lib/booking/travel-fee.ts
?? supabase/migrations/20260812000500_item8_phase3_bookings_travel_fee.sql
```

`updateBookingManagement` now opens at **line 289** (not 284 — the file grew
by 5 lines since Q1's read, from the new `travel_fee` form-parsing lines
313–320). Every subsequent line-number claim below is my own fresh read at
this snapshot, not carried over from the prior reports.

---

## 1. The exact arithmetic, and proof on all five cases

### The implementation (`src/lib/booking/travel-fee.ts`)

```ts
61  export function toPence(value: number | string | null | undefined): number {
62    const parsed = Number(value ?? 0);
63    return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
64  }

67  export function fromPence(pence: number): number {
68    return pence / 100;
69  }

93  export function applyTravelFeeDelta(
94    input: TravelFeeDeltaInput
95  ): TravelFeeDeltaResult {
96    const deltaPence =
97      toPence(input.nextTravelFee) - toPence(input.previousTravelFee);
98
99    return {
100     totalPrice: fromPence(toPence(input.totalPrice) + deltaPence),
101     amountDue: fromPence(toPence(input.amountDue) + deltaPence),
102   };
103 }
```

**The rule, in words**: `deltaPence = toPence(next) − toPence(previous)`;
`newTotalPricePence = toPence(storedTotalPrice) + deltaPence`;
`newAmountDuePence = toPence(storedAmountDue) + deltaPence`; convert back to
pounds with `fromPence`. `amount_paid` is never read or written by this
function — confirmed by its signature (`TravelFeeDeltaInput` has no
`amountPaid` field) and by the doc comment directly above it: *"`amount_paid`
is deliberately never touched: what the customer has already handed over does
not change because the charge did."*

### (a) 45.00 × 2 participants, fee set 0 → 14.30

Stored before: `total_price = 90.00`, `amount_due = 90.00` (unpaid).
`deltaPence = toPence(14.30) − toPence(0) = 1430 − 0 = 1430`.
`newTotalPricePence = toPence(90.00) + 1430 = 9000 + 1430 = 10430` → **£104.30**.
`newAmountDuePence` — same delta → **£104.30**.
`amount_paid` — untouched, stays **£0.00**.

Naive float (`90 + 14.30`) happens to also print `104.3` in IEEE-754 for this
specific pair — no visible drift on this one case. That is exactly the trap:
whether a given pair of decimals drifts under naive float math is
data-dependent, not something you can predict from the numbers looking
"round." The codebase's own next case is the one that does drift.

### (b) same booking, fee changed 14.30 → 20.10

Stored before (from case a): `total_price = 104.30`, `amount_due = 104.30`.
`deltaPence = toPence(20.10) − toPence(14.30) = 2010 − 1430 = 580`.
`newTotalPricePence = toPence(104.30) + 580 = 10430 + 580 = 11010` → **£110.10**.
`newAmountDuePence` — same → **£110.10**.

Verified live (`node -e`) that the codebase's own canonical drift example,
`45.3 − 14.3 + 20.1`, produces `51.099999999999994` in JS, not `51.1`
(confirmed: `(45.3 - 14.3 + 20.1) === 51.1` → `false`). The 104.30/14.30/20.10
triple I used above happens not to drift in JS float64, but that is
incidental to this specific bit pattern, not a property of decimal
subtraction in general — the codebase's own test suite
(`src/lib/booking/__tests__/travel-fee.test.ts:31-42`) picked the one triple
that does drift specifically to prove the pence path is needed unconditionally,
not just for "unlucky" numbers. A naive implementation that looks correct on
manual spot checks (like case a and case b above) can still be silently wrong
on other, equally realistic fee values — which is the whole argument for
never trusting float subtraction here regardless of whether today's example
happens to look clean.

### (c) fee cleared 20.10 → 0

Stored before (from case b): `total_price = 110.10`, `amount_due = 110.10`.
`deltaPence = toPence(0) − toPence(20.10) = 0 − 2010 = −2010`.
`newTotalPricePence = 11010 − 2010 = 9000` → **£90.00** — back to the
pre-fee baseline exactly, no accumulated drift across three edits (this is
also directly asserted in `travel-fee.test.ts:45-70`,
`"moves total_price and amount_due by the same delta through set, change and
clear"`, which chains exactly this a→b→c sequence and asserts
`{ totalPrice: 90, amountDue: 90 }` at the end).

### (d) part-paid booking (total 90, due 90, paid 30) gaining a 14 fee

`deltaPence = toPence(14) − toPence(0) = 1400`.
`newTotalPricePence = 9000 + 1400 = 10400` → **£104.00**.
`newAmountDuePence = 9000 + 1400 = 10400` → **£104.00**.
`amount_paid` — untouched, stays **£30.00**.
Outstanding balance after: `104.00 − 30.00 = 74.00`, not `90.00 − 30.00 =
60.00` — the fee correctly raises what is still owed. (Same numbers as
`travel-fee.test.ts:72-84`.)
Naive float `90 + 14 = 104` — no drift on integers, so this case does not by
itself distinguish naive vs. pence-safe; it is here to prove `amount_paid`
isolation, which it does: nothing in `applyTravelFeeDelta`'s inputs or output
shape can touch it.

### (e) a booking whose `total_price` is NULL

`toPence(null) = Number.isFinite(Number(null ?? 0)) ? Math.round(0*100) : 0
= 0`. With `previousTravelFee = 0` (or whatever it actually was — take 0 for
"never had a fee") and `nextTravelFee = 14`:
`deltaPence = 1400 − 0 = 1400`.
`newTotalPricePence = toPence(null) + 1400 = 0 + 1400 = 1400` → **£14.00**,
not `NaN`, not `null`. Same for `amount_due` if it is also null.
Directly asserted in `travel-fee.test.ts:86-97`,
`"treats a null total_price or amount_due as zero rather than producing
NaN"` → `expect(result.totalPrice).toBe(14)`,
`expect(Number.isNaN(result.totalPrice)).toBe(false)`.

A naive implementation matters here in a way the other cases don't, and the
distinction is `null` vs `undefined`, not float vs pence:
- `null - 0 + 14` in plain JS coerces `null` to `0` and gives `14` — the
  right answer, by luck of JS's `null`→`0` numeric coercion.
- `undefined - 0 + 14` in plain JS gives **`NaN`** — verified live
  (`node -e`). If a hand-rolled version ever read a *missing* key (e.g. a
  narrowed `select()` that omits `total_price`, so
  `beforeState.total_price` is `undefined`, not `null`) instead of going
  through `toPence`'s `Number(value ?? 0)` guard, the naive arithmetic would
  write `NaN` straight into a `numeric(10,2)` column — which Postgres/PostgREST
  will reject at the driver boundary or coerce unpredictably, either way a
  worse failure than a wrong number. `toPence` closes this off for *both*
  `null` and `undefined` inputs by construction (`Number(undefined ?? 0)` is
  `Number(0)` is `0`, same as `null`).

**Summary table**

| Case | total_price | amount_due | amount_paid |
|---|---|---|---|
| (a) 0→14.30 | 90.00 → **104.30** | 90.00 → **104.30** | unchanged (0.00) |
| (b) 14.30→20.10 | 104.30 → **110.10** | 104.30 → **110.10** | unchanged |
| (c) 20.10→0 | 110.10 → **90.00** | 110.10 → **90.00** | unchanged |
| (d) part-paid +14 | 90 → **104.00** | 90 → **104.00** | unchanged (30.00) |
| (e) total_price NULL, +14 | NULL → **14.00** | NULL → **14.00** | unchanged |

---

## 2. Every way the delta can double-charge or under-charge

### 2a. The beforeState-select-omits-`travel_fee` risk — quantified

**Current code is NOT exposed to this.** Both `beforeState` reads in this
file (`updateBookingManagement` at lines 352–356, and `quickUpdateBooking`'s
own at line ~820 in the current file — not touched by this feature) are bare
`.select("*")` wildcards, so `travel_fee` is already present on `beforeState`
with zero select changes. Confirmed by direct read:

```
352    const { data: beforeState } = await adminClient
353      .from("bookings")
354      .select("*")
355      .eq("id", bookingId)
356      .single();
```

But the task explicitly asks what goes wrong if it *were* narrowed — and the
answer is a clean, quantifiable double-charge, not a crash, which is what
makes it dangerous: `const previousTravelFee = Number(beforeState.travel_fee
?? 0);` (line 366) would silently read `undefined ?? 0 = 0` instead of
throwing, so nothing signals the bug at runtime.

**Worked example — the SECOND fee edit, from case (b) above:**
Booking already carries `travel_fee = 14.30`, `total_price = 104.30` (the
result of the first edit). Admin now changes the fee to `20.10`.

- **Correct** (current code): `previousTravelFee = 14.30` (read for real).
  `deltaPence = toPence(20.10) − toPence(14.30) = 2010 − 1430 = 580`.
  `newTotalPricePence = toPence(104.30) + 580 = 11010` → **£110.10**.
- **Bugged** (hypothetical narrow select omitting `travel_fee`):
  `previousTravelFee = Number(undefined ?? 0) = 0`.
  `deltaPence = toPence(20.10) − toPence(0) = 2010 − 0 = 2010`.
  `newTotalPricePence = toPence(104.30) + 2010 = 10430 + 2010 = 12440` →
  **£124.40**.

**Overcharge = £124.40 − £110.10 = £14.30 — exactly the size of the fee that
should have been netted out.** The mechanism is precise: every time the
`beforeState` read can't see the *previous* fee, the code adds the *new* fee
on top of a total that already contains the *old* fee, instead of replacing
one with the other. This compounds on every subsequent edit if the select
stays narrow (a third edit would stack a third phantom charge on top), and
nothing in the type system or a happy-path test would catch it, because
`beforeState.travel_fee` being `undefined` is not a TypeScript error against
an untyped `Record<string, unknown>` row from the admin client. **This is a
real fragility, not a currently-live bug**: if a future refactor narrows
either `beforeState` select to an explicit column list, this exact failure
mode reappears with no compiler or runtime signal. Flagging it as the single
highest-value thing to guard in review of any future touch to this file.

### 2b. The `wasFullyPaid` lock does not fall back to `total_price`

```
372    const previousAmountDue = Number(beforeState.amount_due ?? 0);
373    const previousAmountPaid = Number(beforeState.amount_paid ?? 0);
374    const wasFullyPaid =
375      previousAmountDue > 0 && previousAmountPaid >= previousAmountDue;
```

This is a **read**, not a write, so it cannot itself double- or under-charge
the totals — but it can under-*lock*, which has the same practical effect: a
fee edit that should have been refused goes through. `amount_due` is
nullable with no scale constraint (per the task brief and the live schema).
If `amount_due` is `NULL` on a booking that is nonetheless fully paid (e.g.
`total_price = 90`, `amount_paid = 90`, `amount_due` never populated —
possible because the column is independently nullable, even though the
`create_booking_request` RPC populates it at creation time in the normal
path, confirmed at `supabase/migrations/20260513120100_...sql:353`), then
`previousAmountDue = Number(null ?? 0) = 0`, so `wasFullyPaid = (0 > 0) =
false` — **the lock does not fire**, and a fee change is allowed on a
booking that is, by `total_price`/`amount_paid`, actually fully paid.

Notably, this file's own sibling function has a fallback for exactly this
asymmetry — `quickUpdateBooking` computes `Number(beforeState.amount_due ??
beforeState.total_price ?? 0)` — but the new `wasFullyPaid` check does not
reuse that idiom; it falls back only to `0`, not to `total_price`. This is a
genuine, if narrow, gap: it depends on `amount_due` being null in practice,
which the normal creation path prevents but the schema does not.

### 2c. Read-modify-write race — systemic, not fee-specific, but money-relevant

`updateBookingManagement` reads `beforeState` (line 352), computes an
absolute `total_price`/`amount_due` from it, then issues a plain
`.update(payload).eq("id", bookingId)` (unchanged in this diff) with no
optimistic-concurrency check (no `.eq("total_price", beforeState.total_price)`
or version column). Two concurrent saves against the same booking — e.g. two
admin tabs, or an admin and a scheduled process — each read the same stale
`beforeState`, each compute their own absolute total from it, and whichever
`.update()` lands last simply overwrites the row. Concretely: admin A reads
`total_price=90, travel_fee=0`, sets fee to 14, computes and writes
`total_price=104`. Admin B, reading before A's write lands, also sees
`total_price=90, travel_fee=0`, sets fee to 20, computes and writes
`total_price=110` — silently discarding A's write; the final row shows
`travel_fee=20, total_price=110`, with no record that A's edit ever
happened. This is a **lost update**, not a double-charge, and it is a
pre-existing pattern in this file (the same race exists today for `status`,
`amount_paid`, every other field this action writes) — not introduced by
the travel-fee feature. Flagging because the fee's delta-on-stored-value
design makes the *consequence* of the race a wrong money total, where for
`status` the consequence is merely a wrong status.

### 2d. "Cancelled is NOT locked" is true only when the cancelled booking isn't also fully paid

The lock is exactly two conditions, checked independently (lines 377–391):
`beforeState.status === "completed"`, or `wasFullyPaid`. There is no third
condition naming `cancelled`, so a cancelled-but-not-fully-paid booking is
correctly never locked — proven by the existing test
(`updateBookingManagement-travelFee.test.ts:340-352`,
`"does not lock the travel fee on a cancelled booking"`, using
`BASE_BOOKING` where `amount_due=90, amount_paid=0`, i.e. not fully paid).
But **a cancelled booking that also happens to be fully paid** (customer
paid, then the booking was cancelled) **is still locked**, via the
`wasFullyPaid` arm — the two conditions are independent, and nothing
exempts `cancelled` status from the fully-paid check. The task's brief states
flatly "Cancelled is NOT locked"; the code satisfies that only in the sense
that cancelled was never coded as a third gate, not in the sense that a
cancelled booking can never be locked for any reason. No test in the suite
covers a cancelled-and-fully-paid booking, so this combination is untested
either way. Whether this is the intended behaviour (a fully-paid cancelled
booking arguably *should* stay locked, same as any other fully-paid
booking) or a gap against the brief's literal wording is a product decision,
not something I can resolve from the code — flagging it as the one place the
implementation's actual predicate and the brief's plain-English statement
could be read to disagree.

---

## 3. Null-handling rules actually implemented

Enumerated from `toPence`/`fromPence`/`applyTravelFeeDelta`/`parseTravelFee`
(all quoted in full in §1) plus the calling code in `actions.ts`:

1. **`travel_fee` itself**: DB column is `numeric(10,2) NOT NULL DEFAULT 0`
   (`supabase/migrations/20260812000500_item8_phase3_bookings_travel_fee.sql:26`)
   — never actually `NULL` on a real row. The read code still defensively
   coalesces (`Number(beforeState.travel_fee ?? 0)`, line 366), which is
   redundant given the constraint but harmless, and protects against the
   theoretical case of a row fetched through a code path that doesn't
   include the column.
2. **`total_price` / `amount_due` as inputs to the delta**: both nullable in
   the schema. `toPence(value)` does `Number(value ?? 0)`, so `null`,
   `undefined`, and unparseable strings all collapse to `0` pence — never
   `NaN`. Verified this holds for `undefined` too (not just `null`), which
   matters because a narrowed `select()` produces `undefined` for an omitted
   column, not `null`.
3. **Unparseable/garbage values** (`Number("garbage")` → `NaN`): guarded by
   `Number.isFinite(parsed) ? Math.round(parsed * 100) : 0` inside `toPence`
   — a `NaN` input collapses to `0` pence, not `NaN` pence, so it can never
   propagate into the arithmetic or the eventual write.
4. **`fromPence`**: `pence / 100` where `pence` is always an integer produced
   by `Math.round`, so the result is always a finite number — cannot itself
   introduce `NaN` or `Infinity` given `toPence`'s output range is bounded by
   real money values.
5. **The write itself only happens when the fee actually changed**:
   `travelFeeUpdate` (lines 398–413) is `{}` unless `travelFeeChanged &&
   travelFeeInput !== null`. So a booking whose `total_price`/`amount_due`
   are legitimately `NULL` and whose fee is never touched in a given save
   keeps them `NULL` — the feature only ever *writes* a concrete number into
   those columns when a fee change is actually being applied, never as a
   side effect of an unrelated field edit. Confirmed by
   `updateBookingManagement-travelFee.test.ts:229-245`,
   `"leaves the totals untouched when the fee is not part of the submitted
   form"` — asserts `payload` has neither `total_price` nor `amount_due` as
   keys at all (not merely `undefined` values) when `travel_fee` is absent
   from the FormData.
6. **`parseTravelFee`** is the gate on what can ever become `travelFeeInput`
   in the first place: `/^\d+(\.\d{1,2})?$/` rejects negatives, more than 2dp,
   scientific notation, and non-numeric text, returning `null` (which the
   caller turns into a field-level `fieldErrors.travel_fee`, refusing the
   whole save — line 344-347) rather than ever letting a malformed value
   reach `toPence`. An empty string is treated as `0` (no charge), not an
   error — distinct from `null` (field absent → no attempt to change the fee
   at all, `travelFeeSubmitted = false`).
7. **`amount_paid` in the general payload** (unrelated to the fee delta, but
   the other money field this same function writes): guarded upstream by
   `if (!Number.isFinite(amountPaid) || amountPaid < 0) fieldErrors.amount_paid
   = ...` (lines 341-343) before the payload is ever built, so `NaN` /
   negative values are rejected the same way, independently of the
   travel-fee logic.

Net effect: there is no code path in this feature by which `NaN` or an
unintended `null` can reach a `numeric` column — every conversion point
(`toPence`, `fromPence`, `parseTravelFee`) has its own guard, and the
guards compose (a garbage `previousTravelFee` becomes `0` pence, not `NaN`
pence, before it ever reaches the subtraction).

---

## 4. The completed/fully-paid lock — exact predicate and proof

Full block, byte-exact, current line numbers (offset confirmed against a
fresh `Read` at this snapshot, not carried from any prior report):

```
360    // ── Item 8 Phase 3 — the travel charge ────────────────────────────────────
361    // Evaluated against the booking as it stands BEFORE this submit, so setting
362    // the fee and marking the visit paid in the same save still works. Only a
363    // CHANGED fee is gated: an unchanged one re-posted alongside a note edit on a
364    // completed booking must still go through. Cancelled is deliberately NOT
365    // locked — a cancelled booking is not financial history.
366    const previousTravelFee = Number(beforeState.travel_fee ?? 0);
367    const travelFeeChanged =
368      travelFeeInput !== null &&
369      toPence(travelFeeInput) !== toPence(previousTravelFee);
370
371    if (travelFeeChanged) {
372      const previousAmountDue = Number(beforeState.amount_due ?? 0);
373      const previousAmountPaid = Number(beforeState.amount_paid ?? 0);
374      const wasFullyPaid =
375        previousAmountDue > 0 && previousAmountPaid >= previousAmountDue;
376
377      if (beforeState.status === "completed") {
378        return {
379          fieldErrors: {
380            travel_fee:
381              "This booking is completed — the travel charge can no longer be changed.",
382          },
383        };
384      }
385      if (wasFullyPaid) {
386        return {
387          fieldErrors: {
388            travel_fee:
389              "This booking is fully paid — the travel charge can no longer be changed.",
390          },
391        };
392      }
393    }
```

**The predicate, stated exactly**: refuse the save (return a field-level
error, do not proceed to build or write any payload) **iff**
`travelFeeChanged AND (beforeState.status === "completed" OR
(beforeState.amount_due > 0 AND beforeState.amount_paid >=
beforeState.amount_due))`. `travelFeeChanged` itself requires
`travelFeeInput !== null` (i.e. the field was actually submitted and parsed
to a real number) **and** a pence-level difference from
`beforeState.travel_fee` — so a resubmission of the same value is never
"changed," regardless of status or payment state.

### Does NOT lock a cancelled booking (with the caveat in §2d)

No condition in the block names `cancelled`. Proven directly by
`updateBookingManagement-travelFee.test.ts:340-352` using a booking with
`status: "cancelled"`, `amount_due: 90, amount_paid: 0` (not fully paid) —
the save succeeds and `travel_fee` is written. See §2d for the one
combination (cancelled **and** fully paid) where the fully-paid arm still
fires — that is a property of the fully-paid check being independent of
status, not of any cancelled-specific logic.

### Does NOT block an unchanged fee submitted alongside another edit

Both lock branches live entirely inside `if (travelFeeChanged) { ... }`
(line 371). If the admin resubmits the same fee value (or omits the field
entirely, e.g. from a Notes-only form), `travelFeeChanged` is `false` and
the whole block — including both `return`s — is skipped, no matter what
`beforeState.status` or `wasFullyPaid` are. Proven by
`updateBookingManagement-travelFee.test.ts:296-316`,
`"allows an unchanged travel fee submitted alongside another edit on a
completed booking"`: `beforeState.status = "completed"`,
`beforeState.travel_fee = 14`, form resubmits `travel_fee: "14"` (same
value) plus an `admin_notes` edit — `fieldErrors.travel_fee` is `undefined`
and the update proceeds.

### DOES allow setting the fee and marking it paid in the same save

The whole lock reads exclusively from `beforeState` — the row as it stood
**before** this submit — never from the values being submitted in this same
request. So if a booking is currently unpaid (`beforeState.amount_paid = 0 <
beforeState.amount_due`) and the admin's single submit both changes
`travel_fee` and sets `payment_status = "paid"` / `amount_paid = <new
total>`, `wasFullyPaid` is computed from the *old* `0 < 90`, evaluates
`false`, and the lock does not fire — even though the booking will be fully
paid the instant this save lands. Proven by
`updateBookingManagement-travelFee.test.ts:318-338`,
`"allows setting the fee and marking the booking paid in the same save"`:
starts from `BASE_BOOKING` (`amount_due: 90, amount_paid: 0`), submits
`travel_fee: "14", payment_status: "paid", amount_paid: "104"` in one
`FormData` — `fieldErrors.travel_fee` is `undefined`, and the resulting
payload carries `travel_fee: 14, total_price: 104, amount_paid: 104` all at
once.

### Where it sits relative to the payload build

Strictly before. The lock (lines 360–393, including both early `return`s)
runs, then `travelFeeUpdate` is computed (lines 395–413, only reachable if
the lock didn't already return), then a series of unrelated status/
cancellation guards (completed-reversal, future-date, cancellation
transition — lines 415–487, pre-existing, untouched by this feature), and
only then is the `payload` object literal opened:

```
489    const payload = {
490      ...travelFeeUpdate,
491      status,
```

So a locked save never reaches the `.update()` call at all (it returns
`{ fieldErrors }` directly from inside the lock), and an unlocked save's
`travelFeeUpdate` — computed from the same pre-submit `beforeState` the lock
just evaluated against — is spread into the payload first, before every
other field.

---

## 5. Does folding the fee into `total_price` break any of the 17 reader sites?

The "17 existing readers" figure is not just the design brief's — it is
restated verbatim in the migration file's own comment
(`supabase/migrations/20260812000500_item8_phase3_bookings_travel_fee.sql:19`:
*"which is what makes all 17 existing readers of those columns correct with
no code change"*), so whoever wrote the migration counted the same set this
report is spot-checking.

A repo-wide grep for `total_price|amount_due` outside `__tests__` and the
travel-fee/actions.ts files themselves returns roughly 17 production files
(reports, dashboard, clients, bookings list/detail, email templates, cron,
nav notifications). Read four of the highest-money-stakes ones directly, in
full:

1. **`src/app/admin/reports/reporting.ts:412-444`** (`summarizeReports`) —
   every revenue bucket (`bookedRevenue`, `collectedRevenue`,
   `outstandingRevenue`, `completedRevenue`, `expectedRevenue`) is computed
   as `amount(booking.total_price)`, `amount(booking.amount_paid)`,
   `Math.max(amountDue - amountPaid, 0)`, etc. — always the **stored**
   column, never a recompute from `booking_items.service_price_snapshot ×
   participant count`. **Stays correct**: a fee folded into `total_price`
   flows straight through into `bookedRevenue`/`expectedRevenue`, and
   folded into `amount_due` flows into `outstandingRevenue`, with no
   double-counting because nothing here re-derives the total independently.
2. **`src/app/admin/dashboard/dashboard-data.ts:596-598`** — passes
   `total_price`/`amount_due`/`amount_paid` straight through
   (`booking.total_price ?? null`, gated only by an `includeRevenue`
   RBAC flag, not recomputed). **Stays correct** for the same reason.
3. **`src/app/admin/clients/client-metrics.ts:73`** — client LTV:
   `ltv += toNumber(booking.amount_paid ?? booking.total_price)`. Reads the
   stored column directly. **Stays correct** — a fee-inflated `total_price`
   correctly raises a client's lifetime value once paid, which is the
   intended behaviour (the fee is real money the client owes/paid for that
   visit).
4. **`src/lib/email/notifications.ts:255`**
   (`getBookingTemplateInput`, used by every outbound booking email) —
   `totalPrice: Number(booking.total_price ?? 0)`. Even though this same
   function's booking fetch also includes
   `booking_items(..., service_price_snapshot, ...)` (line 141, used
   elsewhere in the template for the itemised line list), the headline total
   shown in the email is read from the stored `total_price` column, not
   summed from `booking_items`. **Stays correct** — confirms the fold-in
   design is safe for the customer-facing total even though the same
   payload also carries the unfolded per-item prices for display.
5. (Bonus fifth check) **`src/app/admin/bookings/BookingCard.tsx:229-230,
   436-437`** — `showSensitiveDetails && booking.amount_due ? \`
   ${formatMoney(booking.amount_due)}\` : ...` — direct read, no
   recomputation. **Stays correct**.

**No reader spot-checked recomputes `total_price` from
`service_price × participant_count` or sums `booking_items` snapshots into a
total** — every one reads the stored `total_price`/`amount_due`/`amount_paid`
columns as-is. This is exactly the precondition the fold-in design depends
on, and it held in all five sites checked. The one place that *does* carry
per-item prices alongside the total (`notifications.ts`, via
`booking_items`) uses them for a separate itemised display, not to
recompute the headline figure — so introducing a `travel_fee` line into that
same itemised display (a UI follow-up, not a money-correctness question) is
additive and would not require touching how the headline total is sourced.

---

## Findings summary (money-correctness lens)

1. **Arithmetic is correct on all 5 required cases** (§1), and the pence
   approach is provably necessary in general even though 3 of the 5
   requested cases don't individually exhibit float drift in this JS engine
   — the codebase's own test suite picked the `45.3/14.3/20.1` triple
   specifically because it does drift, proving the pence path is needed
   unconditionally, not just for unlucky inputs.
2. **The double-charge mechanism is real but not currently live**: both
   `beforeState` reads are `select("*")`, so `travel_fee` is always present.
   If a future change narrows either select to an explicit column list
   without `travel_fee`, the exact failure reappears silently — quantified
   at exactly the size of the fee being replaced (§2a).
3. **`wasFullyPaid` under-locks when `amount_due` is `NULL`** — it falls
   back only to `0`, not to `total_price` the way the sibling
   `quickUpdateBooking` does for the same asymmetry (§2b). Narrow risk in
   practice (creation path populates `amount_due`), real risk in schema.
4. **Read-modify-write race is systemic to this whole action**, not
   introduced by this feature, but its consequence for money fields is a
   silently lost update rather than a merely wrong status (§2c).
5. **"Cancelled is not locked" holds only when the cancelled booking isn't
   also fully paid** — a cancelled-and-fully-paid booking is still locked
   via the independent `wasFullyPaid` arm, untested either way (§2d). This
   may be intended (fully-paid history staying locked regardless of status)
   or a literal-wording gap against the brief — a product call, not a bug I
   can resolve from the code alone.
6. **Null-handling is airtight for `NaN`/`null`/`undefined`** on the money
   columns (§3) — every numeric conversion (`toPence`, `fromPence`,
   `parseTravelFee`) has its own guard and the guards compose.
7. **The lock predicate is exactly right on the four required proofs**
   (§4): not locking cancelled (with the §2d caveat), not blocking an
   unchanged fee, allowing fee+paid in one save, and evaluated strictly
   before the payload build, from pre-submit `beforeState` only.
8. **All 5 spot-checked reader sites stay correct** (§5) because none of
   them recompute the total from service price × participants — they all
   read the stored, now-fee-inclusive column directly, which is the
   precondition the whole fold-in design depends on.
