# Item 4 — Adversarial review of the four proposed `bookings` indexes

Proposed:
```sql
CREATE INDEX IF NOT EXISTS bookings_date_time_id_idx ON public.bookings (booking_date, start_time, id);
CREATE INDEX IF NOT EXISTS bookings_status_date_idx ON public.bookings (status, booking_date);
CREATE INDEX IF NOT EXISTS bookings_assignment_status_date_idx ON public.bookings (assignment_status, booking_date);
CREATE INDEX IF NOT EXISTS bookings_client_id_date_idx ON public.bookings (client_id, booking_date, start_time);
```

Method: every number below was checked live against project `twzutkfgqclqurvkmvqz` (SELECT-only) or read directly out of `src/app/admin/bookings/bookings-list-data.ts` and `src/app/admin/clients/[clientId]/client-detail-data.ts`. No index was created — not even a temp/session-scoped one — per the read-only mandate; the backward-scan reasoning (Q3) is stated as documented Postgres btree behaviour, not as a live `EXPLAIN` result, because there is nothing to `EXPLAIN` against yet.

---

## Q1 — Does each index serve a real query shape?

**`bookings_date_time_id_idx (booking_date, start_time, id)`**
Exact match for the clinic-wide list's terminal sort in `getBookingsListData` (`bookings-list-data.ts:702-707`):
```ts
.order("booking_date", { ascending: false })
.order("start_time", { ascending: false })
.order("id", { ascending: false })   // tiebreak, plan §4
```
This is the `canViewAll` branch used by every "all bookings" render and by `getBookingsListPage`'s `.range()` pagination. `booking_date` alone (leading column) also serves `view=today` (`eq("booking_date", ctx.today)`), `view=upcoming`/`claimable` (`gte("booking_date", ctx.today)`), and the post-filters `from`/`to` (`gte`/`lte` on `booking_date`). Real shape — the single most load-bearing index of the four.

**`bookings_status_date_idx (status, booking_date)`**
Serves `view=completed` (`eq("status","completed")`), `view=cancelled` (`in status ("cancelled","no_show")`), and the arbitrary post-filter `if (ctx.status) eq("status", ctx.status)` (`bookings-list-data.ts:363`) — a plain single-status equality from the UI's status dropdown, which is genuinely selective. It also nominally serves `notInert()` (`NOT IN ('cancelled','no_show')`, applied to every view except `cancelled`/`all`/`series`) and `view=upcoming`'s `neq(status,'completed')`, but see Q4 — those two are the weak case for this column order, not the strong one. Real shape exists; the ordering choice is the actual issue (Q4).

**`bookings_assignment_status_date_idx (assignment_status, booking_date)`**
Serves `view=unassigned` (`eq("assignment_status","unassigned")`) and `view=partially_assigned` (`eq("assignment_status","partially_assigned")`), plus the post-filter `if (ctx.assignmentStatus) eq("assignment_status", ctx.assignmentStatus)`. `assignment_status` is a 3-value enum (`unassigned`/`partially_assigned`/`fully_assigned` — confirmed live), so an equality here is a true 1-of-3 selectivity win, better than the status column's negation case. Real shape, cleanly served.

**`bookings_client_id_date_idx (client_id, booking_date, start_time)`**
Exact match for `client-detail-data.ts`'s `bookingHistory` and `lifetimeBookings` reads (both the full-access and the therapist-assigned branch, lines 522-529, 537-544, 570-578, 584-592):
```ts
.eq("client_id", clientId)              // (.in("id", assignedBookingIds) on the therapist path — residual filter)
.order("booking_date", { ascending: false })
.order("start_time", { ascending: false })
.limit(historyCap | CLIENT_LIFETIME_SCAN_CAP)
```
`client_id` equality is highly selective (one client's bookings out of the whole table), so the therapist-path's extra `.in("id", assignedBookingIds)` running as a residual filter after the index narrows to that client is not a concern. Also usable (leading column only) for `bookings-list-data.ts`'s search arm `client_id.in.(${searchClientIds.join(",")})` inside the `.or(...)` — though as one arm of a multi-column OR, the planner may or may not pick it depending on the other arms; not the primary justification for this index, but a genuine secondary user. Real shape.

**Verdict: all four serve at least one real, currently-exercised query shape. None is dead weight.**

---

## Q2 — Redundancy check

Live indexes on `public.bookings` today (verified via `pg_indexes`):
```
bookings_client_status_completed_idx  ON (client_id, status) WHERE status = 'completed'
bookings_pkey                         UNIQUE ON (id)
idx_bookings_recurring_template       ON (recurring_template_id) WHERE recurring_template_id IS NOT NULL
```

**Is `bookings_client_id_date_idx` redundant with `bookings_client_status_completed_idx`, or vice versa?** No.
- Different second column: `status` vs `booking_date` — `bookings_client_id_date_idx`'s column list is not a superset/prefix of `bookings_client_status_completed_idx`'s (`(client_id, status)` is not a prefix of `(client_id, booking_date, start_time)`, and never will be — the second columns diverge immediately).
- The existing index is **partial** (`WHERE status = 'completed'`). Postgres can only use a partial index when the query's WHERE clause provably implies the partial predicate. None of the `client-detail-data.ts` reads filter on `status = 'completed'` — they read a client's *entire* history (`bookingHistory`, `lifetimeBookings`) or an *assigned-id-bounded* subset, with no status predicate at all. So the partial index is structurally unusable for the shape the new index targets, and the new index is unusable for whatever narrower purpose the partial one exists for (a `client_id` + `status='completed'` equality lookup — not found in either file reviewed here, so its origin is elsewhere in the codebase and out of this review's scope). They serve disjoint predicates. Not redundant either direction.

**Is `bookings_date_time_id_idx` a prefix of, or prefixed by, anything?** No.
- vs `bookings_client_id_date_idx`: leading columns differ (`booking_date` vs `client_id`) — no prefix relationship possible.
- vs `bookings_status_date_idx` / `bookings_assignment_status_date_idx`: leading columns differ (`status`/`assignment_status` vs `booking_date`).
- vs `bookings_pkey (id)`: `id` alone is not a prefix of `(booking_date, start_time, id)` — `id` is the *third* column here, not the first.
- vs `idx_bookings_recurring_template (recurring_template_id)`: unrelated column entirely.

**Verdict: none of the four is redundant with any existing or sibling-proposed index.** Each has a distinct leading column, and the one case that looks superficially close (`client_id`-leading vs the existing partial `client_id`-leading index) is saved from redundancy by the partial predicate.

---

## Q3 — Can `ORDER BY booking_date DESC, start_time DESC, id DESC` use an Index Scan Backward on the ASC-defined `bookings_date_time_id_idx`?

**Confirmed — yes, under the condition that the reversal is uniform across every column, and that condition holds here.**

`CREATE INDEX ... (booking_date, start_time, id)` with no explicit `ASC`/`DESC`/`NULLS` clauses defaults every column to `ASC NULLS LAST`. Reading a btree index **backward** (`Index Scan Backward`) reverses the *entire* traversal — every column's effective order flips from `ASC NULLS LAST` to `DESC NULLS FIRST` simultaneously. `DESC NULLS FIRST` is also Postgres's own default when a query writes `ORDER BY col DESC` without an explicit `NULLS` clause. Since the query orders `booking_date DESC, start_time DESC, id DESC` (three consecutive `.order(..., {ascending:false})` calls, which PostgREST composes into one `ORDER BY` clause in call order — confirmed by reading the call chain at `bookings-list-data.ts:702-707`), every column's requested direction is the uniform reverse of the index's stored direction, in the same column order. That is exactly the case Postgres's planner recognizes as satisfiable by `Index Scan Backward` — no separate `Sort` node needed.

**The general condition, stated precisely:** a backward index scan satisfies an `ORDER BY` only when (a) the `ORDER BY` column list matches the index's column list in the same order, and (b) *every* column's requested direction is the reverse of that column's stored index direction — a mix (some columns matching forward, others backward) cannot be served by a single scan of a single-direction index; that would need an index explicitly declared with mixed per-column `ASC`/`DESC` to match forward instead.

**NULLS handling here is moot, not just satisfied:** `booking_date`, `start_time`, and `id` are all verified `NOT NULL` live (see Q5 table below), so no row can actually exercise the `NULLS FIRST`/`LAST` distinction on this index regardless of which way it's scanned — the ASC/DESC directional match is the only thing doing real work.

Caveat: this is what the planner *can* do, not a guarantee it *will* — at the table's current live size (15 rows), the planner will almost certainly prefer a full sequential scan + in-memory sort over any index, full stop (see Q7 closing note). The backward-scan property only starts mattering once the table is large enough that avoiding a sort is cheaper than the index's extra I/O — this review answers the design question asked, not "will this fire today."

---

## Q4 — Column order: `(status, booking_date)` vs `(booking_date, status)`, given the negation

**The naive "equality-first" rule does not straightforwardly favor `(status, booking_date)` here, because the dominant status predicate is a negation over a low-cardinality domain, not a selective equality.**

`booking_status_type` has 5 values (verified live: `pending, confirmed, completed, cancelled, no_show`). The `notInert()` step —
```ts
if (!viewIsArchive && !userWantsInertStatus) notInert();  // NOT IN ('cancelled','no_show')
```
— fires on **every view except `cancelled`/`all`/`series`**, i.e. it is the majority-case predicate across the whole surface, and it excludes only 2 of the 5 enum values. A `NOT IN` over 2-of-5 values retains 3-of-5 (60%) of the domain by cardinality — and Postgres's live status distribution today (`pending:7, confirmed:4, cancelled:2, completed:2`) confirms non-inert rows are the large majority (13/15). A leading-column equality/IN-style predicate is only a good btree citizen when it's *selective* (prunes most of the index); a `NOT IN` retaining the majority of rows is close to "scan almost everything," which defeats the entire reason to put a column first. The same weakness applies to `view=upcoming`'s `neq(status,'completed')` (excludes 1-of-5 — retains 80%).

Meanwhile `booking_date` is used almost everywhere with genuinely selective range/equality operators: `eq` (single day, `view=today`), `gte` (today-forward, `view=upcoming`/`claimable`), and the `from`/`to` post-filters — plus it is the column the final `ORDER BY` sorts on first, so leading with it also means the *sort* can potentially be satisfied for free once the range is applied (subject to Q3's backward-scan conditions, though those apply specifically to the 3-column `bookings_date_time_id_idx`, not to this 2-column index, since this index lacks the `start_time`/`id` tiebreak columns).

Where `(status, booking_date)` genuinely wins: the *true* equality/IN cases — `view=completed` (`eq`), `view=cancelled` (`IN` over exactly the 2 excluded values), and the arbitrary single-status dropdown post-filter — are all legitimately selective on `status` first (1-of-5 or 2-of-5, and typically much rarer in practice than "not cancelled/no_show"). For those specific views, `(status, booking_date)` is the better order.

**Conclusion: this is a genuine trade-off, not a clear-cut violation.** The plan's chosen order, `(status, booking_date)`, optimizes for the minority of call sites that filter status by true equality/IN (`completed`, `cancelled`, the dropdown) at the expense of the majority call sites that filter status by negation (`notInert()`, `upcoming`'s `neq`) — for which `(booking_date, status)` would let the date range do the pruning and leave the weak status predicate as a cheap residual filter. Whether that trade-off is worth taking depends on which paths matter more in practice (the "Attention"/"Upcoming"/default-view traffic is likely far higher-volume than "Completed"/"Cancelled" browsing) — the plan as written does not state that reasoning, so it reads as an unexamined default ("equality columns go first") rather than a considered choice for *this* predicate mix. See recommendation below.

---

## Q5 — Column existence, live `information_schema.columns`

Verified against `public.bookings` on project `twzutkfgqclqurvkmvqz`:

| column | exists | type | nullable |
|---|---|---|---|
| `booking_date` | yes | `date` | NO |
| `start_time` | yes | `time without time zone` | NO |
| `id` | yes | `uuid` (PK, `gen_random_uuid()`) | NO |
| `status` | yes | `USER-DEFINED` (`booking_status_type` enum) | NO |
| `assignment_status` | yes | `USER-DEFINED` (`booking_assignment_status_type` enum) | NO |
| `client_id` | yes | `uuid` | NO |

Every column named across all four `CREATE INDEX` statements exists, with the expected types, and every one of them is `NOT NULL` — so none of the migrations would fail at apply time on a missing/misspelled column, and the Q3 NULLS-ordering question is moot for real data (no NULLs possible in any of these columns).

---

## Q6 — Would any of these four change query results?

**No.** All four are plain, non-unique, non-partial, non-expression B-tree indexes (`CREATE INDEX IF NOT EXISTS ... ON public.bookings (col, col, ...)` — no `WHERE`, no `UNIQUE`, no functional/expression columns). A standard multi-column btree index is purely an alternate access path; the planner is only free to choose it when it is provably equivalent to a sequential scan + sort for the given predicate, so row *sets* and row *values* returned are identical regardless of which plan is chosen — this is a basic correctness invariant of the Postgres planner, not something specific to these four.

**Flag on the two *existing* indexes, by contrast (not a criticism of the four proposed ones, but relevant context the plan should carry):** `bookings_client_status_completed_idx` and `idx_bookings_recurring_template` are both **partial** indexes (`WHERE status = 'completed'` / `WHERE recurring_template_id IS NOT NULL`). Partial indexes never change *results* either (the planner only uses them when the predicate is provably implied), but they are the kind of index shape where a careless future edit — narrowing the partial `WHERE` clause without updating the queries that rely on it — could silently make the index stop being chosen (a performance regression, not a correctness one). None of the four *proposed* indexes carry that risk since none are partial.

---

## Q7 — A missing fifth index? Any of the four better dropped?

**No obvious fifth `bookings`-table index is missing.** Walking every predicate in `buildBookingPredicatePlan` and both `client-detail-data.ts` branches again against the four proposed + three existing indexes: `booking_date` (leading, 3-col), `status`, `assignment_status`, and `client_id` (leading, 3-col) are covered; `recurring_template_id` (the `series` view) is already covered by the existing partial index, and a `series` result set is a handful of rows per template, so the extra in-memory `Sort` step for the final `ORDER BY` (the partial index doesn't carry `booking_date`) is cheap and not worth a dedicated compound index. The `location`/`search` `ILIKE '%term%'` arms cannot use a plain btree index regardless of column order (unanchored wildcard) — not an index gap this plan could close anyway. The `attention` view's 4-column `.or(...)` (`status.eq.pending`, `assignment_status.neq.fully_assigned`, `reschedule_status.eq.requested`, `customer_cancelled_at.not.is.null`) spans columns from two of the four proposed indexes plus two uncovered columns — an OR across that many independent columns is not something any single composite index (existing or proposed) serves well, and building one purely for this one chip would be a much bigger, narrower ask than what's on the table.

**One real gap exists, but it is on a different table, already covered:** `getScopedBookingIds` (`bookings-list-data.ts:515-548`) queries `booking_assignments`, not `bookings` — `.eq("assigned_staff_id", profile.id)` and the claimable variant (`.eq("status","unassigned").is("assigned_staff_id", null).eq("required_therapist_gender", ...)` joined `!inner` to `bookings`). Checked live: `booking_assignments` already carries `booking_assignments_assigned_staff_booking_idx (assigned_staff_id, booking_id)` and `booking_assignments_assigned_staff_status_idx (assigned_staff_id, status)`, both of which match these shapes. Nothing missing there either. This is out of scope for "the four bookings indexes" anyway — noted only so the reviewer doesn't have to re-derive it.

**Should any of the four be dropped?** No — each serves a real, currently-live shape (Q1), and Q6 confirms none carries correctness risk. The one soft spot is `bookings_status_date_idx`'s column order (Q4) — not a case for dropping it, since it still cleanly serves `completed`/`cancelled`/the status dropdown, but a case for the plan to either (a) accept the trade-off explicitly (state that the equality-view traffic matters enough to eat the negation-view cost), or (b) flip it to `(booking_date, status)` if the negation-heavy default/attention/upcoming views are judged higher-traffic. This review cannot settle which without production query-volume data neither file exposes — flagging it as a judgment call for the Owner rather than a defect.

---

## Recommendation

Approve all four as structurally sound: every column exists with the right type and is `NOT NULL` (Q5), none is redundant with an existing or sibling index (Q2), none can alter query results (Q6), the backward-scan property the plan implicitly relies on for `bookings_date_time_id_idx` genuinely holds (Q3), and there's no missing fifth `bookings`-table index the query shapes obviously call for (Q7). The one open question worth surfacing to the Owner before sign-off is `bookings_status_date_idx`'s column order (Q4): `(status, booking_date)` favors the minority-traffic equality views (`completed`, `cancelled`, status dropdown) over the majority-traffic negation views (`notInert()`'s default exclusion, `upcoming`), and the plan doesn't show that trade-off was made deliberately. Worth a one-line decision from the Owner — keep as `(status, booking_date)` or flip to `(booking_date, status)` — but not a blocker either way, since both orders are defensible and the table is currently 15 rows regardless (verified live), so nothing here is urgent.
