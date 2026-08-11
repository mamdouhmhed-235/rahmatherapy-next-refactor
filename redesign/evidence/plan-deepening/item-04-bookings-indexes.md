# ITEM 4 deepening — `bookings` indexes

**Plan section audited:** `redesign/plans/POST-BAND-C-FOLLOWUP-plan.md` lines 239-297 ("ITEM 4 — `bookings` indexes")
**Context read:** `redesign/HANDOFF-2026-08-11-PLANNING.md` (full)
**Method:** every claim in the plan section re-verified independently — live SQL against `twzutkfgqclqurvkmvqz`, symbol-level source reads, and grep-based re-counts with the exact commands shown below. Nothing here is asserted from memory of the plan text.

---

## 1. Headline

The plan's factual claims about the *live database* (3 indexes, 15 rows, column list) are all **exactly correct**. Six of its seven column-usage counts are **exactly correct** (`booking_date`×5, `assignment_status`×4, `recurring_template_id`×2, and the three singletons). The **`status`×12 count is wrong** — no defensible counting method reaches 12; the best-supported number is **6 distinct `bookings.status` predicate sites** (or 11 if you count every raw token match of the word `status`, including non-predicate JS property reads — still not 12). One of the occurrences the plan may have been counting (`fv.status` in the `claimable` view) is not `bookings.status` at all — it is `booking_assignments.status`, reached through an aliased `!inner` embed — so it provides zero justification for an index on `bookings`. Separately, the proposed `bookings_client_id_idx` is weaker than the codebase's actual query shape calls for: every live `client_id`-scoped read of `bookings` also does `ORDER BY booking_date DESC, start_time DESC`, which a bare `(client_id)` index does not serve as well as `(client_id, booking_date, start_time)` would. The `CREATE INDEX CONCURRENTLY`/transaction-wrapping claim could not be independently verified (calling `apply_migration` to test it is forbidden by my own operating rules) — I flag it UNVERIFIABLE rather than repeat the plan, with the circumstantial evidence I could gather.

---

## 2. Live database re-verification

### 2a. Current index list on `public.bookings`

```sql
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname='public' AND tablename='bookings' ORDER BY indexname;
```

Result (live, `twzutkfgqclqurvkmvqz`):

| indexname | indexdef |
|---|---|
| `bookings_client_status_completed_idx` | `CREATE INDEX bookings_client_status_completed_idx ON public.bookings USING btree (client_id, status) WHERE (status = 'completed'::booking_status_type)` |
| `bookings_pkey` | `CREATE UNIQUE INDEX bookings_pkey ON public.bookings USING btree (id)` |
| `idx_bookings_recurring_template` | `CREATE INDEX idx_bookings_recurring_template ON public.bookings USING btree (recurring_template_id) WHERE (recurring_template_id IS NOT NULL)` |

**Verdict: CONFIRMED.** Exactly the three indexes the plan lists (§4.1 table), same definitions, same partial predicates.

### 2b. Row count

```sql
SELECT count(*) AS row_count FROM public.bookings;
```
Result: `15`.

**Verdict: CONFIRMED.** Matches the plan's "15 rows today" (§4.1).

### 2c. Column list + nullability (needed for the ORDER BY / nulls-ordering question)

```sql
SELECT column_name, data_type, is_nullable FROM information_schema.columns
WHERE table_schema='public' AND table_name='bookings' ORDER BY ordinal_position;
```

Relevant subset:

| column | data_type | is_nullable |
|---|---|---|
| `id` | uuid | NO |
| `client_id` | uuid | NO |
| `booking_date` | date | NO |
| `start_time` | time without time zone | NO |
| `status` | USER-DEFINED (`booking_status_type`) | NO |
| `assignment_status` | USER-DEFINED | NO |
| `payment_status` | USER-DEFINED | NO |
| `reschedule_status` | text | NO |
| `customer_cancelled_at` | timestamp with time zone | YES |
| `recurring_template_id` | uuid | YES |

`booking_date`, `start_time`, `id` — the three ORDER BY columns — are **all `NOT NULL`**. This matters directly for the plan's backward-scan claim (§3 below).

`booking_status_type` enum values (`pg_enum`): `pending, confirmed, completed, cancelled, no_show` — 5 values, genuinely low-cardinality, consistent with the plan's framing of `status` as an equality-filter column that benefits from being paired with a range column rather than indexed alone.

---

## 3. Re-deriving column usage in `buildBookingPredicatePlan`

**Symbol located:** `buildBookingPredicatePlan` in `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor\src\app\admin\bookings\bookings-list-data.ts`. Current location: **lines 273–401** (function body ends at the `return { embeds, steps };` on line 400, closing brace 401). This matches the plan's implicit line range from the base commit — **no anchor drift** for this symbol (consistent with the handoff's claim that `src/` is byte-identical between `33f895f` and HEAD).

I enumerated every column-name occurrence inside the function by symbol/line, then cross-checked with `Grep` on the whole file (commands below) and manually excluded matches from *outside* the function body (`BOOKING_SELECT`, `CLAIMABLE_BOOKING_SELECT`, `getScopedBookingIds`, `bookingListFiltersFromQuery`, `normalizeClaimableBooking` — none of those are `buildBookingPredicatePlan`).

### 3a. `booking_date` — plan claims ×5

```
grep -n "booking_date" bookings-list-data.ts
```
Within the function (lines 273-401):
- L332 `gte("booking_date", ctx.today)` — `claimable` view
- L338 `eq("booking_date", ctx.today)` — `today` view
- L341 `gte("booking_date", ctx.today)` — `upcoming` view
- L366 `if (ctx.from) gte("booking_date", ctx.from)` — post-filter
- L367 `if (ctx.to) lte("booking_date", ctx.to)` — post-filter

**Count = 5. CONFIRMED, matches the plan exactly.**

### 3b. `assignment_status` — plan claims ×4

- L313 `"assignment_status.neq.fully_assigned"` — inside the `attention` view's `.or(...)` string
- L345 `eq("assignment_status", "unassigned")` — `unassigned` view
- L348 `eq("assignment_status", "partially_assigned")` — `partially_assigned` view
- L364 `if (ctx.assignmentStatus) eq("assignment_status", ctx.assignmentStatus)` — post-filter

**Count = 4. CONFIRMED, matches the plan exactly.**

### 3c. `recurring_template_id` — plan claims ×2

- L357 `if (ctx.templateId) eq("recurring_template_id", ctx.templateId)`
- L358 `else steps.push({ op: "notNull", column: "recurring_template_id" })`

(Mutually exclusive branches of the `series` view — never both in one query.)

**Count = 2. CONFIRMED, matches the plan exactly.**

### 3d. `reschedule_status`, `payment_status`, `customer_cancelled_at`, `client_id` — plan claims "one each"

- `reschedule_status`: L314, `"reschedule_status.eq.requested"` inside `attention`'s `.or(...)`. **×1, CONFIRMED.**
- `payment_status`: L365, `if (ctx.paymentStatus) eq("payment_status", ctx.paymentStatus)` post-filter. **×1, CONFIRMED.**
- `customer_cancelled_at`: L315, `"customer_cancelled_at.not.is.null"` inside `attention`'s `.or(...)`. **×1, CONFIRMED.**
- `client_id`: L395, `arms.push(\`client_id.in.(${ctx.searchClientIds.join(",")})\`)` inside the `search` post-filter's `.or(...)` arm. **×1, CONFIRMED.** (Note: this is the *only* `client_id` reference anywhere in the function — it exists purely to fold pre-resolved client-search hits into the booking `OR`, not as a direct per-client lookup. The client-detail page's `client_id` filtering happens in a *different* file entirely — see §5.)

**All six of these counts are exactly right.**

### 3e. `status` — plan claims ×12. **This does not hold up.**

I tried three different, individually defensible counting methods; none reaches 12.

**Method A — distinct source sites that emit a `bookings.status` predicate** (the same method that produced the correct 5/4/2/1/1/1/1 counts above, i.e. "how many places in the function's logic target this exact column"):

| Line | Code | View / phase | Table |
|---|---|---|---|
| 294 | `steps.push({ op: "notIn", column: "status", value: INERT_STATUS_FILTER })` — the `notInert()` helper's definition | archive-exclusion (called from L303 *and* L331) | `bookings.status` |
| 312 | `"status.eq.pending"` | `attention` view `.or(...)` | `bookings.status` |
| 333 | `` eq(`${embed("fv")}.status`, "unassigned") `` | `claimable` view | **`booking_assignments.status`, NOT `bookings.status`** (see below) |
| 342 | `neq("status", "completed")` | `upcoming` view | `bookings.status` |
| 351 | `eq("status", "completed")` | `completed` view | `bookings.status` |
| 354 | `steps.push({ op: "in", column: "status", values: [...] })` | `cancelled` view | `bookings.status` |
| 363 | `if (ctx.status) eq("status", ctx.status)` | post-filter | `bookings.status` |

That is **6 sites that target `bookings.status`** (294, 312, 342, 351, 354, 363) plus **1 site that targets a different table's `status` column** (333, `booking_assignments.status`). If `notInert()`'s two call sites (L303's archive-exclusion guard, L331's belt-and-suspenders repeat inside `claimable`) are counted as separate applications rather than one definition, that adds 1, giving **7** for `bookings.status` (or 8 including the wrong-table one).

**Method B — raw token count**, `\bstatus\b` (word-boundary, so it does *not* match inside `assignment_status`/`payment_status`/`reschedule_status`/`userWantsInertStatus`/`INERT_STATUS_FILTER` — all of those have a non-boundary `_`/capital immediately before "status"), restricted to lines 273-401:

```
grep -no '\bstatus\b' bookings-list-data.ts   # then filtered to lines 273-401
```
Matches at: 294(×1), 300(×2, `ctx.status === "cancelled" || ctx.status === "no_show"`), 312(×1), 333(×1, `.status` in the `fv.status` template literal), 342(×1), 351(×1), 354(×1), 363(×3, `ctx.status`, `"status"`, `ctx.status` again).

Sum: 1+2+1+1+1+1+1+3 = **11**.

**Method C — Method B minus the two `ctx.status` reads that are pure JS branching (L300's `userWantsInertStatus` computation, and L363's `if (ctx.status)` guard) which never themselves reach the query** — leaves 11 − 3 = **8**.

**None of A/B/C = 12.** The closest is Method B at 11, one short. Given every *other* column in this section counted out exactly via Method A's methodology, I judge Method A (6, or 7 with the notInert double-call) the intended basis, and the plan's "×12" is a **real overcount**, not a rounding or methodology quibble. This is the same class of error the handoff already flagged elsewhere in this planning round ("an '18 ratio comments' count that was 14").

**Separately, and more importantly than the arithmetic: line 333 must not be used as justification for a `bookings.status` index at all.** `eq(`${embed("fv")}.status`, "unassigned")` filters the **`booking_assignments`** table (aliased `fv` via the `!inner` embed defined in `BOOKING_FILTER_EMBEDS = { fv: "booking_assignments", ... }`, line ~195). `bookings_status_date_idx ON public.bookings (status, booking_date)` **cannot help this predicate at all** — it is evaluated against a different table entirely, joined in via PostgREST's embedded-filter mechanism. Whoever wrote the "×12" figure appears to have folded this occurrence into the tally, which both inflates the count and slightly misrepresents what the proposed index would actually accelerate.

**Corrected justification text for §4.2's `bookings_status_date_idx` comment:**
> `status` is targeted directly on `bookings` in 6 of the predicate branches (`notInert`'s exclusion — reached from two call sites, `attention`, `upcoming`, `completed`, `cancelled`, and the post-filter), almost always alongside a `booking_date` bound. (A 7th occurrence, in the `claimable` view, filters `booking_assignments.status` via the `fv` embed and is irrelevant to this index.) Leading with the equality column and trailing the range column is still the right composite shape.

---

## 4. The count of chip queries per render — re-verified

**Symbol:** `getBookingViewCounts` (same file, lines 950-967) and `visibleBookingViews` (lines 916-932).

`visibleBookingViews(true)` (clinic-wide, the case the plan's "11" refers to) returns:
```ts
["attention","today","upcoming","claimable","assigned","unassigned",
 "partially_assigned","completed","cancelled","all","series"]
```
Counted the array literal by hand: **11 entries.** `getBookingViewCounts` does `views.map((view) => countBookings({ ...base, view }))` inside `Promise.all(...)` — one `count:"exact", head:true` query per entry, run in parallel.

**Verdict: CONFIRMED.** "11 count queries per clinic-wide render" (§4.1) is exactly right — this is the one count in the section I did not need to correct.

(For a therapist without clinic-wide access, `visibleBookingViews(false)` returns 5 entries and `getBookingsListPage`'s non-`canViewAll` branch never calls `getBookingViewCounts`'s clinic-wide count path at all — the chip counts for that role come from a different mechanism entirely, `getScopedBookingIds`. Out of scope for this item but worth knowing: the "11" is clinic-wide-only, and the plan's own text already scopes it that way ("11 ... per clinic-wide page render").)

---

## 5. Assessing each proposed index

### 5.1 `bookings_date_time_id_idx (booking_date, start_time, id)` — CORRECT

The live query (`getBookingsListData`, same file, lines 702-707):
```ts
.order("booking_date", { ascending: false })
.order("start_time", { ascending: false })
.order("id", { ascending: false })
```
confirmed verbatim — this **is** exactly `ORDER BY booking_date DESC, start_time DESC, id DESC` as the task brief states, plus `.range()` pagination two lines later (708-711).

- **Nulls-ordering check:** all three columns are `NOT NULL` (verified §2c above), so the ASC-index-serves-DESC-query nulls-ordering question the task asked me to check is **moot in practice** — there are no NULLs to place first or last. Postgres's default is `NULLS LAST` for ASC and `NULLS FIRST` for DESC; a plain ascending btree index's *storage order* for non-null values is unaffected by either default, so this would not have broken the plan's claim even if the columns were nullable, but it is worth stating plainly that the columns being `NOT NULL` removes any doubt.
- **Backward-scan claim:** correct and standard Postgres behavior — a btree index built ascending on `(a,b,c)` can be scanned in reverse to serve `ORDER BY a DESC, b DESC, c DESC` (`Index Scan Backward`), and Postgres's planner does this automatically; no `DESC` needs to be baked into the index definition. **Confirmed technically sound.**
- **Redundancy check:** no existing index touches `booking_date` or `start_time` at all (§2a). Not redundant.

### 5.2 `bookings_status_date_idx (status, booking_date)` — sound shape, overstated justification (see §3e)

- **Redundancy check against `bookings_client_status_completed_idx (client_id, status) WHERE status='completed'`:** not redundant — different leading column (`client_id` vs `status`), and the existing index is *partial* (only completed rows), so it cannot serve a `status`-only or `status+date` query across all statuses. No overlap concern.
- **Effectiveness caveat not in the plan:** a `(status, booking_date)` index helps *equality* filters on `status` (the `completed` view, the `cancelled` view's `IN`) combined with a `booking_date` bound, and helps the `notInert()` exclusion when combined with something else selective. It does **not** meaningfully help the `upcoming` view's `neq("status","completed")` (line 342) — a negation on the leading column is not an efficient index condition; Postgres will typically use `booking_date` as the entry point there instead (which this index also has, just not leading). This isn't wrong to build, just: the plan's framing ("status is in 12 of the chip predicates ... leading with the equality column ... is the standard composite shape") overstates how uniformly "equality" the `status` usages are — 1 of the true 6 is a `neq`, not an `eq`/`in`.

### 5.3 `bookings_assignment_status_date_idx (assignment_status, booking_date)` — CORRECT, count confirmed (§3b, ×4)

No existing index touches `assignment_status`. Not redundant. All 4 usages (attention's `neq.fully_assigned`, `unassigned` eq, `partially_assigned` eq, post-filter eq) are genuine equality/inequality-on-leading-column shapes paired with a date bound elsewhere in the same query — sound justification, unlike 5.2.

### 5.4 `bookings_client_id_idx (client_id)` — not redundant, but **incomplete relative to the actual query shape**

**Direct answer to the assigned question — does it duplicate the leading column of the existing partial composite?** No. `bookings_client_status_completed_idx` is `(client_id, status) WHERE status = 'completed'`, a *partial* index. Postgres will only use a partial index when the query's `WHERE` clause provably implies the partial predicate (here, `status = 'completed'`). A client-detail-page read of a client's *entire* booking history (all statuses) cannot use that partial index at all — Postgres has to either full-scan or use a non-partial index on `client_id`. The plan's own reasoning for this ("the existing composite is partial on `status='completed'` and cannot serve the unfiltered history") is **correct**.

**What the plan missed:** I traced every live `client_id`-scoped read of `bookings` in the codebase (symbol: `getClientDetailData`, `countClientBookings`, both in `src/app/admin/clients/[clientId]/client-detail-data.ts`):

```ts
// getClientDetailData, full-access branch (lines 522-529, 537-544)
.from("bookings").select(bookingSelect).eq("client_id", clientId)
  .order("booking_date", { ascending: false })
  .order("start_time", { ascending: false })
  .limit(historyCap)          // bookingHistory rail
// ...and again, identically ordered, for lifetimeBookings (BOOKING_LIFETIME_SELECT, cap 2000)

// getClientDetailData, therapist-scoped branch (lines 570-578, 584-592) — SAME two reads,
// additionally narrowed by .in("id", assignedBookingIds), SAME two .order() calls

// countClientBookings (lines 776-782) and the inline head-count (lines 532-535, 579-583)
.select("id", { count: "exact", head: true }).eq("client_id", clientId)   // no ORDER BY — count-only
```

Every row-returning `client_id`-scoped query (4 of the 6 `client_id` bookings queries in that file) filters on `client_id` **and then orders by `booking_date DESC, start_time DESC`**. A bare `(client_id)` index serves the filter but leaves Postgres to sort the matching rows separately (irrelevant now at 15 rows/query, but the plan's own stated rationale for doing this work now is "the indexes the projected query shapes will need are in place before the data arrives" — §4.4). A composite `bookings_client_id_date_idx ON public.bookings (client_id, booking_date DESC, start_time DESC)` (or ascending, relying on the same backward-scan property verified in §5.1) would serve **both** the filter and the sort with no separate sort step, at only a marginal size cost over the plain single-column version, and would still serve the two count-only queries just as well as a bare `client_id` index does (count-only queries don't need the trailing columns, but an index with extra trailing columns is never worse for an equality-prefix count than the narrower version). **This is not a correctness bug in the plan — the bare `client_id` index is still useful and not wrong to add — but it is a missed opportunity given the plan's own "for volume, not today" rationale, and I'd suggest the implementer replace `bookings_client_id_idx (client_id)` with `bookings_client_id_date_idx (client_id, booking_date, start_time)` before applying.**

### 5.5 "Deliberately NOT indexed" list — spot-checked, consistent

`reschedule_status`, `payment_status`, `customer_cancelled_at` each appear exactly once in the predicate plan (§3d), confirming the plan's "one predicate each" framing for why they're skipped.

---

## 6. `CREATE INDEX CONCURRENTLY` / transaction-wrapping claim — UNVERIFIABLE by direct test

The plan asserts: *"`apply_migration` wraps the statement [in a transaction]... Using `CONCURRENTLY` here will simply fail."*

**I cannot test this directly** — my operating rules for this audit explicitly forbid calling `mcp__supabase__apply_migration` under any circumstances, which is the only way to observe the tool's actual transaction behavior. I have no access to the MCP server's implementation source (it is a remote service, not part of this repository) and Supabase's public documentation search (`mcp__supabase__search_docs`) returned zero results for a query about it — that search covers product docs (Auth/Realtime/Storage/CLI/client libraries), not this MCP server's internal tool semantics.

**Circumstantial evidence gathered (not proof):**
- I listed all 58 files in `supabase/migrations/` (`Glob supabase/migrations/*`) and grepped for `CONCURRENTLY` — **zero occurrences** in any migration in this repo's history, including the two prior index-adding migrations (`20260522121000_add_band_b_indexes.sql`, `20260803053525_c03_enquiries_converted_booking_index.sql`), both of which use plain `CREATE INDEX IF NOT EXISTS` on tables (`audit_logs`, `booking_assignments`, `bookings`, `enquiries`) of comparable or larger size than today's 15-row `bookings`. This is consistent with — but does not prove — a repo-wide understanding that `CONCURRENTLY` is unusable through this tool.
- `20260809160000_c14_override_breaks.sql` explicitly wraps its own DDL in `BEGIN; ... COMMIT;` — the author of that file evidently believed (or wanted to guarantee) transactional atomicity across two `ALTER TABLE ... DROP CONSTRAINT` statements. This is *consistent with* a mental model where `apply_migration` either already wraps statements (making the explicit `BEGIN/COMMIT` redundant but harmless — nested `BEGIN` inside an existing transaction is a Postgres warning, not an error, and does not start a true sub-transaction) or does not wrap them (making the explicit wrapping necessary). It does not disambiguate the two.

**My instruction to the report reader:** treat the plan's "will simply fail" claim as **plausible but UNVERIFIED**. The recommended action (avoid `CONCURRENTLY`) is safe advice regardless of which way the underlying mechanism actually works, since: (a) on a 15-row table there is no performance reason to use it, (b) if `apply_migration` does wrap in a transaction, `CONCURRENTLY` provably cannot run inside one (this part is a hard Postgres rule, not something to verify — `CREATE INDEX CONCURRENTLY` errors with `25001: CREATE INDEX CONCURRENTLY cannot run inside a transaction block` whenever it is attempted inside `BEGIN...COMMIT`, unconditionally), and (c) if it does *not* wrap in a transaction, `CONCURRENTLY` would actually work but buys nothing at this row count. **Recommend the plan keep its "do not use CONCURRENTLY" instruction, but rephrase the certainty**: change "will simply fail" to "will fail if `apply_migration` wraps statements in a transaction (unverified from outside the tool, but zero precedent for `CONCURRENTLY` exists anywhere in this repo's 58 prior migrations) — and even if it does not, buys nothing at 15 rows."

---

## 7. Migration filename and repo convention

```
Glob supabase/migrations/*   →  58 files, all matching  <14-digit-YYYYMMDDHHMMSS>_<snake_case_description>.sql
```
Most recent three, in order: `20260803053525_c03_enquiries_converted_booking_index.sql`, `20260804182200_c18_consent_events.sql`, `20260809120000_c14_save_availability_day.sql`, `20260809160000_c14_override_breaks.sql`.

**Exact filename the implementer should create:** a 14-digit timestamp later than `20260809160000`, snake_case description, `.sql` extension. Given the current session date (2026-08-11) and no `C-`/`B-` phase code applying to this standalone follow-up item, I recommend:

```
supabase/migrations/20260811130000_add_bookings_indexes.sql
```

(Any later, unique, correctly-formatted timestamp is equally valid — the exact HHMMSS is not load-bearing, only that it sorts after `20260809160000` and doesn't collide.)

**One nuance for the implementer, found by cross-referencing the file list against the live tracking table:**
```sql
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5;
```
```
20260809205045 | c14_override_breaks
20260809154908 | c14_save_availability_day
20260804182200 | c18_consent_events
20260803053525 | c03_enquiries_converted_booking_index
20260802131001 | c02_recurring_bookings
```
Compare `c14_override_breaks`: filename says `20260809160000`, but the **applied** version recorded in `supabase_migrations.schema_migrations` is `20260809205045` — a different timestamp for the same migration. (`c03_enquiries_converted_booking_index`'s filename and recorded version *do* match, `20260803053525` both times.) **Do not assume the committed filename's timestamp will equal whatever version number ends up in the tracking table** — that appears to be assigned by the tool at apply time, independent of the filename. This has no practical consequence for item 4 (nothing depends on the two matching), but it would be a confusing surprise if the implementer goes looking for the file's own timestamp in the tracking table and doesn't find it.

---

## 8. Rollback SQL — exact

Straightforward — unlike the `c14_override_breaks` trap (§ HANDOFF gotcha 8), none of these four indexes back a constraint (they are plain `CREATE INDEX`, not `UNIQUE`/PK), so there is no "cannot drop index because a constraint requires it" hazard:

```sql
DROP INDEX IF EXISTS public.bookings_date_time_id_idx;
DROP INDEX IF EXISTS public.bookings_status_date_idx;
DROP INDEX IF EXISTS public.bookings_assignment_status_date_idx;
DROP INDEX IF EXISTS public.bookings_client_id_idx;
-- (if the client_id index is widened per §5.4:)
DROP INDEX IF EXISTS public.bookings_client_id_date_idx;
```
Adding an index changes no data and drops cleanly; no `ALTER TABLE ... DROP CONSTRAINT` form is ever needed here.

---

## 9. Post-apply verification SQL — exact

```sql
-- 1. Confirm all 4 (or 5, if client_id is widened) new names exist alongside the 3 originals
SELECT indexname FROM pg_indexes
WHERE schemaname='public' AND tablename='bookings' ORDER BY indexname;
-- expect: bookings_assignment_status_date_idx, bookings_client_id_idx (or _date_idx),
--         bookings_client_status_completed_idx, bookings_date_time_id_idx, bookings_pkey,
--         bookings_status_date_idx, idx_bookings_recurring_template   (7 total, or 7 either way)

-- 2. Confirm row count is unchanged (CREATE INDEX never touches data)
SELECT count(*) FROM public.bookings;   -- expect 15, unchanged
```

---

## 10. Generated TypeScript types — confirmed not checked in, confirmed unaffected

```
Glob **/database.types.ts   → no files found
Glob **/*.types.ts (under src/)  → no files found
Grep "Database\[" across repo → no matches
Grep "gen.types|types:generate|supabase gen" in package.json → no matches
```

No Supabase-generated TypeScript types file exists anywhere in this repository, and `package.json`'s `scripts` block has no type-generation command. `bookings-list-data.ts`'s own header comment independently corroborates this: *"the admin client carries no `Database` generic and the row is an unchecked `.returns<BookingRecord[]>()` cast"* (line 65-66) — every Supabase query result in this codebase is manually cast to hand-written interfaces in `./types.ts`, not derived from a generated schema. **An index change has zero TypeScript impact**, both because there is nothing generated to regenerate, and, independently, because Supabase's `generate_typescript_types` output never encodes index metadata at all (only tables, columns, enums, and relationships) — even a project that *did* check in generated types would see no diff from an index-only migration.

---

## 11. Blast radius

### Files to edit
- **New file only:** `supabase/migrations/20260811130000_add_bookings_indexes.sql` (exact name per §7). No existing file is edited by this item — it is additive DDL only.

### Callers / consumers checked
- `buildBookingPredicatePlan`, `countBookings`, `getBookingsListData`, `getBookingViewCounts` — all in `bookings-list-data.ts`, all already traced in full in §3-4 above. None require code changes; indexes are purely a query-planner concern, invisible to PostgREST/application code.
- `getClientDetailData`, `countClientBookings` — `client-detail-data.ts`, traced in §5.4. Same: no code change required.
- `getScopedBookingIds` (`bookings-list-data.ts` lines 515-548) — queries `booking_assignments`, not `bookings` directly by `client_id`/`status`/etc. in the way this item indexes; its one `bookings!inner(status, booking_date)` embedded filter (line 531) reads `bookings.status`/`bookings.booking_date` through a join, which the new `bookings_status_date_idx` and `bookings_date_time_id_idx` can only help, never hurt or break.

### `src/app/booking/manage/` — the known trap, checked explicitly
```
Grep "\.eq\(\"client_id\"|\.from\(\"bookings\"\)" src/app/booking/manage/actions.ts
  → 3 matches, lines 83, 141, 216
```
Read all three (lines 70-229): every one of them is `.from("bookings").update({...}).eq("id", booking.id)...` — filtered **only by primary key** (`id`), never by `status`, `booking_date`, `assignment_status`, `client_id`, or `recurring_template_id`. All three are served by the existing `bookings_pkey` regardless of this item. **`booking/manage` is unaffected by item 4** — confirmed by reading, not assumed.

### Proven NOT affected (what I checked and found clean)
- **New index-name collisions:** `Grep "bookings_date_time_id_idx|bookings_status_date_idx|bookings_assignment_status_date_idx|bookings_client_id_idx"` across the whole repo → the only file containing any of these 4 strings is the plan itself (`redesign/plans/POST-BAND-C-FOLLOWUP-plan.md`). No code, migration, or test references these names today. No collision risk.
- **No index-existence tests anywhere in the suite:** `Grep "pg_indexes|indexdef|CREATE INDEX"` across `src/` and `scripts/` → zero matches in either. Nothing in the vitest suite asserts on `pg_indexes` output, so there is no test to update and no test that could break.
- **Generated types:** confirmed absent and irrelevant, §10.
- **`vitest` coverage:** confirmed via `include` pattern in the handoff (`src/**` and `scripts/**/*.test.{ts,tsx}`) that this is a pure-SQL migration touching neither directory — no test file needs updating as a *result* of this migration; see §12 for what, if anything, should be added.

### Shared with the public/customer site
Nothing under `src/app/(public)/` reads or writes `bookings` directly by any of the five newly-indexed columns (public pages create bookings through `create_booking_request`, a DB function, not through the admin data-layer files this item touches). `src/app/booking/manage/` — the other public-facing surface that touches `bookings` — checked explicitly above and confirmed PK-only. **No public-facing behavior is touched by this item under any outcome** (indexes cannot change query results, only planner choices).

### Ordering relative to the other 7 items
- **No file overlap.** `Grep "bookings-list-data\.ts|client-detail-data\.ts|supabase/migrations|CREATE INDEX|allowed_cities"` across the whole plan document shows item 4's `CREATE INDEX` lines (265-280) are the only migration DDL besides item 8's (which touches `business_settings.allowed_cities`, a different table entirely — no shared file, no shared table).
- Item 6 ("adjustment lists") concerns `availability_overrides`/`staff_availability_overrides`, not `bookings` — confirmed by its section header (line 333) and by item 6 being listed as depending on item 3 (also an availability-overrides item), not item 4.
- **Item 4 has no prerequisite among items 1-3, 5-8, and nothing in items 1-3/5-8 is a prerequisite for it.** It can be sequenced anywhere; the only ordering constraint is the one the plan already states — it is Zone-2, so it needs its own per-action Owner approval separate from any other item's approval, and (per Rule 1 in the plan's §1) must be applied by the orchestrator, never a subagent.

---

## 12. Tests to add

**None are warranted, and this is consistent with existing precedent, not a gap.** Neither of the two prior index-adding migrations in this repo (`20260522121000_add_band_b_indexes.sql`, `20260803053525_c03_enquiries_converted_booking_index.sql`) added or required a test file — I confirmed via `Grep "pg_indexes|indexdef"` across `src/` and `scripts/` that no test in this codebase asserts on index existence or query plans at any point in its history. `buildBookingPredicatePlan`'s own tests (`__tests__/view-predicates-parity.test.ts`, `__tests__/booking-view-counts.test.ts`) run against an in-memory "recording stand-in" query builder (per that file's own header comment, lines 420-426), not a live Postgres connection — they cannot observe index usage and would not change behavior with or without this migration.

The correct verification for this item is the manual SQL in §9, run by the Owner/orchestrator immediately after `apply_migration`, exactly as the plan's §4.3 already specifies ("Post-apply verification: re-query `pg_indexes`... confirm `bookings` row count is unchanged"). I have made that verification exact (§9) rather than descriptive.

---

## 13. Stop conditions for the implementer

1. **If `pg_indexes` at execution time shows anything other than the exact 3 indexes listed in §2a**, stop — the premise has changed since this audit and the migration's `IF NOT EXISTS` guards, while safe, may be masking a schema drift worth understanding first.
2. **If `bookings` row count is not close to 15** (e.g., real production volume has already landed), re-read §4.4's honest-expectation framing before proceeding — the "no measured improvement" claim and the low urgency both depend on the table still being tiny.
3. **If asked to also index `reschedule_status`, `payment_status`, or `customer_cancelled_at`**, don't — the plan's "deliberately NOT indexed" reasoning (§5.5, confirmed) still holds; that would need new profiling evidence, not this item.
4. **If `CREATE INDEX CONCURRENTLY` is attempted and does NOT fail** (contradicting §6's plausible-but-unverified claim), stop and report rather than assuming the transaction-wrapping model was wrong — it could equally mean the statement ran outside any transaction, which has different implications for how any *future* multi-statement Zone-2 migration in this repo should be structured.
5. **Before applying, re-approve the exact SQL text in chat per Zone-2 protocol** — this item is explicitly flagged Zone-2 in the plan (§0.1, §1 rule 1) and nothing in this audit changes that; I did not and must not call `apply_migration`.

## 14. Rollback

See §8 for exact SQL. Additionally: if the migration file itself needs to be reverted (not just the indexes undone live), it is a pure addition with no dependent code — `git rm supabase/migrations/20260811130000_add_bookings_indexes.sql` (or equivalent) is safe with no co-dependency, unlike `c14_override_breaks.sql` which is deliberately co-shipped with application code changes. Item 4's migration has zero application-code coupling in either direction (§11).

---

## Appendix — exact commands run, for reproducibility

```
# Live DB (read-only, mcp__supabase__execute_sql, project twzutkfgqclqurvkmvqz)
SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='bookings' ORDER BY indexname;
SELECT count(*) AS row_count FROM public.bookings;
SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' ORDER BY ordinal_position;
SELECT t.typname, e.enumlabel FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname IN ('booking_status_type') ORDER BY e.enumsortorder;
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5;
mcp__supabase__search_docs: { searchDocs(query: "apply_migration MCP transaction CREATE INDEX CONCURRENTLY", limit: 5) { nodes { title href content } } }  → zero results

# Filesystem / source (Grep, Glob, Read — all read-only)
Grep buildBookingPredicatePlan (files_with_matches) → 4 files
Grep getBookingViewCounts (files_with_matches) → 3 files
Glob supabase/migrations/* → 58 files
Read src/app/admin/bookings/bookings-list-data.ts (full file, 968 lines)
Read src/app/admin/clients/[clientId]/client-detail-data.ts (full file, 896 lines)
Grep "\"status\"" / "booking_date" / "\"assignment_status\"" / "recurring_template_id" / "client_id"  in bookings-list-data.ts, -n
Grep "\bstatus\b" in bookings-list-data.ts, -n -o
Grep "reschedule_status|payment_status|customer_cancelled_at" in bookings-list-data.ts, -n
Read src/app/booking/manage/actions.ts (lines 70-229)
Grep "bookings_date_time_id_idx|bookings_status_date_idx|bookings_assignment_status_date_idx|bookings_client_id_idx" across repo → only the plan file
Grep "pg_indexes|indexdef|CREATE INDEX" in src/ and scripts/ → no matches
Glob **/database.types.ts, **/*.types.ts (src/) → no files
Grep "Database\[" across repo → no matches
Grep "gen.types|types:generate|supabase gen" in package.json → no matches
Read package.json scripts block
Read supabase/migrations/20260522121000_add_band_b_indexes.sql (full)
Read supabase/migrations/20260803053525_c03_enquiries_converted_booking_index.sql (full)
Read supabase/migrations/20260809160000_c14_override_breaks.sql (full)
Grep "bookings-list-data\.ts|client-detail-data\.ts|supabase/migrations|CREATE INDEX|allowed_cities" in the plan file, -n
Grep "## ITEM 6" in the plan file, -n
```

No file under `src/`, `scripts/`, `e2e/`, or `supabase/` was modified, created, or deleted. `src/lib/maintenance.ts` was not opened. No `apply_migration` call was made. No `INSERT`/`UPDATE`/`DELETE`/DDL was executed — every SQL statement above is a `SELECT`.
