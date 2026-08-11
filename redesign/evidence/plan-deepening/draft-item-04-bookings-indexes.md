## ITEM 4 — `bookings` indexes ⛔

*One of two Zone-2 items; the other is item 8 (6 migrations). Item 6 takes Option A, which needs no migration — so item 4's is the only migration until item 8 starts.*

> **Corrected:** the previous header read "⛔ (the only Zone-2 item, unless item 6 takes Option B)". That contradicted this plan's own scope table (§0.1), which lists item 8 as Zone-2 unconditionally. An implementer skimming only this header would wrongly conclude item 8 doesn't need the same Owner-approval-then-orchestrator-applies protocol. It does. The two items are independent Zone-2 actions — see §4.7 for how they relate.

### 4.1 The problem

`getBookingViewCounts` fans out **11 `count: "exact", head: true` queries per clinic-wide page render** (`visibleBookingViews(true)` returns `["attention","today","upcoming","claimable","assigned","unassigned","partially_assigned","completed","cancelled","all","series"]`, one count query per entry, run in parallel — verified by reading the array literal and the `Promise.all` fan-out). The list query orders by `booking_date DESC, start_time DESC, id DESC` with `.range()` pagination.

Live index state on `bookings` — verified, not assumed:

| Index | Definition |
|---|---|
| `bookings_pkey` | `(id)` |
| `bookings_client_status_completed_idx` | `(client_id, status) WHERE status = 'completed'` |
| `idx_bookings_recurring_template` | `(recurring_template_id) WHERE recurring_template_id IS NOT NULL` |

**Nothing on `booking_date`, `start_time`, unqualified `status`, `assignment_status`, `reschedule_status`, `customer_cancelled_at` or `payment_status`.**

**15 rows today; the brief projects 10–15k.** At 15 rows every plan is a sequential scan and the planner will ignore any index added — which is exactly why adding them now is free, and why *verifying* them by query plan now is meaningless. `booking_date`, `start_time`, `id` (the ORDER BY columns) are all `NOT NULL`, and the `booking_status_type` enum has 5 values (`pending, confirmed, completed, cancelled, no_show`) — genuinely low-cardinality.

### 4.2 Column usage — symbol, anchors, and a corrected count

Symbol: `buildBookingPredicatePlan` in `src/app/admin/bookings/bookings-list-data.ts`, currently at **lines 273–401** — **RE-LOCATE BY SYMBOL and report drift rather than trusting these numbers.**

Verified column-usage counts within the function body:

| Column | Count | Sites |
|---|---|---|
| `booking_date` | 5 | L332, L338, L341, L366, L367 |
| `assignment_status` | 4 | L313, L345, L348, L364 |
| `recurring_template_id` | 2 | L357, L358 (mutually exclusive branches) |
| `reschedule_status`, `payment_status`, `customer_cancelled_at`, `client_id` | 1 each | L314, L365, L315, L395 |
| `status` (targeting `bookings.status`) | **6** | L294 (`notInert()` def, reached from L303 and L331), L312, L342, L351, L354, L363 |

> **Corrected:** the previous text said `status` ×12. No defensible counting method reaches 12 — the ceiling under a raw-token count (`\bstatus\b`, word-boundary, lines 273–401) is 11, and that figure includes two pure-JS branch reads that never reach a query. The methodologically-consistent count — "distinct source sites that emit a `bookings.status` predicate," the same method that correctly produced 5/4/2/1/1/1/1 above — is **6**. A 7th occurrence exists (line 333, `eq(\`${embed("fv")}.status\`, "unassigned")` in the `claimable` view) but it filters **`booking_assignments.status`**, not `bookings.status` — `fv` resolves to `booking_assignments` via `BOOKING_FILTER_EMBEDS` (~line 195), reached through PostgREST's `!inner` embed. `bookings_status_date_idx` on `public.bookings` cannot serve that predicate at all; do not cite it as justification.

### 4.3 Proposed indexes

```sql
-- Serves the list's ORDER BY booking_date DESC, start_time DESC, id DESC
-- plus .range() pagination. All three columns are NOT NULL, so nulls-ordering
-- is moot. btree scans backwards, so an ascending definition serves the
-- descending order too (Postgres "Index Scan Backward").
CREATE INDEX IF NOT EXISTS bookings_date_time_id_idx
  ON public.bookings (booking_date, start_time, id);

-- status targets bookings.status directly in 6 predicate branches (notInert's
-- exclusion — reached from two call sites, attention, upcoming, completed,
-- cancelled, and the post-filter), almost always alongside a booking_date
-- bound. (A 7th occurrence, in the claimable view, filters
-- booking_assignments.status via the fv embed and is irrelevant to this
-- index — see §4.2.) Leading with the equality column and trailing the range
-- column is the standard composite shape, though note one of the 6 (the
-- `upcoming` view's `neq("status","completed")`) is a negation on the
-- leading column, which this index helps less than the other 5 equality/IN
-- usages — Postgres will likely enter via booking_date for that one instead.
CREATE INDEX IF NOT EXISTS bookings_status_date_idx
  ON public.bookings (status, booking_date);

-- assignment_status drives the claimable/assigned chips: attention's
-- neq.fully_assigned, unassigned's eq, partially_assigned's eq, and the
-- post-filter's eq — all 4 are genuine equality/inequality-on-leading-column
-- shapes. No existing index touches this column.
CREATE INDEX IF NOT EXISTS bookings_assignment_status_date_idx
  ON public.bookings (assignment_status, booking_date);

-- The client detail page lists a client's bookings; the existing composite
-- (bookings_client_status_completed_idx) is partial on status='completed'
-- and Postgres can only use a partial index when the query provably implies
-- that predicate, so it cannot serve the unfiltered history. Every live
-- row-returning client_id-scoped read of bookings (getClientDetailData,
-- both the full-access and therapist-scoped branches) also does
-- .order("booking_date", desc).order("start_time", desc) — 4 of the file's
-- 6 client_id-scoped bookings queries do this; the other 2 are head-count-only
-- with no ORDER BY. A bare (client_id) index would serve the filter but leave
-- sorting as a separate step, so this is widened to a composite that serves
-- both, at only marginal size cost over the bare version, and serves the
-- count-only queries exactly as well.
CREATE INDEX IF NOT EXISTS bookings_client_id_date_idx
  ON public.bookings (client_id, booking_date, start_time);
```

> **Corrected:** the previous list proposed a bare `bookings_client_id_idx (client_id)`. Widened to `(client_id, booking_date, start_time)` because every row-returning `client_id`-scoped read in `client-detail-data.ts` sorts by those two columns immediately after filtering — see the SQL comment above and §4.5's blast-radius trace. This is not a correctness fix (the bare version was not wrong), it is closer alignment with the plan's own "for volume, not today" rationale.

**Deliberately NOT indexed:** `reschedule_status`, `payment_status`, `customer_cancelled_at` — one predicate each (verified), and all low-cardinality. Indexing them would add write cost for no realistic read benefit. If profiling later says otherwise, add them then.

### 4.4 Execution notes

- **Do NOT use `CREATE INDEX CONCURRENTLY`.** It cannot run inside a transaction block — this part is a hard Postgres rule (`25001: CREATE INDEX CONCURRENTLY cannot run inside a transaction block`), not something to verify. Whether `apply_migration` itself wraps statements in a transaction is **plausible but unverified from outside the tool** (no prior migration in this repo's 58-file history uses `CONCURRENTLY`, including two earlier index-adding migrations of comparable or larger table size — circumstantial, not proof). Either way there is nothing to gain: at 15 rows a plain `CREATE INDEX` is instantaneous, and `CONCURRENTLY` buys nothing even if it would technically run.
- `IF NOT EXISTS` on every statement, so re-running is safe.
- **This is Zone-2.** The executing agent writes the migration file and stops. The Owner approves the exact SQL in chat; the orchestrator applies it via `mcp__supabase__apply_migration`. No subagent calls that tool.
- Filename: a 14-digit timestamp later than the current newest migration (`20260809160000_c14_override_breaks.sql`), snake_case description. Recommended: `supabase/migrations/20260811130000_add_bookings_indexes.sql` — any later, unique, correctly-formatted timestamp is equally valid. Note: the timestamp Supabase records in `supabase_migrations.schema_migrations` at apply time is not guaranteed to equal the filename's timestamp (observed mismatch on `c14_override_breaks`: filename `20260809160000`, recorded version `20260809205045`) — harmless here since nothing depends on the two matching, but don't go looking for the file's own timestamp in the tracking table and treat its absence as an error.

### 4.5 Blast radius

**Files to edit:** one new file only — `supabase/migrations/<timestamp>_add_bookings_indexes.sql` (§4.4). No existing file is edited by this item; it is additive DDL.

**Callers / consumers checked (all traced by reading the source, not assumed):**
- `buildBookingPredicatePlan`, `countBookings`, `getBookingsListData`, `getBookingViewCounts` — all in `bookings-list-data.ts`. No code change required; indexes are a query-planner concern only, invisible to PostgREST/application code.
- `getScopedBookingIds` (`bookings-list-data.ts`, ~lines 515–548) — queries `booking_assignments`, with one embedded filter `bookings!inner(status, booking_date)` (~line 531) that reads `bookings.status`/`bookings.booking_date` through a join. `bookings_status_date_idx` and `bookings_date_time_id_idx` can only help this, never hurt or break it.
- `getClientDetailData`, `countClientBookings` (`src/app/admin/clients/[clientId]/client-detail-data.ts`) — traced in full in §4.3's index comment. No code change required.

**`/booking/manage` — checked by name, the known cross-cutting surface:**
`Grep "\.eq\(\"client_id\"|\.from\(\"bookings\"\)" src/app/booking/manage/actions.ts` → 3 matches (lines 83, 141, 216). Read all three (lines 70–229): every one is `.from("bookings").update({...}).eq("id", booking.id)...` — filtered **only by primary key**, never by `status`, `booking_date`, `assignment_status`, `client_id`, or `recurring_template_id`. All three are served by the existing `bookings_pkey` regardless of this item. **`/booking/manage` is unaffected.**

**Shared with the public/customer site:** nothing under `src/app/(public)/` reads or writes `bookings` directly by any of the four newly-indexed columns — public pages create bookings through `create_booking_request`, a DB function, not through the admin data-layer files this item touches. Combined with the `/booking/manage` check above: **no public-facing behavior is touched by this item under any outcome** — indexes cannot change query results, only planner choices.

**Proven NOT affected (checked, not assumed):**
- **New index-name collisions:** `Grep "bookings_date_time_id_idx|bookings_status_date_idx|bookings_assignment_status_date_idx|bookings_client_id_date_idx"` across the whole repo → no matches anywhere in code, migrations, or tests today. No collision risk.
- **No index-existence tests anywhere:** `Grep "pg_indexes|indexdef|CREATE INDEX"` across `src/` and `scripts/` → zero matches. Nothing in the vitest suite asserts on `pg_indexes` output.
- **Generated TypeScript types:** `Glob **/database.types.ts`, `Glob **/*.types.ts` (under `src/`), `Grep "Database\["` across repo, `Grep "gen.types|types:generate|supabase gen"` in `package.json` → all empty. No generated-types file exists in this repo at all; every Supabase query result is manually cast to hand-written interfaces (`bookings-list-data.ts`'s own header comment confirms this). An index-only migration has zero TypeScript impact, and would have none even if generated types existed — `generate_typescript_types` output never encodes index metadata.
- **`buildBookingPredicatePlan`'s existing tests** (`__tests__/view-predicates-parity.test.ts`, `__tests__/booking-view-counts.test.ts`) run against an in-memory recording stand-in query builder, not a live Postgres connection — they cannot observe index usage and will not change behavior with or without this migration.

### 4.6 Ordering relative to the other items

**No file overlap with any of items 1, 2, 3, 5, 6, 7.** Item 6 ("adjustment lists") concerns `availability_overrides`/`staff_availability_overrides`, a different table entirely. **Item 8 also writes migrations (4 of them, against `business_settings.allowed_cities` and related tables)** — no shared file, no shared table, so there is no sequencing dependency between the two Zone-2 items' SQL. But both are Zone-2: each needs its **own** Owner approval of its exact SQL text in chat, applied by the orchestrator, never batched or waved through together on one approval.

Item 4 has no prerequisite among items 1–3 or 5–8, and is not a prerequisite for any of them. It can be sequenced anywhere in the execution order.

### 4.7 Per-batch verification

**Before writing the migration file**, re-confirm the premise hasn't drifted:
```sql
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname='public' AND tablename='bookings' ORDER BY indexname;
-- MUST show exactly the 3 rows in §4.1's table. If not, stop (§4.8.1).

SELECT count(*) FROM public.bookings;   -- MUST be close to 15 (§4.8.2).
```

**After the Owner applies the migration** (orchestrator-run, not subagent):
```sql
-- 1. Confirm all 4 new names exist alongside the 3 originals (7 total)
SELECT indexname FROM pg_indexes
WHERE schemaname='public' AND tablename='bookings' ORDER BY indexname;
-- MUST now include: bookings_assignment_status_date_idx, bookings_client_id_date_idx,
--   bookings_client_status_completed_idx, bookings_date_time_id_idx, bookings_pkey,
--   bookings_status_date_idx, idx_bookings_recurring_template

-- 2. Confirm row count is unchanged (CREATE INDEX never touches data)
SELECT count(*) FROM public.bookings;   -- MUST still be 15 (or whatever §4.8.1 step showed) — MUST NOT change.
```

**What MUST move:** the index list (3 → 7 rows). **What MUST NOT move:** `bookings` row count, any application-visible query result (chip counts, list ordering, client-detail history) — indexes change planner behavior only, never output. Do not attempt to measure a performance improvement; at 15 rows there will be none to measure. The correct claim after this item ships is: *the indexes the projected query shapes will need are in place before the data arrives* — nothing more.

### 4.8 Tests to add

**None.** Consistent with existing precedent, not a gap: neither prior index-adding migration in this repo (`20260522121000_add_band_b_indexes.sql`, `20260803053525_c03_enquiries_converted_booking_index.sql`) added or required a test file, and no test anywhere in the suite asserts on `pg_indexes` or query plans (§4.5). The correct verification is the manual SQL in §4.7, run by the Owner/orchestrator immediately after `apply_migration`.

### 4.9 Stop conditions

1. **If `pg_indexes` at execution time shows anything other than the exact 3 indexes in §4.1's table**, stop — the premise has changed since this was written, and the migration's `IF NOT EXISTS` guards, while safe, may be masking schema drift worth understanding first.
2. **If `bookings` row count is not close to 15** (real volume has already landed), re-read §4.3's "honest expectation" framing before proceeding — the "no measured improvement" claim and the low urgency both depend on the table still being tiny.
3. **If asked to also index `reschedule_status`, `payment_status`, or `customer_cancelled_at`**, don't — §4.3's "deliberately NOT indexed" reasoning still holds; that needs new profiling evidence, not this item.
4. **If `CREATE INDEX CONCURRENTLY` is attempted and does NOT fail**, stop and report rather than assuming the transaction-wrapping model was wrong — it could mean the statement ran outside any transaction, which has implications for how any future multi-statement Zone-2 migration in this repo should be structured.
5. **Before applying, get the exact SQL text re-approved in chat per the Zone-2 protocol** (§1 rule 1) — this item is Zone-2 regardless of what item 8 does, per the corrected header at the top of this section.
6. **`buildBookingPredicatePlan` has moved from lines 273–401**, or any of the line numbers cited in §4.2 have drifted — re-locate by symbol, note the drift, and re-verify the column-usage counts before trusting this section's numbers.

### 4.10 Rollback

Nothing in this item is irreversible. Adding an index changes no data. None of the four proposed indexes back a constraint (all are plain `CREATE INDEX`, not `UNIQUE`/PK), so there is no "cannot drop index because a constraint requires it" hazard.

```sql
DROP INDEX IF EXISTS public.bookings_date_time_id_idx;
DROP INDEX IF EXISTS public.bookings_status_date_idx;
DROP INDEX IF EXISTS public.bookings_assignment_status_date_idx;
DROP INDEX IF EXISTS public.bookings_client_id_date_idx;
```

If the migration file itself needs to be reverted (not just the indexes undone live), it is a pure addition with no dependent application code — deleting it is safe with no co-dependency, unlike `c14_override_breaks.sql` which is deliberately co-shipped with application code changes.

---
