# Item 3 deepening — the missing secondary `start_time` sort on override lists

Audits `redesign/plans/POST-BAND-C-FOLLOWUP-plan.md` lines 204–236 (ITEM 3), as of
plan commit `33f895f`; repo HEAD is `86b8b22`. All commands run read-only against
the working tree and against Supabase project `twzutkfgqclqurvkmvqz` (`execute_sql`,
SELECT only).

## Headline

The plan's technical facts are all correct — five query sites, both unique
constraints genuinely dropped, `start_time` is `NOT NULL` on both tables (so the
NULLS-handling question the assignment raised is moot). **But the plan's stated
motivation is overstated to the point of being misleading**: it warns that
skipping the fix "would display a day's hours in reverse — an easy and invisible
mistake." In the actual code today, **that mistake is already impossible** on all
three rendering paths that consume these rows — `page.tsx`'s week-grid
(`formatSegments`/`sortByStartTime`) and both managers'
`groupByDate()` — because each already re-sorts a date's segments by `start_time`
client-side, with a comment that says so explicitly: *"Date order comes from the
query; segment order does not."* (`AvailabilityOverridesManager.tsx:94`,
`StaffAvailabilityOverridesManager.tsx:86`). Item 3 is real, correct, and worth
doing — but as **defense-in-depth / query determinism**, not as a fix for a live
display bug. The deepened plan text should say this, so an implementer does not
oversell the fix in the commit message or go looking for a rendering bug that
does not exist. Item 6's stated reason for depending on item 3 ("grouping is only
deterministic once segments of a date are contiguous") is also weaker than
claimed — JS `Map`-based grouping does not require contiguous input at all — but
the *practical* conclusion (do 3 before 6, they touch the same files, sequence
them) is still sound and should stay.

---

## 1. The five sites — re-verified by symbol, not by line number

Grepped the whole `src/` tree for `order(.override_date` (regex):

```
src/app/admin/availability/page.tsx:274:      .order("override_date", { ascending: true }),
src/app/admin/availability/page.tsx:279:      .order("override_date", { ascending: true })
src/app/admin/availability/page.tsx:291:      .order("override_date", { ascending: false })
src/app/admin/staff/[staffId]/availability/page.tsx:154:      .order("override_date", { ascending: true })
src/app/admin/staff/[staffId]/availability/page.tsx:168:      .order("override_date", { ascending: false })
```

Exactly 5 hits, exactly matching the plan's five sites and exactly matching the
plan's own line numbers (204–236 were written against `33f895f`; since `src/` is
confirmed byte-identical `33f895f`→HEAD, **zero anchor drift** — every line number
in §3.2 lands on the exact same statement today). Re-verified by symbol anyway,
per the assignment's instruction that trusting line numbers is itself a defect:

`src/app/admin/availability/page.tsx`, inside the default-exported
`AvailabilityPage` server component's opening `Promise.all([...])`:
- Week window (`.gte("override_date", weekStartIso).lte(..., weekEndIso)`) —
  `.order("override_date", { ascending: true })` at line 274. Feeds
  `weekAdjustments` → `groupOverridesByDate()` → the week-capacity grid.
- Upcoming (`.gte("override_date", today)`, `.limit(AVAILABILITY_UPCOMING_DEFENSIVE_CAP)`) —
  `.order(..., { ascending: true })` at line 279.
- Past (`.lt("override_date", today)`, `.limit(...)`) —
  `.order(..., { ascending: false })` at line 291. **Descending.**
- Two `count: "exact", head: true` sibling queries at lines 283–286 and 293–296
  carry **no** `.order()` at all today — confirmed, nothing to change, matches
  the plan's "leave them."

`src/app/admin/staff/[staffId]/availability/page.tsx`, same shape, one fewer
bucket (no week window on the per-staff page):
- Upcoming — `.order(..., { ascending: true })` at line 154.
- Past — `.order(..., { ascending: false })` at line 168. **Descending.**
- Two count-only siblings at 158–162 and 170–174, no `.order()`, correctly left
  alone by the plan.

### Whole-repo search for a sixth site

Searched three ways, independently:
1. `Grep "order\(.override_date"` over the entire repo root (not just `src/`) →
   6 files matched, but 4 are plan/evidence/handoff **markdown** documents
   quoting the code; the only **source** hits are the same two `page.tsx`
   files above. No sixth code site.
2. `Grep "availability_overrides|staff_availability_overrides"` over all of
   `src/` → 39 lines across 15 files. Read every one that wasn't already one of
   the five sites:
   - `src/app/admin/bookings/assignment-eligibility.ts:212,227` — single-date
     `.eq("override_date", booking.booking_date)` lookups for booking-eligibility
     scoring. **No `.order()` at all** — the whole result set for one date is
     consumed as a set, not rendered as an ordered list. Not a sixth site.
   - `src/lib/booking/availability.ts:595,606` — the live slot-availability
     engine's `loadDayRecords()`. Fetches `.in("override_date", dates)` for a
     batch of dates with **no `.order()` at all**; the caller
     (`working-hours-segments.ts`) turns rows into spans via
     `toSpans()`, which does its **own** `.sort((a,b) => a.start - b.start || a.end - b.end)`
     (`working-hours-segments.ts:93`) — i.e. this consumer already fully
     resorts, unconditionally, and was never order-dependent. Not a sixth site,
     and not affected by item 3 either way.
   - `src/app/admin/availability/actions.ts:308,313,320,374,383` and
     `src/app/admin/staff/[staffId]/availability/actions.ts:248,263,322,332` —
     all **mutations** (delete-then-insert on save), no `.order()`, not list
     queries.
   - Every remaining hit is either a test file's mock table name or a type
     comment.
3. Searched Postgres/PL-pgSQL directly for `order by` in `supabase/**`
   (case-insensitive) → the only `override_date`-adjacent SQL is in the atomic
   booking-snapshot RPCs (`.../phase2_booking_atomic_snapshots.sql:246,303` and
   its two successor migrations), and none of those statements carry an
   `ORDER BY` on `override_date` — they're `WHERE override_date = p_booking_date`
   single-date lookups. `20260809120000_c14_save_availability_day.sql` does use
   `ORDER BY rule.start_time, rule.end_time` inside `jsonb_agg(...)`, but that is
   the **rules** table (`availability_rules`/inserted rows), not an override
   table, and it already carries a `start_time` secondary key — so it's already
   correct and out of item 3's scope.
4. `src/app/booking/manage/` (the named trap) — `Grep "override|\.order\("` over
   its three files (`ManageBookingForms.tsx`, `actions.ts`, `page.tsx`) →
   **zero matches**. Confirmed clean: this tree never touches an override table
   or a `.order()` call at all.

**Conclusion: exactly five sites, confirmed exhaustively; no sixth exists
anywhere in `src/`, `supabase/`, or the customer-facing booking tree.**

---

## 2. Database verification (read-only SQL, project `twzutkfgqclqurvkmvqz`)

**Row counts** — both zero, confirming §3.5's "nothing to observe live" claim:
```sql
select 'availability_overrides' as tbl, count(*) as n from public.availability_overrides
union all
select 'staff_availability_overrides', count(*) from public.staff_availability_overrides;
-- availability_overrides: 0
-- staff_availability_overrides: 0
```

**Unique constraints — confirmed dropped** (`pg_constraint`):
```
tbl                          | conname                                          | contype | def
availability_overrides       | availability_overrides_pkey                      | p       | PRIMARY KEY (id)
availability_overrides       | availability_overrides_time_check                | c       | CHECK (end_time > start_time)
staff_availability_overrides | staff_availability_overrides_pkey                | p       | PRIMARY KEY (id)
staff_availability_overrides | staff_availability_overrides_staff_id_fkey       | f       | FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON DELETE CASCADE
staff_availability_overrides | staff_availability_overrides_time_check          | c       | CHECK (end_time > start_time)
```
No `UNIQUE` constraint on either table. Cross-checked with `pg_indexes`: each
table now carries only its `_pkey` unique index (on `id`) — the old
`availability_overrides_override_date_key` and
`staff_availability_overrides_staff_id_override_date_key` indexes are gone too
(they were owned by the dropped constraints, per the C-14 Phase C migration's
own comment about `ERROR: cannot drop index ... because constraint ... on table
... requires it`). **Confirms the plan's premise cleanly: one date/staff+date
can now legitimately hold N rows, and nothing in the schema stops it.**

**Nullability of `start_time`** — checked on both tables via
`information_schema.columns`:
```
table                         | column      | is_nullable | data_type
availability_overrides        | start_time  | NO          | time without time zone
availability_overrides        | end_time    | NO          | time without time zone
availability_overrides        | override_date | NO        | date
staff_availability_overrides  | start_time  | NO          | time without time zone
staff_availability_overrides  | end_time    | NO          | time without time zone
staff_availability_overrides  | override_date | NO        | date
staff_availability_overrides  | staff_id    | NO          | uuid
```
**`start_time` is `NOT NULL` on both tables.** This is a hard DB constraint, not
something application code can bypass short of a migration — so the "does the
plan need explicit NULLS handling?" question the assignment raised resolves to
**no, and the plan's silence on it is correct, not a gap.** For completeness I
also checked the PostgREST/`postgrest-js` `.order()` signature
(`node_modules/.pnpm/@supabase+postgrest-js@2.104.1/.../PostgrestTransformBuilder.ts:110-344`):
it accepts `nullsFirst?: boolean`, defaults to `undefined` (Postgres's own
default — `NULLS LAST` for ascending, `NULLS FIRST` for descending — applies
when omitted), and `.order()` is chainable: calling it twice appends a second
`ORDER BY` key exactly as §3.3 intends (`this.url.searchParams.set(key,
`${existingOrder ? `${existingOrder},` : ''}${column}.${asc/desc}...`)`). No
`nullsFirst` option is needed for this fix given the `NOT NULL` constraint.

---

## 3. The load-bearing finding: client code already re-sorts by `start_time`

This is the part the plan section does not mention, and it changes how the fix
should be framed (not whether to do it).

**Consumer 1 — the week-grid, `src/app/admin/availability/page.tsx`.**
`weekAdjustments` (the week-window query result, currently ordered by
`override_date` only) is grouped by `groupOverridesByDate()` (line 174) and, at
render time, each date's segment array is passed through `formatSegments()`
(lines 606, 615), which calls `sortByStartTime()` (line 132:
`[...segments].sort((a,b) => a.start_time.localeCompare(b.start_time))`) before
formatting. **The week-grid's segment order is already correct today,
independent of query order.** `src/app/admin/availability/__tests__/page.test.ts`
already locks this in: *"joins multiple segments with ' · ', sorted by start
time regardless of input order"* (line 58) and groupOverridesByDate's own test
comments confirm rows are grouped without assuming any input order.

**Consumer 2 — `AvailabilityOverridesManager.tsx`'s upcoming/past lists.**
`groupByDate()` (line 75) buckets raw rows by `override_date` into a `Map`
(order-independent — a `Map.set` doesn't care what order rows arrive in), then
explicitly: *"Date order comes from the query; segment order does not."* (line
94) followed by `day.segments.sort((a,b) =>
a.start_time.localeCompare(b.start_time))` (line 96). `OverrideRow` (line 471)
renders `day.segments` — already sorted — directly. **Already correct today.**

**Consumer 3 — `StaffAvailabilityOverridesManager.tsx`, identical shape.**
Same `groupByDate()` at line 66, same sort at line 87, same comment at line 85.
**Already correct today.**

So: on all three human-visible rendering paths, "a day's hours in reverse" is
not a reachable bug in the current code, because each consumer independently
re-sorts by `start_time` before display. Adding `.order("start_time", {
ascending: true })` server-side is still the right thing to do — it makes the
*query* itself deterministic (useful for anything that reads these rows without
going through one of these three helpers, and removes reliance on undefined
Postgres tie-break order for anyone debugging with raw SQL or the Supabase
dashboard) — but the plan's §3.1/§3.2 framing ("an easy and invisible mistake")
overstates the current risk and should be corrected to something like: *"the
three current renderers already defend against this client-side; this change
makes the query itself deterministic too, as a second line of defense and for
any future direct consumer."*

**Corollary for item 6's stated dependency** (§6.7: *"grouping is only
deterministic once segments of a date are contiguous and in time order... Ship
3 first, then 6"*): the "contiguous" half of that claim already holds without
item 3 — `ORDER BY override_date` alone still clusters all rows sharing a date
value together in the result set (SQL sort groups equal keys regardless of
secondary-key ties), and JS `Map`-based grouping (`groupByDate`,
`groupOverridesByDate`) doesn't require contiguous input in the first place —
it buckets by key wherever a row appears in the array. The "in time order" half
is true but, per the above, already independently guaranteed by each renderer's
own `.sort()`. **The practical conclusion to keep — do item 3 before item 6,
because they edit the same files and item 7 waits on both — is still correct**;
only the stated *mechanism* of the dependency is weaker than claimed. Recommend
softening §6.7's reasoning rather than removing the ordering.

---

## 4. Blast radius

### Files to edit (item 3 itself)
- `src/app/admin/availability/page.tsx` — add `.order("start_time", {
  ascending: true })` as a second `.order()` call after the three existing
  `.order("override_date", ...)` calls at lines 274, 279, 291.
- `src/app/admin/staff/[staffId]/availability/page.tsx` — same, after lines
  154 and 168.

No other file needs a code change for item 3 in isolation.

### Callers / consumers of the changed queries
- `weekAdjustments` (availability `page.tsx:348`) → `groupOverridesByDate`
  (line 375) → `resolvedWeek` → rendered via `formatSegments` in the week-grid
  JSX (lines 607, 616). Already resorts; unaffected in output, gains
  determinism in input.
- `overridesUpcoming` / `overridesPast` (availability `page.tsx`, passed at
  lines 513–516) → `<AvailabilityOverridesManager upcoming=... past=... />` →
  its internal `groupByDate` (already sorts). Same for the staff tree's
  `<StaffAvailabilityOverridesManager>`.
- The two `count: "exact", head: true` siblings on each page — untouched,
  confirmed to carry no `.order()` today, nothing to change.

### Tests affected
Ran the full test suite for both directories to establish the pre-change
baseline:
```
npx vitest run "src/app/admin/availability" "src/app/admin/staff/[staffId]/availability"
→ 9 test files, 89 tests, all passed (3.66s)
```
None of the 9 files mock or assert on the Supabase query chain for these
`page.tsx` reads (see §5 below), so **adding the second `.order()` call should
not change this number** — it must stay 9 files / 89 passed after the edit.
This is also a subset of the repo-wide vitest baseline recorded in the handoff
(§6: `5 failed / 2236 passed`); item 3 must not move that total either.

### Proven NOT affected (checked explicitly)
- `src/app/booking/manage/{ManageBookingForms.tsx,actions.ts,page.tsx}` —
  grepped for `override|\.order\(`, zero matches. This tree never queries an
  override table. **Confirmed clean — the named trap does not apply to item 3.**
- `src/app/(public)/**` — no file under the public tree references
  `override_date`, `availability_overrides`, or `staff_availability_overrides`
  at all (checked via the repo-wide grep in §1.2; every hit outside admin was
  either a migration, `src/lib/booking/availability.ts`, or
  `assignment-eligibility.ts`, none of which are under `(public)`).
- `src/lib/booking/availability.ts` (the live slot-availability engine used by
  the customer booking flow) — reads override rows with **no `.order()`** and
  its consumer (`working-hours-segments.ts:toSpans`) does its own unconditional
  `.sort()`. Not one of the five sites; not touched by item 3; already
  order-independent by construction.
- `src/app/admin/bookings/assignment-eligibility.ts` — single-date `.eq()`
  lookups, no `.order()`, consumes the override rows for one date as an
  unordered set for eligibility scoring. Not affected.
- SQL/RPCs in `supabase/migrations/**` — no `ORDER BY override_date` anywhere
  in the migration history (checked via case-insensitive `order by` grep across
  `supabase/`); the atomic-booking-snapshot RPCs do single-date `WHERE
  override_date = p_booking_date` lookups, not ordered lists.
- Both override tables hold **0 rows** in the live database (confirmed by
  SELECT), so there is no live data whose display order could currently be
  wrong to begin with — corroborates §3.5's "nothing to observe live."

### Shared with the public/customer site
Nothing. Item 3's two files are both under `src/app/admin/`; its consumers
(`AvailabilityOverridesManager.tsx`, `StaffAvailabilityOverridesManager.tsx`)
are also admin-only components. The one place that could plausibly have been a
leak — `src/app/booking/manage/` — is confirmed clean (see above).

---

## 5. Existing tests, enumerated, and where new ordering tests belong

**`src/app/admin/availability/`** (non-recursive + `__tests__/`):
```
AvailabilityOverridesManager.test.tsx   — component test; renders the manager
                                           with fixed fixture data. No test
                                           currently exercises segment ordering
                                           (grepped for sort/order/segments —
                                           only one unrelated comment hit).
AvailabilityRulesManager.test.tsx       — unrelated (weekly rules, not overrides)
WorkingHoursDayEditor.test.tsx          — unrelated (day editor UI)
__tests__/actions.test.ts               — mutations (save/delete), mocks
                                           createSupabaseAdminClient's `.from()`
                                           chain directly (a `stubAdminClient()`
                                           helper) but never touches `.order()`
                                           — the mutations don't read lists.
__tests__/availability-data.test.ts     — pure banner-state resolver
                                           (resolveAvailabilityBannerState),
                                           unrelated to ordering.
__tests__/page.test.ts                  — pure post-processing helpers exported
                                           from page.tsx: formatSegments,
                                           groupOverridesByDate,
                                           resolveWeekdayRule. THIS file already
                                           contains the closest thing to an
                                           "ordering test" in the repo:
                                           "joins multiple segments with ' · ',
                                           sorted by start time regardless of
                                           input order" and "independent of
                                           query row order" — both already
                                           passing, both already proving the
                                           client-side sort works.
```

**`src/app/admin/staff/[staffId]/availability/`**:
```
StaffAvailabilityRulesForm.test.tsx     — unrelated (weekly rules form)
__tests__/actions.test.ts               — mutations, same shape as above
__tests__/lib.test.ts                   — pure helpers from lib.ts (constants/
                                           banner-state equivalent)
```
**No `page.test.ts` and no `StaffAvailabilityOverridesManager.test.tsx` exist
for the staff tree at all.** `StaffAvailabilityOverridesManager.tsx` currently
has **zero dedicated test coverage of any kind** — not just of ordering, of
anything.

**How this repo tests page-level query building: it does not.** Every
`page.tsx` in this tree is a full async Server Component; nothing in the
existing suite mocks `createSupabaseServerClient()`'s `.from().select().order()`
chain to assert what gets sent to PostgREST. The only place a Supabase chain is
mocked at all is `actions.test.ts` (mutations), via a hand-rolled
`stubAdminClient()` that returns canned `{data, error}` per table name — it
never asserts `.order()` args because saves don't order anything.

**Honest recommendation, given that shape:**
1. **Do not** try to add a "the query includes `.order("start_time", {ascending:
   true})`" unit test by mocking the full postgrest chain for `page.tsx` — this
   repo has no precedent for it, `page.tsx` isn't structured to expose the
   query builder separately from the Server Component body, and building that
   mock (and threading it through `getStaffProfile`, `redirect`, etc. to reach
   the query) would be a disproportionate scaffold for a two-line change with
   no branching logic to cover. This would also violate the "simplicity first /
   no speculative abstraction" standard this session is operating under.
2. **What actually deserves a test is the thing that is genuinely undertested
   today: the client-side sort itself**, which is what really guarantees
   correct display and which item 3 is reinforcing at the DB layer. Concretely:
   - `src/app/admin/availability/AvailabilityOverridesManager.test.tsx`
     (existing file): add a case that renders `<AvailabilityOverridesManager>`
     with `upcoming`/`past` rows for one date, two segments, **fed in
     start_time-descending order** (mirroring what an unordered/DB-tie-broken
     result could look like), and assert the rendered text shows the earlier
     segment first (e.g. `08:00–12:30 · 15:00–20:00`, not the reverse). This
     locks in `groupByDate`'s internal sort, which is the actual thing
     protecting users today and which has no test right now.
   - **New file** `src/app/admin/staff/[staffId]/availability/StaffAvailabilityOverridesManager.test.tsx`
     — does not exist; create it with the equivalent case for the staff
     manager, since that component currently has no test file at all. This is
     arguably out of a strict reading of "item 3" and closer to closing a
     pre-existing gap, but it is the honest home for "the new ordering tests"
     the assignment asks about, because the query-level change itself has
     nothing to unit-test.
3. For the query-builder edit itself, the right verification is `npx tsc
   --noEmit` (the `.order()` overload requires a valid column name and options
   shape, so a typo is a compile error, not a runtime one) plus a direct code
   read confirming exactly five `.order("start_time", { ascending: true })`
   calls were added as the **second** `.order()` on each existing chain (order
   of `.order()` calls matters — PostgREST concatenates them in call order into
   a single comma-separated `order=` param, confirmed from
   `PostgrestTransformBuilder.ts:334-342`).

---

## 6. Ordering / file overlap with items 6 and 7

- **Item 6 is a confirmed, correctly-stated dependent of item 3** — not because
  grouping needs it (see §3 corollary above), but because item 6's Option A
  changes the *same* `.order()` chains again (adding the row-fetch-ceiling
  `.limit()` change right next to where item 3 adds `.order("start_time")`),
  and because item 6's own verification (§6.6: "a date's segments are never
  split across the cap boundary") is stated in terms of item 3 already having
  landed. Sequencing item 3 before item 6, as the plan's "Suggested order and
  commits" table already does (item 3 first, item 6 second), is correct and
  should stand.
- **Item 7 (admin colour/contrast) touches the same two `page.tsx` files and
  both Manager components for an unrelated reason** — literal `oklch(...)`
  substitution. Recounted independently (not trusting the plan's number):
  ```
  src/app/admin/availability/page.tsx                                    7 oklch
  src/app/admin/staff/[staffId]/availability/page.tsx                    0 oklch
  src/app/admin/availability/availability-data.ts                        0 oklch
  src/app/admin/staff/[staffId]/availability/lib.ts                      9 oklch
  src/app/admin/availability/AvailabilityOverridesManager.tsx            6 oklch
  src/app/admin/staff/[staffId]/availability/StaffAvailabilityOverridesManager.tsx  1 oklch
                                                                         ----
                                                                          23 oklch across 6 files
  ```
  **This exactly reproduces the plan's own claim** ("six availability files
  that already carry 23 `oklch()` literals item 7 must also change," line
  1222) — independently re-counted and confirmed correct. This is genuine
  evidence the plan's own self-correction (replacing an earlier, wrong claim
  that the collision was on `AdminTopNav.tsx`) is accurate. Practical
  consequence for item 3: whatever line an `.order("start_time", ...)` call
  lands on in `page.tsx` will need re-anchoring by symbol once item 7's literal
  substitution has also touched that file — item 3 should land, and item 6
  after it, **before** item 7 starts, exactly as §"Suggested order and
  commits" already directs. No change needed to that sequencing; this section
  exists to confirm it holds up under independent re-verification.
- No overlap was found between item 3 and any of items 1, 2, 4, 5, or 8 — none
  of those touch `availability_overrides`, `staff_availability_overrides`, or
  either availability `page.tsx`.

---

## 7. Claims tested (summary table)

| # | Claim (plan §3, paraphrased) | Verdict | Evidence |
|---|---|---|---|
| 1 | Five list queries order by `override_date` only | CONFIRMED | `Grep 'order\(.override_date'` over `src/` → exactly 5 hits, matching plan's sites and line numbers exactly |
| 2 | No sixth site anywhere in the repo | CONFIRMED | Three independent searches: source grep, RPC/SQL grep, `booking/manage/` grep — all clean |
| 3 | C-14 Phase C dropped the unique constraints on both tables | CONFIRMED | `pg_constraint` query — only `pkey`, `check`, and (staff) `fkey` remain; no `unique` |
| 4 | Both override tables hold 0 rows today | CONFIRMED | `SELECT count(*)` on both — 0 and 0 |
| 5 | (assignment) `start_time` nullability needs NULLS handling | FALSE | `information_schema.columns` — `start_time` is `NOT NULL` on both tables; no NULLS-handling logic is needed |
| 6 | "Getting this backwards would display a day's hours in reverse — an easy and invisible mistake" | PARTIAL | True as a description of what the *query* alone would do; false as a description of current live risk — all three renderers (`formatSegments`/`sortByStartTime`, both managers' `groupByDate`) already re-sort by `start_time` client-side and are already unit-tested for it in `page.test.ts` |
| 7 | (item 6, §6.7) item 3 is required because "grouping is only deterministic once segments of a date are contiguous and in time order" | PARTIAL | Contiguity already holds from `ORDER BY override_date` alone (equal keys stay adjacent); JS `Map` grouping doesn't need contiguous input either. The practical sequencing conclusion (3 before 6) is still correct for other reasons (shared files, item 6's own verification language assumes it) |
| 8 | Count-only queries need no ordering, leave them | CONFIRMED | All 4 `count: "exact", head: true` sibling queries (2 per page) verified to carry no `.order()` today |
| 9 | (assignment) item 7 collides on 6 files / 23 `oklch()` literals (plan line 1222) | CONFIRMED | Independent recount across the exact 6 files: 7+0+0+9+6+1 = 23 |

---

## 8. Recommended text to fold into the plan (item 3 section)

- Add a short subsection after §3.1 titled something like *"Current risk, precisely"*
  stating that the reversed-order failure mode is already prevented client-side
  on all three renderers today (cite `formatSegments`/`sortByStartTime` in
  `page.tsx`, and `groupByDate` in both managers), and reframe the fix as
  query-level determinism / defense-in-depth rather than a live-bug fix — so an
  implementer doesn't oversell it or go hunting for a rendering bug that
  doesn't exist.
- Soften §6.7's dependency reasoning per §3's corollary above (contiguity
  doesn't require item 3; the practical "do 3 before 6" conclusion still
  holds).
- Add §3.5's test guidance: no query-builder unit test is warranted (no
  precedent in this repo, no branching logic to cover); instead add the
  client-side-sort regression test to the existing
  `AvailabilityOverridesManager.test.tsx`, and create the currently-missing
  `StaffAvailabilityOverridesManager.test.tsx` with the equivalent case.
- Note the exact 23-`oklch()`/6-file collision with item 7 as independently
  reconfirmed (not just trusted from the plan), so a future reader doesn't
  have to redo the recount.
