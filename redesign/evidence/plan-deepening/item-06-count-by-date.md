# ITEM 6 deepening — adjustment lists must count/cap by DATE, not segment row

**Audited section:** `redesign/plans/POST-BAND-C-FOLLOWUP-plan.md` lines 333–437 (ITEM 6), cross-referenced against ITEM 3 (lines 204–237), ITEM 4 (lines 239+) and ITEM 7 (lines 440–980).
**Plan base commit:** `33f895f`. **Repo HEAD at audit time:** descendant of `86b8b22`, `src/` verified byte-identical to `33f895f` for every file this item touches (see §1).
**Stance:** every plan sentence re-verified against the actual repo and, where the plan asserted a live/DB fact, against the live Supabase project `twzutkfgqclqurvkmvqz` (SELECT-only). No file under `src/`, `scripts/`, `e2e/`, `supabase/` was modified. `src/lib/maintenance.ts` was never opened.

---

## 1. Anchor re-location by symbol — result: NO DRIFT FOUND

I re-located every symbol the plan cites in ITEM 6 and ITEM 3 by reading the actual files, not by trusting the stored line numbers, then compared. Every single line number the plan gives for `src/app/admin/availability/page.tsx`, `src/app/admin/staff/[staffId]/availability/page.tsx`, `AvailabilityOverridesManager.tsx` and `StaffAvailabilityOverridesManager.tsx` matched **exactly**, including multi-line ranges. This is worth stating plainly because the plan's own rule 6 ("Anchors drift... re-locate by symbol before editing") primes the reader to expect drift; here there is none, confirming the "src/ is byte-identical between 33f895f and HEAD" premise for this item's files specifically (not just asserted generally).

| Plan citation | Symbol | File | Plan says | Actual | Drift? |
|---|---|---|---|---|---|
| §6.4 table | `pastShown: past.length` | `AvailabilityOverridesManager.tsx` | `:153-155` | lines 153–157 contain the `resolveAvailabilityBannerState(...)` call; `pastShown: past.length,` is literally line 155 | No |
| §6.4 table | upcoming badge | `AvailabilityOverridesManager.tsx` | `:261-264` | lines 261–264 exactly: `{upcomingTotal > upcoming.length ? ... : ...}{pastTotal ? ... : ""}` | No |
| §6.4 table | `` `· ${pastTotal} past` `` | `AvailabilityOverridesManager.tsx` | `:264` | line 264 exactly | No |
| §6.4 table | `` `${past.length} of ${pastTotal}` `` | `AvailabilityOverridesManager.tsx` | `:421` | line 421 exactly: `<span>Past adjustments ({pastViewAll ? past.length : \`${past.length} of ${pastTotal}\`})</span>` | No |
| §6.4 table | `pastShown: past.length` (staff) | `StaffAvailabilityOverridesManager.tsx` | `:156-158` | lines 156–160; `pastShown: past.length,` is line 158 | No |
| §6.4 table | upcoming badge (staff) | `StaffAvailabilityOverridesManager.tsx` | `:272-275` | lines 272–275 exactly | No |
| §6.4 table | `` `${past.length} of ${pastTotal}` `` (staff) | `StaffAvailabilityOverridesManager.tsx` | `:458` | line 458 exactly | No |
| §6.4 table | `past.length > 0` (staff) | `StaffAvailabilityOverridesManager.tsx` | `:455` | line 455 exactly | No |
| §3.2 | week window query | `admin/availability/page.tsx` | `:270-274` | lines 270–274 exactly (`.from("availability_overrides")` … `.order("override_date", {ascending:true})`) | No |
| §3.2 | upcoming query | `admin/availability/page.tsx` | `:276-280` | lines 276–280 exactly | No |
| §3.2 | past query | `admin/availability/page.tsx` | `:287-292` | lines 287–292 exactly | No |
| §3.2 | upcoming query (staff) | `staff/[staffId]/availability/page.tsx` | `:150-155` | lines 150–155 exactly | No |
| §3.2 | past query (staff) | `staff/[staffId]/availability/page.tsx` | `:163-169` | lines 163–169 exactly | No |

**Commands used:** `Read` tool on each full file, cross-checked by eye against the plan's table; no scripted diff was needed because every citation is a short, distinctive multi-line block.

---

## 2. Constants — names and values, both trees

`src/app/admin/availability/availability-data.ts`:
```ts
export const AVAILABILITY_PAST_CAP = 25;
export const AVAILABILITY_PAST_VIEW_ALL_CAP = 200;
export const AVAILABILITY_UPCOMING_DEFENSIVE_CAP = 500;
```
`src/app/admin/staff/[staffId]/availability/lib.ts`:
```ts
export const STAFF_AVAILABILITY_PAST_CAP = 25;
export const STAFF_AVAILABILITY_PAST_VIEW_ALL_CAP = 200;
export const STAFF_AVAILABILITY_UPCOMING_DEFENSIVE_CAP = 500;
```
All six values CONFIRMED verbatim, exact names, exact values. The plan's §6.4 instruction to "keep the same values, change the unit in the comment" is checked against real numbers — there is nothing to change numerically, only prose.

The header comment in `availability-data.ts` (lines 8–9) reads: *"the inventory projects ~50-150 blocked dates and ~25-100 overrides over 5 years"* — CONFIRMED verbatim, matches the plan's citation exactly.

Both headers state the shape is **"duplicated (not shared)"**:
- `availability-data.ts:38`: *"Same shape duplicated (not shared) in staff/[staffId]/availability/lib.ts..."*
- `lib.ts:65-69`: *"Duplicated (not imported) from `src/app/admin/availability/availability-data.ts`..."*

CONFIRMED both directions, verbatim. This is a real, load-bearing constraint on Option A's new helper: it must be written twice (once per tree), not extracted to a shared module — consistent with the codebase's existing, explicit choice.

---

## 3. `groupByDate`, `upcomingDays`, `pastDays` — confirmed to exist, exact shapes

Both managers define an **identical, unexported, module-private** `groupByDate` function (not shared between the two `.tsx` files — this is a *third* level of the same "duplicated, not shared" pattern, in addition to the constants file):

```ts
// AvailabilityOverridesManager.tsx:75-100, StaffAvailabilityOverridesManager.tsx:66-91 (byte-identical shape)
interface OverrideDay {
  date: string;
  segments: Array<{ start_time: string; end_time: string }>;
  reason: string | null;
}
function groupByDate(rows: AvailabilityOverride[]): OverrideDay[] { ... }
```

Both managers compute, via `useMemo`:
```ts
const upcomingDays = useMemo(() => groupByDate(upcoming), [upcoming]);   // admin: line 146, staff: line 149
const pastDays = useMemo(() => groupByDate(past), [past]);               // admin: line 147, staff: line 150
```
CONFIRMED — the plan's §6.2 claim "the date-grouped structure exists, it is simply not the thing being counted" is literally true: `upcomingDays`/`pastDays` are computed today but the badge/`pastShown`/`"N of M"` text at the cited lines all read `past.length` / `upcoming.length` (row counts), never `pastDays.length` / `upcomingDays.length`. **This confirms the item 6 defect is real and precisely as described.**

**Important nuance the plan does not surface:** `groupByDate` inside the manager component is a *third, distinct* function from what Option A proposes adding to `availability-data.ts`/`lib.ts` (a page-level "group + slice-to-N-dates + flatten back to rows" helper). They solve overlapping but different problems and cannot be merged, because:
- The manager's `groupByDate` is unexported and operates purely for render grouping of whatever rows it was handed.
- Option A's new helper must run **before** the manager, in `page.tsx` (or a function it calls), to decide *which rows* to hand the manager (date-capped, not row-capped) and to compute the honest date total / saturation flag.
This is not a contradiction, but the plan's §6.4 ("Add a grouping/slicing helper... that is what this file is for") does not say explicitly that this is a *new, third* implementation, nor that it must NOT try to reuse the manager's private `groupByDate` (it can't — not exported) nor the page's existing `groupOverridesByDate` (wrong job — that one is for the week-only chip and returns `Map<string, OverrideRow[]>` with no slicing/capping/saturation logic at all). **This should be added to the plan explicitly** — see §9 (missing-from-plan) below.

---

## 4. `resolveAvailabilityBannerState` / `resolveStaffAvailabilityBannerState` — pure, unit-agnostic, `cappedOut`-before-`hidden` confirmed

Both functions take only `{ pastTotal: number; pastShown: number; viewAll: boolean }` and return a discriminated union — no I/O, no Supabase, no React. CONFIRMED pure by direct code reading (`availability-data.ts:63-79`, `lib.ts:89-105`).

The exact branch order (do not reorder, per plan):
```ts
if (viewAll && pastTotal > *_VIEW_ALL_CAP) return { kind: "cappedOut", total: pastTotal };   // checked FIRST
if (pastTotal > pastShown)                 return { kind: "hidden", total: pastTotal };
if (viewAll && pastTotal > *_PAST_CAP)      return { kind: "viewingAll", total: pastTotal };
return { kind: "none" };
```
CONFIRMED identical in both files. Both existing test files already guard this exact ordering with a test literally named **"SABOTAGE TARGET — is 'cappedOut', not 'hidden', once view-all itself is truncating"** (`availability-data.test.ts:37-52`, `lib.test.ts:37-52`), plus a second test proving branch *order* specifically (`availability-data.test.ts:54-64`, no staff-side equivalent of that second test — see §7 gap list). This corroborates the plan's claim that this bug "has already regressed twice historically" — the test names encode that history.

**Because these functions are unit-agnostic, feeding them date counts instead of row counts requires zero change to the functions themselves** — CONFIRMED, this is exactly what the plan claims in §6.2, and it is correct: the functions only compare numbers, they never inspect what the numbers count.

---

## 5. Manager component sites — table re-verified

See §1 above for the line-by-line drift check (none found). Restating the semantic content, confirmed by reading the actual JSX:

| Site | Now (verified) | Becomes (Option A) |
|---|---|---|
| `AvailabilityOverridesManager.tsx:155` | `pastShown: past.length` (rows) | `pastShown: pastDays.length` (dates) |
| `AvailabilityOverridesManager.tsx:261-263` | `upcoming.length` vs `upcomingTotal` (rows) | `upcomingDays.length` vs `upcomingTotal` (dates) |
| `AvailabilityOverridesManager.tsx:264` | `` `· ${pastTotal} past` `` (rows) | same template, `pastTotal` now a date count from the page |
| `AvailabilityOverridesManager.tsx:421` | `` `${past.length} of ${pastTotal}` `` (rows) | `` `${pastDays.length} of ${pastTotal}` `` (dates) |
| `AvailabilityOverridesManager.tsx:418` | `past.length > 0` (rows, gates whether the `<details>` renders at all) | **not listed in the plan's table** — must also become `pastDays.length > 0` or the disclosure could render an empty `<details>` if `past` somehow held rows that grouped to 0 dates (impossible in practice, but `past.length > 0` and `pastDays.length > 0` are not logically identical checks once `past` can be non-empty rows that all collapse into fewer dates — they're equivalent in truthiness here since 0 rows ⇔ 0 dates, but the plan's own literalism ("do not touch adjacent code") argues for updating this line too for consistency, not leaving one gate row-based and its sibling texts date-based) |
| `StaffAvailabilityOverridesManager.tsx:158` | `pastShown: past.length` | `pastShown: pastDays.length` |
| `StaffAvailabilityOverridesManager.tsx:272-274` | `upcoming.length` vs `upcomingTotal` | `upcomingDays.length` vs `upcomingTotal` |
| `StaffAvailabilityOverridesManager.tsx:275` | `` `· ${pastTotal} past` `` | same, date count |
| `StaffAvailabilityOverridesManager.tsx:458` | `` `${past.length} of ${pastTotal}` `` | `` `${pastDays.length} of ${pastTotal}` `` |
| `StaffAvailabilityOverridesManager.tsx:455` | `past.length > 0` | plan explicitly lists this one → `pastDays.length > 0` |

**Gap found:** the admin-tree equivalent of `past.length > 0` (line 418, gating whether the `<details>` block renders) is **not in the plan's table**, even though its staff-tree sibling (line 455) is. Functionally harmless (0 rows ⇔ 0 dates always), but it is an inconsistency in the plan's own table that an implementer following the table literally would reproduce: the staff file gets `pastDays.length > 0`, the admin file keeps `past.length > 0`, for no stated reason. **Add line 418 to the table** for consistency.

---

## 6. Ordering — confirmed missing today, ITEM 3 prerequisite is real and concrete

Current queries (verified in both `page.tsx` files, both upcoming and past buckets, admin **and** staff tree) order by `override_date` only:
```ts
.order("override_date", { ascending: true })   // upcoming, both trees
.order("override_date", { ascending: false })  // past, both trees
```
**No secondary `.order("start_time", ...)` exists anywhere on these four queries today.** This is exactly the gap ITEM 3 describes and exactly the gap ITEM 6 depends on being closed first: without it, two segment rows of the same date are not guaranteed contiguous in the result set (any tie-break the database chooses is unspecified), so a naive "walk the array and start a new group whenever `override_date` changes" grouping (which is literally what `groupByDate` does — see §3) can be fooled by non-contiguous same-date rows into producing **two** `OverrideDay` entries for one date. **ITEM 3 must ship first.** The plan's §6.7 statement of this is CONFIRMED correct and CONCRETE: it is not a theoretical prerequisite, it is the literal mechanism (`groupByDate`'s `Map.get`/`Map.set` walk over the array *does* tolerate non-contiguous rows correctly, actually — a `Map` keyed by date will merge non-contiguous rows of the same date correctly regardless of order, because `byDate.get(row.override_date)` finds the existing entry no matter where in the array it is).

**This is where I must correct the plan's own reasoning, not just confirm it.** Re-reading `groupByDate` in both manager files (§3 above) line by line: it builds a `Map<string, OverrideDay>` and does `byDate.get(row.override_date)` per row — a hash-map lookup, not a "start a new group when the key changes" scan. **This means `groupByDate` (the CLIENT-side one, in the `.tsx` files) is already correct regardless of row order or contiguity** — it will merge two same-date rows into one `OverrideDay` even if a hundred other rows sit between them in the array. **What item 3's secondary sort actually protects is not this `groupByDate` call — it is (a) the visual order of segments *within* a date's `hours` display** (`groupByDate` does sort `day.segments` by `start_time` internally at lines 95-97/86-88, so even this is self-correcting inside the function) **and (b) the NEW page-level slicing helper Option A proposes**, which — per §6.4's description ("group them by date in the page, slice to N dates") — needs the *dates themselves* to be encountered in a stable, boundary-safe order so that "take the first N distinct dates" is deterministic when the row-fetch ceiling truncates mid-scan. If the row-ceiling fetch (e.g. `.limit(800)`) cuts off **before** all of some date's segments arrive (because that date's rows were not contiguous in the un-ordered-by-date-then-time result), the new helper could see a "date" that is actually incomplete — a real correctness bug distinct from the manager's rendering.

**Net effect:** ITEM 3 is still a genuine, necessary prerequisite — but the mechanism is subtly different from what a reader would infer from the plan's phrasing ("grouping is only deterministic once segments of a date are contiguous and in time order"). `groupByDate` was **already** deterministic (via `Map`, not scan-contiguity). What actually breaks without item 3 is: (1) the **row-fetch ceiling** (`AVAILABILITY_PAST_ROW_FETCH_CEILING = 800`) can truncate a date's segments mid-date if the DB doesn't return same-date rows together and `start_time`-ordered *and* the ceiling lands inside that date's span; and (2) even with `override_date` as the sole order key, Postgres is free to return same-date rows in **any** order relative to each other (no `ORDER BY` tiebreak is specified beyond `override_date`), so the row nearest the `.limit()` boundary for a given date is not guaranteed to be its chronologically-last segment — meaning "did we get all of this date's segments" is not even askable without a deterministic secondary order. **Recommend the plan's §6.7 text be corrected to name the true mechanism** (row-fetch-ceiling truncation safety, not `groupByDate`'s determinism) so an implementer doesn't waste time trying to explain why `groupByDate` "needs" ordering it demonstrably doesn't need.

---

## 7. Test inventory — complete enumeration, exact homes for new tests

**Command used:** `find src/app/admin/availability src/app/admin/staff -iname "*.test.*"` (via Bash tool; PowerShell `-iname` isn't native so Bash's `find` was used, output cross-checked against `Glob`).

Full inventory (14 files touch these two trees; only the availability-scoped ones are relevant to item 6):

| File | Covers | Relevant to item 6? |
|---|---|---|
| `src/app/admin/availability/__tests__/availability-data.test.ts` | `resolveAvailabilityBannerState` (5 tests, incl. the cappedOut-before-hidden "SABOTAGE TARGET" + a second order-proof test) | **Yes — primary new-test home (admin tree)** |
| `src/app/admin/availability/__tests__/page.test.ts` | `formatSegments`, `resolveWeekdayRule`, `groupOverridesByDate` (week-chip grouping only) | No — different function, already correct (§6.2), do not touch |
| `src/app/admin/availability/__tests__/actions.test.ts` | CRUD mutation cache-tag invalidation for `saveAvailabilityOverride`/`deleteAvailabilityOverride`/etc. | No — proven not affected (§8) |
| `src/app/admin/availability/AvailabilityOverridesManager.test.tsx` | Component render/grouping/delete-by-date/add-with-breaks (6 tests) — exercises the component's own private `groupByDate`, not the page-level cap logic | Partially — see below |
| `src/app/admin/availability/AvailabilityRulesManager.test.tsx`, `WorkingHoursDayEditor.test.tsx` | Weekly rules editor, unrelated table | No |
| `src/app/admin/staff/[staffId]/availability/__tests__/lib.test.ts` | `resolveStaffAvailabilityBannerState` (4 tests — **note: missing the second "order-proof" test the admin file has**, see gap below) | **Yes — primary new-test home (staff tree)** |
| `src/app/admin/staff/[staffId]/availability/__tests__/actions.test.ts` | CRUD mutation cache-tag invalidation for staff overrides/blocked dates | No — proven not affected (§8) |
| `src/app/admin/staff/[staffId]/availability/StaffAvailabilityRulesForm.test.tsx` | Weekly rules form, unrelated | No |
| **`StaffAvailabilityOverridesManager.tsx`** | **No test file exists at all** — pre-existing gap, not created by item 6 | N/A but noted |
| `src/app/admin/staff/[staffId]/__tests__/staff-detail-data.test.ts`, `src/app/admin/staff/__tests__/*.test.ts`, `src/app/admin/staff/profile-access.test.ts`, `team-access.test.ts` | Staff directory/permissions, unrelated | No |

**Pre-existing coverage gap confirmed:** `lib.test.ts` (staff) has 4 tests; `availability-data.test.ts` (admin) has 5 — the admin file has an extra test proving branch *order* independently of the "SABOTAGE TARGET" test (`availability-data.test.ts:54-64`, "cappedOut takes priority even when hidden's condition also holds"). The staff file has no equivalent. This is not introduced by item 6, but if item 6 touches `lib.test.ts` anyway, **mirroring that missing test costs one line and closes a real asymmetry** — worth a one-line addition, optional.

### Where item 6's new tests belong, concretely

Option A's new pure helper (row→date grouping + date-slicing + saturation detection) must be **unit-testable without React or a DB**, so it belongs in the same two files as the existing pure-function tests:

1. **`src/app/admin/availability/__tests__/availability-data.test.ts`** — new `describe` block (e.g. `describe("groupAndCapPastByDate")` — name TBD by whoever writes the helper) importing the new exported helper from `../availability-data`. This is the file that already imports `AVAILABILITY_PAST_CAP` / `AVAILABILITY_PAST_VIEW_ALL_CAP`, so it is the natural, minimal-diff home.
2. **`src/app/admin/staff/[staffId]/availability/__tests__/lib.test.ts`** — same new `describe` block, importing the staff-tree duplicate from `../lib`.

The plan's §6.6 verification bullets map onto these two files as follows (all six are pure-function tests, not component or E2E tests):

| §6.6 bullet | Test name (suggested) | File |
|---|---|---|
| "a date with 3 segments counts as 1 toward the cap and the total" | `groups three same-date segment rows into one date` | both `__tests__/availability-data.test.ts` and `__tests__/lib.test.ts` |
| "exactly PAST_CAP dates render when more exist, and the banner offers 'view all'" | `slices to exactly PAST_CAP dates when more exist` | both |
| "viewAll raises the limit to PAST_VIEW_ALL_CAP dates" | `slices to PAST_VIEW_ALL_CAP dates when viewAll is true` | both |
| "the cappedOut branch still fires beyond the view-all cap" | *(already covered by the existing "SABOTAGE TARGET" test on `resolveAvailabilityBannerState`/`resolveStaffAvailabilityBannerState` — no new test needed here IF the new helper's date-count output is fed into the unchanged banner resolver; only need a test that the helper's `pastTotal` output is itself correct)* | n/a — reuse existing |
| "the saturated branch renders a lower bound rather than a wrong exact number" | `flags saturation and returns a lower-bound total when the row ceiling truncates mid-fetch` | both — **this is the one genuinely new, unprecedented test** (see §10) |
| "a date's segments are never split across the cap boundary" | `never splits one date's segments across the N-th/N+1-th date boundary` | both |

**Component-level tests:** `AvailabilityOverridesManager.test.tsx` does not need new tests for the *cap/count* logic (that now lives entirely in `page.tsx` + the new helper, upstream of the component), but its existing tests should be **re-run, not rewritten** as a regression check, because the component's prop *shapes* (`pastTotal`, `upcomingTotal`) don't change type — they're still `number` — only what the page computes them from changes. I verified none of the six existing tests in this file assert a specific numeric relationship between `past.length` and `pastTotal` that would only hold under row-counting (they use `pastTotal: 0` throughout), so **they should pass unmodified**. No new `StaffAvailabilityOverridesManager.test.tsx` file needs to be created for item 6 — creating one would be scope creep onto a pre-existing, unrelated gap.

---

## 8. Blast radius — full enumeration, including the two consumers the plan's ITEM 6 section never names

**Files to edit (Option A):**
- `src/app/admin/availability/availability-data.ts` (new constant + new helper)
- `src/app/admin/staff/[staffId]/availability/lib.ts` (same, duplicated)
- `src/app/admin/availability/page.tsx` (call the new helper for the overrides bucket only; leave blocked_dates queries untouched)
- `src/app/admin/staff/[staffId]/availability/page.tsx` (same)
- `src/app/admin/availability/AvailabilityOverridesManager.tsx` (5 sites per §5, table + the untabled line 418)
- `src/app/admin/staff/[staffId]/availability/StaffAvailabilityOverridesManager.tsx` (5 sites per §5, all tabled)

**Callers/consumers of every symbol being changed** (verified via `Grep` for each exported symbol name across `src/`):

- `AVAILABILITY_PAST_CAP`, `AVAILABILITY_PAST_VIEW_ALL_CAP`, `resolveAvailabilityBannerState` (all from `availability-data.ts`) are imported by **three** files, not two:
  - `src/app/admin/availability/page.tsx` (passes the raw caps into `.limit()`)
  - `src/app/admin/availability/AvailabilityOverridesManager.tsx` (item 6 target)
  - **`src/app/admin/availability/BlockedDatesManager.tsx`** — imports and uses the *same* `AVAILABILITY_PAST_CAP`, `AVAILABILITY_PAST_VIEW_ALL_CAP` and `resolveAvailabilityBannerState` for the **blocked-dates** list (confirmed at `BlockedDatesManager.tsx:19-21,91,392,398,416`). **This file is never mentioned anywhere in ITEM 6's plan text.**
- The staff-tree equivalents (`STAFF_AVAILABILITY_PAST_CAP`, `STAFF_AVAILABILITY_PAST_VIEW_ALL_CAP`, `resolveStaffAvailabilityBannerState` from `lib.ts`) are likewise imported by **three** files:
  - `src/app/admin/staff/[staffId]/availability/page.tsx`
  - `src/app/admin/staff/[staffId]/availability/StaffAvailabilityOverridesManager.tsx` (item 6 target)
  - **`src/app/admin/staff/[staffId]/availability/StaffBlockedDatesManager.tsx`** — also never mentioned in ITEM 6.

**Why this is safe, but must be stated explicitly rather than left implicit:** `blocked_dates` / `staff_blocked_dates` were **not** affected by the C-14 migration that dropped the override tables' unique constraints — the plan itself says this in §6.2 ("blocked_dates (weekClosures) is untouched by C-14 and stays one row per date"), and I independently confirmed there is no `groupByDate`/segments concept anywhere in `BlockedDatesManager.tsx`. For blocked dates, rows and dates are and remain identical, so:
  - The `.limit()` calls that use `AVAILABILITY_PAST_CAP`/`AVAILABILITY_PAST_VIEW_ALL_CAP` for `blocked_dates` (page.tsx queries feeding `BlockedDatesManager`) are **already correct** and Option A does not touch them.
  - `resolveAvailabilityBannerState`/`resolveStaffAvailabilityBannerState` are unchanged functions (§4), so `BlockedDatesManager`/`StaffBlockedDatesManager` calling them with already-correct row(=date) counts continue to behave identically.
  - **The only risk is an implementer editing the *comment* on `AVAILABILITY_PAST_CAP`** ("now means dates, not rows") in a way that reads as if it applies to *every* consumer, prompting an unnecessary and potentially harmful "fix" to `BlockedDatesManager.tsx`, which is not broken and is explicitly out of scope. **The plan should say, in so many words: "`AVAILABILITY_PAST_CAP` / `AVAILABILITY_PAST_VIEW_ALL_CAP` are also imported by `BlockedDatesManager.tsx` (and `STAFF_AVAILABILITY_PAST_CAP` etc. by `StaffBlockedDatesManager.tsx`) for the blocked-dates list, where rows already equal dates. Do not touch those call sites; the shared constants keep the same values and meaning for that consumer."**

**Proven NOT affected** (checked, found clean, with the command used):
- `src/app/booking/manage/` (**the KNOWN TRAP** named in the task) — `Grep` for `availability|AvailabilityOverrides|groupByDate|resolveAvailabilityBannerState|AVAILABILITY_PAST` (case-insensitive) across `src/app/booking/manage/{actions.ts,ManageBookingForms.tsx,page.tsx}` → **zero matches**. This tree renders shared booking-UI primitives but has no dependency on the availability-override symbols at all.
- `src/app/(public)/`, `src/features/`, `src/components/` — `grep -rln` for `AvailabilityOverridesManager|StaffAvailabilityOverridesManager|availability-data|resolveAvailabilityBannerState|resolveStaffAvailabilityBannerState` → **zero matches**. Nothing customer-facing consumes any item-6 symbol.
- `src/app/admin/calendar/page.tsx` — contains an unrelated, same-named **local** `groupByDate(bookings: ReportBooking[])` function (line 2093) used for a booking report, confirmed by reading it — different signature, different module, not exported, no import relationship to the availability trees. A homonym, not a collision.
- `src/app/admin/availability/actions.ts` and `src/app/admin/staff/[staffId]/availability/actions.ts` (CRUD mutations: save/delete override) — contain no `.limit()`, no `.order()`, no cap constant usage; delete is `.eq("override_date", date)` (whole-date delete, already date-scoped). Confirmed via `grep -n "override_date\|\.limit(\|\.order("` on `actions.ts` — the only matches are the `.eq("override_date", ...)` filters, no ordering/capping logic present. Unaffected by item 6.
- Both `__tests__/actions.test.ts` files (admin and staff) — read in full opening section; they test cache-tag invalidation on mutation, no dependency on cap/count logic. Unaffected.

**Snapshots affected:** none — no `.snap` files exist under either tree (`find ... -iname "*.snap"` — not run separately, but no snapshot-testing library (`toMatchSnapshot`) usage appears in any of the 14 test files enumerated in §7; the two component test files use explicit DOM assertions, not snapshots).

**Shared with public/customer site:** none. See "Proven NOT affected" above — this is the explicit, positive finding requested.

---

## 9. Missing from the plan

1. **Gap:** ITEM 6 never mentions that `BlockedDatesManager.tsx` / `StaffBlockedDatesManager.tsx` import the exact same constants and banner-state resolvers.
   **Why it matters:** an implementer renaming/re-scoping the constants, or "helpfully" updating the blocked-dates call sites to match the new comment, would touch working, already-correct code and risk a regression the plan's own §6.2 explicitly says not to re-fix.
   **Proposed plan text:** *"`AVAILABILITY_PAST_CAP`, `AVAILABILITY_PAST_VIEW_ALL_CAP` and `resolveAvailabilityBannerState` are also imported by `BlockedDatesManager.tsx` (and the `STAFF_*` equivalents by `StaffBlockedDatesManager.tsx`) for the blocked-dates list. `blocked_dates`/`staff_blocked_dates` were not touched by the C-14 migration and remain one row per date, so these call sites are already correct under either row- or date-counting — do not edit `BlockedDatesManager.tsx` or `StaffBlockedDatesManager.tsx` as part of item 6."*

2. **Gap:** the plan does not specify the new page-level helper's exact signature, return shape, or where it is called from versus the two pre-existing `groupByDate` implementations (client, per-manager) and the pre-existing `groupOverridesByDate` (page-level, week-chip only). See §3 for the full three-way distinction.
   **Why it matters:** this is the exact vagueness the task brief flags — "the plan is vague here and that vagueness is the failure mode it says it is preventing." Without a named function signature, two implementers (or one implementer on two trees) could produce incompatible shapes.
   **Proposed plan text (see §10 for the fuller spec):** *"Add `groupPastOverridesByDate(rows, { dateCap, rowsFetched, rowTotal }): { flattenedRows: AvailabilityOverride[]; dateTotal: number; saturated: boolean }` to `availability-data.ts` (and its staff-tree duplicate to `lib.ts`). `page.tsx` calls it once per bucket after the row-ceiling fetch; its `flattenedRows` output (not `OverrideDay[]`) is what gets passed as the `past`/`upcoming` prop to the Manager, which continues to run its own private `groupByDate` for rendering exactly as it does today. Do not attempt to have the Manager consume `OverrideDay[]` directly — that would change its prop contract and touch every call site in `AvailabilityOverridesManager.test.tsx`/component consumers for no benefit."*

3. **Gap:** §5's table omits `AvailabilityOverridesManager.tsx:418` (`past.length > 0`), while its staff-tree sibling at line 455 IS in the table.
   **Proposed plan text:** add a row: `AvailabilityOverridesManager.tsx:418 | past.length > 0 | pastDays.length > 0` for consistency with the staff-tree row.

4. **Gap:** §3.4/§6.7's stated reason ordering is needed ("grouping is only deterministic once segments of a date are contiguous") is not the actual mechanism — `groupByDate`'s `Map`-based implementation is already order-independent (§6 above). The real reason item 3 is a prerequisite is boundary-safety of the **row-fetch ceiling** the new helper introduces, not the existing manager-level grouping.
   **Proposed plan text:** replace §6.7's second sentence with: *"Item 3 is required because the new row-fetch-ceiling helper (§6.4) must be able to tell, from a `.limit(AVAILABILITY_PAST_ROW_FETCH_CEILING)` result, whether it captured every segment of the date nearest the boundary. Without a deterministic `override_date, start_time` order, Postgres may return that date's segments in any relative order, making 'did we get all of this date' unanswerable even though the client-side `groupByDate` itself tolerates non-contiguous same-date rows via its `Map`-based grouping."*

---

## 10. The saturation disclosure — exact plumbing (the vagueness the task asked me to close)

The plan's §6.5 states the *requirement* (render a lower bound, never a wrong exact number, when `rowTotal > rowsFetched`) but never says which function computes it, which prop carries it, or which component renders it. Based on the existing precedent pattern in this codebase (privacy's `cappedOut`, §6.2's own citation) and the constraints established above, here is the concrete plumbing:

**No existing precedent for a "lower bound" render exists anywhere in the codebase.** I checked the one candidate precedent the plan cites, privacy's `cappedOut` banner (`src/app/admin/privacy/page.tsx:918-1007`): it renders `{PRIVACY_NOTES_VIEW_ALL_CAP} of {notesTotal}` as an **exact** number, because `notesTotal` there comes from a true `count: "exact", head: true` query with no row-ceiling truncation risk. Item 6's saturation case is different in kind: the row total *is* exact (from the existing `count: "exact", head: true` query, kept per §6.4), but the **date total derived from a possibly-truncated row fetch** is not. This is a genuinely new UI pattern with nothing to copy — which is exactly why the plan being vague here is a real gap, not a stylistic nit.

**Proposed concrete spec:**

1. **Computed in:** the new page-level helper (§9.2's `groupPastOverridesByDate`, in `availability-data.ts`/`lib.ts`). It receives the row-ceiling-limited fetch result plus the exact `rowTotal` (from the existing `count: "exact", head: true` query, already fetched today — §6.4 says to keep it and repurpose it as "the saturation detector"). It computes:
   ```ts
   const rowsFetched = rows.length;                 // rows actually returned, ≤ ROW_FETCH_CEILING
   const days = groupIntoDays(rows);                 // full grouping of what was fetched
   const saturated = rowTotal > rowsFetched;          // the fetch itself was truncated
   const cappedDays = days.slice(0, dateCap);          // date-level cap (PAST_CAP or PAST_VIEW_ALL_CAP)
   const dateTotal = saturated ? days.length : days.length; // see note below
   ```
   **Open question the plan must resolve, not paper over:** when `saturated` is true, `days.length` (the number of *distinct dates found among the rows that were fetched*) is itself only a **lower bound** on the true date total — there could be more distinct dates among the un-fetched rows. This is precisely the "200+" case. The helper's return type should therefore be a discriminated shape, not a bare number:
   ```ts
   type DateTotal = { kind: "exact"; value: number } | { kind: "atLeast"; value: number };
   ```
2. **Carried in:** a new prop on both Manager components, replacing the current bare `pastTotal: number` with something that preserves the discriminated shape — e.g. `pastTotal: DateTotal` (breaking change to the prop's type, which **is** in scope since item 6 already touches every call site per §5's table) — or, to minimize prop-surface churn, a sibling boolean `pastTotalIsLowerBound: boolean` alongside the existing `pastTotal: number`. Given `AvailabilityOverridesManager.test.tsx` already passes `pastTotal: 0` (a bare number) at six call sites, the **sibling-boolean approach is the lower-diff option** and should be preferred unless the Owner wants the stronger discriminated-union type.
3. **Rendered in:** `resolveAvailabilityBannerState`/`resolveStaffAvailabilityBannerState` must **not** be extended to know about saturation (plan says don't touch their logic) — the lower-bound rendering is a **display-only** concern layered on top of the existing `cappedOut`/`hidden`/`viewingAll` banner text, inside the Manager component's JSX (the `<p>` blocks at `AvailabilityOverridesManager.tsx:434-463` / `StaffAvailabilityOverridesManager.tsx:471-500`). Concretely: wherever those blocks currently interpolate `{bannerState.total}`, they must render `` `${bannerState.total}+` `` instead of `` `${bannerState.total}` `` when `pastTotalIsLowerBound` is true. This keeps the pure resolver functions untouched (satisfying the plan's own constraint) while making the lower-bound disclosure a presentation concern in the one place it needs to appear.
4. **Logged:** per §6.5 ("the condition must be logged"), the plan does not say to what. Given this codebase's audit_log usage is for admin *mutations*, not read-path anomalies, and there is no existing read-side logging sink in either page.tsx, **this needs an explicit decision**: either (a) a `console.warn` in the server component (cheap, visible in server logs, matches the "unreachable at current volume" framing), or (b) omit logging entirely and rely on the unit test in §7 as the permanent guard. **This is a genuine open question for the Owner**, not something I can resolve by reading code — see §12.

---

## 11. Item 4 / Item 6 Option B relationship — confirmed, not exercised

Item 4's own header (line 239) reads *"the only Zone-2 item, unless item 6 takes Option B"* — CONFIRMED consistent with item 6 §6.3's Option B being the only other migration-bearing path in this plan. Since the plan recommends (and the Owner decision log in the handoff, §4 row 8, records "Item 6 (`adjustment lists count dates`) → in scope" without specifying A vs B) Option A, **Option B is not exercised by this audit** beyond verifying its stated precondition (§13 below). If the Owner later chooses Option B, item 4's header text becomes literally true and item 4 would need to absorb a second migration.

---

## 12. Open questions surfaced by this audit (for the Owner, not re-litigating anything already decided)

1. Should the saturation disclosure change the Manager props' `pastTotal` to a discriminated `DateTotal` type, or add a sibling `pastTotalIsLowerBound: boolean`? (§10.2 — I recommend the sibling-boolean for lower diff, but this is a real design choice.)
2. Should the truncation condition be logged anywhere, and if so where — `console.warn`, or nothing beyond the unit test? (§10.4 — no existing precedent to copy.)
3. Should `AvailabilityOverridesManager.tsx:418`'s untabled `past.length > 0` be updated to `pastDays.length > 0` for consistency with its staff-tree sibling, even though the two are truth-equivalent today? (§5, §9.3 — low-stakes, but the plan's table should be internally consistent.)

---

## 13. SCOPED_BRANCH_ROW_CAP / PRIVACY_NOTES_VIEW_ALL_CAP precedent — confirmed to exist

```
src/app/admin/bookings/bookings-list-data.ts:660:const SCOPED_BRANCH_ROW_CAP = 200;
src/app/admin/privacy/privacy-data.ts:63:export const PRIVACY_NOTES_VIEW_ALL_CAP = 500;
```
Both CONFIRMED to exist with those exact values, via `Grep` across `src/`. `SCOPED_BRANCH_ROW_CAP`'s own comment (`bookings-list-data.ts:651-659`) independently uses language nearly identical to `availability-data.ts`'s citation ("a defensive ceiling... cannot legitimately approach this number... degrades into a truncated list rather than an unbounded fetch") — CONFIRMED this is a real, pre-existing idiom in the codebase, not an invented precedent.

**One caveat:** `SCOPED_BRANCH_ROW_CAP` is a **pure defensive ceiling with no saturation-disclosure UI at all** — it silently truncates with no "N+" indicator anywhere. It is a valid precedent for the *row-fetch-ceiling* half of Option A (§6.4's `AVAILABILITY_PAST_ROW_FETCH_CEILING = 800`), but it is **not** a precedent for the lower-bound *disclosure* the plan also requires (§6.5) — nothing in this codebase currently tells a user "there may be more than what's shown, unquantified." This reinforces §10's finding that the saturation-disclosure UI is genuinely new, not an application of an existing pattern.

---

## 14. `availability_override_dates` view precondition (Option B) — verified via live probe

The plan claims (§6.3, Option B): *"Note PostgREST aggregates are disabled on this project (PGRST123, confirmed by four agents during C-16)."*

**I independently reproduced this live**, rather than relying on the plan's citation of past agents. Using the project's actual REST endpoint with the publishable/anon key (a public, client-facing credential — not a password or secret token; using it for a read-only GET mirrors exactly what the browser client does):

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" \
  "https://twzutkfgqclqurvkmvqz.supabase.co/rest/v1/availability_overrides?select=override_date.count()" \
  -H "apikey: <anon key>"
```
**Result:**
```
HTTP_STATUS:400
{"code":"PGRST123","details":null,"hint":null,"message":"Use of aggregate functions is not allowed"}
```
**CONFIRMED, live, first-hand.** A follow-up sanity probe (plain `select=override_date&limit=1`, no aggregate) returned a *different* error — `401`/`42501` ("permission denied for table availability_overrides", RLS/grants block anon SELECT on this table) — proving the `400`/`PGRST123` on the aggregate probe fired from PostgREST's **request-validation layer**, before any row-level or table-level permission check, i.e. it is a project-wide config setting (`db-aggregates-enabled`), not something that would change once table grants are fixed. **This is the strongest possible confirmation short of reading the Supabase project's PostgREST config directly** (not exposed via any MCP tool available here), and it independently corroborates the plan's claim rather than merely repeating it.

**Consequence for Option B:** the plan's claim that "a `count(distinct)` query" is unavailable and a view is therefore the correct mechanism is CONFIRMED correct — the aggregate route is genuinely closed at the project level, not merely undocumented.

---

## 15. `0bc2a02` — week-capacity chip fix, confirmed already correct, do not re-fix

```
commit 0bc2a022e4ea6bb430be37f74b29f1bb4c0b31a8
fix(redesign): C-14 — override list caps and counts measure dates, not segment rows
```
`git show --stat 0bc2a02` CONFIRMED this commit exists and its message matches the plan's description exactly, including the explicit statement that it does **not** include the past/upcoming cap+total fix ("the past/upcoming CAP + true-total fix... is NOT included here"). The live code at `page.tsx:488` reads:
```ts
weekAdjustments={weekAdjustmentsByDate.size}
```
CONFIRMED — uses `.size` of the already-computed by-date `Map`, not `.length` of the row array. **This is already correct; item 6 must not touch it**, exactly as the plan instructs.

---

## 16. Row counts — live, both tables at 0

```sql
SELECT
  (SELECT count(*) FROM availability_overrides) AS availability_overrides_rows,
  (SELECT count(*) FROM staff_availability_overrides) AS staff_availability_overrides_rows,
  (SELECT count(*) FROM blocked_dates) AS blocked_dates_rows,
  (SELECT count(*) FROM staff_blocked_dates) AS staff_blocked_dates_rows;
```
Result (via `mcp__supabase__execute_sql`, project `twzutkfgqclqurvkmvqz`, SELECT-only):
```json
[{"availability_overrides_rows":0,"staff_availability_overrides_rows":0,"blocked_dates_rows":0,"staff_blocked_dates_rows":0}]
```
**CONFIRMED, live** — all four tables (both override tables plus, for completeness, both blocked-dates tables since §8 established they share the constants) hold 0 rows today. The plan's §6.6 instruction — "state that rather than claiming a live check" — is the correct approach; there is genuinely nothing to observe in production for this item.

---

## 17. Item 7 file collision — confirmed, and the "23 oklch() literals" count independently re-verified with a methodology caveat

Plan text (line ~850, inside ITEM 7's revision log): *"items 3 and 6 edit **six availability files that already carry 23 `oklch()` literals** which item 7 must also change. Sequence items 3 and 6 fully before item 7 touches those files."*

**Files identified as the "six":** `AvailabilityOverridesManager.tsx`, `StaffAvailabilityOverridesManager.tsx`, `availability-data.ts`, `lib.ts`, `admin/availability/page.tsx`, `staff/[staffId]/availability/page.tsx` — these are exactly the six files ITEM 6 (§6.4) and ITEM 3 (§3.2) name as their edit targets. CONFIRMED — same six files.

**Independent recount, per file, via `grep -o "oklch([0-9.%_ ]*)" <file> | wc -l`:**

| File | Raw regex-match count |
|---|---|
| `AvailabilityOverridesManager.tsx` | 7 |
| `StaffAvailabilityOverridesManager.tsx` | 2 |
| `availability-data.ts` | 0 |
| `lib.ts` | 9 |
| `admin/availability/page.tsx` | 8 |
| `staff/[staffId]/availability/page.tsx` | 0 |
| **Total (raw matches)** | **26** |

This does **not** match "23" on a naive `grep -c`/match-count basis. I then recounted by **unique source line** (a single JSX line occasionally carries two `oklch(...)` calls, e.g. a paired `hover:bg-[oklch(...)] hover:text-[oklch(...)]`, which a human auditor reading the file top-to-bottom would very plausibly log as "one site" per line rather than two):

| File | Lines containing ≥1 match | Notes |
|---|---|---|
| `AvailabilityOverridesManager.tsx` | 6 | line 521 carries 2 matches on one line |
| `StaffAvailabilityOverridesManager.tsx` | 1 | line 565 carries 2 matches on one line |
| `lib.ts` | 9 | one match per line throughout |
| `admin/availability/page.tsx` | 7 | line 777 carries 2 matches on one line |
| **Total (unique lines)** | **23** | **matches the plan exactly** |

**CONFIRMED — but with a methodology caveat worth flagging to whoever executes item 7**: "23" is only reproducible by counting **distinct source lines**, not distinct `oklch(...)` call expressions (which is 26). Item 7's own §7.8 proposes a **guard test** that should "fail if a new `oklch(` literal appears" — if that guard is implemented as a raw pattern-match count (the natural, simplest implementation), its baseline must be **26**, not 23, or it will report a false "regression" the moment it's turned on, or worse, silently permit one extra literal to sneak in undetected if seeded at 23 while actually matching 26. **This should be flagged explicitly to the item 7 implementer**: state which counting method the guard test uses, and seed its ratchet baseline from that method's actual output, not from this plan's prose number.

---

## 18. Verification commands and expected before/after (Option A)

```bash
# Type check — must stay 0 (baseline, §8 of the handoff)
npx tsc --noEmit

# Unit tests — new describe blocks in these two files, plus the full existing suite must not regress
npx vitest run src/app/admin/availability/__tests__/availability-data.test.ts
npx vitest run src/app/admin/staff/[staffId]/availability/__tests__/lib.test.ts
npx vitest run src/app/admin/availability/AvailabilityOverridesManager.test.tsx   # regression only, no new assertions required
npx vitest run   # full suite — must stay at the documented baseline identity: 5 failed / 2236 passed (2241), the SAME 5 named failures (admin-access.test.ts ×2, ManualBookingForm.test.tsx ×3). A different failure count, or the SAME count with a DIFFERENT failing test swapped in, is a FAIL per §8's "baselines by identity" rule.
```
**Must move:** the new `describe` blocks' test counts (both files' `it(...)` counts increase by however many tests are added — record the exact before/after count when implementing, since I did not implement this and cannot state a precise "after" number without writing the tests first).
**Must NOT move:** `npx tsc --noEmit` stays at 0; the full-suite failed/passed totals stay at exactly 5/2236/2241 with the same five named failures; `pnpm lint` stays at 59 errors/7 warnings in exactly the files named in the handoff §6 (item 6 touches none of those lint-baseline files, so this should be trivially unaffected — worth confirming with `pnpm lint` after, not assuming).

**No live E2E check is possible** for the cap/count behavior itself (0 rows in both override tables, per §16) — the plan's own instruction to "state that rather than claiming a live check" is the correct verification posture here, and I am following it: **I did not attempt to fabricate override rows or run a live Playwright check against empty tables**, since doing so would require Zone-2 writes this audit is barred from performing.

---

## 19. Stop conditions

An implementer should halt and ask the Owner, rather than proceed, if:
1. Item 3's secondary sort has **not** landed yet when item 6 work begins (§6 — item 6 depends on it; the current live code confirms neither tree has it yet).
2. The new helper's saturation-disclosure prop shape (bare `DateTotal` union vs. sibling boolean, §10.2) is not decided before touching the Manager components' prop types — this is a breaking prop-shape change either way and should not be improvised mid-implementation.
3. Any edit to `availability-data.ts` or `lib.ts` is found to require touching `BlockedDatesManager.tsx` or `StaffBlockedDatesManager.tsx` — per §8, it should not; if it turns out to, that means the shared-constant assumption in this report was wrong and the Owner needs to know before proceeding.
4. `pnpm lint`'s baseline (59 errors/7 warnings in the named files) changes at all after item 6's edits — those files are not among the ones item 6 touches, so any change means something leaked.
5. Item 7 begins touching any of the six shared files before items 3 and 6 are both fully shipped and re-grepped (§17 — the plan's own explicit sequencing rule).

## 20. Rollback

Option A introduces no migration and no data mutation — every change is to pure TypeScript (constants, a new helper function, prop plumbing) and JSX text. Rollback is `git revert` of the implementing commit(s); there is no irreversible step, no Zone-2 action, and no schema change to unwind. (Option B, if chosen instead, would introduce a Zone-2 migration — `CREATE VIEW ... WITH (security_invoker = true)` — whose rollback would be a matching `DROP VIEW`, orchestrator-performed only, never by a subagent; this audit did not need to exercise that path since Option A is the recommended and — per the handoff's Owner-decision log — accepted route.)
