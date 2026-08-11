# R1 — Adversarial refutation of the column-usage derivation report and the blast-radius report (Item 4)

Scope: re-derive every number in both reports from source, independently, without trusting the
reported line numbers or counts. Default posture: refute unless independently reproduced.

Anchor commit `33f895f`, current HEAD `91a5864`. Re-ran `git diff 33f895f HEAD -- <file>` myself for
both `src/app/admin/bookings/bookings-list-data.ts` and
`src/app/admin/clients/[clientId]/client-detail-data.ts` — both empty, confirming NO drift
independently (not just re-trusting the prior reports' claim of no drift).

---

## Part 1 — Column-usage derivation report

### Claim 1 (symbol range 273–401, no drift) — CONFIRMED

Read `buildBookingPredicatePlan` directly out of the file (both at `33f895f` via `git show` and at
current HEAD, byte-identical). L273 = `export function buildBookingPredicatePlan(`, L401 = the
closing `}` immediately after `return { embeds, steps };` at L400. Matches exactly.

### Claim 2 (per-column counts) — 7 of 8 CONFIRMED, 1 of 8 REFUTED (`status`)

I re-read L273–401 line by line and independently classified every column-name token as either (a) a
real predicate emission that reaches a query, or (b) a pure-JS read/branch condition that does not.

**Confirmed exactly as claimed (7 columns):**

| column | claimed | my recount | lines |
|---|---|---|---|
| `booking_date` | 5 | 5 | L332, L338, L341, L366, L367 |
| `assignment_status` | 4 | 4 | L313 (or-string), L345, L348, L364 |
| `recurring_template_id` | 2 | 2 | L357 (if), L358 (else) |
| `reschedule_status` | 1 | 1 | L314 (or-string) |
| `payment_status` | 1 | 1 | L365 |
| `customer_cancelled_at` | 1 | 1 | L315 (or-string) |
| `client_id` | 1 | 1 | L395 |

L299–300 (`const userWantsInertStatus = ctx.status === "cancelled" || ctx.status === "no_show";`) is
correctly excluded by the original report as a pure-JS branch read — it never itself pushes a
predicate, it only decides whether L303 calls `notInert()`. I confirm this exclusion is correct.

**REFUTED: `status` (bookings.status) — claimed 6, actual distinct emission sites = 7.**

The report's own `actualLines` value for this row is:
`"L294 (notInert() definition's own steps.push, invoked from call sites L303 and L331), L312, L342, L351, L354, L363"`
— i.e. it collapses two real, independent call sites (L303 and L331) into **one** list slot (L294,
the shared helper's definition), then adds 5 more direct-call lines, totalling 6.

This is inconsistent with how every other column in the same table was counted. For
`assignment_status`, `booking_date`, etc., every distinct call-site *line* got its own slot in the
count — there is no shared helper for those columns, so no ambiguity arose. `status` is the only
column that goes through a shared helper (`notInert()`, defined L293-294), and that helper has **two
separate call sites**, not one:

```
L303:  if (!viewIsArchive && !userWantsInertStatus) notInert();   // rule 1 — archive exclusion
...
L331:      notInert();   // inside case "claimable", after the canClaim early-return
```

These are not mutually exclusive. For `view === "claimable"` with a typical (non-archived) status
filter, **both fire in the same request**: L303's guard (`!viewIsArchive && !userWantsInertStatus`)
is true for the claimable view (it isn't in the archive set `{cancelled, all, series}`), so
`notInert()` runs once there, and then the `claimable` case unconditionally calls it again at L331.
The source comment even says so explicitly: *"Repeated on purpose even when rule 1 already excluded
them: the C-05 lockdown invariant is that claimable is unconditionally strict..."* — confirming this
is an intentional double emission, not dead/unreachable code. Neither L303 nor L331 is a "pure-JS
branch read that never reaches a query" — both are genuine calls that push a
`{op:"notIn", column:"status", ...}` step onto `steps`.

Counting call sites on the same footing as every other column in the table:
`L303, L312, L331, L342, L351, L354, L363` = **7 distinct emission sites**, not 6. (If instead you
count by literal source-text occurrence of the string `"status"` — a different, narrower
methodology the report doesn't state but implicitly used — you get 6, because L303 and L331 are just
`notInert();` calls with no literal "status" text on those lines. That methodology is why the error
wasn't caught, but it undercounts real query-touching call sites relative to the rest of the table.)

Practical consequence for the index justification: this makes the `status` column's real call-site
count *higher* than reported (7, not 6, and — for the claimable view specifically — the same request
pushes the identical `NOT IN ('cancelled','no_show')` predicate twice), which if anything strengthens
rather than weakens the case that `status` is a heavily-touched column. But the reported number is
wrong and should not be cited as 6 going forward.

### Claim 3 (bookings.status vs booking_assignments.status split) — CONFIRMED

Independently traced `BOOKING_FILTER_EMBEDS` (L193–202):
```
fv: "booking_assignments"
fg: "booking_assignments"
fa: "booking_assignments"
fs: "booking_items"
```
L333 is `eq(\`${embed("fv")}.status\`, "unassigned")`. `embed("fv")` resolves to alias `fv`, mapped to
`booking_assignments`. `bookingSelectWith` (L468–477, spot-checked) turns filter aliases into
PostgREST `!inner` embeds appended to the `bookings` select (e.g. `fv:booking_assignments!inner(id)`),
so `.eq("fv.status", ...)` at L333 is filtering the **joined `booking_assignments` row's `status`**
via the `fv` alias — not `bookings.status`. Correctly excluded from the bookings.status count, and
correctly not double-counted as an assignment_status hit either (it's a different column,
`booking_assignments.status`, not `booking_assignments.assignment_status`). Confirmed.

### Claim 4 (`visibleBookingViews` / `getBookingViewCounts` / `countBookings`) — CONFIRMED

Read all three directly:
- `visibleBookingViews` L916–932: `canViewAll` branch returns exactly the 11 entries in the claimed
  order (`attention, today, upcoming, claimable, assigned, unassigned, partially_assigned, completed,
  cancelled, all, series`).
- `getBookingViewCounts` L950–967: `views.map((view) => countBookings({ ...base, view }))` inside a
  single `Promise.all`.
- `countBookings` L776–800: one `.select(..., { count: "exact", head: true })` per invocation.

One count-exact/head-true query per visible view, fanned out in parallel — confirmed exactly.

### Claim 5 (clinic-wide ordering + `.range()`) — CONFIRMED

`getBookingsListData`'s `canViewAll` branch (L695–712):
```
.order("booking_date", { ascending: false })
.order("start_time", { ascending: false })
.order("id", { ascending: false })
...
if (limit !== undefined) { query = query.range(start, start + limit - 1); }
```
Matches exactly.

### Claim 6 (live schema/enum check) — CONFIRMED

Re-ran the SELECT-only checks myself against `twzutkfgqclqurvkmvqz`:
- `information_schema.columns`: `booking_date` (date, NOT NULL), `id` (uuid, NOT NULL), `start_time`
  (time without time zone, NOT NULL), `status` (`booking_status_type`, NOT NULL), `assignment_status`
  (`booking_assignment_status_type`, NOT NULL), `client_id` (uuid, NOT NULL) — all NOT NULL, all types
  as claimed.
- `pg_enum` for `booking_status_type`: exactly 5 labels in sort order — `pending, confirmed,
  completed, cancelled, no_show`. Matches exactly.

---

## Part 2 — Blast-radius report

### Claim 1 (index names collide nowhere in code) — CONFIRMED

Re-grepped the whole repo for the 4 index names. Only hits: `redesign/plans/POST-BAND-C-FOLLOWUP-plan.md`
and files under `redesign/evidence/` (this item's own evidence docs). No hits in `src/`, `scripts/`,
`e2e/`, or `supabase/migrations/`.

### Claim 2 (no `pg_indexes`/`indexdef`/`CREATE INDEX` in src/ or scripts/) — CONFIRMED

Re-ran both scoped greps independently. Zero matches in either directory.

### Claim 3 (no generated `Database` types / codegen script) — CONFIRMED

`Glob **/database.types.ts` → none. `Grep "Database\["` (whole repo) → none. Read `package.json`
scripts block directly — no types-generation script for Supabase; only `cf:typegen` (Wrangler, for
Cloudflare env bindings, unrelated).

### Claim 4 (client-detail-data.ts query count) — RE-DERIVED INDEPENDENTLY, CONFIRMS THE REPORT'S CORRECTION

Grepped `.from("bookings")` in `client-detail-data.ts` myself: 7 hits, at L523, 533, 538, 571, 580,
585, 778 — exactly what the report found (not the "6" of whatever prior claim it was correcting).
Read the surrounding code for all 7:

- **Row-returning, both with `.order("booking_date",{ascending:false}).order("start_time",...)`:**
  L523 (full-access rail), L538 (full-access lifetime scan), L571 (therapist-scoped rail, additionally
  `.in("id", assignedBookingIds)`), L585 (therapist-scoped lifetime scan, same `.in`). = 4, confirmed.
- **Count-only (`.select("id", {count:"exact",head:true})`), no `ORDER BY`:** L533 (full-access
  head-count), L580 (therapist-scoped head-count, + `.in("id",...)`), and L778 — inside the separate
  exported function `countClientBookings` (L773–788), which is its own top-level export, not part of
  `getClientDetailData`. = 3, confirmed — not 2.

So: 7 total, 4 row-returning / 3 count-only. My independent count matches the blast-radius report's
correction exactly. (File is 895 lines by `wc -l`, not 896 as the report's evidence string says — an
off-by-one in the report's own line-count aside, likely a fencepost in how it counted "lines read";
doesn't affect any of the claims themselves.)

### Claim 5 (`booking/manage/actions.ts` — PK-only vs PK+status) — CONFIRMED

Read the full file (262 lines, matches). Three `.from("bookings")` update sites:
- L82–90 (`addCustomerManageNote`): `.eq("id", booking.id)` only — PK-only, confirmed.
- L140–152 (`requestCustomerCancellation`): `.eq("id", booking.id)` **and**
  `.in("status", ["pending", "confirmed"])` at L150 — filtered by id AND status, contradicting a
  blanket "ALL filtered only by primary key" claim. Confirmed report is right to call this FALSE.
- L215–229 (`requestCustomerReschedule`): `.eq("id", booking.id)` only — the status check
  (`!["pending","confirmed"].includes(booking.status)`, L210) happens in JS before the query, not as
  part of the query itself — PK-only, confirmed.

1 of 3 queries is not PK-only. Report's FALSE verdict and ~83/~141/~216 line markers confirmed.

### Claim 6 (public booking creation doesn't touch `bookings` directly) — CONFIRMED

`Grep \.from\(["']bookings["']\) path: src/app/(public)` → no matches. `Grep create_booking_request
path: src` → 8 files, including `src/app/api/bookings/createBookingTransaction.ts`. Confirmed.

### Claim 7 (`getScopedBookingIds`) — CONFIRMED

Read L515–548 directly. Function spans exactly that range. L531:
`.select("booking_id, bookings!inner(status, booking_date)")` on `booking_assignments`, verbatim.
L535–536: `.not("bookings.status", "in", '("cancelled","no_show")')` and
`.gte("bookings.booking_date", todayISO)` — both filter through the same `bookings!inner` embed.
Confirmed exactly.

### Claim 8 (specs never touch live Postgres) — CONFIRMED

Read both spec files' headers/mocks directly. `view-predicates-parity.test.ts` (L1–44): its own header
comment states the SQL side is `buildBookingPredicatePlan → applyBookingPredicates(recordingBuilder,
...) → replay the recorded PostgREST filters over fixtures` — never a live connection.
`booking-view-counts.test.ts` (L17–40): `vi.mock("next/cache", ...)` and
`vi.mock("@/lib/supabase/admin", ...)` cover the only two live-reaching seams. Confirmed neither spec
can observe index usage.

### Claim 9 (migration house style — byte-level) — CONFIRMED

Re-read both prior migration files in full and independently re-checked line endings at the byte
level (counting `\r\n` vs bare `\n` occurrences, not trusting the report's `od -c` claim):

- `20260522121000_add_band_b_indexes.sql`: 18 CRLF, 0 LF-only → CRLF throughout.
- `20260803053525_c03_enquiries_converted_booking_index.sql`: 0 CRLF, 19 LF-only → LF-only throughout.

And casing: file 1 is all-lowercase (`create index if not exists / on / where`); file 2 is
all-uppercase (`CREATE INDEX IF NOT EXISTS / ON / WHERE`). Both confirmed exactly as the report
states — the two prior migrations genuinely disagree on both dimensions, so "matches house style" is
not a well-defined claim for casing or line endings from these 2 samples. Shared conventions (schema
qualification, `IF NOT EXISTS`, 2-space indent, header comment, trailing newline, no `CONCURRENTLY`,
batching multiple statements in one file) are genuinely uniform across both and confirmed.

---

## Part 3 — New findings from this pass (not surfaced by either report)

1. **`status` column count should be 7, not 6** (see Part 1, Claim 2 above). The undercount comes
   from folding `notInert()`'s two independent call sites (L303, L331) into the single list slot for
   the function's definition (L294). Both call sites are real and, for the `claimable` view, both
   fire in the same request — the report's own parenthetical acknowledges "invoked from call sites
   L303 and L331" but only allocates one slot in the count of 6.

2. **Two additional `bookings`-table query shapes in `getBookingsListData`, missed by both reports,
   that none of the four proposed indexes are the primary access path for.** `bookings-list-data.ts`
   L719–727 and L733–741 (the `!canViewAll` scoped branch) run:
   ```
   .from("bookings").select(...).in("id", scopedIds.assignedIds)      // L720
     .order("booking_date", {ascending:false}).order("start_time", {ascending:false})
     .limit(SCOPED_BRANCH_ROW_CAP)   // = 200, L660

   .from("bookings").select(...).in("id", claimableOnlyIds)           // L734
     .order("booking_date", {ascending:false}).order("start_time", {ascending:false})
     .limit(SCOPED_BRANCH_ROW_CAP)
   ```
   These two queries bypass `buildBookingPredicatePlan`/`applyBookingPredicates` entirely (they're
   filtered by a pre-resolved `id IN (...)` list from `getScopedBookingIds`, not by
   `booking_date`/`status`/etc.), which is exactly why the derivation report — correctly scoped to
   `buildBookingPredicatePlan`'s L273–401 — never saw them, and why the blast-radius report's Q1-style
   reasoning (which explicitly scopes `bookings_date_time_id_idx` to "the `canViewAll` branch") also
   didn't reach them. With no `WHERE` predicate on `booking_date`/`start_time`, and a filter on `id`
   instead, Postgres has no reason to choose the new `(booking_date, start_time, id)` index as the
   access path here — `id` equality/`IN` is served by the existing `bookings_pkey`, and the (small,
   `SCOPED_BRANCH_ROW_CAP`-bounded) result set is more likely sorted in memory than served by an index
   scan. Not a defect in the proposed migration (the existing PK covers it adequately), but a real
   query shape that "the four proposed indexes would not serve" as asked, and that neither report
   enumerated.

3. Spot-checked the blast-radius report's `newFindings` claim that
   `redesign/evidence/plan-deepening/item-04-bookings-indexes.md` §5.4 independently lists
   `countClientBookings` plus two inline head-counts (3 count-only sites) — confirmed by reading that
   section directly (L202–217 of that file): it names `countClientBookings` (lines 776–782 in that
   doc's own commit snapshot) and "the inline head-count (lines 532–535, 579–583)" as separate items,
   consistent with 3 count-only sites, corroborating the blast-radius report's claim that this document
   carries the same latent inconsistency.

---

## Verdict summary

| Report | Claim | Verdict |
|---|---|---|
| Derivation | 1 (range 273–401, no drift) | CONFIRMED |
| Derivation | 2 (per-column counts) | REFUTED for `status` (6 → 7 real call sites); 7/8 columns confirmed |
| Derivation | 3 (embed trace / bookings.status vs booking_assignments.status) | CONFIRMED |
| Derivation | 4 (11 views / 1 count query per view) | CONFIRMED |
| Derivation | 5 (ordering + range) | CONFIRMED |
| Derivation | 6 (live schema/enum) | CONFIRMED |
| Blast-radius | 1 (index names collide nowhere) | CONFIRMED |
| Blast-radius | 2 (no pg_indexes/indexdef/CREATE INDEX in src/scripts) | CONFIRMED |
| Blast-radius | 3 (no generated types) | CONFIRMED |
| Blast-radius | 4 (client-detail-data.ts 7 total, 4 row / 3 count) | CONFIRMED (independently re-derived, matches) |
| Blast-radius | 5 (booking/manage/actions.ts — 1 of 3 filtered by status too) | CONFIRMED |
| Blast-radius | 6 (public booking creation via RPC) | CONFIRMED |
| Blast-radius | 7 (getScopedBookingIds embed filters) | CONFIRMED |
| Blast-radius | 8 (specs never touch live Postgres) | CONFIRMED |
| Blast-radius | 9 (migrations diverge on casing + line endings) | CONFIRMED |

**Net effect on the migration's justification:** the one real numeric error (`status` = 7, not 6)
does not weaken the case for `bookings_status_date_idx` — if anything it shows `status` is filtered
even more often than claimed, including one case (claimable) where it's filtered twice in the same
request. The client-detail-data.ts 4-of-7 split (row-returning vs count-only) is exactly right and
does not change the justification for `bookings_client_id_date_idx`. The one genuinely new gap is
finding 2 above: two `bookings` query shapes in the scoped (non-`canViewAll`) branch of
`getBookingsListData` that the four proposed indexes do not serve — they rely on the existing
`bookings_pkey` instead, which is adequate for their bounded, id-list-filtered shape, so this is a
documentation gap, not a design defect requiring a fifth index.
