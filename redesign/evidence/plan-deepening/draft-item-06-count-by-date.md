## ITEM 6 — Adjustment lists must count and cap by DATE, not by segment row

*(Added 2026-08-10 at the Owner's confirmation — this replaces the mistaken "Maps cookie label" line in their list. In scope, Option A, per the Owner decision log. §11 records the resolution.)*

### 6.1 The problem

Before C-14, a unique constraint guaranteed **one row per override date**, so "rows" and "dates" were the same number and every cap, count and badge could use rows interchangeably. **C-14 Phase C dropped those uniques.** A date with a break is now 2+ rows. Every row-based number on these surfaces silently became wrong:

- `AVAILABILITY_PAST_CAP = 25` now means "25 **segment rows**", so "25 past adjustments" can be as few as ~8 actual dates.
- The `count: "exact", head: true` totals count rows, so the "view all N" figure overstates how many dates exist.
- `.limit()` is row-based, so a cap boundary can fall **mid-date** and render a date with only some of its hours.

Both override tables hold **0 rows** today (re-confirmed live this pass, along with `blocked_dates`/`staff_blocked_dates`, all four at 0). This is a latent correctness bug, not a live one — there is nothing to observe in production, and verification must say so rather than claim a live check.

### 6.2 What is already correct — do not re-fix it

- The week-capacity chip on `/admin/availability` was fixed in `0bc2a02` (`weekAdjustments={weekAdjustmentsByDate.size}` at `page.tsx:488`, re-verified live). **Leave it.**
- `resolveAvailabilityBannerState` (`availability-data.ts:63-79`) and `resolveStaffAvailabilityBannerState` (`lib.ts`, same shape) are **pure and unit-agnostic** — they take `pastTotal` / `pastShown` / `viewAll` and only compare numbers; they never inspect what the numbers count. Feed them date counts and they behave correctly **with no change to the functions themselves**. Do not touch their logic; in particular do not reorder the `cappedOut`-before-`hidden` check (re-verified in place: `cappedOut` at line 69, `hidden` at line 72), which is deliberate and has already regressed twice historically (privacy's notes rail, then password-requests — both guarded today by the existing `"SABOTAGE TARGET"` test).
- Both managers already compute `groupByDate(...)` into `upcomingDays` / `pastDays` (`AvailabilityOverridesManager.tsx:146-147`, `StaffAvailabilityOverridesManager.tsx:149-150`, both via `useMemo`). **The date-grouped structure exists** — it is simply not the thing being counted: the badge/`pastShown`/"N of M" text at every cited site below still reads `past.length` / `upcoming.length` (row counts), never `pastDays.length` / `upcomingDays.length`.
- **`BlockedDatesManager.tsx` and `StaffBlockedDatesManager.tsx` import the same shared constants and resolvers** — `AVAILABILITY_PAST_CAP`, `AVAILABILITY_PAST_VIEW_ALL_CAP`, `resolveAvailabilityBannerState` (`BlockedDatesManager.tsx:19-21`, used at `:91,392,398,416`) and the `STAFF_*` equivalents (`StaffBlockedDatesManager.tsx`, same shape). **`blocked_dates` / `staff_blocked_dates` were not touched by the C-14 migration that dropped the override tables' unique constraints** and remain one row per date (confirmed: no `groupByDate`/segments concept anywhere in either blocked-dates manager). For blocked dates, rows and dates are and stay identical, so:
  - The `.limit()` calls feeding `BlockedDatesManager`/`StaffBlockedDatesManager` are **already correct**. Option A does not touch them.
  - The two resolver functions are unchanged (this section doesn't touch their logic at all), so the blocked-dates managers calling them with already-correct row(=date) counts continue to behave identically.
  - **Do not edit `BlockedDatesManager.tsx` or `StaffBlockedDatesManager.tsx` as part of this item.** The only realistic way this item leaks into them is an implementer "helpfully" updating the blocked-dates call sites to match the *comment* change on `AVAILABILITY_PAST_CAP`/`AVAILABILITY_PAST_VIEW_ALL_CAP` (see 6.4) — the comment change applies to the overrides consumers only; the shared constants keep the same values and the same meaning for the blocked-dates consumers.

### 6.3 Two options — recommendation first

**➤ OPTION A (RECOMMENDED, Owner-selected) — group in code under a defensive row ceiling, with saturation disclosure. No migration, no Zone-2.**

Fetch override rows under a defensive **row** ceiling, group them by date in the page, slice to N **dates**, and pass the flattened rows plus honest date totals to the manager.

Why this is the right call here, rather than a bigger fix:

1. **Proportionate to the real data.** `availability-data.ts`'s own header projects **~25–100 overrides over 5 years**. Even at 3 segments each that is a few hundred rows. This is not `bookings`.
2. **It is the idiom this very file already established.** The header defines the upcoming bucket as *"a defensive ceiling, not a truly unbounded read"*, citing the `SCOPED_BRANCH_ROW_CAP` (`bookings-list-data.ts:660`, value `200`) / `PRIVACY_NOTES_VIEW_ALL_CAP` (`privacy-data.ts:63`, value `500`) precedent — both re-verified live, exact names and values. **One caveat carried forward, not previously stated:** `SCOPED_BRANCH_ROW_CAP` is a pure defensive ceiling with **no** saturation-disclosure UI — it silently truncates with no "N+" indicator anywhere in the codebase. It is a valid precedent for the row-fetch-ceiling half of this design (6.4), but **there is no existing precedent anywhere in this codebase for the lower-bound disclosure UI** this item also requires (6.5). Treat 6.5 as new ground, not an application of an existing pattern.
3. **It matches how the codebase already resolved the identical trade-off.** C-16 accepted a capped-not-paginated `getClientCandidates` precisely because the exact fix required Zone-2. Same reasoning, same conclusion.
4. **It cannot silently lie** — see 6.5.

**OPTION B (escalation, not being built) — a grouped view per table.**

```sql
CREATE VIEW public.availability_override_dates
  WITH (security_invoker = true) AS
  SELECT override_date, count(*) AS segment_count
  FROM public.availability_overrides GROUP BY override_date;
```
…and a `(staff_id, override_date)` equivalent, each with `GRANT SELECT … TO service_role`. PostgREST would then `.limit()` and `count: "exact", head: true` over **dates** natively, exactly, forever. `security_invoker = true` is not optional — it matches the deliberate `SECURITY INVOKER` choice made for the C-14 RPCs.

**Costs:** a Zone-2 migration, two new database objects, and a second query per bucket. **PostgREST aggregates are confirmed disabled on this project** — re-verified live this pass via a direct REST probe (`select=override_date.count()` against `availability_overrides`, anon key, a public client-facing credential, read-only GET): `HTTP 400 PGRST123 "Use of aggregate functions is not allowed"`. A follow-up probe without the aggregate returned a *different* error (`401`/`42501`, a permissions error), which fired only because the request first passed PostgREST's validation layer — proving the `PGRST123` block is a project-wide config setting, not a permissions artifact that would clear once grants are fixed. This is why a view is the mechanism, and why Option B cannot be simplified further.

**Option A is the item being built.** Option B is documented for completeness only; do not build it without a separate, explicit Owner request.

### 6.4 Option A — exact changes

**Anchors below are re-verified against the live tree this pass (byte-identical to `33f895f`) — RE-LOCATE BY SYMBOL and report drift rather than trusting these numbers if the file has moved since.**

**Constants** — `src/app/admin/availability/availability-data.ts` (`AVAILABILITY_PAST_CAP` at line 44, `AVAILABILITY_PAST_VIEW_ALL_CAP` at line 45, `AVAILABILITY_UPCOMING_DEFENSIVE_CAP` at line 47) and, duplicated, `src/app/admin/staff/[staffId]/availability/lib.ts` (`STAFF_AVAILABILITY_PAST_CAP`, `STAFF_AVAILABILITY_PAST_VIEW_ALL_CAP`, `STAFF_AVAILABILITY_UPCOMING_DEFENSIVE_CAP`, same shape):

- Keep `*_PAST_CAP = 25` and `*_PAST_VIEW_ALL_CAP = 200` at the same values, but **their unit changes from rows to dates**. Update the surrounding comments to say so explicitly for the overrides consumers — a constant whose meaning silently changed is exactly the trap this fix exists to remove. Do **not** word the comment in a way that reads as applying to `BlockedDatesManager.tsx`/`StaffBlockedDatesManager.tsx` too (6.2) — those consumers are unaffected and must stay untouched.
- Add a row-fetch ceiling, e.g. `AVAILABILITY_PAST_ROW_FETCH_CEILING = 800`, with its reasoning in a comment: it must comfortably cover `PAST_VIEW_ALL_CAP` (200 dates) × a realistic worst-case segments-per-date (~4).
- Add a new, exported, pure helper — **do not confuse this with either of the two `groupByDate` functions that already exist** (see the "three groupByDate-shaped things" note below). Suggested signature:
  ```ts
  function groupAndCapPastByDate(
    rows: AvailabilityOverride[],
    opts: { dateCap: number; rowTotal: number }
  ): { flattenedRows: AvailabilityOverride[]; dateTotal: DateTotal };

  type DateTotal = { kind: "exact"; value: number } | { kind: "atLeast"; value: number };
  ```
  It groups the fetched rows by `override_date`, slices to the first `dateCap` distinct dates, flattens back to rows (not `OverrideDay[]` — see below), and computes `dateTotal` per 6.5. `page.tsx` calls it once per bucket, after the row-ceiling fetch, passing `rows.length` and the existing exact `count` as `rowTotal`.
- **This is a third, distinct implementation from what already exists**, and the plan must say so or two implementers can produce incompatible shapes:
  1. The manager's own private `groupByDate` (`AvailabilityOverridesManager.tsx:75-100`, `StaffAvailabilityOverridesManager.tsx:66-91`) — unexported, builds `OverrideDay[]` purely for render grouping of whatever rows it was handed. **Leave this alone**; the manager keeps calling it exactly as today, on whatever `flattenedRows` the page now hands it.
  2. The page's existing `groupOverridesByDate` (week-chip only, feeds the `CapacityPreview` grid) — wrong job, no slicing/capping/saturation logic. **Leave this alone.**
  3. This new helper — page-level, decides *which rows* the manager receives (date-capped, not row-capped) and computes the honest date total / saturation flag. It must **not** try to reuse either of the above.
  Its output (`flattenedRows`) is what gets passed as the `past`/`upcoming` prop to the Manager — **do not** change the Manager's prop contract to accept `OverrideDay[]` directly; that would touch every call site in `AvailabilityOverridesManager.test.tsx` for no benefit, since the manager already groups internally.

**⚠️ Duplicate, do not share.** `availability-data.ts`'s header (lines 1-42) states the shape is *"duplicated (not shared)"* in the staff tree (line 38), and `lib.ts`'s header says the same in the other direction. **Do not introduce a shared module** for the new helper either — write it twice, once per tree, consistent with the codebase's existing, explicit choice.

**Queries** — `src/app/admin/availability/page.tsx` and `src/app/admin/staff/[staffId]/availability/page.tsx` (re-verified live, exact lines given, re-locate by symbol):

- Past bucket (admin `:287-292`, staff `:163-169`): replace `.limit(pastViewAll ? PAST_VIEW_ALL_CAP : PAST_CAP)` with `.limit(PAST_ROW_FETCH_CEILING)`, then call the new helper to group and slice to the date cap.
- Keep the existing `count: "exact", head: true` row-count queries for the past bucket (admin `:293-296`, staff `:170-174`). **Their role changes**: no longer the displayed total, they are the **saturation detector** (6.5).
- **Upcoming bucket also needs the helper, not just a relabeled display.** The upcoming query (admin `:275-280`, staff `:149-155`) already fetches under `AVAILABILITY_UPCOMING_DEFENSIVE_CAP = 500` rows, and there is already a matching exact-count query (admin `:283-286`, staff `:156-162`, both marked "Fix round (verify-FAIL Check 2, non-blocking)"). At current volume this bucket cannot saturate — but the same row/date unit mismatch exists here as in the past bucket: `upcomingTotal` must become a date count derived from the same grouping, and the badge condition at `AvailabilityOverridesManager.tsx:261-264` (`upcomingTotal > upcoming.length`) must compare **like units** once `upcoming.length` becomes `upcomingDays.length` — comparing a date-count total against a row-length would silently be wrong the moment it could disagree. Run the upcoming bucket's fetched rows through the same `groupAndCapPastByDate`-shaped helper (or an equivalent unconditional grouping call with no cap applied, since upcoming has no view-all step) so `upcomingTotal` and `upcomingDays.length` are both dates, and treat its saturation flag identically to the past bucket's, even though it is not expected to ever be reached. Do not special-case "upcoming can't saturate" into skipping the check — that was the exact assumption already disproven by "0 rows in production is what masked the row/date bug" (6.1 header).
- Ordering: both trees currently order the four override queries by `override_date` only (verified live, no secondary key anywhere). See 6.7 for the corrected relationship to item 3 — item 3's secondary sort is **not** a correctness prerequisite for this item, contrary to what an earlier draft of this section (and of item 3's own §3.4) implied.

**Managers** — `AvailabilityOverridesManager.tsx` and `StaffAvailabilityOverridesManager.tsx` (identical shape; sites re-verified live at `33f895f`, re-locate by symbol):

| Site | Now | Becomes |
|---|---|---|
| `AvailabilityOverridesManager.tsx:155` | `pastShown: past.length` | `pastShown: pastDays.length` |
| `AvailabilityOverridesManager.tsx:261-264` | `upcoming.length` / `upcomingTotal` in the badge | `upcomingDays.length` vs date-based `upcomingTotal` |
| `AvailabilityOverridesManager.tsx:264` | `` `· ${pastTotal} past` `` | same template, `pastTotal` now a date count |
| `AvailabilityOverridesManager.tsx:421` | `` `${past.length} of ${pastTotal}` `` | `` `${pastDays.length} of ${pastTotal}` `` |
| `AvailabilityOverridesManager.tsx:418` | `past.length > 0` (gates whether the `<details>` disclosure renders at all) | `pastDays.length > 0` — **add this row; a prior draft of this table omitted it while listing the staff-tree sibling below.** Truth-equivalent today (0 rows ⇔ 0 dates) but leaving one gate row-based and its sibling date-based is an inconsistency an implementer would otherwise reproduce verbatim. |
| `StaffAvailabilityOverridesManager.tsx:158` | `pastShown: past.length` | `pastShown: pastDays.length` |
| `StaffAvailabilityOverridesManager.tsx:272-275` | `upcoming.length` / `upcomingTotal` | `upcomingDays.length` vs date-based `upcomingTotal` |
| `StaffAvailabilityOverridesManager.tsx:275` | `` `· ${pastTotal} past` `` | same, date count |
| `StaffAvailabilityOverridesManager.tsx:458` | `` `${past.length} of ${pastTotal}` `` | `` `${pastDays.length} of ${pastTotal}` `` |
| `StaffAvailabilityOverridesManager.tsx:455` | `past.length > 0` | `pastDays.length > 0` |

`pastTotal` and `upcomingTotal` must arrive from the page already expressed in **dates** (per the `DateTotal` shape in 6.5, or the number extracted from it).

### 6.5 The saturation disclosure — exact plumbing

A previous attempt at this fix was **correctly halted** because shipping the totals half alone could make the "view all N" link **silently fail to appear** when older dates genuinely exist beyond the cap — trading a visible overcount for an invisible undercount. Option A must prevent this structurally, not just claim to:

- The date total is derived from rows actually fetched, so it is exact **whenever the fetch was complete**.
- Completeness is not assumed — it is **measured**: the existing exact row-count query gives the true row total; if `rowTotal > rowsFetched`, the fetch was truncated and the date total is a **lower bound**, not an exact figure.
- In that case the UI must render it as a lower bound (e.g. `200+`) and never as an exact figure. **A silent truncation here is a plan failure, not an acceptable simplification.**
- At the projected volume the saturated branch is unreachable on both the past and upcoming buckets — but it must still be implemented and unit-tested on both, because "unreachable" is exactly what was said about one-row-per-date before C-14.

**No existing precedent for a "lower bound" render exists anywhere in this codebase.** The one candidate — privacy's `cappedOut` banner (`src/app/admin/privacy/page.tsx`) — renders `{PRIVACY_NOTES_VIEW_ALL_CAP} of {notesTotal}` as an **exact** number, because its `notesTotal` comes from a true `count: "exact", head: true` query with no row-ceiling truncation risk. This item's case is different in kind: the row total is exact, but the **date total derived from a possibly-truncated row fetch** is not. Build this new, do not look for something to copy.

**Concrete spec:**

1. **Computed in:** the new helper (6.4), fed the row-ceiling-limited fetch result plus the exact `rowTotal`. Return type is the discriminated `DateTotal` shown in 6.4 — not a bare `number` — because when `saturated` is true, `days.length` (dates found *among the rows that were fetched*) is itself only a lower bound: there could be more distinct dates among the un-fetched rows.
2. **Carried in:** a prop change on both Manager components. Given `AvailabilityOverridesManager.test.tsx` already passes `pastTotal: 0` as a bare number at six existing call sites, prefer the **lower-diff option**: keep `pastTotal: number` and add a sibling `pastTotalIsLowerBound: boolean` (same for `upcomingTotal`/`upcomingTotalIsLowerBound` per 6.4's upcoming-bucket requirement), rather than replacing the prop with a `DateTotal` union. This is a genuine design choice with no forcing precedent — if an implementer strongly prefers the union type instead, that is fine, but do not improvise a third shape; pick one before touching the prop types (see Stop Conditions, 6.9).
3. **Rendered in:** `resolveAvailabilityBannerState`/`resolveStaffAvailabilityBannerState` must **not** learn about saturation — the lower-bound rendering is a **display-only** concern layered on top of the existing `cappedOut`/`hidden`/`viewingAll` banner text, inside the Manager's JSX wherever it currently interpolates `{bannerState.total}`. Render `` `${bannerState.total}+` `` instead of `` `${bannerState.total}` `` when the corresponding `*IsLowerBound` flag is true. This keeps the pure resolvers untouched.
4. **Logged:** there is no existing read-path logging sink in either `page.tsx`, and this codebase's audit-log usage is for admin *mutations*, not read-path anomalies. Default to a `console.warn` in the server component when `saturated` is true (cheap, visible in server logs, matches the "unreachable at current volume" framing) rather than adding a new logging sink or table. Do not spend effort building alerting for a branch that is unreachable at today's volume; the unit test in 6.6 is the permanent guard.

### 6.6 Blast radius

**Files to edit:**
- `src/app/admin/availability/availability-data.ts` (new constant, new helper, comment update)
- `src/app/admin/staff/[staffId]/availability/lib.ts` (same, duplicated)
- `src/app/admin/availability/page.tsx` (call the new helper for both the upcoming and past overrides buckets; leave the `blocked_dates` queries and week-window query untouched)
- `src/app/admin/staff/[staffId]/availability/page.tsx` (same)
- `src/app/admin/availability/AvailabilityOverridesManager.tsx` (6 sites: the 5 tabled in a prior draft plus `:418`, per 6.4)
- `src/app/admin/staff/[staffId]/availability/StaffAvailabilityOverridesManager.tsx` (5 sites, all previously tabled)

**Callers/consumers of every changed symbol** (checked via `Grep` for each exported symbol across `src/`):
- `AVAILABILITY_PAST_CAP`, `AVAILABILITY_PAST_VIEW_ALL_CAP`, `resolveAvailabilityBannerState` are imported by **three** files, not two: `admin/availability/page.tsx` (edited above), `AvailabilityOverridesManager.tsx` (edited above), and **`BlockedDatesManager.tsx`** (`:19-21,91,392,398,416`, re-verified live) — **not edited, per 6.2**.
- `STAFF_AVAILABILITY_PAST_CAP`, `STAFF_AVAILABILITY_PAST_VIEW_ALL_CAP`, `resolveStaffAvailabilityBannerState` are likewise imported by `staff/[staffId]/availability/page.tsx`, `StaffAvailabilityOverridesManager.tsx`, and **`StaffBlockedDatesManager.tsx`** — **not edited, per 6.2**.

**Proven NOT affected** (checked, found clean, command given):
- `src/app/booking/manage/` (the known trap for this plan) — `Grep` for `availability|AvailabilityOverrides|groupByDate|resolveAvailabilityBannerState|AVAILABILITY_PAST` (case-insensitive) across `actions.ts`, `ManageBookingForms.tsx`, `page.tsx` → **zero matches**. This route has no dependency on any item-6 symbol.
- `src/app/(public)/`, `src/features/`, `src/components/` — `grep -rln` for `AvailabilityOverridesManager|StaffAvailabilityOverridesManager|availability-data|resolveAvailabilityBannerState|resolveStaffAvailabilityBannerState` → **zero matches**. Nothing customer-facing consumes any item-6 symbol.
- `src/app/admin/calendar/page.tsx` — has an unrelated, same-named **local** `groupByDate(bookings: ReportBooking[])` at line 2093, unexported, different signature, no import relationship to either availability tree. A homonym, not a collision.
- `src/app/admin/availability/actions.ts` and `src/app/admin/staff/[staffId]/availability/actions.ts` (save/delete override mutations) — `grep -n "override_date\|\.limit(\|\.order("` shows only `.eq("override_date", date)` whole-date deletes; no ordering or capping logic present. Unaffected.
- `src/app/admin/availability/__tests__/actions.test.ts` and the staff-tree equivalent — test cache-tag invalidation on mutation only, no dependency on cap/count logic. Unaffected.
- `AvailabilityOverridesManager.test.tsx`'s six existing tests all pass `pastTotal: 0` and never assert a numeric relationship between `past.length` and `pastTotal` that only holds under row-counting — they should pass unmodified as a regression check, not require rewriting.

**Snapshots affected:** none. No `.snap` files exist anywhere in the repository (repo-wide fact, not scoped to this item); neither of the two component test files in these trees uses `toMatchSnapshot`.

**Shared with the public/customer site:** none — see "Proven NOT affected" above, `/booking/manage` included by name as required.

### 6.7 Relationship to item 3 — corrected

**A prior draft of this section stated that item 3's secondary sort is a correctness prerequisite for item 6 (that grouping is "only deterministic once segments of a date are contiguous and in time order"). That is wrong, and item 3's own §3.4 already says as much in different words ("does not stop a `.limit()` boundary falling mid-date... needs a view or RPC" — i.e. item 3 was never claimed to fix the capping problem even before item 6 existed). Correcting it here:**

- SQL's `ORDER BY` on a single column (`override_date` alone, which is what all four queries use today, re-verified live) mathematically guarantees that all rows sharing an `override_date` value are **contiguous** in the result set — a secondary sort key cannot affect this; it only orders rows *within* an already-contiguous same-date block. Contiguity was never at risk, with or without item 3.
- The manager's own `groupByDate` (both `.tsx` files) is `Map`-keyed on `override_date` (`byDate.get`/`byDate.set`, re-verified line by line in `AvailabilityOverridesManager.tsx:75-100`) — it merges same-date rows correctly by hash lookup regardless of their position in the array, and it separately re-sorts `day.segments` by `start_time` at the end (`:95-97`) before returning. It has never needed ordering from the database to group or display correctly.
- The row-fetch-ceiling truncation detector this item introduces (`rowTotal > rowsFetched`, an exact-count comparison) is likewise completely order-independent.
- **Net effect: item 3 provides no correctness benefit to item 6.** Neither the grouping, nor the truncation detection, nor the manager's own rendering depends on the database returning a deterministic secondary order. What item 3 actually buys — a deterministic `start_time` order for same-date rows *as returned by Postgres* — is redundant with the manager's own client-side segment sort, which already runs regardless.
- This item does **not** depend on item 3 shipping first. If the top-level plan table still sequences item 3 before item 6, that sequencing is harmless (item 3 is cheap and orthogonal) but should not be described as a hard dependency in item 3's or item 6's text, and an implementer should not block item 6 waiting on item 3 for correctness reasons. Item 3's own §3.4 caveat ("does not stop a `.limit()` boundary falling mid-date") is resolved by item 6 regardless of whether item 3 has landed, since item 6 replaces row-based `.limit()` with date-based slicing entirely on its own.

### 6.8 Ordering and prerequisites vs. other items

- **Item 3:** not a correctness prerequisite (6.7, corrected). Sequence-neutral; doing it first or not at all before item 6 makes no difference to item 6's correctness.
- **Item 4:** its own header states it is "the only Zone-2 item, unless item 6 takes Option B." Option A (this section) introduces no migration, so item 4's Zone-2 status is unaffected. No ordering interaction.
- **Item 7 (admin theming):** genuine file collision. Item 7 must recolor `oklch()` literals in the same six files item 3 and this item edit: `AvailabilityOverridesManager.tsx`, `StaffAvailabilityOverridesManager.tsx`, `availability-data.ts`, `lib.ts`, `admin/availability/page.tsx`, `staff/[staffId]/availability/page.tsx`. **Sequence items 3 and 6 fully before item 7 touches those six files** — re-grep for `oklch(` on all six immediately before item 7 starts them, do not trust a stale count. The oklch literal count for these six files is **23 by unique source line** (the plan's stated figure) but **26 by raw occurrence** (two lines carry two literals each). State explicitly which counting method any item-7 ratchet guard uses, and seed its baseline from that method's actual output on the post-item-6 tree, not from either number quoted here — item 6's edits to these files (new helper calls, prop renames) will not add or remove `oklch()` literals themselves, but the guard must be re-run after item 6 lands, not assumed unchanged.
- **`BlockedDatesManager.tsx` / `StaffBlockedDatesManager.tsx`:** deliberately excluded from this item (6.2, 6.6). If item 7 recolors these files too (they are not among the six above, but do carry their own literals as admin-tree files), that is independent of this item and carries no interaction.

### 6.9 Verification

**Type check and full suite — must move / must NOT move:**
```bash
npx tsc --noEmit
# must stay 0, silent, exit 0 (current baseline)

npx vitest run src/app/admin/availability/__tests__/availability-data.test.ts
npx vitest run src/app/admin/staff/[staffId]/availability/__tests__/lib.test.ts
npx vitest run src/app/admin/availability/AvailabilityOverridesManager.test.tsx
# regression check only for the third — no new assertions required there

npx vitest run
# full suite MUST stay at the documented baseline identity: 5 failed / 2236 passed (2241),
# the SAME five named failures (admin-access.test.ts x2, ManualBookingForm.test.tsx x3).
# A different count, or the same count with a different test swapped in, is a FAIL.

pnpm lint
# must stay at 59 errors / 7 warnings in exactly the six files already named in the
# session baseline. This item touches none of those six files, so this should be
# unaffected — confirm with an actual run, do not assume.
```
**Must move:** the two `__tests__/*.test.ts` files' `it(...)` counts increase by the number of new tests added (6.10). Record the exact before/after count when implementing.
**Must NOT move:** `npx tsc --noEmit` stays at 0; the full-suite totals stay at exactly 5 failed / 2236 passed / 2241 total with the same five named failures; `pnpm lint`'s 59/7 in the same six files.

**No live E2E check is possible.** Both override tables hold 0 rows (re-confirmed live this pass), so there is nothing to observe in production. State this in the verification writeup rather than claiming a live check, and do not fabricate rows to exercise it — that would be a Zone-2 write this item is not scoped to make.

### 6.10 Tests to add

All six are pure-function tests (no React, no DB), added as new `it(...)` blocks inside the existing `describe(...)` for each file — do not create new test files for these:

| Test name (as it would read in `it(...)`) | File |
|---|---|
| `groups three same-date segment rows into one date` | `src/app/admin/availability/__tests__/availability-data.test.ts` |
| `groups three same-date segment rows into one date` | `src/app/admin/staff/[staffId]/availability/__tests__/lib.test.ts` |
| `slices to exactly PAST_CAP dates when more exist` | both files above |
| `slices to PAST_VIEW_ALL_CAP dates when viewAll is true` | both files above |
| `flags saturation and returns a lower-bound total when the row ceiling truncates mid-fetch` | both files above — the one genuinely new, unprecedented case (6.5) |
| `never splits one date's segments across the N-th/N+1-th date boundary` | both files above |

The existing `"SABOTAGE TARGET — is 'cappedOut', not 'hidden'..."` test (`availability-data.test.ts:37-52`, `lib.test.ts` equivalent) already covers the `cappedOut`-beyond-view-all-cap branch and needs no new test, provided the new helper's date-count output is what gets fed into the unchanged banner resolver — only the helper's own `dateTotal` output needs its own correctness test (covered by the rows above).

**Optional, not required by this item:** `lib.test.ts` (staff) has 4 `it(...)` blocks; `availability-data.test.ts` (admin) has a 5th, `"cappedOut takes priority even when hidden's condition also holds"` (`:54-64`), proving branch order independently of the sabotage test. The staff file has no equivalent — a pre-existing asymmetry, not introduced by this item. Mirroring it costs one test and closes a real gap, but is optional here since it is not part of this item's scope.

**Not required:** a new `StaffAvailabilityOverridesManager.test.tsx` file. None exists today; creating one would be scope creep onto a pre-existing, unrelated gap this item did not create.

### 6.11 Stop conditions

Halt and ask the Owner rather than proceed, if:

1. The saturation-disclosure prop shape (sibling boolean, recommended in 6.5, vs. a `DateTotal` union prop) has not been settled before editing the Manager components' prop types — this is a breaking prop-shape change either way and should not be improvised mid-implementation. Default to the sibling-boolean recommendation in 6.5 unless there is a concrete reason to prefer the union.
2. Any edit to `availability-data.ts` or `lib.ts` turns out to require touching `BlockedDatesManager.tsx` or `StaffBlockedDatesManager.tsx` — per 6.2/6.6, it should not. If it does, the shared-constant assumption in this section was wrong and the Owner needs to know before proceeding.
3. `pnpm lint`'s baseline (59 errors / 7 warnings, in the six files already identified elsewhere in this plan) changes at all after this item's edits — none of those six files are edited by this item, so any change means something leaked.
4. Item 7 begins touching any of the six shared files (6.8) before items 3 and 6 are both fully shipped and re-grepped for `oklch(`.
5. The upcoming bucket's row-fetch ceiling (500, unchanged) is ever found to be insufficient at real production volume — this item assumes it stays defensive-only and unreachable-saturated; if real data approaches it, that is a signal the assumption in 6.1's projected volume (~25-100 overrides over 5 years) no longer holds and the caps need Owner re-evaluation, not a silent bump.

### 6.12 Rollback

Option A introduces no migration and no data mutation — every change is to pure TypeScript (constants, a new helper function, prop plumbing) and JSX text. Rollback is `git revert` of the implementing commit(s); there is no irreversible step, no Zone-2 action, and no schema change to unwind anywhere in this item.

(Option B, if the Owner later chooses it instead of Option A, would introduce a Zone-2 migration — `CREATE VIEW ... WITH (security_invoker = true)`, whose rollback would be a matching `DROP VIEW`, orchestrator-performed only, never by an implementing agent. Option B is not being built by this item; this note exists only so a future switch to it isn't planned as if it were as reversible as Option A.)
