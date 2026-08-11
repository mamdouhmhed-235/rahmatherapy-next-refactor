## ITEM 3 — The missing secondary sort on override lists

### 3.1 The problem

C-14 Phase C dropped the unique constraints on `availability_overrides(override_date)`
and `staff_availability_overrides(staff_id, override_date)` — confirmed live via
`pg_constraint`: each table now carries only its primary key (plus a `CHECK` and,
on the staff table, its `staff_id` foreign key); no `UNIQUE` constraint remains on
either, and the old unique indexes are gone with it. One date can now legitimately
hold several segment rows. Five list queries order by `override_date` **only**,
which was a total ordering when one row per date was guaranteed and is not any
more.

### 3.2 Exact sites (re-locate by symbol, do not trust the line numbers)

Both files are inside `src/`, which is byte-identical to the plan's base commit
`33f895f`, so these line numbers currently land correctly — but re-locate by
symbol and report drift if they don't, per the standing convention.

`src/app/admin/availability/page.tsx`, symbol `AvailabilityPage` (the default
export, the async Server Component), inside its opening `Promise.all([...])`:
- Week window (`.gte("override_date", weekStartIso).lte(..., weekEndIso)`) —
  `.order("override_date", { ascending: true })`, currently at `:274`. Feeds
  `weekAdjustments`.
- Upcoming (`.gte("override_date", today)`, `.limit(AVAILABILITY_UPCOMING_DEFENSIVE_CAP)`)
  — `.order("override_date", { ascending: true })`, currently at `:279`.
- Past (`.lt("override_date", today)`, `.limit(...)`) — `.order("override_date",
  { ascending: false })`, currently at `:291`. **Descending.**

`src/app/admin/staff/[staffId]/availability/page.tsx`, same shape, one fewer
bucket (no week window on the per-staff page):
- Upcoming — `.order("override_date", { ascending: true })`, currently at `:154`.
- Past — `.order("override_date", { ascending: false })`, currently at `:168`.
  **Descending.**

The `count: "exact", head: true` queries adjacent to each of the above (two per
file) carry no `.order()` today and need none — leave them.

Confirmed exhaustively that no sixth site exists anywhere in the repo: a
whole-`src/` grep for `order\(.override_date` returns exactly these 5 hits; a
grep for every `availability_overrides` / `staff_availability_overrides`
reference (39 lines, 15 files) shows every other hit is either a mutation
(delete-then-insert save actions, no `.order()`), a single-date `.eq()` lookup
consumed as a set (`assignment-eligibility.ts:212,227`; the live slot-engine's
`loadDayRecords()` in `src/lib/booking/availability.ts:595,606`, whose caller
`working-hours-segments.ts:toSpans` already does its own unconditional
`.sort((a,b) => a.start - b.start || a.end - b.end)`), or a test/type comment;
and a case-insensitive `order by` sweep of `supabase/**` finds no `ORDER BY
override_date` in any RPC or migration (the one adjacent hit,
`20260809120000_c14_save_availability_day.sql`'s `ORDER BY rule.start_time,
rule.end_time` inside a `jsonb_agg`, is the **rules** table, already carries a
`start_time` secondary key, and is out of item 3's scope).

### 3.3 The change

Add `.order("start_time", { ascending: true })` as a **second** `.order()` call
on each of the five chains above (PostgREST/`postgrest-js` concatenates
successive `.order()` calls into one comma-separated `order=` parameter, so call
order is what determines primary/secondary — confirmed by reading
`PostgrestTransformBuilder.ts`).

On the two descending queries, **the date stays descending and `start_time`
stays ascending** — the list reads newest date first, but within a date the
segments must read 08:00 before 15:00.

No `NULLS`-handling logic is needed: `start_time` is `NOT NULL` on both tables
(confirmed via `information_schema.columns`), so there is no null tie-break case
to reason about.

### 3.4 Current risk, precisely

Do not oversell this fix as closing a live display bug — it isn't one today.
All three human-visible rendering paths that consume these rows already
re-sort a date's segments by `start_time` client-side, independent of query
order:

- `src/app/admin/availability/page.tsx` — `formatSegments()` (currently
  `:144`) calls `sortByStartTime()` (currently `:132`,
  `[...segments].sort((a,b) => a.start_time.localeCompare(b.start_time))`)
  before rendering the week grid. Locked in by
  `src/app/admin/availability/__tests__/page.test.ts`'s existing test *"joins
  multiple segments with ' · ', sorted by start time regardless of input
  order"*.
- `src/app/admin/availability/AvailabilityOverridesManager.tsx` — `groupByDate()`
  buckets rows into a `Map` (order-independent) and then, with the comment
  *"Date order comes from the query; segment order does not."*, sorts each
  date's segments by `start_time.localeCompare`. `OverrideRow` renders the
  already-sorted `day.segments` directly.
- `src/app/admin/staff/[staffId]/availability/StaffAvailabilityOverridesManager.tsx`
  — identical shape: `groupByDate()` (currently `:66`), the same comment
  (currently `:85`), the same sort (currently `:87`), `OverrideRow` (currently
  `:508`) rendering `day.segments` directly.

So the reversed-order failure mode this fix targets is already prevented,
client-side, everywhere a human sees these rows. Adding the secondary sort
server-side is still the right thing to do — it makes the **query** itself
deterministic, which matters for anything that reads these rows without going
through one of the three helpers above (raw SQL, the Supabase dashboard, a
future direct consumer) — but frame it as **query-level determinism /
defense-in-depth**, not as a fix for a reachable rendering bug. Don't go
looking for a display bug that doesn't exist, and don't claim in the commit
message that this fix corrects something users could currently see.

*(Corrected: an earlier draft of this section warned that skipping the fix
"would display a day's hours in reverse — an easy and invisible mistake." That
description is true only of the raw query in isolation; it is false as a
description of current live risk, because all three renderers above already
guard against it and are already tested for it.)*

### 3.5 What this does and does not fix

Adding the sort makes the ordering **total and deterministic**, so a date's
segments are contiguous and would render in the right order even for a
hypothetical consumer that skipped client-side sorting. **It does not stop a
`.limit()` boundary falling mid-date** — a capped list can still show a date
with only some of its segments. That is the caps/date-counting problem, out of
scope here (§0.2) and requiring a view or RPC (item 6). Do not attempt it here,
and do not claim this fix closes it.

### 3.6 Blast radius

**Files edited by item 3 itself:**
- `src/app/admin/availability/page.tsx` — three `.order()` chains gain a second
  `.order("start_time", { ascending: true })` call.
- `src/app/admin/staff/[staffId]/availability/page.tsx` — two `.order()` chains,
  same change.

No other file needs a code change for item 3 in isolation.

**Callers / consumers (proven affected, output unchanged, determinism gained):**
- `weekAdjustments` → `groupOverridesByDate()` → the week-grid JSX (via
  `formatSegments`). Already resorts client-side; output is identical
  before/after, input is now deterministic.
- `overridesUpcoming` / `overridesPast` → `<AvailabilityOverridesManager
  upcoming=... past=... />` → its internal `groupByDate()`. Same: output
  unchanged, input now deterministic.
- The per-staff page's equivalent props → `<StaffAvailabilityOverridesManager>`
  → its own `groupByDate()`. Same.
- The four `count: "exact", head: true` sibling queries (two per file) —
  confirmed to carry no `.order()` today; untouched.

**Proven NOT affected (checked explicitly, commands given):**
- `src/app/booking/manage/{ManageBookingForms.tsx,actions.ts,page.tsx}` —
  `Grep "override|\.order\("` over these three files returns zero matches.
  This tree never queries an override table. The named collision trap does
  not apply to item 3.
- `src/app/(public)/**` — no file under the public tree references
  `override_date`, `availability_overrides`, or `staff_availability_overrides`
  at all (confirmed by the repo-wide `availability_overrides|staff_availability_overrides`
  grep in §3.2; every non-admin hit is in `src/lib/booking/availability.ts` or
  `assignment-eligibility.ts`, both handled next).
- `src/lib/booking/availability.ts` (`loadDayRecords()`, used by the live
  customer-facing slot-availability engine) — reads override rows with no
  `.order()` at all; its only consumer, `working-hours-segments.ts:toSpans`,
  does its own unconditional `.sort()`. Not one of the five sites; already
  order-independent by construction; untouched by item 3.
- `src/app/admin/bookings/assignment-eligibility.ts` — single-date `.eq()`
  lookups (`:212`, `:229`), no `.order()`, consumes rows for one date as an
  unordered set for eligibility scoring. Not affected.
- SQL/RPCs in `supabase/migrations/**` — no `ORDER BY override_date` anywhere
  in migration history (case-insensitive `order by` grep across `supabase/`);
  the atomic-booking-snapshot RPCs do single-date `WHERE override_date =
  p_booking_date` lookups, not ordered lists. Not affected.
- Both override tables hold **0 rows** live (confirmed via `SELECT count(*)`
  on both), so there is no live data whose display order could currently be
  wrong — there is nothing to observe live either before or after this change.

### 3.7 Shared with the public/customer site

Nothing. Both edited files are under `src/app/admin/`; their two consumer
components are admin-only. `/booking/manage` — the one place a leak could
plausibly hide — is confirmed clean by direct grep (§3.6). No further public
surface exists for this item.

### 3.8 Ordering and prerequisites vs other items

- **Item 6 depends on item 3 — ship 3 first, then 6 — but on a narrower
  mechanism than the plan currently states.** The plan's §6.7 says item 3 is
  required because "grouping is only deterministic once segments of a date are
  contiguous and in time order." The contiguity half of that does not actually
  require item 3: `ORDER BY override_date` alone already clusters every row
  sharing a date value together in the result set, and both `groupByDate()`
  implementations are `Map`-based, which buckets by key regardless of input
  order — they never needed contiguous input. The time-order half is true, but
  (per §3.4) it's already independently guaranteed by each renderer's own
  client-side `.sort()`. The **practical conclusion still holds** — do item 3
  before item 6, because they edit the same two `page.tsx` files and item 6's
  own verification language is written assuming item 3 has landed — but the
  stated *mechanism* in §6.7 should be corrected to something like: "item 3
  is sequenced first because it touches the same query chains item 6 also
  touches, and because item 3's disclosed limitation (a `.limit()` boundary
  can still split a date) is exactly what item 6 removes — not because
  grouping would otherwise be non-deterministic."
- **Item 7 (admin colour/contrast) touches the same six files for an unrelated
  reason** — literal `oklch(...)` substitution. Sequence item 3 (and item 6)
  fully before item 7 starts on these files, and re-anchor by symbol
  afterward, per the plan's existing "Suggested order and commits" table.
  *(Corrected: the plan's line 1222 states this collision as "23 `oklch()`
  literals" across the six files. That figure is a **line count**
  (`grep -c`, i.e. lines containing at least one match), not an occurrence
  count. Re-run independently with an occurrence count (`grep -o`, counting
  every literal, since a line can carry more than one) on the same six files:
  `page.tsx`=8, staff `page.tsx`=0, `availability-data.ts`=0, staff `lib.ts`=9,
  `AvailabilityOverridesManager.tsx`=7, `StaffAvailabilityOverridesManager.tsx`=2
  — sums to **26**, not 23. This session's established convention is to
  standardise on occurrence counts for any ratchet guard item 7 builds, so
  whoever edits item 7's section should update line 1222's figure from 23 to
  26. This does not change item 3's own scope or sequencing — it is noted here
  only because item 3 is what first collides with item 7 on these files.)*
- No overlap found between item 3 and items 1, 2, 4, 5, or 8 — none of those
  touch `availability_overrides`, `staff_availability_overrides`, or either
  availability `page.tsx`.

### 3.9 Verification

Per-batch, run after editing each file (or both together — they're independent
edits):

```
npx tsc --noEmit
```
Must exit 0, silently, as it does on the current baseline. The `.order()`
overload requires a valid column name and options shape, so a typo here is a
compile error, not a runtime one.

```
npx vitest run "src/app/admin/availability" "src/app/admin/staff/[staffId]/availability"
```
Baseline today: **9 test files, 89 tests, all passing.** After adding the two
new ordering-regression cases (§3.10), this **must become 9 files / 91 tests**
if extending the existing file plus the new file both land — track the exact
number for whichever subset you've added at the time you run this. Nothing in
this range should newly fail.

```
npx vitest run
```
Full-suite baseline: **5 failed / 2236 passed (2241)**, Test Files 2 failed |
220 passed (222). This total **must not move** except for the count increase
from the new tests in §3.10 (passing). Do not let a change here fix or newly
break either of the two pre-existing failing files
(`src/lib/auth/admin-access.test.ts`, `ManualBookingForm.test.tsx`) — if either
count changes, stop and investigate before attributing it to item 3.

No live-data check is possible or meaningful: both override tables hold 0 rows
today. Say so in the commit rather than claiming a live check that can't
happen.

### 3.10 Tests to add

This repo has no precedent for unit-testing a Server Component's Supabase
query-builder chain directly (no `page.tsx` in this tree exposes its query
apart from the component body, and the only place a Supabase chain is mocked
at all — `actions.test.ts` — covers mutations, which never call `.order()`).
Building that scaffold for a two-line, non-branching change would itself be
speculative. Verify the query edit via `npx tsc --noEmit` plus a direct read
confirming exactly five `.order("start_time", { ascending: true })` calls
landed as the **second** `.order()` on each pre-existing chain (§3.9).

What genuinely deserves a test is the thing currently undertested: the
client-side sort that is the real guarantee of correct display, reinforced
(not replaced) by item 3's DB-level change.

1. **Extend** `src/app/admin/availability/AvailabilityOverridesManager.test.tsx`
   — add a case named:
   `it("renders a date's segments in start-time order even when the input rows arrive out of order", ...)`
   Feed `upcoming` with the existing two-segment fixture shape but with the PM
   row (`15:00:00`–`20:00:00`) listed **before** the AM row
   (`08:00:00`–`12:30:00`) — mirroring what an unordered or DB-tie-broken
   result could look like — and assert the rendered entry's text still reads
   `"08:00–12:30 · 15:00–20:00"` (the existing joined-segment assertion
   pattern already used at this file's line 88, just with reversed input).
   This is the regression test that actually protects users; it has no
   equivalent today.
2. **New file**
   `src/app/admin/staff/[staffId]/availability/StaffAvailabilityOverridesManager.test.tsx`
   — this component has **zero test coverage of any kind** today, not just of
   ordering. Creating a file with only the ordering case risks looking like
   adequate coverage was added when it wasn't — so this new file's minimum
   scope must be more than the one ordering case. At minimum, mirror the shape
   of the sibling `AvailabilityOverridesManager.test.tsx` (mock `./actions`,
   `next/navigation`, and `sonner` the same way) and cover:
   - `it("renders a date's segments in start-time order even when the input rows arrive out of order", ...)`
     — the same regression case as above, using
     `StaffAvailabilityOverridesManager`'s props (`staffId`, `upcoming`,
     `upcomingTotal`, `past`, `pastTotal`, `pastViewAll`, `pastAllHref`,
     `pastRecentHref`, `weeklyRules`).
   - `it("groups two segment rows on the same date into a single override entry", ...)`
     — the grouping equivalent of the collision this whole area exists to
     guard (mirrors the collision reasoning already documented at the top of
     the sibling test file for `AvailabilityOverridesManager`).
   - `it("renders the empty state when there are no upcoming overrides", ...)`
     — covers `EmptyOverridesState`, currently unexercised.
   Do not treat this new file as in scope only because item 3 needs one
   ordering case in it — since it starts from zero coverage, ship it with this
   minimum baseline or flag explicitly in the commit that it is deliberately
   partial and why.

### 3.11 Stop conditions

Halt and ask rather than proceeding if any of the following happen:

1. Re-locating the five sites by symbol turns up a different count than 5, or
   any site's shape (which bucket, ascending vs descending) doesn't match
   §3.2 — this means the anchor has drifted for a reason not accounted for
   here (e.g. item 6 or item 7 already landed on these files out of the
   stated order).
2. Either override table has non-zero rows at the time of implementation —
   this whole section's "nothing to observe live" reasoning no longer holds,
   and the change should be checked against real data before shipping, not
   assumed safe by analogy to the empty-table case.
3. `npx vitest run "src/app/admin/availability" "src/app/admin/staff/[staffId]/availability"`
   does not land at exactly 9 files / 91 tests after both test additions (or
   the intermediate count doesn't match after adding only one file's worth).
4. The full-suite baseline moves by anything other than the exact net new
   passing tests added here — in particular, if either of the two documented
   pre-existing failing files' pass/fail counts change.
5. `npx tsc --noEmit` produces any output at all (baseline is silent, exit 0).
6. Implementing the fix reveals a genuine live rendering discrepancy in one of
   the three consumers named in §3.4 (i.e. the "already defended
   client-side" claim turns out false on closer reading) — that would be a
   separate, more serious finding worth surfacing loudly, not silently folded
   into this item.

### 3.12 Rollback

Nothing here is irreversible. This item is a pure code diff — five added
`.order()` calls across two files, plus one extended and one new test file.
No migration, no data write, no schema change. `git revert` of the commit (or
of the two file edits plus the two test file changes) fully undoes it with no
residual state anywhere, live or otherwise.
