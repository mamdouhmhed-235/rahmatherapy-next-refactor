# Item 4 — R2 adversarial refutation pass on the four proposed `bookings` indexes

Role: adversarial verifier. Default posture is REFUTE unless independently re-derived from a live,
re-run SELECT-only query or a fresh grep against the plan file. Nothing in R1's report (`C-index-shapes.md`)
or `A-column-usage.md` was trusted at face value — every checkable number below was re-queried against
project `twzutkfgqclqurvkmvqz` in this session, and the proposed SQL was re-read directly from
`redesign/plans/POST-BAND-C-FOLLOWUP-plan.md` (lines 954-990), not copied from the prior report.

No index was created. No writes outside this file. No DDL executed.

---

## 1. Column existence / type / nullability — independently re-verified

Query run:
```sql
SELECT column_name, is_nullable, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'bookings'
  AND column_name IN ('booking_date','start_time','id','status','assignment_status','client_id')
ORDER BY column_name;
```
Live result (this session):

| column | is_nullable | data_type | udt_name |
|---|---|---|---|
| assignment_status | NO | USER-DEFINED | booking_assignment_status_type |
| booking_date | NO | date | date |
| client_id | NO | uuid | uuid |
| id | NO | uuid | uuid |
| start_time | NO | time without time zone | time |
| status | NO | USER-DEFINED | booking_status_type |

Matches the R1 claim exactly, column-for-column, type-for-type, nullability-for-nullability. No typo,
no drift. Also independently confirmed `public.bookings` is a real base table (`pg_class.relkind = 'r'`,
not a view — `CREATE INDEX` would fail differently on a view), and `id DEFAULT gen_random_uuid()` is
live-confirmed via `information_schema.columns.column_default`.

**Cross-checked the SQL text itself against the plan file**, not just the report's transcription of it —
`redesign/plans/POST-BAND-C-FOLLOWUP-plan.md:954-990` contains the four `CREATE INDEX IF NOT EXISTS`
statements verbatim, and every column token in them (`booking_date`, `start_time`, `id`, `status`,
`assignment_status`, `client_id`) matches a column confirmed to exist above. **No column-name typo
exists in any of the four statements.** This was the single highest-value thing to falsify (a typo'd
column is a migration that fails outright at apply time) and it does not hold up — all four statements
would succeed against the live schema.

**Verdict: CONFIRM.** Could not refute.

---

## 2. Enum type name and values — independently re-verified

Query run:
```sql
SELECT t.typname, e.enumlabel, e.enumsortorder
FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
WHERE t.typname IN ('booking_status_type','booking_assignment_status_type')
ORDER BY t.typname, e.enumsortorder;
```
Live result:
- `booking_status_type`: pending(1), confirmed(2), completed(3), cancelled(4), no_show(5) — **5 values**, matches R1's claim exactly, same 5 labels, same order.
- `booking_assignment_status_type`: unassigned(1), partially_assigned(2), fully_assigned(3) — **3 values**, matches R1's claim exactly.

**Verdict: CONFIRM.** Could not refute.

---

## 3. Redundancy: `bookings_client_id_date_idx` vs `bookings_client_status_completed_idx`

Live index definition re-pulled via `pg_indexes` (not trusted from the report):
```
bookings_client_status_completed_idx: CREATE INDEX ... ON public.bookings USING btree (client_id, status) WHERE (status = 'completed'::booking_status_type)
```
Confirmed live, verbatim, including the partial predicate and its enum cast.

Precise statement of what each index can/cannot serve:
- **`bookings_client_status_completed_idx` (client_id, status) WHERE status='completed'** can serve, *and only serve*, queries whose WHERE clause provably implies `status = 'completed'` — e.g. `WHERE client_id = $1 AND status = 'completed'`. It is structurally unusable for any query that does not filter on `status = 'completed'` (Postgres cannot use a partial index unless the query predicate entails the partial predicate). It cannot serve `client-detail-data.ts`'s `bookingHistory`/`lifetimeBookings` reads (no status filter at all) or the assigned-id-bounded therapist branch (filters `id IN (...)`, not status).
- **`bookings_client_id_date_idx` (client_id, booking_date, start_time)** — full (non-partial) index — can serve *any* `client_id` equality regardless of status, ordered by `booking_date`/`start_time`. It is the one that matches `bookingHistory`/`lifetimeBookings`'s `.eq(client_id).order(booking_date desc).order(start_time desc).limit(n)` shape exactly. It could technically also answer a `client_id + status='completed'` query (residual filter on status, unindexed), but would do so less efficiently than the partial index for that one narrow case since it can't prune on status before hitting rows.
- Column lists diverge at position 2 (`status` vs `booking_date`) — neither is a prefix of the other, so this is not a case of one subsuming the other in either direction. Confirmed independently, not just re-stated from R1.

**Verdict: CONFIRM — not redundant in either direction, and the report's characterization of which queries each index can/cannot serve is accurate.** Could not refute.

---

## 4. Identifier byte length (63-byte NAMEDATALEN limit)

Counted directly (ASCII only, so char count == byte count — verified no multi-byte characters present):

| index name | bytes |
|---|---|
| `bookings_date_time_id_idx` | 25 |
| `bookings_status_date_idx` | 24 |
| `bookings_assignment_status_date_idx` | 35 |
| `bookings_client_id_date_idx` | 27 |

All four are well under the 63-byte limit (longest is 35/63 = 56% of the budget). For comparison, the
longest *existing* live index name on this table, `bookings_client_status_completed_idx`, is 36 bytes
(confirmed via `octet_length(relname)` from `pg_class`), also comfortably under the limit. None of the
four proposed names would be silently truncated or rejected.

**Verdict: CONFIRM — no name exceeds the limit.** Could not refute.

---

## 5. `CREATE INDEX IF NOT EXISTS` silent-no-op risk / name collision

`CREATE INDEX IF NOT EXISTS <name> ...` in Postgres checks only whether an object of that **name**
already exists in the target schema — if it does, the statement is skipped (a NOTICE is emitted, not
an error) regardless of whether the existing object's column list, order, or WHERE clause matches what
was requested. This is a real, general footgun: if any of these four names already existed live with a
*different* definition, the migration would silently do nothing and the plan's intended index would
never be built, with no error to surface the mismatch.

Checked live, two independent ways:
```sql
SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='bookings';
-- → exactly 3 rows: bookings_client_status_completed_idx, bookings_pkey, idx_bookings_recurring_template

SELECT indexname FROM pg_indexes WHERE schemaname='public'
  AND indexname ~ 'bookings.*(date_time_id|status_date|assignment_status_date|client_id_date)';
-- → 0 rows
```
None of the four proposed names exist anywhere on `public.bookings` today, under an exact-match check
or a broader regex sweep for near-miss variants. The silent-no-op hazard is real as a general Postgres
property, but it has no live target to bite on right now — re-running the migration later (e.g. after
a partial prior apply) would still be safe under `IF NOT EXISTS` *only* as long as nobody hand-creates
a same-named, differently-shaped index in between. Worth stating as a standing caveat, not a defect in
this migration as written.

**Verdict: CONFIRM (the risk is real in general; CONFIRM that it does not apply today — no collision exists).**

---

## 6. Lock behavior of non-`CONCURRENTLY` `CREATE INDEX`

The four statements in `POST-BAND-C-FOLLOWUP-plan.md` are plain `CREATE INDEX IF NOT EXISTS` — not
`CREATE INDEX CONCURRENTLY` (the plan's own §4.9 risk note, line 1065, explicitly flags that
`CONCURRENTLY` is expected to fail here because Supabase migrations run inside a transaction block, and
`CONCURRENTLY` cannot run inside one — confirming non-concurrent is the intended, only-viable mode).

A non-`CONCURRENTLY` `CREATE INDEX` takes a `SHARE` lock on the target table for the duration of the
build. `SHARE` lock semantics: it blocks `INSERT`/`UPDATE`/`DELETE` and any other lock mode that
conflicts with `SHARE` (including other DDL), but it does **not** block plain reads (`SELECT`) — `SHARE`
is compatible with `ACCESS SHARE`, the lock a `SELECT` takes. So: writes to `bookings` are blocked for
the build's duration; reads are not.

At the table's live size (15 rows, confirmed live in this session: `pending:7, confirmed:4, completed:2,
cancelled:2`, no `no_show` rows), an index build over 15 rows completes in low single-digit milliseconds.
Four sequential `CREATE INDEX` statements in one migration transaction therefore hold write locks for a
cumulative duration on the order of milliseconds, not a duration any real concurrent writer would
observe as an outage. This matters in principle (a write-blocking lock is a write-blocking lock) but is
immaterial in practice at current volume — consistent with the plan's own "low urgency at 15 rows"
framing.

**Verdict: CONFIRM.** Stated as fact, not refuted by anything found.

---

## Attempt to break at least one of the four indexes — result

Specifically tried and failed to establish any of:
- **Typo'd column** → none; every column in all four `CREATE INDEX` statements exists with the exact type/nullability claimed, verified against a fresh live query, not the prior report's numbers.
- **Redundant with an existing index** → none; the one superficially-close case (`client_id`-leading proposed index vs the existing partial `client_id`-leading index) is genuinely non-redundant because the second column diverges (`booking_date` vs `status`) and the existing index is partial with a predicate none of the target queries satisfy.
- **Redundant with a sibling proposed index** → none; all four proposed indexes have mutually distinct leading columns (`booking_date`, `status`, `assignment_status`, `client_id`), confirmed by re-reading the plan file's SQL directly.
- **Would fail at apply time** → no; table is a real base table, all columns exist with matching types, no name collision with any live index, no identifier exceeds the byte limit, syntax (`CREATE INDEX IF NOT EXISTS ... ON public.bookings (...)`) is valid non-concurrent DDL that Supabase's transactional migration runner can execute.
- **Name-length overflow** → no; longest proposed name is 35/63 bytes.
- **Silent no-op via `IF NOT EXISTS` colliding with a differently-shaped existing index** → no; zero name collisions exist live today (checked by exact match and by regex sweep).

None of these lines of attack produced a defect. Every specific, falsifiable claim asked to be checked
(column shape, enum shape, redundancy direction, byte length, name collision, lock semantics) was
re-derived independently from a live, freshly-run query in this session and held up exactly as R1
reported it. I am reporting this as CONFIRM rather than manufacturing a REFUTE, per the instruction to
default to refute only *when uncertain* — here there is no uncertainty; the live database answers each
question directly and unambiguously.

The one item in R1's report that remains a **judgment call, not a checkable fact** — `bookings_status_date_idx`'s
column order `(status, booking_date)` vs the alternative `(booking_date, status)` — is not something a
SELECT-only check can adjudicate (it depends on relative traffic volume across views, which isn't in
the database). R1 already flagged it correctly as open-for-Owner, not as a settled claim; nothing here
changes that framing.

## Verdict summary

| # | Check | Verdict |
|---|---|---|
| 1 | Column names/types/nullability for all 6 columns across all 4 indexes | CONFIRM |
| 2 | Enum type names + values (`booking_status_type` 5 values, `booking_assignment_status_type` 3 values) | CONFIRM |
| 3 | `bookings_client_id_date_idx` vs `bookings_client_status_completed_idx` redundancy (neither direction) | CONFIRM |
| 4 | All 4 index names within the 63-byte identifier limit | CONFIRM |
| 5 | No live name collision for any of the 4 proposed index names (`IF NOT EXISTS` no-op risk inapplicable today) | CONFIRM |
| 6 | Non-`CONCURRENTLY` `CREATE INDEX` takes a `SHARE` lock — blocks writes, not reads; immaterial at 15 rows | CONFIRM |

**No index of the four is wrong, redundant, or would fail at apply time.** R1's report survives this
adversarial pass on every independently-checkable point.
