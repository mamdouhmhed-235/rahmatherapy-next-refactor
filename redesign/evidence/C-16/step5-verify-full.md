# C-16 Phase C Step 5 — FULL verification (commit `ca0cc21`)

VERDICT: PASS

Scope note: another agent is concurrently landing Steps 6-7 in the working
tree (`page.tsx`, `BookingsChrome.tsx`). At the start of this review the
working tree was byte-identical to `ca0cc21` for all three of this step's
files (`git diff ca0cc21 -- src/app/admin/bookings/` was empty). Partway
through, the other agent's edits landed (`git diff --stat ca0cc21 --
src/app/admin/bookings/` later showed `BookingsChrome.tsx`, `page.tsx`, and
even `bookings-list-data.ts` modified). Every code-content claim below is
sourced from `git show ca0cc21:<path>` / `git show ca0cc21 -- <path>` /
`git diff ca0cc21~1 ca0cc21 -- <path>`, not the live working copy. The static
gates (§11) were run twice for this reason — see that section for the
timing caveat on the transient `BookingsChrome.tsx` lint noise.

---

## Check 1 — `git show ca0cc21 --stat`

```
 .../__tests__/view-predicates-parity.test.ts       | 869 +++++++++++++++++++++
 src/app/admin/bookings/bookings-list-data.ts       | 545 ++++++++++++-
 src/app/admin/bookings/page.tsx                    |  23 +-
 3 files changed, 1416 insertions(+), 21 deletions(-)
```
Exactly three files. `BookingsChrome.tsx` is NOT in this commit — confirmed
absent from the stat, and confirmed absent from
`git show ca0cc21:src/app/admin/bookings/bookings-list-data.ts` (no
`getBookingViewCounts` / `visibleBookingViews`, which exist only in the
current working tree — those are the other agent's Step 6 additions on top
of this commit). PASS.

---

## Check 2 — Independent re-derivation of all 11 views

Oracle: `filterBookings`, `src/app/admin/bookings/page.tsx:59-204` (as of
`ca0cc21`; re-read via `git show ca0cc21:...page.tsx`, since the working
copy has since moved on). Archive rule at `page.tsx:86-106`, view predicate
at `page.tsx:108-138`.

SQL: `buildBookingPredicatePlan`,
`src/app/admin/bookings/bookings-list-data.ts:262-390`. Archive rule at
`:285-292`, view switch at `:295-349`, post-view filters at `:351-387`.

Schema facts used below (verified read-only via `execute_sql` against the
live Postgres, project `twzutkfgqclqurvkmvqz`):
`status`/`assignment_status`/`payment_status` are `NOT NULL` enum columns;
`reschedule_status` is `NOT NULL text` default `'none'`;
`customer_cancelled_at`/`recurring_template_id` are nullable;
`booking_assignments.assigned_staff_id` is nullable `uuid`,
`booking_assignments.status`/`required_therapist_gender` are `NOT NULL`. No
column is unexpectedly nullable in a way that would make SQL `neq`/`eq`
diverge from JS `!==`/`===` (a nullable column compared with `neq` in
Postgres behaves differently from JS on `null`, and none of the compared
columns can be null).

| View | Oracle (page.tsx) | SQL (bookings-list-data.ts) | Verdict |
|---|---|---|---|
| `all` | `view==="all"`; archive rule skipped (`viewIsArchive` true) | `case "all": break` (no predicate); `notInert()` skipped since `viewIsArchive` true (`:290-292`, `:296-297`) | **MATCH** |
| `attention` | `status==="pending" \|\| assignment_status!=="fully_assigned" \|\| reschedule_status==="requested" \|\| Boolean(customer_cancelled_at)`, archive rule applies (`:110-114`) | `or("status.eq.pending,assignment_status.neq.fully_assigned,reschedule_status.eq.requested,customer_cancelled_at.not.is.null")` + `notInert()` (`:298-307`) | **MATCH** (see §10 for a fixture gap — clause 1 is never independently exercised, not a code defect) |
| `assigned` | `isOwnBooking` = `booking_assignments.some(a=>a.assigned_staff_id===profile.id)` (`access.ts:19-23`), archive rule applies | `eq(fv.assigned_staff_id, staffId)` via `!inner` embed alias `fv` (`:308-310`) | **MATCH** — EXISTS semantics equivalent to `.some()` |
| `claimable` | `!["cancelled","no_show"].includes(status) && booking_date>=today && hasClaimableAssignment(...)`; `hasClaimableAssignment` requires `canClaimAssignments`, not cancelled/no_show, not past, and one assignment row with `status==="unassigned" && !assigned_staff_id && required_therapist_gender===profile.gender` (`access.ts:25-43`) | `if(!canClaim) id.in.()`; else `notInert()` (repeated) + `gte(booking_date,today)` + `eq(fv.status,"unassigned")` + `isNull(fv.assigned_staff_id)` + `eq(fv.required_therapist_gender,staffGender)`, all on the SAME alias `fv` (`:311-325`) | **MATCH** — all three assignment-row conditions share alias `fv`, which is PostgREST's documented "same joined row" semantic, exactly mirroring the oracle's single `.some()` predicate. See §10 for an un-exercised sub-clause (not a defect). |
| `today` | `booking_date===today` | `eq("booking_date", today)` (`:326-328`) | **MATCH** |
| `upcoming` | `booking_date>=today && status!=="completed"` | `gte("booking_date",today); neq("status","completed")` (`:329-332`) | **MATCH** — this is the clause the implementer's own sabotage run previously found missing (fixed with fixture B14, now genuinely isolated — see §10) |
| `unassigned` | `assignment_status==="unassigned"` | `eq("assignment_status","unassigned")` (`:333-335`) | **MATCH** |
| `partially_assigned` | `assignment_status==="partially_assigned"` | `eq("assignment_status","partially_assigned")` (`:336-338`) | **MATCH** |
| `completed` | `status==="completed"` | `eq("status","completed")` (`:339-341`) | **MATCH** |
| `cancelled` | `["cancelled","no_show"].includes(status)`, archive rule skipped | `in("status",["cancelled","no_show"])`, `notInert()` skipped (`:342-344`) | **MATCH** |
| `series` | `templateId ? recurring_template_id===templateId : recurring_template_id!==null`, archive rule skipped (cancelled/no_show occurrences stay visible) | `eq("recurring_template_id",templateId)` else `notNull("recurring_template_id")`, `notInert()` skipped (`:345-348`) | **MATCH** on code logic. **But the "cancelled included" claim is untested** — see §10, this is the top finding of this review. |

All 11 views: code-level MATCH. No functional divergence found by manual
trace. Three fixture/test-coverage gaps found (detailed in §10) — none of
them are implementation bugs; each is a place the parity spec's 14-fixture
corpus cannot currently distinguish the shipped predicate from a strictly
weaker one.

---

## Check 3 — The C-05 archive escape rule

`userWantsInertStatus = ctx.status==="cancelled" || ctx.status==="no_show"`
and `viewIsArchive = view==="cancelled"||"all"||"series"`
(`bookings-list-data.ts:288-291`), identical in shape and effect to the
oracle's `page.tsx:92, 98-99`. `ctx.status` comes from
`bookingListFiltersFromQuery`'s `value("status")` (`:474-499`), which reads
the raw `status` query param and returns `undefined` for absent/empty — it
cannot be populated by anything except an explicit operator selection in the
Status dropdown. No default value, no code path sets it to `"cancelled"` or
`"no_show"` implicitly. The escape cannot be triggered accidentally.

The `claimable` case additionally calls `notInert()` a second, unconditional
time (`:320`, comment at `:317-319` explains why: claimable must stay
strict even when the operator explicitly opts into cancelled/no_show
elsewhere). Verified via the parity spec's own case
`view=claimable + status=cancelled` (test file `:610-615`), which asserts an
empty result — I traced this by hand: the unconditional `notInert()` adds a
second `status NOT IN (cancelled,no_show)` and the post-view filter (`:352`)
adds `eq(status,"cancelled")`; these are contradictory, giving zero rows,
which matches the oracle (its `claimable` branch checks
`!["cancelled","no_show"].includes(status)` regardless of the status filter,
`page.tsx:118-119`). PASS.

---

## Check 4 — PostgREST alias semantics (the subtlest point)

Four aliases, one table each two of which repeat: `fv`/`fg`/`fa` →
`booking_assignments`, `fs` → `booking_items`
(`bookings-list-data.ts:182-191`).

Traced `view=assigned` + `assigned_staff=<different person>` by hand using
fixture B12 (`view-predicates-parity.test.ts:262-287`), which carries TWO
`booking_assignments` rows: one for `STAFF_A`, one for `STAFF_B`.
- View predicate: `eq(fv.assigned_staff_id, STAFF_A)` — satisfied by B12's
  first assignment row.
- Post filter: `eq(fa.assigned_staff_id, STAFF_B)` — satisfied by B12's
  second assignment row.
Because `fv` and `fa` are DIFFERENT aliases, PostgREST renders these as two
independent `!inner` embeds → two independent `EXISTS`-style joins, each
free to match a different row of the same booking's assignment set. This is
exactly what the oracle does (two independent `.some()` calls,
`page.tsx:115` and `:161-166` for `isOwnBooking`/`assignedStaff`
respectively) — a booking with two different assignment rows satisfies
both independently.

If `fv` and `fa` had been collapsed to ONE shared alias, PostgREST's
documented semantic is that every filter carrying that alias must hold on
the SAME joined row — that would require one single assignment row with
`assigned_staff_id = STAFF_A AND assigned_staff_id = STAFF_B`
simultaneously, which is impossible unless `STAFF_A === STAFF_B`. B12 would
then wrongly return zero rows for this combination, contradicting the
oracle. The parity spec's case `"view=assigned + assigned_staff=<someone
else> — two INDEPENDENT EXISTS"` (test file `:704-708`, expects `["B12"]`)
is precisely the regression test for this collapse. I did not have a live
PostgREST HTTP endpoint to fire an actual duplicate-alias probe against (only
`execute_sql`, which runs against raw Postgres, bypassing PostgREST's query
layer) — the alias-scoping behaviour verified above rests on PostgREST's
documented embedded-resource-filter semantics plus the parity spec's own
recording-and-replay evaluator (`view-predicates-parity.test.ts:514-560`),
which enforces "all filters on one alias must hold on the same embedded row"
in its interpreter (`:548-557`) and independently reproduces B12's result.
PASS — the four-alias design is necessary and correctly applied.

---

## Check 5 — Count/range structural equivalence (adversarial)

Only caller of `getBookingsListData`/`countBookings` in the whole tree is
`getBookingsListPage` (`bookings-list-data.ts:841-873`) — confirmed via
`grep -rn "getBookingsListData\|countBookings\|getBookingsListPage" src/app`
excluding the data-helper file itself and tests: the single hit is
`page.tsx:307` calling `getBookingsListPage`. There is no other entry point
into these two functions.

Inside `getBookingsListPage`, the SAME `predicates` object (one JS object
literal, `:855-862`) is passed to both `getBookingsListData` (`:868`) and
`countBookings` (`:869`) via `Promise.all`. `buildBookingPredicatePlan` is a
pure function of its `ctx` argument (no `Date.now()`/randomness inside it —
`ctx.today` is supplied by the caller) — so calling it twice
(`bookings-list-data.ts:675` inside `getBookingsListData`, `:768` inside
`countBookings`) on the identical object necessarily produces an identical
`{embeds, steps}` plan both times. One correction to the file's own header
comment (`:134-137`, "handed to `buildBookingPredicatePlan` once"): the
function is actually invoked twice, once per consumer — the comment
overstates it slightly, but because the function is pure and deterministic
this is not a bug, just an imprecise description worth tightening.

Checked for the specific adversarial shapes named in the dispatch:
- **Default parameter divergence**: `countBookings` never receives
  `limit`/`offset` (it doesn't accept them) — correct, since a COUNT should
  never be windowed to a page.
- **Early return**: the `!canViewAll` branch (`:850-853`) never calls
  `countBookings` at all; `total: rows.length` is derived from the same
  array it returns, so there is no separate WHERE clause to diverge from.
- **Conditional embed**: `bookingSelectWith(BOOKING_SELECT, plan?.embeds??[])`
  (row query, `:688`) vs `bookingSelectWith("id", plan?.embeds??[])` (count
  query, `:776`) — both read `plan.embeds` from their own locally-computed
  but input-identical `plan`, so the embed list is always identical between
  the two.
- **Filter applied outside `applyBookingPredicates`**: none found — `.order()`
  and `.range()` (row query only, `:691-699`) do not add predicates, and the
  count query has neither.

PASS — no path found where the two queries could diverge.

---

## Check 6 — Cache key

`getBookingsListData`'s key (`:738-751`) includes `staffId`, `staffGender`,
`canViewAll`, `canClaim`, `limit`, `offset`, and `predicates` explicitly.
`countBookings`'s key (`:785`) is `cacheKeyPart({ predicates })` only — but
`predicates` (type `BookingPredicateContext`,
`bookings-list-data.ts:217-225`) itself carries `staffId`, `staffGender`,
and `canClaim` as fields, so the staff-scoped values are present in both
keys, just nested in one and flattened+duplicated in the other. Functionally
equivalent, stylistically asymmetric — not a defect.

JSON-safety: `BookingPredicateContext` is `view/status/.../search/templateId`
(all `string|undefined`), `today`/`staffId`/`staffGender` (`string`),
`canClaim` (`boolean`), `searchClientIds` (`string[]`) — every field is a
JSON primitive or array of primitives. No `Set`/`Map`/`Date` anywhere in the
interface. Grepped the whole file for `new Set(`/`new Map(`/`new Date(`: the
only hits are the pre-existing (C-09, untouched by this commit) `new Set(...)`
de-duplication inside `getScopedBookingIds` (`:530, 533`), which converts
back to `string[]` via `Array.from(...)` before returning — it never crosses
a cache key or a cached return value as a `Set`. PASS.

One latent (not currently manifest) fragility: `cacheKeyPart`
(`src/lib/cache/cache-key.ts:19-28`) only sorts its TOP-LEVEL keys before
`JSON.stringify`; it does not deep-sort nested objects. Since `predicates`
is passed as the same object reference to both cache-key calls here, this
doesn't cause a divergence today — but a future change that reconstructs an
equivalent-but-differently-ordered `predicates` object for one call and not
the other would silently split the cache entry (a cache-miss inefficiency,
not a data leak). Not a defect in this commit; worth knowing.

---

## Check 7 — Therapist-scoped branch

Diffed `ca0cc21~1` → `ca0cc21` (`git diff ca0cc21~1 ca0cc21 --
bookings-list-data.ts`): the scoped (`!canViewAll`) branch's two reads
(`:704-718`, `:719-732`) are unchanged except for one added
`.limit(SCOPED_BRANCH_ROW_CAP)` per branch (`:714`, `:728`) plus the
`SCOPED_BRANCH_ROW_CAP = 200` constant and its comment (`:640-649`). No
`.range()` was added — confirmed by re-reading the whole branch: it still
does two `.in("id", […])` reads, still `.sort(...)` merges them in memory
(`:733-736`). The prior version (`ca0cc21~1`) had no `.limit(...)` at all on
these two reads (confirmed via `git show ca0cc21~1:...` — no
`SCOPED_BRANCH_ROW_CAP` string present), so this is a genuinely new,
minimal, defensive addition exactly matching the plan's ask. PASS.

---

## Check 8 — The two pinned narrowings

Both are real vitest assertions (`view-predicates-parity.test.ts:840-868`),
not just comments, so a future regression that widens or narrows them would
fail the suite. Both independently re-derived by hand:

1. **Partial booking-id search.** Oracle joins `[booking.id, ...]` and does
   substring `.includes()` (`page.tsx:184-199`), so any fragment of the id
   matches. SQL only adds the `id.eq.<search>` arm when `isUuid(ctx.search)`
   is true (`bookings-list-data.ts:251-255, 381`) — a valid reason
   (`uuid.ilike` doesn't exist in Postgres, `PostgREST` has no cast syntax in
   filter params). Genuinely pinned. **However, I judge this narrowing to be
   a bigger real-world behaviour change than its description ("a partial id
   fragment no longer matches") suggests.** The booking detail page renders
   exactly this fragment as the user-facing reference:
   `src/app/admin/bookings/[bookingId]/page.tsx:1267-1270`:
   ```
   function shortRef(id: string) {
     if (!id) return "—";
     return `#${id.slice(0, 8).toUpperCase()}`;
   }
   ```
   This is the id format the app itself trains staff to use when referring
   to a booking (an 8-char prefix, shown prominently on the detail page).
   Pre-Step-5, pasting that exact reference into the bookings list search
   box would have found the booking (substring match against the full id).
   Post-Step-5, on the `canViewAll` (SQL) path, that same paste now silently
   returns zero rows, with no error and no indication why. This is not a
   contrived edge case — it is the id shown to the user, undersold as "a
   partial id fragment." Not a blocking defect (it is caught, deliberate,
   and pinned), but worth surfacing to the user/reviewer explicitly, and
   worth updating the narrowing note to reference `shortRef` by name so a
   future reader doesn't underestimate it.

2. **Cross-field-boundary search term.** Oracle's join produces a single
   string where two adjacent fields' values sit back-to-back with one space
   between them; a search term that happens to exactly span that boundary
   (e.g. "zainab iqbal zainab@example.test", spanning
   `contact_full_name` + `contact_email` on fixture B12) matches the joined
   string but no single column's `ilike`. Traced by hand against B12's
   fixture values (`view-predicates-parity.test.ts:262-287`) — confirmed the
   join order (`page.tsx:184-193`) puts `contact_full_name` immediately
   before `contact_email`, so the concatenation is exact. This requires a
   user to type both a name and an email (or similarly two field values) in
   one search box with exact spacing — a genuinely obscure case, fairly
   described. PASS, adequately pinned and adequately described.

---

## Check 9 — `getSearchClientIds`'s 200-cap

`SEARCH_CLIENT_ID_CAP = 200` (`bookings-list-data.ts:800`),
`.limit(SEARCH_CLIENT_ID_CAP)` (`:817`) with **no `.order()`** before it.
If a search term matches more than 200 clients, only some
(Postgres/PostgREST's default, unordered-query row order — not guaranteed
stable) 200 client ids populate `searchClientIds`, and the
`client_id.in.(…)` arm (`:384`) only matches bookings for those 200. A
booking whose OWN snapshot fields (`contact_full_name`/`email`/`phone`,
`:375-378`) still match the search term is unaffected (those arms are
unconditional, independent of the client cap) — so under-matching only
bites a booking whose contact snapshot has gone stale (client's name/email
changed since the booking was made) relative to the *current* client search,
combined with that client falling outside the arbitrary (unordered) first
200. This is a narrow but real, currently **untested** edge case — no
fixture in the parity spec has more than 2 real clients, so the 200-cap
boundary is never exercised. Confirmed the fallback (booking's own
`contact_*` columns) still matches regardless of the cap, as claimed.
Flagging as an untested edge case, not a defect in the shipped logic.

---

## Check 10 — The parity spec's teeth (highest-value check)

The implementer's own history: sabotage #5 (dropping `upcoming`'s
`status!=completed`) initially passed because every `completed` fixture
was also past-dated; fixed by adding B14 (future-dated + completed,
`view-predicates-parity.test.ts:309-317`), which now correctly isolates
that clause. I looked for the same class of hole across the other 10 views
and found three:

1. **`attention`'s `status.eq.pending` clause is never independently
   tested.** The only `pending` fixture is B1
   (`view-predicates-parity.test.ts:165-172`), and B1's
   `assignment_status` is also overridden to `"unassigned"` — so B1 already
   satisfies clause 2 (`assignment_status.neq.fully_assigned`) on its own.
   If a regression removed or broke the `status.eq.pending` arm entirely,
   B1 would still appear in the `attention` results via clause 2, and the
   case at `:578-583` (expected `["B1","B3","B4","B5","B6","B7","B8"]`)
   would still pass. **Concrete gap**: no fixture has `status: "pending"`
   with `assignment_status: "fully_assigned"` (or otherwise not matching
   any other attention clause) — that fixture would be needed to prove
   clause 1 does anything. The shipped code (`:301`,
   `"status.eq.pending"`) is present and looks correct on inspection; this
   is a coverage gap in the test, not an observed implementation bug.

2. **`claimable`'s `isNull(fv.assigned_staff_id)` check is never
   independently tested.** Every fixture's `assignment()` helper
   (`:88-100`) pairs `status: "unassigned"` with `assigned_staff_id: null`
   by default, and every override that sets a non-null `assigned_staff_id`
   also sets `status: "assigned"`/`"completed"`. No fixture has an
   assignment row with `status: "unassigned"` AND a non-null
   `assigned_staff_id` — so dropping the `isNull` step
   (`bookings-list-data.ts:323`) from the plan would not change the result
   of the single `claimable` case (`:604-608`, expected `["B6"]`) on this
   corpus, since the `eq(fv.status,"unassigned")` check alone already
   excludes every other candidate row. Same caveat: the shipped code has
   the check; only the test's ability to prove it matters is missing.

3. **`series`'s "cancelled included" claim is asserted by name but not by
   data — the closest repeat of the exact gap-class the implementer already
   found once.** The test is literally named `"view=series — every
   recurring occurrence, cancelled included"` (`:662`) but its expectation
   is `["B11","B12"]` (`:665`) — B11 is `status: "completed"`
   (`:250`), B12 is the default `"confirmed"` (`:262-287`, no `status`
   override) — **neither fixture is cancelled or no_show.** No fixture in
   the 14-row corpus combines a `recurring_template_id` with
   `status: "cancelled"` or `"no_show"`. So if a future change accidentally
   added `notInert()` unconditionally to the `series` case (treating it
   like a non-archive view, contradicting the explicit design comment at
   `:290-291` and `page.tsx:98-99`'s matching intent), this spec would not
   catch it — the exact same shape of blind spot that let the `upcoming`
   sabotage through before B14 was added. Recommend a 15th fixture (a
   recurring, cancelled booking) to close this, mirroring how B14 closed the
   `upcoming` gap.

I looked for the equivalent property on the other two archive-rule views
(`all`, `cancelled`) and found them properly covered: `all`'s expected set
(`ALL_LABELS`, `:577`) includes B9 (cancelled) and B10 (no_show)
(`:231-246`), and `cancelled`'s own tests are inherently about those
statuses — so only `series` has this gap.

Everything else I traced (the 8 remaining views, the post-view filters,
the two independent-EXISTS cases) has at least one fixture that would fail
if the corresponding clause were dropped or weakened — I did not find
further gaps of this class.

---

## Check 11 — Static gates

**tsc**: `npx tsc --noEmit` → 0 errors (run twice, once early and once after
the other agent's Step 6/7 edits landed in the working tree; both times
clean).

**vitest**: `npx vitest run` →
```
Test Files  2 failed | 174 passed (176)
     Tests  5 failed | 1557 passed (1562)
```
Failures, by identity: `admin-access.test.ts` ×2 (`gives Owner broad
access...`, `gives Admin broad operational access...`) +
`ManualBookingForm.test.tsx` ×3 (`renders step 1 on first load`, `moves
focus to the first invalid field...`, `shows the consent error...`) —
exactly the inherited baseline (2 files, 5 tests), no new failures, no
missing ones. The new parity spec passed in full on its own:
`npx vitest run .../view-predicates-parity.test.ts` → `35 passed (35)`, run
twice (before and after the other agent's later edits), both green.

**eslint**: `npx eslint . -f json` — first run (mid-way through the other
agent's concurrent edit to `BookingsChrome.tsx`) transiently showed 2 extra
errors in that file; a `git diff ca0cc21 -- .../BookingsChrome.tsx` at that
moment confirmed the file was mid-edit (uncommitted, not part of `ca0cc21`).
A second, clean re-run gave:
```
TOTAL ERRORS 59  TOTAL WARNINGS 7
```
across exactly six files: `design_handoff_area_pages/prototype/{area-page,
shared,site-chrome}.jsx` and `src/features/booking/{BookingExperience.tsx,
BookingExperienceLoader.tsx,utils/returning-customer.ts}` — this is the
inherited baseline exactly, by identity. Neither `bookings-list-data.ts`,
`page.tsx`, nor the new parity spec produced a single lint error or warning
in either run. PASS, with the caveat that the transient `BookingsChrome.tsx`
noise belongs to the concurrently-landing Step 6/7 work, not to `ca0cc21`.

---

## Check 12 — Code hygiene

- `border-l-4`: no hits in any of this commit's three files.
- `revalidateTag(`: no hits.
- `new Set(`/`new Map(`/`new Date(` crossing `unstable_cache`: none — the
  only `new Set(...)` usages (`:530, 533`) are pre-existing (C-09), converted
  to `string[]` via `Array.from` before being returned or keyed, never
  themselves cached or keyed.
- `createSupabaseAdminClient()` ordering: `page.tsx:217` awaits
  `getStaffProfile(supabase)` before any bookings data fetch; every
  `createSupabaseAdminClient()` call in `bookings-list-data.ts` (`:516, 627,
  690, 783, 818` per the ca0cc21 line numbers) lives inside a cached fetcher
  invoked later in the render, after the profile/permission checks
  (`page.tsx:215-227`). No call precedes `getStaffProfile`.

All PASS.

---

## Summary

The SQL predicate plan in `buildBookingPredicatePlan` correctly reproduces
`filterBookings`' semantics for all 11 views on independent, line-by-line
re-derivation — I found no case where the shipped SQL selects a different
row set than the oracle would. The count/row structural-equivalence and
cache-key designs hold up under adversarial review (single call site, pure
plan builder, JSON-safe staff-scoped context in both keys). Static gates
match the inherited baseline by identity.

Three real gaps were found in the *parity spec's* ability to catch a future
regression (not in the shipped implementation): `attention`'s
`status.eq.pending` clause, `claimable`'s `isNull(assigned_staff_id)` check,
and — most notably, as it is the same shape of hole the implementer already
found once for `upcoming` — `series`'s untested "cancelled occurrences stay
visible" claim. One documented narrowing (partial-UUID search) is
correctly pinned but underdescribes its real-world blast radius given the
booking detail page trains users to search on exactly that truncated id
format. One edge case (the 200-client search cap) is unexercised by any
fixture. None of these block this commit — they are follow-up-worthy
findings for the parity spec and its documentation, not defects in the SQL
predicates themselves.
