# Item 8, Phases 3–5 — deepening audit (fee, recurring propagation, communications)

Plan section audited: `redesign/plans/POST-BAND-C-FOLLOWUP-plan.md` lines 1058–1202 (§8.6–§8.12).
Repo: `rahmatherapy-next-refactor`. HEAD at audit time: `0ec700c` (one docs commit ahead of the
handoff's stated `86b8b22`; `src/` is unaffected). Supabase project `twzutkfgqclqurvkmvqz`, read-only
`execute_sql` only. No files under `src/`, `scripts/`, `e2e/`, `supabase/` were modified. No git writes.
No migrations applied.

Stance taken throughout: every plan sentence re-verified against the live schema or the current file,
re-located **by symbol**, not by trusting the stored line number. Where a citation matched exactly it is
recorded as confirmed with the command/read that proved it; where it did not, the drift is reported
explicitly.

---

## 1. Schema verification (SELECT-only)

```sql
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name IN ('bookings','recurring_booking_templates')
ORDER BY table_name, ordinal_position;
```

**`bookings`** — 48 columns. Money-relevant:
| column | data_type | nullable | default |
|---|---|---|---|
| `total_price` | numeric | YES | (none) |
| `amount_due` | numeric | YES | (none) |
| `amount_paid` | numeric | **NO** | `0` |

No `travel_fee` column exists yet (confirms the plan's premise).

**`recurring_booking_templates`** — 24 columns, **zero money columns**: no `total_price`, `amount_due`,
`amount_paid`, `price`, or anything price-shaped. This directly confirms plan §8.7's "stores the address
… but no money whatsoever — confirmed against the live schema." ✅ CONFIRMED.

**Precision — a finding the plan does not mention:**

```sql
SELECT table_name, column_name, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_schema='public' AND table_name='bookings'
  AND column_name IN ('total_price','amount_due','amount_paid');
```

| column | precision | scale |
|---|---|---|
| `total_price` | **10** | **2** |
| `amount_due` | null (unbounded) | null (unbounded) |
| `amount_paid` | null (unbounded) | null (unbounded) |

`total_price` is `numeric(10,2)` — the database itself rounds anything written there to 2dp. `amount_due`
and `amount_paid` are **bare `numeric`** with no scale constraint at all — nothing stops either column
from silently accumulating more than 2 decimal places if application code ever computes one. This is a
pre-existing schema inconsistency, not introduced by Item 8, but it is directly relevant to the new
`travel_fee` columns and to the delta-write arithmetic §8.6 specifies. See §7 below for the concrete
recommendation.

`amount()`/`toAmount()`/`toNumber()` — the three helpers this codebase uses everywhere money is read
(`reporting.ts:735-737`, `customer-manage.ts:150`, `client-metrics.ts:109`) — are all a bare
`Number(value ?? 0)`. **None of them round.** There is no existing rounding helper to reuse; the new
delta-write logic must introduce its own discipline (§7).

---

## 2. The "15 read sites" claim — re-derived

Command used (excluding tests/types, production code only):

```
grep -rn "total_price\|amount_due" src --include=*.ts --include=*.tsx \
  | grep -v "__tests__" | grep -v "\.test\.t"
```

Every hit was opened and classified as (a) a bare `select()` column-name string — not a "read" in the
sense the plan means — or (b) a genuine computed/displayed use.

**Every genuine use is confirmed a flat scalar read: none of them sum sub-components, none re-derive
from `booking_items`.** The plan's central design claim ("fold it in and every one is correct with zero
edits") **holds**. But the plan's own enumerated list of ~15 named sites is an **undercount** — I found
at least 4 more production read sites it never names:

| # | Site | Confirmed behaviour | In plan's list? |
|---|---|---|---|
| 1 | `nav-notifications.ts:287` | `Number(amount_due) - Number(amount_paid)` | ✅ named |
| 2 | `reporting.ts` `summarizeReports` (402-480, esp. 413-450) | 6 accumulators, all flat reads | ✅ named (as `:434`) |
| 3 | `reporting.ts` `getRevenueSeries` (499-518) | 3 accumulators, flat reads | ✅ named (as `:512`) |
| 4 | `actions.ts:764,783` (`quickUpdateBooking` mark_paid) | flat read | ✅ named |
| 5 | `reporting.ts` `getNetCollectionRate` (1313-1323) | flat read | ✅ named |
| 6 | `reporting.ts` `getAvgBookingValue` (1329-1338) | flat read | ✅ named |
| 7 | `client-metrics.ts:73,84` | flat read (LTV, avg) | ✅ named |
| 8 | `dashboard-data.ts:75,597` | select + conditional pass-through | ✅ named |
| 9 | `export/route.ts:70-86,104,155` | flat read, CSV | ✅ named |
| 10 | `customer-manage.ts:206` | flat read | ✅ named |
| 11 | `booking/manage/page.tsx:227` | flat read (`Row label="Total"`) | ✅ named |
| 12 | `BookingCard.tsx:229-230,436-437` | flat read, display | generic ("booking cards") |
| 13 | `[bookingId]/page.tsx:1439,1458` and `BookingDetailSidebar.tsx:141` | flat read, display | generic ("detail") |
| **14** | **`reporting.ts` `getNoShowRate` (1232-1254), `lostRevenue += amount(booking.total_price)` at 1245 and 1248** | flat read | **❌ NOT named anywhere in the plan** |
| **15** | **`reporting.ts` `getSourceAttribution` (1287-1307), `bookingRevenue = amount(booking.total_price)` at 1293** | flat read | **❌ NOT named** |
| **16** | **`clients-list-data.ts:313`, `const due = Number(row.amount_due ?? row.total_price ?? 0); … current.outstanding += Math.max(0, due - paid);`** — the clients-LIST page's own per-client outstanding-balance accumulator, structurally identical to `nav-notifications.ts:287` but a separate file/surface | flat read | **❌ NOT named** |
| **17** | **`src/app/admin/clients/[clientId]/page.tsx:1674`, `{formatMoney(booking.total_price)}`** — the client-detail page's booking-history row list | flat read, display | **❌ NOT named** (only "detail" is named, which reads as the *booking* detail page, not the *client* detail page) |

Verification commands used to confirm nothing in the plan's list references these four:

```
grep -n "getNoShowRate\|getSourceAttribution\|1231\|1245\|1248\|1284\|1293\|clients-list-data\|1674" \
  redesign/plans/POST-BAND-C-FOLLOWUP-plan.md
→ (no output — zero matches)
```

**Verdict: PARTIAL.** The design conclusion ("fold it in, zero edits needed") is correct and holds for
all 17 sites I found, not just the ~13 named. But "at least 15 read sites" is imprecise both in count and
enumeration — the true number of distinct production surfaces reading these two columns is at least 17,
and 4 of them (two `reporting.ts` functions, the clients-list outstanding accumulator, and the client-detail
page's booking row) are entirely absent from the plan's list. None of this changes the design (per the
plan's own stated test: "if ANY of them sums or re-derives, that changes the design" — none do), but an
implementer following the plan's list as a checklist would not know these four exist and would have no
way to confirm they were swept. **Recommend the deepened plan add all 4 to the enumerated list**, so the
sweep in §8.9B ("enumerate every reader … anything present in the code and absent here is a gap in the
plan") is actually complete when it runs.

---

## 3. `booking_items` / `service_price_snapshot` readers — the "never put the fee in booking_items" reasoning

Read `reporting.ts:534-547` (`getServicePerformance`) and `:566-588` (`getStaffRevenueAttribution`)
directly:

```ts
// getServicePerformance (534-547)
for (const item of data.bookingItems) {
  ...
  existing.revenue += amount(item.service_price_snapshot);
  ...
}
// getStaffRevenueAttribution (566-588)
for (const item of data.bookingItems) {
  ...
  existing.revenue += amount(item.service_price_snapshot);
  ...
}
```

**CONFIRMED.** Both functions read `service_price_snapshot` off `booking_items`, never `total_price` or
`amount_due`. Neither has any code path that would pick up a `booking_items` row lacking a valid
`service_id`. The plan's reasoning ("a fee row would corrupt per-service and per-therapist analytics with
a fake service") is accurate and the two function citations (`:534-547`, `:566-588`) are byte-exact.

---

## 4. The participant-multiply claim — quoted and verified

```sql
-- supabase/migrations/20260727120000_c06_client_crud_hardening.sql:230
v_total_price := v_service_price * v_participant_count;
```

**CONFIRMED, line-exact.** Read `create_booking_request`'s full body: this assignment happens once, at
creation, inside `create_booking_request` (the only place `v_total_price` is *computed*; every other
writer either copies `service.price` verbatim or reads `total_price` back as a stored value). Then at
`:550-561` the same insert writes `v_total_price` into both `total_price` and `amount_due`, with
`amount_paid` hardcoded to `0`. An **additive delta** applied post-creation (`total_price = total_price -
old_fee + new_fee`) never touches `v_participant_count`, so the plan's "one journey, one fee, however
many people" claim is architecturally sound — the multiply and the fee-delta are in genuinely disjoint
code paths and can never double-apply.

**Worked arithmetic assertion (plan §8.9C), verified by tracing the actual SQL and cron code, not
assumed:**

> £45 service, 2 participants, £14 travel fee.
> `v_total_price := 45 * 2 = 90` (create_booking_request, one-time, at creation)
> `total_price = 90 - 0 + 14 = 104` (admin sets the fee afterwards, via the additive delta in
> `updateBookingManagement`)
> **`total_price` = 104, NOT `(45 + 14) * 2 = 118`.**

This is correct **only if the fee is applied strictly after creation, as a delta on the already-multiplied
total** — which is exactly what §8.6 specifies (`newTotal = total_price − oldFee + newFee`, operating on
the stored `total_price`, never on `service_price * participant_count` freshly). This dependency should be
stated explicitly in the deepened plan as a **stop condition**: if any future code path ever recomputes
`total_price` from `service_price * participant_count` while a non-zero `travel_fee` already exists on
the row (e.g., a hypothetical "recalculate price" admin action), it must add `travel_fee` *after* the
multiply, never before. No such recompute path exists today (verified — `total_price` is only ever
written by (a) the three creation paths below, or (b) the delta in `updateBookingManagement`), but it is
the one design invariant an implementer must never accidentally break.

---

## 5. All writers of `bookings.total_price`/`amount_due` — "is there any other occurrence writer?"

```
grep -rniE "insert into (public\.)?bookings\b" supabase/migrations/
→ 20260503150000_phase2_booking_atomic_snapshots.sql:437   (superseded — CREATE OR REPLACE FUNCTION create_booking_request, earlier version)
→ 20260513120100_update_create_booking_request_per_participant_services.sql:342  (superseded — same function, later version)
→ 20260727120000_c06_client_crud_hardening.sql:525          (LIVE — latest CREATE OR REPLACE of create_booking_request)
→ 20260802122636_c02_recurring_bookings.sql:784             (create_recurring_booking_series — separate function)
```

```
grep -rn '\.from("bookings")\s*\n?\s*\.insert(' src --multiline
→ src/app/api/cron/extend-recurring-horizons/route.ts (only TS-side writer)
```

**CONFIRMED — exactly three live writers of a new `bookings` row, all found and read:**
1. `create_booking_request` (SQL, latest definition in `c06…sql`) — single/group bookings, multiplies by
   participant count.
2. `create_recurring_booking_series` (SQL, `c02…sql:784-829`) — first materialised batch of a new series,
   `group_booking: false` (line ~823, "single participant by design"), no multiply.
3. `extend-recurring-horizons/route.ts:406-433` (TS, the daily cron) — rolls the horizon forward,
   `group_booking: false` (line 425), no multiply.

**No fourth writer exists.** This answers plan §8.9F directly: there is **no other writer that creates
occurrences** beyond the cron and the RPC. (The three "superseded" SQL files above are earlier
`CREATE OR REPLACE FUNCTION create_booking_request` definitions in migration history — Postgres functions
are replaced in place, so only the `c06` version is live; this is standard for this codebase's migration
style and not a duplicate-writer risk.)

**Cron occurrence-build block — read in full, `route.ts:406-433`:**

```ts
// route.ts:406
for (const date of candidates) {
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      ...
      total_price: service.price,        // line 419
      amount_due: service.price,          // line 420
      amount_paid: 0,
      ...
      group_booking: false,               // line 425
      ...
      recurring_template_id: template.id,
    })
```

**CONFIRMED, line-exact** against the plan's citation `route.ts:419-420`. `group_booking: false` at
line 425 confirms "the cron does not multiply by participant count" — there is no participant-count
variable anywhere in this insert; `service.price` is written verbatim. The plan's step 2 fix
(`total_price: service.price + template.travel_fee`, same for `amount_due`) is a minimal, correct,
2-line change to this exact block.

**`create_recurring_booking_series` price snapshot — read in full, `c02…sql:784-829`:**

```sql
INSERT INTO public.bookings (
  ...
  total_price,      -- line 794
  amount_due,        -- line 795
  amount_paid,
  ...
)
VALUES (
  ...
  v_service.price,   -- line 817 (total_price)
  v_service.price,   -- line 818 (amount_due)
  0,
  ...
  false,              -- line 823, "single participant by design (brief §12)"
  ...
)
```

Plan cites "~:794-818" (with a hedging `~`) — the column list starts at 784, the VALUES price literals
are at 817-818. The `~` is honest about the imprecision; the range is a reasonable approximation of "the
whole price-related block," not a wrong citation. Adding `p_travel_fee` as a new RPC parameter and adding
it to both `v_service.price` values here is the correct, minimal change plan step 3 asks for.

---

## 6. `/admin/bookings/series/[templateId]` — does it exist, what does it render, where does a travel-charge control go

**It exists.** Read in full: `src/app/admin/bookings/series/[templateId]/page.tsx` (544 lines) +
`SeriesActions.tsx` (168 lines, client component).

Current render, top to bottom: back link → header (service name, cadence/therapist/end summary, Active/
Cancelled badge) → cancelled-notice banner (if applicable) → **"Schedule" panel** (cadence, ends, first
visit, horizon date, therapist, participant gender, address line, notes) → **"Client" panel** (name +
link, RBAC-gated) → **"Upcoming visits" panel** (next 10, `VISIT_SELECT`, no money columns) → collapsible
**"Past visits"** (last 5) → "View all N visits" link → **"Actions" panel**, rendered by `SeriesActions`.

`TEMPLATE_SELECT` (lines 48-71) does **not** select any money column — consistent with the schema finding
in §1 (there is none to select yet).

**A concrete trap the plan does not flag:** `SeriesActions.tsx` already has an **"Edit series" button**
(lines 87-95), and it is **`disabled`**, with explanatory copy directly beneath it (lines 160-164):

```tsx
<AdminButton type="button" variant="outline" ... disabled ...>
  Edit series
</AdminButton>
...
<p className="text-xs text-[var(--admin-text-muted)]">
  Editing isn&rsquo;t available yet for repeat visits. Cancel this
  series and create a new one if cadence, address, or therapist need to
  change.
</p>
```

`recurring-actions.ts` has exactly two exported server actions: `createRecurringSeries` (93) and
`cancelRecurringSeries` (237). **There is no edit/update action for a template today.** The plan's
instruction ("the series gets its own travel-charge control, on the series view") is correct in *where*,
but an implementer reading only that line could reasonably assume they're wiring a field into an
*existing* edit form. **They are not — this is new-from-scratch UI and a new server action**, and the
existing "Edit series is disabled, not available yet" copy sits right next to where the new control must
go. The deepened plan should say explicitly: build a new, separate `AdminPanel` (e.g. "Travel charge",
between "Schedule" and "Client", or folded into "Actions") backed by a **new** client component (sibling
to `SeriesActions.tsx`, e.g. `SeriesTravelChargeForm.tsx`) and a **new** server action in
`recurring-actions.ts` — do not attempt to extend the disabled "Edit series" button, which is explicitly
scoped by its own copy to "cadence, address, or therapist," not price.

**Reusable pattern for the new server action** — `cancelRecurringSeries` (`recurring-actions.ts:237-322`)
is the closest existing precedent and should be mirrored:
- Same auth gate: `getStaffProfile` → `actor.active && canManageAllBookings(actor)`.
- Same idempotency-via-filter style for the template update.
- Same cascade shape: `.from("bookings").update(...).eq("recurring_template_id", templateId).in("status",
  ["pending","confirmed"]).gte("booking_date", today)`.
- Same audit-row-by-hand pattern (no RPC on this path), `action_type: "recurring_series_cancelled"`.
- Same revalidate/updateTag footer.

**One thing `cancelRecurringSeries`'s filter does *not* need to handle, that the new fee action *must*:**
cancellation only ever targets `status IN ('pending','confirmed')` and that's a complete lock — a
cancelled/completed booking is excluded by status alone. The fee lock is **not** expressible by status
alone: a `confirmed` booking that is **fully paid** (`amount_paid >= amount_due`) must also be skipped
(§8.6's completed/fully-paid rule), and PostgREST's `.gte()`/`.lt()` filters compare a column to a
**literal**, not to another column — there is no `.filter("amount_paid", "lt", "amount_due")` that works
column-to-column through the JS client. **The deepened plan must specify the two-step shape**:
1. `SELECT id, amount_due, amount_paid, status FROM bookings WHERE recurring_template_id = $1 AND status
   IN ('pending','confirmed') AND booking_date >= $2` (fetch candidates).
2. Partition in application code: `toUpdate = candidates.filter(b => Number(b.amount_paid) <
   Number(b.amount_due))`; the rest are `skipped`.
3. `UPDATE bookings SET total_price = total_price - $oldFee + $newFee, amount_due = amount_due - $oldFee
   + $newFee WHERE id IN (toUpdate.map(b => b.id))`.
4. Report `{ updated: toUpdate.length, skipped: candidates.length - toUpdate.length }`, exactly as
   `cancelRecurringSeries` already reports `cancelledOccurrenceCount`.

This two-step shape is missing from the plan entirely; without it an implementer will reach for a single
`.update().eq(...).lt("amount_paid","amount_due")` call, which PostgREST will either reject or (worse)
silently misinterpret as a literal comparison, and the "skip fully-paid" rule will not actually be
enforced.

**Audit registration** — `src/app/admin/audit/format.ts` was read in full for its action-type map. Two
findings:
1. `booking_management_updated` **is already registered** (line 24, family
   `bookings_and_assignments`), so the fee-on-a-single-booking write path (§8.6, reusing this action
   type) needs **no new registration**. Confirmed.
2. **`recurring_series_cancelled`** — the action type `cancelRecurringSeries` already writes today, for a
   *shipped* feature — **is not registered anywhere in `format.ts`**. `describeAction()` (lines 100-110)
   has a graceful fallback: unregistered types render as `actionType.replace(/_/g, " ")` (readable, not
   blank/"unlabelled" as the plan's phrasing implies) but are mis-filed into family
   `operations_and_email` (should be `bookings_and_assignments`) and get chip tone `"none"` (no colour).
   This is a **pre-existing, out-of-scope defect** adjacent to Item 8 — worth a one-line footnote, not a
   fix. It also corrects the plan's claim precision: an unregistered action type does not render
   "unlabelled," it renders mis-categorised and uncoloured. The new series-level fee action type (e.g.
   `recurring_series_travel_fee_updated`) should be added to the map for the same reason
   `booking_management_updated` already is — correct family + chip — not because the alternative is a
   blank timeline entry.

---

## 7. `updateBookingManagement` — full read, payload, guard, and the email-timing guarantee

Read `src/app/admin/bookings/actions.ts:284-578` in full (the whole function).

| Plan citation | What's there | Match |
|---|---|---|
| `updateBookingManagement (:284-464)` | function signature at 284, closing brace at 578 (the payload build the plan is pointing at ends at 464 — the function itself continues past that for the DB call, audit row and emails) | function start exact; `:464` marks the end of the payload-adjacent block, not the function — technically imprecise but the intent ("add to the payload block") lands correctly |
| `payload (:417-455)` | `const payload = { ... }` literal, opens 417, closes 455 | **exact** |
| `canManageAllBookings` gate | line 290, `if (!canManageAllBookings(actor))` | **exact match** to "already this action's gate" |
| audit row `:500-526` | `await adminClient.from("audit_logs").insert({...})`, opens 500, closes 526 | **exact** |
| `quickUpdateBooking (:732-798)` | function opens 732; body continues to 909 — `:798` is where the payload-building ternary ends, not the function | payload-block citation exact; function-end citation imprecise, same pattern as above |
| `:777-778` (confirm branch) | `action === "confirm" ? { status: "confirmed" as BookingStatus }` | **exact** |
| `actions.ts:764,783` | `const amountDue = Number(beforeState.amount_due ?? beforeState.total_price ?? 0);` (764); `amount_paid: amountDue` inside the `mark_paid` payload (783) | **exact**, and confirmed a flat read — no summing |
| Email send #1 `:560-565` | `if (beforeState.status === "pending" && data.status === "confirmed") { await sendBookingConfirmedClientEmail(...) }` | **exact** |
| Email send #2 `:893-898` | Same guard, `updatedBooking.status` instead of `data.status`, inside `quickUpdateBooking` | **exact** |

**The email-timing guarantee — verified by reading both paths, not assumed:**

- **`updateBookingManagement`** (the Status & Payment *form*, the surface §8.6/§8.8 add the travel-fee
  input to): the `.update(payload)` call is at lines 457-462; the confirmation email send is at 561-565 —
  **strictly after** the DB write, in the same function, same request. If `travel_fee` is added to
  `payload` (417-455), it is written to the DB **before** the email reads the row back out via
  `getBookingTemplateInput` (which does a fresh `SELECT`, not a reuse of `data`). **CONFIRMED: no race.**

- **`quickUpdateBooking`**'s `confirm` action (777-778): the payload for this action is `{ status:
  "confirmed" }` **only** — no `travel_fee` field, no form at all, exactly as the plan describes ("with
  no form fields at all"). This path does **not** gain fee-awareness from folding `travel_fee` into the
  payload, because there is no fee input on this path to fold. The plan's fix for this exact gap is
  correct and is the **only** correct fix given the current code: **hide the confirm chip** (§8.8) rather
  than try to make the one-click action fee-aware. I verified there is no alternate reading under which
  this chip could safely stay visible; leaving it up would let an admin one-click-confirm (and
  immediately email) an out-of-zone booking with `travel_fee` still at its default `0`.

**Net verdict on §8.6/§8.8's core write-path and email-timing claims: CONFIRMED**, with two citation
precision notes above (function *end* line vs. the cited payload/audit *block* end line — cosmetic, does
not affect correctness).

---

## 8. `BookingManagementForm.tsx` — full read of the three cited symbols

- `QUICK_ACTIONS` — **exact**, lines 336-372 (plan cites `:336-346`, which is just the first array entry,
  `confirm`; the const itself runs to 372 across 4 actions — the citation targets the right entry).
- `AmountPaidInput` — **exact**, 443-515 (plan cites `:443-515`, byte-exact). The `total > 0` preview
  idiom the plan wants the new travel-fee input to mirror is real: line 491, `{total > 0 ? (` — the
  "Match total · £X" quick-fill button block. This is a legitimate, existing pattern to copy.
- `StatusAndPaymentSection` — **exact**, 689-938 (plan cites `:689-938`, byte-exact). Contains
  `QUICK_ACTIONS.map(...)` at 784, the Status select (pending/confirmed/completed/cancelled/no_show
  options at 826-830) inside the cited `:807-832` block, and `AmountPaidInput` wired at 888-898 with
  `total={total}` from line 696 (`const total = Number(booking.total_price ?? 0);`).

**Confirmed gap the plan names correctly**: `getBookingDetailData` (`booking-detail-data.ts`) has **zero**
references to `allowed_cities`/`business_settings` anywhere in the file (`grep` returned only the function
declaration line, no settings query). The claim "the booking detail page does not currently fetch the
town list — it must be added" is accurate; this is a real, additional data-fetch that must be threaded
into `getBookingDetailData` and passed down to `BookingManagementForm`/`StatusAndPaymentSection` for the
"outside free-travel zone" alert to render at all.

---

## 9. Email layer — every count re-derived, not trusted

**`renderSummary` call count.** Command:
```
grep -n "renderSummary(input)" src/lib/email/templates.ts
```
13 matches: lines 444, 470, 494, 517, 539, 560, 588, 612, 629, 1017, 1082, 1141, 1209.
**CONFIRMED: exactly 13.** Function body (`243-259`) and total line (`255-257`) also byte-exact against
the plan's citation.

**`renderBookingPlainText` call count**, production only:
```
grep -n "renderBookingPlainText(" src/lib/email
```
- `notifications.ts`: 650, 671, 728, 750, 792, 981, 1003, 1040, 1065 → **9 production call sites**
- `sample-data.ts:173` → 1 more, but this is the **admin preview dispatch table**, not a real send.
- `__tests__/*` → excluded (not send sites).

**CONFIRMED: exactly 9** production send sites, matching the plan's "from 9 more" reading (13 + 9 = 22,
matching "7 spots covering all 22 send sites"). Function signature (`:635`) and `Total:` line (`:668`)
both byte-exact.

**The "7 spots" list — one citation is wrong, one spot is missing:**

| Cited spot | What's actually there | Correct? |
|---|---|---|
| `renderSummary` | fixed HTML block, `templates.ts:243-259` | ✅ |
| `renderBookingPlainText` | fixed plain-text block, `templates.ts:635-674` | ✅ |
| `BookingEmailTemplateInput` (`:16-30`) | interface, byte-exact | ✅ |
| `buildVarMap` (`:87-103`) | function opens 87; the var map object itself runs to 106/107 (closing brace 107) — `totalPrice:` is at line 102, inside the cited range | ✅ (minor: cited end line 103 is 4 lines short of the function's actual close at 107, but the relevant line is captured) |
| `BOOKING_EMAIL_SELECT` (`notifications.ts:123-138`) | byte-exact | ✅ |
| `getBookingTemplateInput` (`:216-265`, total at `:255`) | function opens 216; `totalPrice: Number(booking.total_price ?? 0)` **is at line 255**, byte-exact; function closes at 265 | ✅ exact |
| **`sample-data.ts:173`** | `content: renderBookingPlainText("Booking confirmation", SAMPLE_TEMPLATE_INPUT, overrides),` — a **dispatch-table entry that forwards the whole input object**. It requires **no edit** for a travel-fee field to work; it already passes `SAMPLE_TEMPLATE_INPUT` through unchanged. | ❌ **wrong citation** |

**What sample-data.ts actually needs edited**: `SAMPLE_TEMPLATE_INPUT` itself, `sample-data.ts:46-67`
(the literal object — `totalPrice: 65` sits at line 53). If `BookingEmailTemplateInput` grows an optional
`travelFee` field, this object needs a sibling `travelFee: <sample value>` line added near 53, so the
admin's live preview/"send test" actually demonstrates the new line. **Line 173 needs zero changes.**

**A genuine missing touch point (8th spot, not named anywhere):**
`src/app/admin/emails/components/templates-data.ts` defines a **shared constant**,
`BOOKING_SUMMARY_FIXED_PART` (lines 137-140):
```ts
const BOOKING_SUMMARY_FIXED_PART: FixedPart = {
  label: "Booking summary",
  source: "Built from the booking's date, time, address and total price.",
};
```
This single constant is referenced by **13 template registry entries** (grep-confirmed: lines 574, 593,
615, 647, 662, 675, 694, 713, 767, 781, 793, 812, 859 — one shared object, reused 13×, matching the same
13 templates that call `renderSummary`). It drives the admin editor's "Filled automatically" panel — the
UI that tells an admin what's auto-generated vs. editable. If a labelled travel-charge line is added to
`renderSummary`'s fixed HTML block, **this description string becomes stale** ("… and total price"
doesn't mention travel charge) and should be updated in the same commit. It is a **one-line change in one
place** (used by all 13 templates via the shared constant) but it is entirely absent from the plan's touch
-point list. **Recommend adding it as the plan's 8th spot.**

**Corrected touch-point count: 8 spots (not 7), one of the original 7 mis-cited.**

---

## 10. Admin-editable template overrides — the risk investigated, and why it does NOT materialise

Read `resolveTemplateOverrides` (`templates.ts:689-711`) in full:

```ts
export async function resolveTemplateOverrides(templateId: string): Promise<Record<string, string>> {
  ...
  const { data } = await supabase.from("email_template_overrides").select("field_key, value")
    .eq("template_id", templateId);
  const map: Record<string, string> = {};
  for (const row of data ?? []) map[row.field_key] = row.value;
  return map;
}
```

This returns a `{ field_key: value }` map. It is consumed exclusively through `substituteVars`
(`templates.ts:65-74`), which replaces `{varName}` placeholders **inside specific, named, registered
fields** (per `templates-data.ts`'s `SafeField` catalogue — `greeting_intro`, `footer_contact`,
`body_cta_url`, `body_intro`, `body_ask`, `body_cta_label`, `body_signoff`, `intro`,
`wrapper_change_summary`, `plain_text_intro`, `group_copy`, `massage_variant_1..5`,
`cupping_variant_1..5` — the full kind list, per the file's own header comment, lines 22-24).

**`renderSummary` and the core of `renderBookingPlainText` are not on that list.** They are fixed
template functions that embed `formatMoney(input.totalPrice)` directly in a literal HTML/text string —
confirmed by reading both function bodies in full (§9 above). Neither is driven by
`resolveTemplateOverrides`'s output at all. `templates-data.ts`'s own `fixedParts`/`FixedPart` mechanism
(lines 33-36, "auto-generated content this template sends that isn't an editable field") exists
specifically to document this: `BOOKING_SUMMARY_FIXED_PART` (§9) is the registry's own admission that the
Total line is **not** admin-editable.

I also grepped `templates-data.ts` for `totalPrice`/`{total`/`travel` inside any `defaultValue` string —
**zero matches** — confirming no *existing* overridable field's default text currently references the
total price or embeds a travel-charge-shaped placeholder that a saved override could be silently
clobbering today.

**Verdict: the risk the task asked me to investigate does NOT materialise, on the condition that the
labelled travel-charge line is added to `renderSummary`/`renderBookingPlainText` directly (as the plan
already specifies) and NOT wired up as a new `SafeField`/overridable field.** If a future implementer
instead chose to add it as a new overridable field (e.g. a new `travel_charge_line` kind with a default
value), that WOULD reintroduce exactly the risk described — any admin who had saved an override on a
*different* field in the same template before the new field existed is unaffected (overrides are keyed
per-field, not per-template), but if the travel line were folded into an *existing* field's default text
(e.g., appended to `greeting_intro`'s default), any template with a saved `greeting_intro` override would
never render the new travel line, silently. **This is a real hazard, but it is a hazard of a design
alternative the plan does not choose — it is avoided by construction as long as the implementation follows
§8.8's own instruction to touch `renderSummary`/`renderBookingPlainText` directly.** Recommend the
deepened plan state this constraint explicitly as a guardrail: *"The travel-charge line MUST be added
inside the fixed `renderSummary`/`renderBookingPlainText` functions, never as a new overridable
`SafeField`. If any future change moves it into an override-controlled field, every existing saved
override for that field must be audited before ship."*

---

## 11. The pre-fee request-received email — verified

Read `sendBookingCreatedEmails`, `notifications.ts:608-677`, in full. **Byte-exact match** to the plan's
citation. It is called once, at booking creation (from the booking-submission path), before any admin
action can set `travel_fee` (the fee only exists on `updateBookingManagement`'s payload, which requires an
existing booking row). The plan's claim "the customer would see £45, then £59 on confirmation" is
structurally correct — there is no code path by which a fee could exist at the moment this email sends.
**CONFIRMED.**

---

## 12. Customer-facing copy — statements the plan's §8.9D audit must include

Traced beyond the plan's own citations (`AboutYouStep.tsx`, `ConfirmStep`, emails, manage page) to find
concrete text, not just name the files:

**`AboutYouStep.tsx:56-58`** — `COVERED_TOWNS` — byte-exact.
**`AboutYouStep.tsx:123-131`** — `isCovered`/`isOutsideCoverage` — byte-exact (`isCovered` spans 125-130,
`isOutsideCoverage` at 131, both inside the cited `:123-131` range).
**`AboutYouStep.tsx:510-518`** (covered notice) and **`:520-529`** (outside-coverage notice) — both
byte-exact. The outside-coverage text, read in full:

```tsx
<strong>Outside current home visit area:</strong> We currently
cover Luton, Dunstable, Houghton Regis, Harpenden and St Albans.
Use a covered town before choosing a time.
```

This independently corroborates the plan's §8.2 "5 towns, hardcoded" claim (this string names exactly the
5 towns `BOOKING_ALLOWED_CITIES` would list) and confirms it needs full replacement (not just a tone
change) — it currently commands the customer to pick a different town, which becomes actively wrong once
out-of-zone becomes bookable.

**A statement the plan does not name, found while reading `ConfirmStep.tsx`, lines 225-243:**

```tsx
<span>
  I understand payment is taken in person by cash or card and the
  amount due is based on the selected service and participant
  count.
</span>
```

This is a **required acknowledgement checkbox** (`paymentAcknowledged`) the customer must tick to submit
a booking. It explicitly enumerates what the amount due is "based on" — **service and participant count
only**. Once a travel fee can apply, this statement is incomplete: it should say something like "...based
on the selected service, participant count, and any travel charge for your area." This sits in the same
component (`ConfirmStep.tsx`) the plan already names for the *new* restatement (near the `.reassurance`
divs at lines 266-280), but the plan's instruction ("restate it plainly … beside the existing payment
reassurance") reads as *adding new text*, not *correcting this existing checkbox copy*, and would leave
this specific sentence unaudited if followed literally. **Recommend adding this exact line/range
(`ConfirmStep.tsx:232-236`) to the plan's §8.9D list of statements requiring an edit.**

---

## 13. Rounding / precision — the arithmetic rules an implementer needs

Given §1's finding (`total_price` is `numeric(10,2)`; `amount_due`/`amount_paid` are unscaled `numeric`;
no rounding helper exists anywhere in the codebase), the deepened plan should specify:

1. **New columns**: define both `bookings.travel_fee` and `recurring_booking_templates.travel_fee` as
   **`numeric(10,2)`**, matching `total_price`'s existing precision/scale — not bare `numeric`. This gives
   the fee column itself the same DB-level 2dp enforcement `total_price` already has, and is the more
   defensible schema choice than matching `amount_due`'s unscaled convention (which is itself a
   pre-existing gap, not a pattern worth propagating to a new column).
2. **Delta arithmetic must happen in integer pence, in application code**, not in floating-point pounds:
   ```ts
   const toPence = (v: number | string | null) => Math.round(Number(v ?? 0) * 100);
   const newTotalPence = toPence(beforeState.total_price) - toPence(beforeState.travel_fee) + toPence(newFeeInput);
   const newTotal = newTotalPence / 100;
   ```
   This avoids the classic IEEE-754 binary-fraction error (e.g. `45.30 - 14.30 + 20.10` can yield
   `51.099999999999994` in native JS float arithmetic) that would otherwise get written verbatim into the
   unscaled `amount_due` column (where the DB will not clean it up, unlike `total_price`, which Postgres
   will silently round on write).
3. **The worked example holds under this rule**: `(45 × 2) + 14 = 104` — all inputs and intermediate
   values here are exact in binary (integers or `.5`), so this specific example shows no drift either way;
   the integer-pence rule matters for fees like `£14.30`/`£12.75`/etc., which are the realistic cases.
4. **`amount_due`'s delta must use the identical pence-rounded arithmetic** as `total_price`'s, computed
   from the *same* `oldFee`/`newFee` pair in the same request, so the two columns can never diverge by a
   fraction of a penny from independent rounding.

None of this is in the current plan text. It is a genuine, previously-unflagged gap directly responsive
to the task's explicit request ("specify the arithmetic rules so an implementer does not introduce float
drift").

---

## 14. Exact migration SQL

**Migration A — Phase 3, `bookings.travel_fee`:**

```sql
-- supabase/migrations/<timestamp>_item8_bookings_travel_fee.sql
alter table public.bookings
  add column travel_fee numeric(10,2) not null default 0;
```

Rollback:
```sql
alter table public.bookings
  drop column travel_fee;
```

**Migration B — Phase 4, `recurring_booking_templates.travel_fee`:**

```sql
-- supabase/migrations/<timestamp>_item8_recurring_templates_travel_fee.sql
alter table public.recurring_booking_templates
  add column travel_fee numeric(10,2) not null default 0;
```

Rollback:
```sql
alter table public.recurring_booking_templates
  drop column travel_fee;
```

Both are additive, `not null default 0` — Postgres applies the constant default to existing rows without
a full table rewrite (fast-default path, PG 11+); zero data risk, zero effect on any existing row's
`total_price`/`amount_due` (both remain untouched by the migration itself — the fold-in only happens the
first time an admin sets a non-zero fee via the application code path). Neither migration touches
`total_price`/`amount_due`'s own type, so the pre-existing precision inconsistency noted in §1/§13 is left
exactly as-is (out of this item's scope to fix retroactively).

---

## 15. Ordering, blast radius, and file list per phase

**Phase 3 (fee on a single booking) — files to edit, in order:**
1. Migration A (above) — must land first, everything else in this phase depends on the column existing.
2. `src/app/admin/bookings/actions.ts` — `updateBookingManagement`: add `travel_fee` field parsing, the
   completed/fully-paid lock (new logic, no existing precedent to copy — nearest analogue is the
   `isCompletedReversal` guard pattern already in this same function), extend `payload` (417-455) with the
   delta-computed `total_price`/`amount_due`, using the pence-rounding rule from §13.
3. `src/app/admin/bookings/[bookingId]/booking-detail-data.ts` — `getBookingDetailData`: add the
   free-travel town list fetch (currently absent — confirmed §8).
4. `src/app/admin/bookings/BookingManagementForm.tsx` — `StatusAndPaymentSection`: new travel-fee input
   (mirror `AmountPaidInput`'s `total > 0` preview idiom, §8), new "outside free-travel zone" alert.
5. `src/app/admin/audit/format.ts` — no change needed; `booking_management_updated` is already registered
   (§6).

**Phase 4 (recurring propagation) — depends on Phase 3's column existing and its delta-arithmetic helper
being extracted/reusable (recommend factoring the pence-rounding delta helper out of `actions.ts` so
Phase 4's series action and the cron can both call it, rather than duplicating the rounding logic):**
1. Migration B (above).
2. `supabase/migrations/20260802122636_c02_recurring_bookings.sql` — **do not edit this file** (historical
   migration, per the codebase's own "do not edit historical migrations" convention already stated
   elsewhere in the plan for Phase 1). Instead, `create_recurring_booking_series`'s definition must be
   **replaced in a new migration** (`CREATE OR REPLACE FUNCTION`) that adds the `p_travel_fee` parameter —
   same pattern the three superseded `create_booking_request` definitions already demonstrate (§5). This
   is a **third migration this phase actually needs**, beyond the plan's budgeted "1 migration" for Phase
   4 (§8.12's table says "~4-6 files + 1 migration" for Phase 4) — the plan's own effort table undercounts:
   Phase 4 needs (a) the `travel_fee` column migration and (b) a `CREATE OR REPLACE FUNCTION
   create_recurring_booking_series` migration adding the parameter. **Recommend correcting §8.12's Phase 4
   row to "2 migrations."**
3. `src/app/api/cron/extend-recurring-horizons/route.ts` — lines 419-420, add `+ template.travel_fee` (the
   route already selects `template.*` upstream — verify `travel_fee` is included in whatever select
   pulls `template` before editing these two lines).
4. `src/app/admin/bookings/recurring-actions.ts` — new server action (name TBD, e.g.
   `setSeriesTravelFee`), mirroring `cancelRecurringSeries`'s shape exactly (§6), including the two-step
   fetch-then-filter-then-update pattern for the fully-paid skip (§6) — **this cannot be a single
   PostgREST `.update().filter()` call**.
5. `src/app/admin/bookings/series/[templateId]/page.tsx` + a **new** sibling client component (e.g.
   `SeriesTravelChargeForm.tsx`, alongside the existing `SeriesActions.tsx`) — new UI, not an extension of
   the disabled "Edit series" button (§6).
6. `src/app/admin/audit/format.ts` — **new** action-type entry required this time (unlike Phase 3), e.g.
   `recurring_series_travel_fee_updated`, family `bookings_and_assignments` — otherwise it inherits the
   same mis-filing `recurring_series_cancelled` already has (§6).

**Phase 5 (communications) — depends on Phase 3's column existing (for the booking-level line) and
benefits from, but does not strictly require, Phase 4 (recurring series fee display can ship after):**
1. `src/features/booking/components/AboutYouStep.tsx` — reword `:520-529`.
2. `src/features/booking/components/ConfirmStep.tsx` — reword `:232-236` (payment acknowledgement, §12 —
   **not currently named by the plan**) and add the new restatement near `:266-280`.
3. `src/app/admin/bookings/[bookingId]/booking-detail-data.ts` + `BookingManagementForm.tsx` — already
   listed under Phase 3 (§8.8 explicitly says Phase 5's chip-gating must land WITH Phase 3, per the plan's
   own ordering note — confirmed sound, since the bypass exists the instant Phase 3 ships the fee field
   without Phase 5's chip-hiding).
4. `src/lib/email/templates.ts` — `renderSummary` (243-259), `renderBookingPlainText` (635-674),
   `BookingEmailTemplateInput` (16-30), `buildVarMap` (87-107).
5. `src/lib/email/notifications.ts` — `BOOKING_EMAIL_SELECT` (123-138, add `travel_fee`),
   `getBookingTemplateInput` (216-265, add `travelFee: Number(booking.travel_fee ?? 0)` alongside line
   255).
6. `src/lib/email/sample-data.ts` — `SAMPLE_TEMPLATE_INPUT` (**46-67**, not 173 — §9 correction).
7. `src/app/admin/emails/components/templates-data.ts` — `BOOKING_SUMMARY_FIXED_PART` (137-140, **missing
   from the plan's list entirely** — §9).
8. `src/lib/booking/customer-manage.ts` + `src/app/booking/manage/page.tsx:227` — line-item split for the
   manage page (numerically correct already per §2; this is copy-only).

**Cross-item file collisions**: none found with Items 1-7 of the same plan (Item 8 touches
`actions.ts`, `BookingManagementForm.tsx`, `recurring-actions.ts`, the email layer, and
`AboutYouStep.tsx`/`ConfirmStep.tsx` — none of these files are named in the plan's Items 1-7 sections, per
a targeted grep of the surrounding plan text for these filenames outside the Item 8 section). Item 7
(admin colour/contrast) touches CSS tokens and colour literals across `BookingManagementForm.tsx` and
other admin surfaces Item 8 also edits — **file-level overlap, not logic-level**: both items can touch
`BookingManagementForm.tsx` in the same release, but Item 7's edits are purely `className`/token
substitutions while Item 8's are new fields/logic. Recommend landing Item 7's Phase 0 (the token/cascade
fixes) **before** Item 8's UI changes ship, simply so new UI is authored against corrected tokens rather
than needing a second pass — not a hard technical dependency, a sequencing convenience.

---

## 16. Tests — named, with exact files

| Test | File |
|---|---|
| `(45 × 2) + 14 = 104`, not `(45+14) × 2` | New: `src/app/admin/bookings/__tests__/travelFee-arithmetic.test.ts` (pure function test if the pence-delta helper from §13 is extracted; otherwise add to `updateBookingManagement.test.ts` if one exists — confirm before creating a duplicate) |
| Fee locked when `status = 'completed'`, server-rejected | Extend `src/app/admin/bookings/__tests__/updateBookingManagement-completed-guard.test.ts` (existing file, already tests `COMPLETED_BOOKING` fixtures against `updateBookingManagement` — natural home) |
| Fee locked when fully paid (`amount_paid >= amount_due`, `amount_due > 0`) | Same file as above, new `it()` block |
| Unchanged fee + another edit still succeeds on a completed/fully-paid booking | Same file |
| Setting fee + marking paid in the same save is allowed | Same file |
| `cancelled` is NOT locked (explicit negative assertion) | Same file |
| Quick-confirm chip hidden when outside zone + `travel_fee = 0`; visible otherwise | `src/app/admin/bookings/BookingManagementForm.test.tsx` (existing file already renders this form) |
| Delta correctness: set → change → clear a fee; `amount_paid` never moves | New `it()` blocks in `updateBookingManagement-completed-guard.test.ts` or a new sibling `updateBookingManagement-travelFee.test.ts` following the same naming convention |
| Recurring: template fee propagates to newly-generated occurrences | `src/app/api/cron/__tests__/extend-recurring-horizons.test.ts` (existing file, already tests this route) |
| Recurring: series-level fee update applies to future materialised occurrences only, skips completed/fully-paid, reports counts | New: `src/app/admin/bookings/__tests__/setSeriesTravelFee.test.ts`, mirroring `src/app/admin/bookings/__tests__/cancelRecurringSeries.test.ts`'s existing structure exactly |
| Confirmation email contains fee-inclusive total (mailer mocked) | `src/lib/email/__tests__/sendBookingConfirmedClientEmail.test.ts` (existing file) |
| `create_recurring_booking_series`'s new `p_travel_fee` param applies to the first batch | `src/app/admin/bookings/__tests__/createRecurringSeries.test.ts` (existing file) |

---

## 17. Stop conditions

- If `SELECT proname FROM pg_proc WHERE prosrc ILIKE '%allowed_cities%'` (plan §8.9A) returns a function
  other than `create_booking_request` when re-run at implementation time — stop, a second consumer has
  appeared since this audit.
- If `information_schema.columns` shows `bookings.travel_fee` or `recurring_booking_templates.travel_fee`
  already exists before the migration runs — stop, something already added it out-of-band.
- If the two-step fetch-then-filter series-update pattern (§6) is skipped in favour of a single PostgREST
  filter chain attempting `amount_paid < amount_due` — stop; this cannot work as a single call and will
  either error or silently update rows it should have skipped.
- If a labelled travel-charge line is proposed for an *overridable* email field (a new `SafeField` kind)
  rather than the fixed `renderSummary`/`renderBookingPlainText` blocks — stop and re-read §10; this
  reintroduces the override-silently-drops-it risk the current design avoids by construction.
- If any future "recalculate total_price" code path is proposed, it must add `travel_fee` strictly after
  `service_price × participant_count`, never fold it into the multiply (§4) — stop and re-derive if this
  ordering is not obviously preserved.

## 18. Rollback

- Both migrations (§14) are single `ADD COLUMN`/`DROP COLUMN` pairs — trivially reversible, no data loss
  on rollback since `travel_fee` is additive and nothing else is derived from it destructively.
- `create_recurring_booking_series`'s `CREATE OR REPLACE FUNCTION` migration (§15) rolls back by a further
  `CREATE OR REPLACE FUNCTION` restoring the prior body (verbatim from `c02…sql`) — standard for this
  codebase's existing multi-generation function history (§5).
- Application-code changes (all of Phases 3-5 outside the two migrations) are ordinary reversible commits;
  none are irreversible once the `travel_fee` columns exist and default to `0` (a full revert simply stops
  writing/reading them, and every existing "flat scalar read" site in §2 continues to work unchanged,
  since it never depended on `travel_fee` existing).
