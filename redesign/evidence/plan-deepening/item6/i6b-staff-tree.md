# ITEM 6b — staff tree (`src/app/admin/staff/[staffId]/availability/`), derived independently

**Scope:** `lib.ts`, `page.tsx`, `StaffAvailabilityOverridesManager.tsx` only. Derived from first
principles against the live tree; the admin tree's shape was **not** assumed — every claim below was
re-checked directly against these three files, read in full.

**Files read in full:** `lib.ts` (106 lines), `page.tsx` (415 lines),
`StaffAvailabilityOverridesManager.tsx` (590 lines), plus
`__tests__/lib.test.ts` (53 lines) and `StaffAvailabilityOverridesManager.test.tsx` (116 lines, see
§6 — this file is the headline finding).

No file under `src/`, `scripts/`, `e2e/`, `supabase/` was modified. `src/lib/maintenance.ts` was never
opened. No git write command was run.

---

## 1. `lib.ts` — every exported constant/helper, confirmed

Full file read (106 lines). Exports, in order:

| Export | Line | Value / signature |
|---|---|---|
| `formatDateLong(value: string): string` | 1 | date formatter, `en-GB`, short weekday |
| `formatDateFull(value: string): string` | 12 | date formatter, `en-GB`, long weekday |
| `formatTime(value: string): string` | 23 | `value.slice(0, 5)` |
| `DAYS_LONG` | 27 | `string[]`, Sunday–Saturday |
| `CANCELLED_TEXT` | 38 | `"text-[oklch(26%_0.14_25)]"` |
| `CANCELLED_BORDER` | 39 | `"border-[oklch(26%_0.14_25)]"` |
| `CANCELLED_BG_SOFT` | 40 | `"bg-[oklch(95.5%_0.028_20)]"` |
| `PENDING_TEXT` | 43 | `"text-[oklch(28%_0.120_55)]"` |
| `PENDING_BORDER` | 44 | `"border-[oklch(80%_0.07_75)]"` |
| `PENDING_BG_SOFT` | 45 | `"bg-[oklch(96.0%_0.038_75)]"` |
| `RESTRICTED_TEXT` | 48 | `"text-[oklch(30%_0.020_280)]"` |
| `RESTRICTED_BG_SOFT` | 49 | `"bg-[oklch(94.0%_0.008_280)]"` |
| `CONFIRMED_BG_SOFT` | 52 | `"bg-[oklch(93.5%_0.038_155)]"` |
| `STAFF_AVAILABILITY_PAST_CAP` | 70 | `25` — **CONFIRMED**, matches plan/prior audit |
| `STAFF_AVAILABILITY_PAST_VIEW_ALL_CAP` | 71 | `200` — **CONFIRMED** |
| `STAFF_AVAILABILITY_UPCOMING_DEFENSIVE_CAP` | 73 | `500` — **CONFIRMED** |
| `StaffAvailabilityBannerState` (type) | 75-79 | discriminated union: `none \| hidden \| cappedOut \| viewingAll` |
| `resolveStaffAvailabilityBannerState(params)` | 89-105 | pure, see §7 |

**9 `oklch()` literals, one per line, exactly at lines 38, 39, 40, 43, 44, 45, 48, 49, 52** — confirmed
by reading the file (not grep-counted; every line was visually checked). This matches the assignment's
claim of "9 oklch literals" exactly, both by raw match count and by unique line (each of these 9 lines
carries exactly one literal, no line carries two). **Do not touch these 9 lines.** All new code in this
report is inserted starting after line 73 (between the existing `STAFF_AVAILABILITY_UPCOMING_DEFENSIVE_CAP`
constant and the existing `StaffAvailabilityBannerState` type on line 75) — i.e. strictly *after* every
oklch-carrying line, so the insertion cannot collide with item 7's later recolor pass on those 9 lines.
**Everything at line 75 and below shifts down by however many lines the insertion adds** (~45 lines, see
§4) — the orchestrator must re-locate `StaffAvailabilityBannerState` / `resolveStaffAvailabilityBannerState`
by symbol after applying this change, not trust "89-105" post-edit.

The header comment above the three `STAFF_AVAILABILITY_*` constants (lines 54-69) is a **shared** comment
that already names both `StaffBlockedDatesManager` and `StaffAvailabilityOverridesManager` as consumers,
and states the shape is "Duplicated (not imported) from
`src/app/admin/availability/availability-data.ts`". **This report does not edit that existing comment**
(surgical — it is accurate as written); the new unit-clarification text is a **separate, new** comment
block (§4), so as not to blur the boundary the plan itself insists on (6.2/6.6: do not let the comment
read as if it touches `StaffBlockedDatesManager.tsx`).

## 2. `page.tsx` — override query block, current state (re-verified live, not trusted from the plan)

The plan's own citations (`:149-155` / `:156-162` / `:163-169` / `:170-174`) are **pre-item-3** line
numbers. Item 3 shipped in `5212bc4` and added a second `.order("start_time", { ascending: true })` to
both override queries, shifting everything below by one line per query added. Re-derived from the live
file (415 lines total):

- **Upcoming override query:** lines 149-156 (`supabase.from("staff_availability_overrides")` … `.limit(STAFF_AVAILABILITY_UPCOMING_DEFENSIVE_CAP)`).
- **Upcoming override head-count:** lines 159-163.
- **Past override query:** lines 164-171 (`.limit(adjPastViewAll ? STAFF_AVAILABILITY_PAST_VIEW_ALL_CAP : STAFF_AVAILABILITY_PAST_CAP)`).
- **Past override head-count:** lines 172-176.

Both override queries already carry `.order("override_date", …).order("start_time", { ascending: true })`
— item 3's secondary sort **is present today** on this tree. This matches the assignment's framing
("currently ~lines 148-175 after item 3's edit") almost exactly; the true range is 149-176.

Blocked-dates queries (lines 123-148) and the week-window/rules/bookings/audit queries are **not** part
of this item and are not touched anywhere below.

## 3. Row-fetch ceiling for this tree

**Name:** `STAFF_AVAILABILITY_PAST_ROW_FETCH_CEILING`
**Value:** `800`
**Justification:** identical arithmetic to the admin tree's precedent value cited in the plan (§6.4):
`STAFF_AVAILABILITY_PAST_VIEW_ALL_CAP` (200 dates, the larger of the two date caps) × a realistic
worst case of ~4 segments/date ≈ 800.

**Does `.eq("staff_id", staffId)` change the arithmetic? No — if anything it makes 800 more
conservative here, never less.** The staff-tree query is scoped to a single staff member, which is
necessarily a *subset* of whatever clinic-wide override volume the admin tree's identical ceiling is
sized against. A per-staff-member row count can never exceed the clinic-wide row count for the same
window, so a ceiling sized for the clinic-wide case is at least as safe (and in practice far safer) when
applied per-staff. There is no reason to pick a different number for this tree; `800` is kept for parity
with the admin tree's value, not because the staff-id scoping requires a different number.

## 4. Grouping/slicing helper — new, staff-tree-only, exact code

Per the assignment's explicit instruction and the plan's §6.4 "duplicated, not shared" rule, this is
written independently for `lib.ts`, not imported from `availability-data.ts`. Symbol names deliberately
differ from any admin-tree name I might guess at (I did not read the admin tree's files for this
assignment, by design — see task framing) so there is no accidental collision risk either way; `Grep`
confirms none of the new names below exist anywhere in `src/` today.

Insert **between line 73 and line 75** of `lib.ts`:

```ts
// Item 6 (Option A, POST-BAND-C-FOLLOWUP-plan.md §6.4) — C-14 Phase C dropped
// the one-row-per-override-date unique constraint, so a date with a break is
// now 2+ rows. STAFF_AVAILABILITY_PAST_CAP and STAFF_AVAILABILITY_PAST_VIEW_ALL_CAP
// above KEEP THE SAME VALUES (25 / 200) but, for THIS file's overrides
// consumer (StaffAvailabilityOverridesManager) only, their unit changes from
// rows to DATES. `StaffBlockedDatesManager` also imports these same two
// constants for the blocked-dates list — `staff_blocked_dates` was NOT
// touched by the C-14 migration and stays one row per date, so for that
// consumer rows and dates remain identical and NOTHING changes there.
// Do not edit StaffBlockedDatesManager.tsx to "match" this comment.

// Row-fetch ceiling feeding the date-grouping helper below: a defensive
// ceiling, not a truly unbounded read (same idiom as SCOPED_BRANCH_ROW_CAP /
// PRIVACY_NOTES_VIEW_ALL_CAP, the precedent this file's header already
// cites). Sized to comfortably cover STAFF_AVAILABILITY_PAST_VIEW_ALL_CAP
// (200 dates) x a realistic worst case of ~4 segments/date = 800.
// `.eq("staff_id", staffId)` scopes this query to one staff member — a
// subset of whatever clinic-wide volume the admin tree's identical ceiling
// covers — so 800 is, if anything, more conservative here, never less.
export const STAFF_AVAILABILITY_PAST_ROW_FETCH_CEILING = 800;

export interface StaffAvailabilityOverrideRow {
  id: string;
  override_date: string;
  start_time: string;
  end_time: string;
  reason: string | null;
}

export type StaffAvailabilityDateTotal =
  | { kind: "exact"; value: number }
  | { kind: "atLeast"; value: number };

/**
 * Groups override rows fetched under STAFF_AVAILABILITY_PAST_ROW_FETCH_CEILING
 * by `override_date`, keeps the first `dateCap` distinct dates (the query is
 * already `override_date`-major — see page.tsx's `.order()` calls — so
 * "first N distinct dates encountered" is "first N dates in query order"),
 * and flattens back to rows. Does NOT return `OverrideDay[]` — the Manager's
 * own private `groupByDate` still does that render-time grouping unchanged;
 * this only decides WHICH rows the Manager receives.
 *
 * `rowTotal` is the true row count for the bucket (the existing
 * `count: "exact", head: true` query in page.tsx, unchanged). If it exceeds
 * `rows.length`, the row-fetch ceiling truncated the fetch and `dateTotal`
 * can only be a LOWER BOUND on the true date count — more distinct dates
 * could exist among rows that were never fetched. Callers must render
 * `atLeast` as "N+", never as an exact figure.
 *
 * This is a THIRD, distinct implementation from (a) this component's own
 * unexported `groupByDate` in StaffAvailabilityOverridesManager.tsx
 * (render-only grouping of whatever rows it is handed, no capping) and
 * (b) any page-level week-chip-only grouping — this one alone decides
 * slicing and saturation, upstream of the Manager.
 *
 * Duplicated (not imported) from the admin tree's equivalent helper in
 * `src/app/admin/availability/availability-data.ts` — the two directory
 * trees deliberately keep independent Manager components (see this file's
 * header comment above); same shape, written twice, not shared.
 */
export function groupAndCapStaffOverridesByDate(
  rows: StaffAvailabilityOverrideRow[],
  opts: { dateCap: number; rowTotal: number }
): { flattenedRows: StaffAvailabilityOverrideRow[]; dateTotal: StaffAvailabilityDateTotal } {
  const { dateCap, rowTotal } = opts;
  const saturated = rowTotal > rows.length;

  const dateOrder: string[] = [];
  const byDate = new Map<string, StaffAvailabilityOverrideRow[]>();
  for (const row of rows) {
    const existing = byDate.get(row.override_date);
    if (existing) {
      existing.push(row);
    } else {
      byDate.set(row.override_date, [row]);
      dateOrder.push(row.override_date);
    }
  }

  const cappedDates = new Set(dateOrder.slice(0, dateCap));
  const flattenedRows = rows.filter((row) => cappedDates.has(row.override_date));

  const dateTotal: StaffAvailabilityDateTotal = saturated
    ? { kind: "atLeast", value: dateOrder.length }
    : { kind: "exact", value: dateOrder.length };

  return { flattenedRows, dateTotal };
}
```

**Why `dateOrder.push` + `Set` rather than reusing the Manager's `groupByDate`:** the Manager's version is
unexported and builds `OverrideDay[]` (with segment sub-sorting) purely for rendering — it cannot be
imported into `lib.ts` (module boundary) and is the wrong return shape even if it could be. This helper
needs to know *distinct-date order* and *row membership per date* to slice and flatten, not a rendered
`OverrideDay[]`.

**Upcoming bucket, no cap:** call the same helper with `dateCap: Number.POSITIVE_INFINITY` — see §5.
`Array.prototype.slice(0, Infinity)` returns the full array, so this is a genuine "no cap" call, not a
second code path. No admin-tree wording was assumed for this; it directly satisfies the plan's own
"(or an equivalent unconditional grouping call with no cap applied)" fallback (§6.4 upcoming-bucket
paragraph).

## 5. `page.tsx` — exact before/after for both buckets

### 5a. Import statement (currently lines 13-19)

**Before:**
```ts
import {
  RESTRICTED_BG_SOFT,
  RESTRICTED_TEXT,
  STAFF_AVAILABILITY_PAST_CAP,
  STAFF_AVAILABILITY_PAST_VIEW_ALL_CAP,
  STAFF_AVAILABILITY_UPCOMING_DEFENSIVE_CAP,
} from "./lib";
```

**After:**
```ts
import {
  RESTRICTED_BG_SOFT,
  RESTRICTED_TEXT,
  STAFF_AVAILABILITY_PAST_CAP,
  STAFF_AVAILABILITY_PAST_ROW_FETCH_CEILING,
  STAFF_AVAILABILITY_PAST_VIEW_ALL_CAP,
  STAFF_AVAILABILITY_UPCOMING_DEFENSIVE_CAP,
  groupAndCapStaffOverridesByDate,
} from "./lib";
```

### 5b. Upcoming override query (lines 149-156) — **NO CHANGE**

Stays exactly as today. The plan is explicit that the upcoming bucket's row-fetch ceiling (500) is
unchanged; only how its result is *interpreted downstream* changes (5d).

### 5c. Past override query (lines 164-171)

**Before:**
```ts
    supabase
      .from("staff_availability_overrides")
      .select("id, override_date, start_time, end_time, reason")
      .eq("staff_id", staffId)
      .lt("override_date", today)
      .order("override_date", { ascending: false })
      .order("start_time", { ascending: true })
      .limit(adjPastViewAll ? STAFF_AVAILABILITY_PAST_VIEW_ALL_CAP : STAFF_AVAILABILITY_PAST_CAP),
```

**After:**
```ts
    supabase
      .from("staff_availability_overrides")
      .select("id, override_date, start_time, end_time, reason")
      .eq("staff_id", staffId)
      .lt("override_date", today)
      .order("override_date", { ascending: false })
      .order("start_time", { ascending: true })
      .limit(STAFF_AVAILABILITY_PAST_ROW_FETCH_CEILING),
```

The `.limit()` argument becomes **unconditional** on `adjPastViewAll` — the view-all toggle now only
selects `dateCap` downstream (5d), not the SQL row limit. Both head-count queries (lines 159-163,
172-176) are **unchanged** — they become the saturation detectors, not the displayed totals.

### 5d. New block — insert immediately after the `Promise.all` closes (after line 198's `]);`, before line 200's `// Per-section "Last saved by …" line…` comment)

```ts
  // Item 6 (Option A) — group the fetched override rows by date and slice to
  // the date cap. The `count: "exact", head: true` queries above are now the
  // truncation detectors (true row total vs rows actually fetched under the
  // ceiling), not the displayed totals, from here on.
  const overridesPastResult = groupAndCapStaffOverridesByDate(overridesPastData ?? [], {
    dateCap: adjPastViewAll ? STAFF_AVAILABILITY_PAST_VIEW_ALL_CAP : STAFF_AVAILABILITY_PAST_CAP,
    rowTotal: overridesPastTotal ?? 0,
  });
  const overridesUpcomingResult = groupAndCapStaffOverridesByDate(overridesUpcomingData ?? [], {
    dateCap: Number.POSITIVE_INFINITY, // upcoming has no view-all step to cap against
    rowTotal: overridesUpcomingTotal ?? 0,
  });
  if (
    overridesPastResult.dateTotal.kind === "atLeast" ||
    overridesUpcomingResult.dateTotal.kind === "atLeast"
  ) {
    console.warn(
      `[staff availability] override date total saturated for staff ${staffId}`,
      { past: overridesPastResult.dateTotal, upcoming: overridesUpcomingResult.dateTotal }
    );
  }
```

### 5e. `StaffAvailabilityOverridesManager` JSX call (lines 392-403)

**Before:**
```tsx
      <StaffAvailabilityOverridesManager
        staffId={staffId}
        upcoming={overridesUpcomingData ?? []}
        upcomingTotal={overridesUpcomingTotal ?? 0}
        past={overridesPastData ?? []}
        pastTotal={overridesPastTotal ?? 0}
        pastViewAll={adjPastViewAll}
        pastAllHref={adjPastAllHref}
        pastRecentHref={adjPastRecentHref}
        weeklyRules={availabilityRules ?? []}
        lastSavedBy={overridesTrail}
      />
```

**After:**
```tsx
      <StaffAvailabilityOverridesManager
        staffId={staffId}
        upcoming={overridesUpcomingResult.flattenedRows}
        upcomingTotal={overridesUpcomingResult.dateTotal.value}
        upcomingTotalIsLowerBound={overridesUpcomingResult.dateTotal.kind === "atLeast"}
        past={overridesPastResult.flattenedRows}
        pastTotal={overridesPastResult.dateTotal.value}
        pastTotalIsLowerBound={overridesPastResult.dateTotal.kind === "atLeast"}
        pastViewAll={adjPastViewAll}
        pastAllHref={adjPastAllHref}
        pastRecentHref={adjPastRecentHref}
        weeklyRules={availabilityRules ?? []}
        lastSavedBy={overridesTrail}
      />
```

**`StaffBlockedDatesManager`'s call (lines 379-390) is untouched** — different data (`blockedUpcomingData`
etc.), not part of this item, per 6.2/6.6.

## 6. `StaffAvailabilityOverridesManager.tsx` — every display site re-located BY SYMBOL, plus a real drift finding

### 6.0 DRIFT FOUND — the plan's/prior-audit's blast-radius claim for this component test is WRONG today

Both the plan (§6.6, "Not required: a new `StaffAvailabilityOverridesManager.test.tsx` file. None
exists today") and the prior item-6 deepening audit (`item-06-count-by-date.md` §7: *"StaffAvailabilityOverridesManager.tsx | No test file exists at all — pre-existing gap, not created by item 6"*)
state that **no test file exists for this component**.

**This is false as of the live tree.** `src/app/admin/staff/[staffId]/availability/StaffAvailabilityOverridesManager.test.tsx`
exists — 116 lines, 3 tests in one `describe` block — and was created in commit `5212bc4`
(`fix(availability): order override lists by start_time within a date`, the SAME commit that shipped
item 3), confirmed via `git log --oneline -- ".../StaffAvailabilityOverridesManager.test.tsx"`. The
file's own header says it explicitly: *"this file was created alongside item 3's secondary-sort change."*
Its three tests:
1. `"groups two segment rows on the same date into a single override entry"`
2. `"renders a date's segments in start-time order even when the input rows arrive out of order"`
3. `"renders the empty state when there are no upcoming overrides"`

**Consequence for this item:** this file's single `renderManager()` fixture builder (lines 62-79) passes
`upcoming`, `upcomingTotal`, `past`, `pastTotal`, `pastViewAll`, `pastAllHref`, `pastRecentHref`,
`weeklyRules` — **no `upcomingTotalIsLowerBound` / `pastTotalIsLowerBound`**. If those two new props are
added as **required**, this file fails to typecheck (`tsc --noEmit` regression) unless it is also edited.
None of its 3 assertions touch the badge/`"N of M"` text the new props feed, so if the two new props are
**optional, defaulting to `false`**, this file needs **zero edits** and keeps passing unmodified as a
genuine regression check — this is why §6.1 below makes them optional. **If the Owner prefers required
props for stricter typing instead**, the fix is a single one-line addition inside `renderManager()`'s JSX
(`upcomingTotalIsLowerBound={false} pastTotalIsLowerBound={false}`), not six separate call sites (this
file has one fixture builder, unlike the admin tree's `AvailabilityOverridesManager.test.tsx`, which the
prior audit says has six). **This file should be added to item 6's blast-radius file list for the staff
tree** — it does not need edits under the optional-prop design, but an implementer must know it exists
and re-run it as a regression check (§8 below), which the plan/prior-audit's "no test exists" framing
would cause someone to skip entirely.

*(I did not check whether the admin tree's `AvailabilityOverridesManager.tsx` has a similarly
undiscovered/newer test file — out of scope for this assignment, which was scoped to the staff tree
only. Worth a follow-up check given both trees' test files were touched by the same commit `5212bc4`.)*

### 6.1 Prop-type change — exact before/after (lines 100-118)

**Before:**
```ts
interface StaffAvailabilityOverridesManagerProps {
  staffId: string;
  /** C-16 Step 14 (N4) — `>= today`, defensive-capped only. Query-sorted ascending. */
  upcoming: StaffAvailabilityOverride[];
  /** Fix round (verify-FAIL Check 2, non-blocking) — true count of
   *  `override_date >= today` for this staff. Only differs from
   *  `upcoming.length` once the defensive cap is actually hit. */
  upcomingTotal: number;
  /** `< today`, capped (or view-all capped). Query-sorted newest-first. */
  past: StaffAvailabilityOverride[];
  /** True count of `override_date < today` for this staff — see lib.ts. */
  pastTotal: number;
  pastViewAll: boolean;
  pastAllHref: string;
  pastRecentHref: string;
  weeklyRules: WeeklyRule[];
  /** "Last saved by {actor} on {date}" line. */
  lastSavedBy?: string | null;
}
```

**After:**
```ts
interface StaffAvailabilityOverridesManagerProps {
  staffId: string;
  /** C-16 Step 14 (N4) — `>= today`, defensive-capped only. Query-sorted ascending. */
  upcoming: StaffAvailabilityOverride[];
  /** Item 6 — now a DATE count (was a row count pre-item-6). Only differs
   *  from `upcomingDays.length` once the defensive cap is actually hit. */
  upcomingTotal: number;
  /** Item 6 — true when `upcomingTotal` is a lower bound (the row-fetch
   *  ceiling truncated the fetch), not an exact date count. Optional,
   *  defaults to `false`, so StaffAvailabilityOverridesManager.test.tsx's
   *  existing fixtures (which predate this prop) keep compiling unmodified. */
  upcomingTotalIsLowerBound?: boolean;
  /** `< today`, capped (or view-all capped) BY DATE as of item 6. Query-sorted newest-first. */
  past: StaffAvailabilityOverride[];
  /** Item 6 — now a DATE count (was a row count pre-item-6). See lib.ts. */
  pastTotal: number;
  /** Same as upcomingTotalIsLowerBound, for the past bucket. */
  pastTotalIsLowerBound?: boolean;
  pastViewAll: boolean;
  pastAllHref: string;
  pastRecentHref: string;
  weeklyRules: WeeklyRule[];
  /** "Last saved by {actor} on {date}" line. */
  lastSavedBy?: string | null;
}
```

Destructure (lines 120-131) gains the two new params with defaults:

**Before:**
```ts
export function StaffAvailabilityOverridesManager({
  staffId,
  upcoming,
  upcomingTotal,
  past,
  pastTotal,
  pastViewAll,
  pastAllHref,
  pastRecentHref,
  weeklyRules,
  lastSavedBy,
}: StaffAvailabilityOverridesManagerProps) {
```

**After:**
```ts
export function StaffAvailabilityOverridesManager({
  staffId,
  upcoming,
  upcomingTotal,
  upcomingTotalIsLowerBound = false,
  past,
  pastTotal,
  pastTotalIsLowerBound = false,
  pastViewAll,
  pastAllHref,
  pastRecentHref,
  weeklyRules,
  lastSavedBy,
}: StaffAvailabilityOverridesManagerProps) {
```

No new imports are needed in this file — `STAFF_AVAILABILITY_PAST_ROW_FETCH_CEILING` and
`groupAndCapStaffOverridesByDate` are `page.tsx`-only; the Manager only receives already-computed totals
and already-capped rows as props, per the plan's explicit "do not change the Manager's prop contract to
accept `OverrideDay[]` directly" instruction (§6.4).

### 6.2 `pastShown` — re-located BY SYMBOL

Plan cites `:156-158`; **actual is lines 156-160** (drift of +2, consistent with item 3's already-landed
secondary-sort lines pushing everything down — not a surprise, but re-confirmed, not assumed).

**Before (lines 156-160):**
```ts
  const bannerState = resolveStaffAvailabilityBannerState({
    pastTotal,
    pastShown: past.length,
    viewAll: pastViewAll,
  });
```

**After:**
```ts
  const bannerState = resolveStaffAvailabilityBannerState({
    pastTotal,
    pastShown: pastDays.length,
    viewAll: pastViewAll,
  });
```

(`pastDays` already exists — `const pastDays = useMemo(() => groupByDate(past), [past]);` at line 150,
unchanged by this item.)

### 6.3 Badge — re-located BY SYMBOL

Plan cites `:272-275`; **actual is lines 268-276** (the whole `badge={...}` JSX prop, the two
interpolations the plan means are at lines 272-274 and 275 respectively — matches the plan's numbers for
the interpolations themselves, drift is only in how the surrounding block is bracketed).

**Before:**
```tsx
      badge={
        <span className="inline-flex rounded-full border border-[var(--admin-border)] bg-[var(--admin-panel)] px-2.5 py-0.5 text-xs font-medium text-[var(--admin-text-muted)]">
          {/* Fix round (verify-FAIL Check 2, non-blocking) — silent at 501+
              before this: the badge just showed `upcoming.length` with no
              way to tell a cap had been hit. */}
          {upcomingTotal > upcoming.length
            ? `${upcoming.length} of ${upcomingTotal} upcoming`
            : `${upcoming.length} upcoming`}
          {pastTotal ? ` · ${pastTotal} past` : ""}
        </span>
      }
```

**After:**
```tsx
      badge={
        <span className="inline-flex rounded-full border border-[var(--admin-border)] bg-[var(--admin-panel)] px-2.5 py-0.5 text-xs font-medium text-[var(--admin-text-muted)]">
          {/* Fix round (verify-FAIL Check 2, non-blocking) — silent at 501+
              before this: the badge just showed `upcoming.length` with no
              way to tell a cap had been hit. */}
          {upcomingTotal > upcomingDays.length
            ? `${upcomingDays.length} of ${upcomingTotal}${upcomingTotalIsLowerBound ? "+" : ""} upcoming`
            : `${upcomingDays.length} upcoming`}
          {pastTotal ? ` · ${pastTotal}${pastTotalIsLowerBound ? "+" : ""} past` : ""}
        </span>
      }
```

### 6.4 `past.length > 0` disclosure gate — re-located BY SYMBOL

Plan cites `:455`; **actual is line 455, exact match, no drift.**

**Before:** `{past.length > 0 ? (`
**After:** `{pastDays.length > 0 ? (`

### 6.5 `"N of M"` text — re-located BY SYMBOL

Plan cites `:458`; **actual is line 458, exact match, no drift.**

**Before:**
```tsx
<span>Past overrides ({pastViewAll ? past.length : `${past.length} of ${pastTotal}`})</span>
```

**After:**
```tsx
<span>Past overrides ({pastViewAll ? pastDays.length : `${pastDays.length} of ${pastTotal}${pastTotalIsLowerBound ? "+" : ""}`})</span>
```

### 6.6 Banner paragraphs (`bannerState.total` interpolations) — new site, not in the plan's table at all

The plan's §6.4 table for this tree lists only the 5 sites above (§6.2-6.5, minus the badge counted as
one). It does **not** mention the two places `bannerState.total` itself is rendered — because the plan's
§6.5.3 spec ("wherever they currently interpolate `{bannerState.total}`... render `${bannerState.total}+`")
is a *requirement*, not a located site. Re-located here by symbol, currently at **lines 471-500**:

**Before (lines 471-490, the `cappedOut` and `hidden` branches — `viewingAll`, lines 491-499, has no
total to interpolate and needs no change):**
```tsx
            {bannerState.kind === "cappedOut" ? (
              <p className="mt-3 border-t border-[var(--admin-border)] pt-3 text-xs text-[var(--admin-text-muted)]">
                Showing the first {STAFF_AVAILABILITY_PAST_VIEW_ALL_CAP} of {bannerState.total} past
                overrides. The rest aren&rsquo;t reachable from this list.{" "}
                <Link
                  href={pastRecentHref}
                  className="font-semibold text-[var(--admin-primary)] underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                >
                  Show recent {STAFF_AVAILABILITY_PAST_CAP} only
                </Link>
              </p>
            ) : bannerState.kind === "hidden" ? (
              <p className="mt-3 border-t border-[var(--admin-border)] pt-3 text-xs">
                <Link
                  href={pastAllHref}
                  className="font-semibold text-[var(--admin-primary)] underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                >
                  View all {bannerState.total} past overrides
                </Link>
              </p>
            ) : bannerState.kind === "viewingAll" ? (
```

**After:**
```tsx
            {bannerState.kind === "cappedOut" ? (
              <p className="mt-3 border-t border-[var(--admin-border)] pt-3 text-xs text-[var(--admin-text-muted)]">
                Showing the first {STAFF_AVAILABILITY_PAST_VIEW_ALL_CAP} of {bannerState.total}
                {pastTotalIsLowerBound ? "+" : ""} past
                overrides. The rest aren&rsquo;t reachable from this list.{" "}
                <Link
                  href={pastRecentHref}
                  className="font-semibold text-[var(--admin-primary)] underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                >
                  Show recent {STAFF_AVAILABILITY_PAST_CAP} only
                </Link>
              </p>
            ) : bannerState.kind === "hidden" ? (
              <p className="mt-3 border-t border-[var(--admin-border)] pt-3 text-xs">
                <Link
                  href={pastAllHref}
                  className="font-semibold text-[var(--admin-primary)] underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                >
                  View all {bannerState.total}{pastTotalIsLowerBound ? "+" : ""} past overrides
                </Link>
              </p>
            ) : bannerState.kind === "viewingAll" ? (
```

**Design decision made explicit (the plan leaves this genuinely open, per its own §12/§10.2-equivalent
framing for the admin tree):** I chose to apply the `+` suffix at **every** site that renders `pastTotal`/
`upcomingTotal` as a number to the user — badge, `"N of M"` text, and both banner paragraphs — not only
the two `bannerState.total` sites the plan's §6.5.3 wording narrowly names. Rationale: 6.5's top-level
requirement is "must render it as a lower bound... never as an exact figure," stated without scoping to
one render site; leaving the badge or `"N of M"` line showing a bare number while the banner two lines
below shows `200+` would itself be the exact kind of silently-wrong-exact-number defect this item exists
to eliminate. This is a **judgment call**, not a plan-mandated fact — flagging it rather than presenting
it as the only valid reading.

### 6.7 `upcomingDays.length === 0` empty-state gate (line 445) — **already date-based, confirmed NO CHANGE NEEDED**

`{upcomingDays.length === 0 ? (` at line 445 already uses `upcomingDays`, not `upcoming`. This site is
**not** in the plan's table (correctly — it was already correct) and this report confirms it independently:
no edit required here. Consistent with the fact that `EmptyOverridesState` gating for "upcoming" was
already right; only the *counts displayed* (badge/banner/`"N of M"`) were row-based, not the render gates
for the upcoming list itself.

### 6.8 Full site inventory, staff tree (supersedes the plan's table for this tree)

| Site | Line (current) | Now | Becomes |
|---|---|---|---|
| `resolveStaffAvailabilityBannerState` call | 156-160 | `pastShown: past.length` | `pastShown: pastDays.length` |
| Badge | 268-276 | `upcoming.length` / bare `pastTotal`/`upcomingTotal` | `upcomingDays.length`; `+`-suffixed totals |
| Disclosure gate | 455 | `past.length > 0` | `pastDays.length > 0` |
| `"N of M"` text | 458 | `past.length` / bare `pastTotal` | `pastDays.length`; `+`-suffixed `pastTotal` |
| `cappedOut` banner | 471-474 | bare `bannerState.total` | `+`-suffixed |
| `hidden` banner | 482-490 (total at ~488) | bare `bannerState.total` | `+`-suffixed |
| `viewingAll` banner | 491-499 | no total shown | **no change** |
| Empty-state gate | 445 | `upcomingDays.length === 0` | **no change — already correct** |

6 edited JSX/logic sites total (one more than the plan's 5-site table for this tree, because of the
banner-total sites in §6.6 the plan's table omitted for both trees).

## 7. `resolveStaffAvailabilityBannerState` — confirmed to need NO change

Read in full (lines 89-105):

```ts
export function resolveStaffAvailabilityBannerState(params: {
  pastTotal: number;
  pastShown: number;
  viewAll: boolean;
}): StaffAvailabilityBannerState {
  const { pastTotal, pastShown, viewAll } = params;
  if (viewAll && pastTotal > STAFF_AVAILABILITY_PAST_VIEW_ALL_CAP) {
    return { kind: "cappedOut", total: pastTotal };
  }
  if (pastTotal > pastShown) {
    return { kind: "hidden", total: pastTotal };
  }
  if (viewAll && pastTotal > STAFF_AVAILABILITY_PAST_CAP) {
    return { kind: "viewingAll", total: pastTotal };
  }
  return { kind: "none" };
}
```

**Confirmed pure and unit-agnostic**: three `number`/`boolean` inputs in, a discriminated union out, no
I/O, no knowledge of what `pastTotal`/`pastShown` count. `cappedOut` is checked **before** `hidden`
(lines 95-97 before 98-100) — confirmed, matches the plan's instruction not to reorder it. Feeding it
`pastShown: pastDays.length` and a `pastTotal` that is now a date count (§5d) requires **zero change to
this function** — exactly as the plan claims. **No edit made or needed here.**

The existing `"SABOTAGE TARGET"` test (`lib.test.ts:37-52`) already guards this branch order and needs
no new test. `lib.test.ts` (read in full, 53 lines, 4 `it()` blocks, one `describe`) has **no** second
"branch order independent of the sabotage test" case — the admin tree's `availability-data.test.ts` has
one extra test the staff file lacks (a pre-existing asymmetry, confirmed independently here, not
introduced by this item; optional to mirror, not required).

## 8. Verification this report recommends (not run — this is a derivation-only pass)

```bash
npx tsc --noEmit
npx vitest run "src/app/admin/staff/[staffId]/availability/__tests__/lib.test.ts"
npx vitest run "src/app/admin/staff/[staffId]/availability/StaffAvailabilityOverridesManager.test.tsx"
# ^ regression check only — §6.0's drift finding means this file MUST be
#   included in the verification command list; the plan/prior-audit's text
#   would cause it to be silently skipped.
npx vitest run
pnpm lint
```
Expected identity per the parent context: `tsc` 0; full suite 5 failed/2236 passed (2241), same five
named failures; lint 59E/7W in the same six files (none of which this item touches). I did not run these
— no code was changed by this pass — but the orchestrator should run them after applying §4-6.

## 9. Blast radius, staff tree only

**Edited:** `lib.ts`, `page.tsx`, `StaffAvailabilityOverridesManager.tsx`.
**Not edited, confirmed correct to leave alone:** `StaffBlockedDatesManager.tsx` (imports the same three
`STAFF_AVAILABILITY_*` symbols for the blocked-dates list, where rows already equal dates — §4's new
comment says so explicitly to head off an implementer "fixing" it), the blocked-dates queries in
`page.tsx` (lines 123-148), `actions.ts` (no `.limit()`/`.order()`/cap constants present, mutation-only).
**Test file needing awareness, not necessarily edits:** `StaffAvailabilityOverridesManager.test.tsx` —
see §6.0, the headline finding of this report.

## 10. Summary of every claim tested

| Claim (plan / prior audit) | Verdict |
|---|---|
| `STAFF_AVAILABILITY_PAST_CAP` = 25, line ~70 | CONFIRMED, line 70 exact |
| `STAFF_AVAILABILITY_PAST_VIEW_ALL_CAP` = 200, line ~71 | CONFIRMED, line 71 exact |
| `STAFF_AVAILABILITY_UPCOMING_DEFENSIVE_CAP` = 500, line ~73 | CONFIRMED, line 73 exact |
| lib.ts carries 9 oklch literals | CONFIRMED, lines 38,39,40,43,44,45,48,49,52, one per line |
| page.tsx past query at `:163-169` (plan) | DRIFT — actual `:164-171` (item 3's landed secondary sort shifted it) |
| page.tsx upcoming query at `:149-155` (plan) | DRIFT — actual `:149-156` |
| `pastShown: past.length` at `:156-158` (plan) | DRIFT — actual `:156-160` |
| upcoming badge at `:272-275` (plan) | Interpolations match exactly; block bracket differs (`:268-276`) |
| `` `${past.length} of ${pastTotal}` `` at `:458` | CONFIRMED exact, no drift |
| `past.length > 0` at `:455` | CONFIRMED exact, no drift |
| `resolveStaffAvailabilityBannerState` needs no change | CONFIRMED by reading it in full |
| No test file exists for `StaffAvailabilityOverridesManager.tsx` | **FALSE — DRIFT.** `StaffAvailabilityOverridesManager.test.tsx` exists (116 lines, 3 tests), created in `5212bc4` (item 3's commit) |
| Both override tables hold 0 rows (no live check possible) | Not independently re-queried in this pass (out of scope — no DB access was needed to derive code); prior audit's live SQL result is not re-disputed here |
