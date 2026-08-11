# Item 4 — blast-radius re-verification

**Scope:** `bookings` index-only migration (4× `CREATE INDEX IF NOT EXISTS` on `public.bookings`), no application code edited. No migration file exists yet (`git status --porcelain -- supabase/` returns empty; `ls supabase/migrations` has no file for this item) — this is a pre-apply re-verification of the plan's blast-radius claims, not a post-apply audit.

Method: every claim below was independently re-run with the exact command shown, not copied from `redesign/evidence/plan-deepening/item-04-bookings-indexes.md` (a prior pass over the same item, read for context but not trusted). Two claims did not survive re-verification — see 4 and 5.

---

## Claim 1 — index-name collision: CONFIRMED

```
Grep pattern: bookings_date_time_id_idx|bookings_status_date_idx|bookings_assignment_status_date_idx|bookings_client_id_date_idx
scope: whole repo
```
Output: matches only inside `redesign/plans/POST-BAND-C-FOLLOWUP-plan.md` and `redesign/evidence/plan-deepening/*.md` (the plan text and prior audit docs). Zero matches in any file under `src/`, `scripts/`, `e2e/`, or `supabase/migrations/`. No collision risk.

## Claim 2 — no test asserts on pg_indexes/indexdef/CREATE INDEX: CONFIRMED

```
Grep pattern: pg_indexes|indexdef|CREATE INDEX
path: src/            → No matches found
path: scripts/        → No matches found
```
Zero in both directories.

## Claim 3 — no generated database types file: CONFIRMED

```
Glob **/database.types.ts        → No files found
Glob src/**/*.types.ts           → No files found
Grep "Database\["  (whole repo)  → No files found
```
`package.json` `scripts` block (read in full) has no `gen-types`/`types:generate`/`supabase gen`-style entry — only `dev`, `build`, `start`, `lint`, `test`, `test:unit`, `test:e2e`, `test:e2e:setup/cleanup`, `reset:live-auth-owner`, `test:security:secrets`, `bootstrap:owner-admin`, `verify:london-time`, `cf:build/preview/deploy/upload`, `cf:typegen` (that last one is Cloudflare Workers env typegen, unrelated to Supabase). No generated-types mechanism exists.

## Claim 4 — 6 client_id-scoped bookings queries (4 row / 2 count-only): **FALSE — actual count is 7 (4 row / 3 count-only)**

```
Grep pattern: \.from\("bookings"\)
path: src/app/admin/clients/[clientId]/client-detail-data.ts   (bracket path — used the Grep tool, not shell glob, to sidestep the counting hazard)
```
Result — **7 matches**, not 6: lines 523, 533, 538, 571, 580, 585, 778.

Cross-referenced each against `.eq("client_id", clientId)` and `.select("id", { count: "exact", head: true })` by reading the full file (896 lines):

| Line (`.from("bookings")`) | Function | Shape | client_id filter | ORDER BY |
|---|---|---|---|---|
| 523 | `getClientDetailData`, full-access, `bookingHistory` rail | row-returning | ✓ (525) | `booking_date desc, start_time desc` (526–527) |
| 533 | `getClientDetailData`, full-access, `historyCountResult` | **count-only** | ✓ (535) | none |
| 538 | `getClientDetailData`, full-access, `lifetimeResult` | row-returning | ✓ (540) | `booking_date desc, start_time desc` (541–542) |
| 571 | `getClientDetailData`, therapist branch, `assignedResult` | row-returning | ✓ (573, plus `.in("id",…)`) | `booking_date desc, start_time desc` (575–576) |
| 580 | `getClientDetailData`, therapist branch, `assignedCountResult` | **count-only** | ✓ (582, plus `.in("id",…)`) | none |
| 585 | `getClientDetailData`, therapist branch, `assignedLifetimeResult` | row-returning | ✓ (587, plus `.in("id",…)`) | `booking_date desc, start_time desc` (589–590) |
| 778 | `countClientBookings` (separate exported function) | **count-only** | ✓ (780) | none |

**Row-returning count = 4 — this part of the claim is CONFIRMED**, and all 4 do `.order("booking_date", { ascending: false }).order("start_time", { ascending: false })` verbatim, which is the load-bearing fact behind widening the index to `(client_id, booking_date, start_time)`.

**Count-only count = 3, not 2.** `getClientDetailData` alone already contains 2 count-only bookings queries (lines 533, 580) plus its own 4 row-returning ones = 6 bookings queries total inside that one function. `countClientBookings` (lines 773–788) is a **separate exported function** with its own 7th `client_id`-scoped bookings query (line 778, count-only, no ORDER BY) — the task's own framing ("`getClientDetailData` **and** `countClientBookings`") includes this function, so it must be counted. 4 + 3 = 7, not 4 + 2 = 6.

**Consequence for the sole-justification claim:** the widening rationale itself still holds — the core fact "every row-returning client_id-scoped read orders by `(booking_date desc, start_time desc)`" is exactly right (4/4, confirmed). The miscount is in the *denominator/other-bucket* (6 total / 2 count-only, should be 7 total / 3 count-only), not in the premise the index shape depends on. This is the same class of off-by-one the prior evidence pass (`item-04-bookings-indexes.md` §5.4) also produced — that document's own prose says "4 of the 6 ... in that file" while its own bullet list enumerates `countClientBookings` **and** two separate inline head-counts (3 count-only sites), which is internally inconsistent with "6" and was not caught at the time. Re-verified here independently and the count is 7.

## Claim 5 — `booking/manage/actions.ts`: 3 bookings queries, ALL PK-only: **FALSE — one of the three also filters by `status`**

Read all three call sites in full (`src/app/booking/manage/actions.ts`, 262 lines):

| Function | `.from("bookings")` line | Filters applied |
|---|---|---|
| `addCustomerManageNote` | 83 | `.eq("id", booking.id)` only — **PK-only, confirmed** |
| `requestCustomerCancellation` | 141 | `.eq("id", booking.id)` **AND** `.in("status", ["pending", "confirmed"])` (line 150) — **NOT PK-only** |
| `requestCustomerReschedule` | 216 | `.eq("id", booking.id)` only — **PK-only, confirmed** |

The claimed line numbers (~83, ~141, ~216) are exactly right as location markers — all three are `.from("bookings")` at those exact lines. But `requestCustomerCancellation` (line 141) additionally does `.in("status", ["pending", "confirmed"])` at line 150, directly contradicting "ALL filtered only by primary key `.eq('id', ...)`, never by status."

Practical effect on blast radius is small — the query still targets exactly one row via the unique `id` filter, so `bookings_status_date_idx` is neither required nor harmed here; the `status` clause is a guard on the update's WHERE, not a scan driver. But the literal claim as stated is false for 1 of 3 queries, and the report must say so rather than repeat it.

## Claim 6 — nothing under `src/app/(public)/` touches bookings by the 4 indexed columns; public creation goes through `create_booking_request`: CONFIRMED

```
Grep pattern: \.from\(["']bookings["']\)   path: src/app/(public)   → No matches found
Grep pattern: booking_date|assignment_status|status|client_id   path: src/app/(public)   → No files found
```
`create_booking_request` (`Grep`, whole repo) is called from `src/app/api/bookings/createBookingTransaction.ts` — the API route backing the public booking form — not from any file literally inside `src/app/(public)/`. Nothing under `src/app/(public)/` (`page.tsx`, `services/`, `areas/`, `home/`, `about/`, `faqs-aftercare/`, `reviews/`, `cookies/`, `privacy/`, `layout.tsx`) queries the `bookings` table directly, by these columns or any other.

## Claim 7 — `getScopedBookingIds` embedded filter: CONFIRMED

`getScopedBookingIds` spans lines 515–548 exactly (`src/app/admin/bookings/bookings-list-data.ts`). Line 531:
```ts
.select("booking_id, bookings!inner(status, booking_date)")
```
confirmed verbatim, plus lines 535–536 further filter through the same embed (`.not("bookings.status", "in", ...)`, `.gte("bookings.booking_date", todayISO)`).

## Claim 8 — parity tests run against an in-memory recording stand-in, not live Postgres: CONFIRMED

Read both files in full header/setup:
- `__tests__/view-predicates-parity.test.ts` (header comment, lines 1–43): states explicitly the SQL side is `bookingListFiltersFromQuery → buildBookingPredicatePlan → applyBookingPredicates(recordingBuilder, plan.steps) → replay the recorded PostgREST filters over the fixtures` — a fixture replay, never a live connection.
- `__tests__/booking-view-counts.test.ts` (lines 1–80): `vi.mock("next/cache", …)` and `vi.mock("@/lib/supabase/admin", …)` fully mock the cache layer and the Supabase admin-client factory; its own comment block (lines 72–76) names the mechanism "Recording stand-ins." No real Postgres connection is reachable from either spec — neither can observe index usage or query-plan choice.

## Claim 9 — house style of the two prior index migrations: **mixed, not uniform — reported exactly, not assumed**

Read both files in full and inspected raw bytes (`od -c`) for line-ending/EOF, since visual diffing can miss `\r\n` vs `\n`.

**`20260522121000_add_band_b_indexes.sql`** (Band B, 3 indexes across 3 tables in one file):
- Header: a 7-line `--`-prefixed comment block — title, a bulleted `index_name → consumer` table, an idempotency note, a pointer to `SHARED-IMPLEMENTATION-NOTES.md`, a plan-file pointer.
- Keywords: **lowercase** — `create index if not exists`, `on public.<table>`, `where … is not null` / `where status = 'completed'`.
- Schema-qualified: yes (`public.audit_logs`, `public.booking_assignments`, `public.bookings`).
- `IF NOT EXISTS`: yes, on every statement.
- One statement per index, separated by a single blank line; `ON`/`WHERE` continuation lines indented 2 spaces under the `CREATE INDEX` line.
- Line endings: **CRLF** (`\r\n` confirmed via `od -c` on every line, including the final one).
- File ends with a trailing newline after the last statement's `;`.

**`20260803053525_c03_enquiries_converted_booking_index.sql`** (C-03, 1 index):
- Header: a longer `--`-prefixed comment block — title, rationale paragraph, partial-index justification, an "Owner-approved and applied" line + "Applied version" line + "Reversible with" line, and a "Ledger premise re-verified live" paragraph.
- Keywords: **UPPERCASE** — `CREATE INDEX IF NOT EXISTS`, `ON public.enquiries`, `WHERE … IS NOT NULL`.
- Schema-qualified: yes (`public.enquiries`).
- `IF NOT EXISTS`: yes.
- One statement; `ON`/`WHERE` continuation lines indented 2 spaces, same as file 1.
- Line endings: **LF only** (`od -c` shows no `\r` anywhere in the file).
- File ends with a trailing newline after the `;`.

**What is actually consistent across both** (safe to call "house style"): schema-qualify every table (`public.<table>`), always use `IF NOT EXISTS`, indent `ON`/`WHERE` continuation clauses 2 spaces under `CREATE INDEX`, open with a `--`-prefixed header comment block before any SQL, end the file with a trailing newline, never use `CONCURRENTLY`, one `CREATE INDEX` statement per logical index (file 1 shows this is fine to batch several in one file, separated by blank lines — directly supports batching item 4's 4 statements in one file).

**What is NOT consistent — do not assume a single answer:** keyword casing (file 1 lowercase throughout, file 2 uppercase throughout) and line-ending convention (file 1 CRLF, file 2 LF-only). An implementer picking either casing or either line-ending is equally "matching precedent" on this specific repo's history of 2 samples — there is no majority to defer to. (The repo's other source files are CRLF per this task's own operating notes, which is a tiebreaker argument for CRLF + the file-1 lowercase-or-either casing, but that is a recommendation, not a verified house style — stating it as settled fact would repeat the same error this task exists to catch.)

---

## Summary table

| # | Claim | Verdict |
|---|---|---|
| 1 | No index-name collision | CONFIRMED |
| 2 | No test asserts on pg_indexes/indexdef/CREATE INDEX | CONFIRMED |
| 3 | No generated database types file | CONFIRMED |
| 4 | 6 client_id-scoped bookings queries (4 row / 2 count-only) | **FALSE** — actual is 7 (4 row / 3 count-only); the row-returning/ORDER-BY sub-claim (4/4) is CONFIRMED |
| 5 | 3 `booking/manage/actions.ts` queries, ALL PK-only, never by status | **FALSE** — 2 of 3 are PK-only; the `requestCustomerCancellation` query (line 141) also filters `.in("status", [...])` (line 150) |
| 6 | Nothing under `(public)/` touches bookings by the 4 columns; public creation goes through `create_booking_request` | CONFIRMED |
| 7 | `getScopedBookingIds` embedded `bookings!inner(status, booking_date)` filter | CONFIRMED |
| 8 | Parity tests run against in-memory recording stand-in, not live Postgres | CONFIRMED |
| 9 | House style of prior 2 index migrations | Partially consistent (schema-qualification, `IF NOT EXISTS`, 2-space continuation indent, header comment block, trailing newline, no `CONCURRENTLY`, batching is fine) — **NOT consistent** on keyword casing (lower vs UPPER) or line endings (CRLF vs LF); reported as mixed rather than asserting one is "the" house style |

No file under `src/`, `scripts/`, `e2e/`, or `supabase/` was modified, created, or deleted by this audit. `src/lib/maintenance.ts` was not opened. No database write of any kind was executed — only `Read`/`Grep`/`Glob`/read-only `Bash` (`git status`, `od -c`, `wc -c`, `ls`) were used; no `mcp__supabase__*` tool was called.
