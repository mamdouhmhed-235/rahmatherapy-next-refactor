# ITEM 6, admin tree — derived change (Option A)

**Scope:** `src/app/admin/availability/availability-data.ts`, `page.tsx`, `AvailabilityOverridesManager.tsx` only. Staff tree (`lib.ts`, staff `page.tsx`, `StaffAvailabilityOverridesManager.tsx`) is a separate report (i6b).

**Read in full, this pass:** all three assigned files, plus `AvailabilityOverridesManager.test.tsx` and `__tests__/availability-data.test.ts` (to check what a prop-shape change would break), plus a targeted `Grep` on `BlockedDatesManager.tsx` and `actions.ts` to re-confirm two "must not touch" claims from the plan/prior audit.

**Stance:** every number/line below was re-read from the live file just now (2026-08-11), not copied from the plan or the prior audit (`item-06-count-by-date.md`, based on `33f895f`). Where they disagree, that's flagged as DRIFT, not silently reconciled.

---

## 1. Constants and helpers in `availability-data.ts` — confirmed / one correction

Current file, read in full (79 lines):

```ts
export const AVAILABILITY_PAST_CAP = 25;                    // line 44
export const AVAILABILITY_PAST_VIEW_ALL_CAP = 200;           // line 45
/** Defensive-only — see file header. Never paginated. */
export const AVAILABILITY_UPCOMING_DEFENSIVE_CAP = 500;      // line 47
```

- `AVAILABILITY_PAST_CAP = 25` — **CONFIRMED**, matches plan §6.4 and prior audit §2.
- `AVAILABILITY_PAST_VIEW_ALL_CAP = 200` — **CONFIRMED**.
- `AVAILABILITY_UPCOMING_DEFENSIVE_CAP = 500` — **CONFIRMED**. The task brief's phrasing ("the plan says the upcoming bucket fetches 500 defensively — VERIFY") is itself correct; there is nothing to correct here, the plan's number and the live code agree.

Header (lines 1–42) re-read in full:
- "~50-150 blocked dates and ~25-100 overrides over 5 years" — **CONFIRMED verbatim** (line 9).
- "Same shape duplicated (not shared) in staff/[staffId]/availability/lib.ts" — **CONFIRMED verbatim** (lines 38-42): *"the two directory trees already keep independent Manager components (BlockedDatesManager vs StaffBlockedDatesManager), and this step doesn't introduce new cross-tree coupling."* This is the load-bearing constraint for §4 below (the new helper is NOT extracted to a shared module).
- `resolveAvailabilityBannerState` (lines 63-79) — pure, takes only `{ pastTotal, pastShown, viewAll }`, no I/O. Branch order confirmed: `cappedOut` (line 69) checked before `hidden` (line 72) before `viewingAll` (line 75). **This function's body is not touched by this design.**

No drift in this file vs. the plan/prior audit — the file has not changed since `33f895f` (no item currently in flight edits it).

---

## 2. `page.tsx` override query block — DRIFT FOUND (item 3 already landed)

The plan (§6.4) and the prior audit (§1, "NO DRIFT FOUND") both cite the past bucket at `:287-292` and its count query at `:293-296`, against a tree that did **not** yet have item 3's secondary `.order("start_time")` sort. **Item 3 has since shipped** (`5212bc4`, confirmed by the task brief and independently by what's actually in the file below). That added one line to each of the two override list queries (upcoming and past), shifting every line number after it down. Re-read today, full `Promise.all` block:

**Upcoming bucket (overrides) — now `page.tsx:276-282`** (was `:276-280` pre-item-3):
```ts
    supabase
      .from("availability_overrides")
      .select("*")
      .gte("override_date", today)
      .order("override_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(AVAILABILITY_UPCOMING_DEFENSIVE_CAP),
```

**Upcoming count — now `page.tsx:285-288`** (was `:283-286`):
```ts
    supabase
      .from("availability_overrides")
      .select("id", { count: "exact", head: true })
      .gte("override_date", today),
```

**Past bucket (overrides) — now `page.tsx:289-295`** (plan said `:287-292`, prior audit confirmed `:287-292` against the pre-item-3 tree — both now stale by 2 lines):
```ts
    supabase
      .from("availability_overrides")
      .select("*")
      .lt("override_date", today)
      .order("override_date", { ascending: false })
      .order("start_time", { ascending: true })
      .limit(adjPastViewAll ? AVAILABILITY_PAST_VIEW_ALL_CAP : AVAILABILITY_PAST_CAP),
```

**Past count — now `page.tsx:296-299`** (was `:293-296`):
```ts
    supabase
      .from("availability_overrides")
      .select("id", { count: "exact", head: true })
      .lt("override_date", today),
```

**Verdict: DRIFT, fully explained.** Every override query gained exactly one line (`.order("start_time", { ascending: true })`), and downstream lines shifted accordingly. This does not change what item 6 needs to do — it changes only which literal line numbers an implementer should search for. Re-locate by symbol (`.from("availability_overrides")` + `.lt(`/`.gte(` + `.limit(`), not by the numbers quoted in the plan or the prior audit.

The variable-assignment block right after the `Promise.all` (currently `page.tsx:347-350`) is unchanged shape from what the plan describes:
```ts
const overridesUpcoming = (overridesUpcomingResult.data ?? []) as OverrideRow[];
const overridesUpcomingTotal = overridesUpcomingCountResult.count ?? 0;
const overridesPast = (overridesPastResult.data ?? []) as OverrideRow[];
const overridesPastTotal = overridesPastCountResult.count ?? 0;
```
This is the block that changes (§3-5 below). It sits between `weekClosures` (line 346) and `weekAdjustments` (line 351, the week-chip query result, `groupOverridesByDate`-fed — **not touched**).

The JSX call site (currently `page.tsx:515-525`):
```tsx
        adjustmentsSlot={
          <AvailabilityOverridesManager
            upcoming={overridesUpcoming}
            upcomingTotal={overridesUpcomingTotal}
            past={overridesPast}
            pastTotal={overridesPastTotal}
            pastViewAll={adjPastViewAll}
            pastAllHref={adjPastAllHref}
            pastRecentHref={adjPastRecentHref}
            rules={rules}
            lastSavedBy={overridesTrail}
          />
        }
```

---

## 3. The row-fetch ceiling — exact name, value, arithmetic

```ts
/**
 * Row-fetch ceiling for the past-overrides query — NOT the displayed cap.
 * `AVAILABILITY_PAST_CAP`/`AVAILABILITY_PAST_VIEW_ALL_CAP` count DATES (see
 * their comments below); C-14 Phase C dropped the unique constraint on
 * `override_date`, so a date is now 1+ rows. The query must therefore fetch
 * more ROWS than the largest DATE cap needs, so grouping-then-slicing in
 * code can still find that many distinct dates.
 *
 * Arithmetic: AVAILABILITY_PAST_VIEW_ALL_CAP (200 dates, the largest cap
 * this ceiling must cover) x 4 (a generous worst case for segments-per-date
 * — most adjusted dates are 1 segment, a handful have a single lunch break
 * i.e. 2; 4 already assumes every one of the 200 dates has 3 breaks) = 800.
 */
export const AVAILABILITY_PAST_ROW_FETCH_CEILING = 800;
```

Placed immediately after `AVAILABILITY_UPCOMING_DEFENSIVE_CAP` (after current line 47) in `availability-data.ts`.

**Caveat to flag, not to silently fix:** 200 × 4 = 800 exactly — zero slack margin. If the *actual* worst-case date in the fetched window has more than 4 segments, and enough other dates in the same window also run above-average, the ceiling could truncate before the 200th distinct date is fully represented, and — per the saturation math below — this shows up correctly as `saturated = true` (the exact `rowTotal` count exceeds `rows.length`), so the UI would still correctly downgrade to a lower-bound "200+" render rather than silently under-reporting as an exact number. The ceiling value is a defensive-ceiling choice (matching `SCOPED_BRANCH_ROW_CAP` / `PRIVACY_NOTES_VIEW_ALL_CAP` precedent, per the plan's own citation), not a hard correctness guarantee by itself — the saturation flag is what makes the design safe even if 800 turns out to be tight. Per plan §6.11 stop condition 5, if this ever fires at real volume, that's a signal for Owner re-evaluation, not a silent bump.

---

## 4. The grouping/slicing helper

**File: `availability-data.ts`** — confirmed the right home. The file's own header says "SERVER + CLIENT — pure constants/helpers only (no I/O)" (line 1), and the new helper is pure (no Supabase, no React) — same category as `resolveAvailabilityBannerState` already there.

**Naming deviation from the plan's literal suggestion, flagged explicitly:** §6.4 suggests `groupAndCapPastByDate`, then in the very same section says the upcoming bucket must run through "the same `groupAndCapPastByDate`-shaped helper" — i.e. the plan's own text expects one function serving both buckets, despite naming it `...Past...`. Since it genuinely serves both `past` and `upcoming`, I'm naming it **`groupAndCapOverridesByDate`** instead. This is a considered choice, not silent drift — flagging so the Owner/implementer can override it if `groupAndCapPastByDate` is preferred for some reason not visible from the code (e.g. matching a test file already written elsewhere — none currently exists).

**Exact implementation:**

```ts
export type DateTotal =
  | { kind: "exact"; value: number }
  | { kind: "atLeast"; value: number };

/**
 * Groups override rows by `override_date`, keeps only the first `dateCap`
 * distinct dates (all of that date's rows, never a partial date — a date's
 * rows are matched by Set membership, so they're always kept or dropped as
 * a whole), and flattens back to rows in their original order. Omit
 * `dateCap` to keep every date found (the upcoming bucket has no cap).
 *
 * `rowTotal` must be the exact `count: "exact", head: true` row count for
 * the SAME filter `rows` was fetched under. If it's larger than
 * `rows.length`, the row-fetch ceiling (`AVAILABILITY_PAST_ROW_FETCH_CEILING`
 * / `AVAILABILITY_UPCOMING_DEFENSIVE_CAP`) truncated the fetch before every
 * row was read — in that case `dateTotal` is only a LOWER BOUND on the true
 * number of distinct dates (there could be more dates among the rows that
 * were never fetched at all), never an exact figure. Callers must render it
 * as such, never as a plain number.
 *
 * `rows` must already be ordered by `override_date` (ties broken by
 * `start_time`) — both callers in page.tsx already provide this.
 *
 * Distinct from, and must NOT be merged with:
 *  - AvailabilityOverridesManager.tsx's private `groupByDate` — builds
 *    `OverrideDay[]` for RENDERING whatever rows it's handed; runs AFTER
 *    this helper, on this helper's `flattenedRows` output, exactly as it
 *    does today.
 *  - page.tsx's own `groupOverridesByDate` — feeds ONLY the current-week
 *    `CapacityPreview` chip, has no capping/saturation concept, and stays
 *    untouched.
 */
export function groupAndCapOverridesByDate<T extends { override_date: string }>(
  rows: T[],
  opts: { dateCap?: number; rowTotal: number }
): { flattenedRows: T[]; dateTotal: DateTotal } {
  const { dateCap, rowTotal } = opts;
  const saturated = rowTotal > rows.length;

  const datesInOrder: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!seen.has(row.override_date)) {
      seen.add(row.override_date);
      datesInOrder.push(row.override_date);
    }
  }

  const keptDates = new Set(
    dateCap === undefined ? datesInOrder : datesInOrder.slice(0, dateCap)
  );
  const flattenedRows = rows.filter((row) => keptDates.has(row.override_date));

  return {
    flattenedRows,
    dateTotal: saturated
      ? { kind: "atLeast", value: datesInOrder.length }
      : { kind: "exact", value: datesInOrder.length },
  };
}
```

Why this satisfies the "never split a date's segments across the boundary" test (§6.10): `keptDates` is a set of whole dates; `flattenedRows` is a `.filter()` on set membership, so every row of a kept date is kept and every row of a dropped date is dropped — there is no code path that keeps some but not all of one date's rows.

Why it's generic rather than importing a row type: `availability-data.ts` currently defines no `OverrideRow`/`AvailabilityOverride`-shaped interface of its own (that type lives separately, and differently named, in `page.tsx` — `OverrideRow` — and in `AvailabilityOverridesManager.tsx` — `AvailabilityOverride`, structurally identical, already passed across that boundary today with no cast). A generic `T extends { override_date: string }` avoids importing from `page.tsx` (which would be a reverse import — `page.tsx` imports FROM `availability-data.ts`, never the other way) and avoids adding a third redundant type definition.

**Comment updates on the two existing constants** (§6.4's instruction: change the unit description, without implying `BlockedDatesManager.tsx`'s usage is affected):

```ts
/**
 * For hour-adjustment ("override") consumers, this counts DATES, not rows —
 * C-14 Phase C dropped the unique constraint on `override_date`, so an
 * adjusted date can now be 2+ rows (one per bookable segment). For
 * blocked-dates consumers (BlockedDatesManager.tsx), rows and dates are
 * still identical — `blocked_dates` was not touched by that migration — so
 * this same value and meaning continues to apply there unchanged.
 */
export const AVAILABILITY_PAST_CAP = 25;
/** See AVAILABILITY_PAST_CAP's comment immediately above — same distinction. */
export const AVAILABILITY_PAST_VIEW_ALL_CAP = 200;
```

---

## 5. The `count: "exact", head: true` queries — role change, exact wiring

Both count queries (§2 above, `page.tsx:285-288` and `:296-299`) are **kept verbatim, zero code change** — only what their results feed into changes. Replace the current variable-assignment block (currently `page.tsx:347-350`, four lines) with:

```ts
  // Item 6 — C-14 Phase C dropped the unique constraint on `override_date`,
  // so an adjusted date is now 1+ rows. AVAILABILITY_PAST_CAP/
  // AVAILABILITY_PAST_VIEW_ALL_CAP count DATES; group the row-ceiling-
  // limited fetch by date and slice to the date cap. The exact row-count
  // queries above are no longer the displayed total — they're the
  // saturation detector: if the true row count exceeds what the ceiling
  // actually returned, the fetch was truncated and the date total below is
  // a lower bound, not exact.
  const overridesUpcomingRowTotal = overridesUpcomingCountResult.count ?? 0;
  const {
    flattenedRows: overridesUpcoming,
    dateTotal: overridesUpcomingDateTotal,
  } = groupAndCapOverridesByDate(
    (overridesUpcomingResult.data ?? []) as OverrideRow[],
    { rowTotal: overridesUpcomingRowTotal }
  );
  const overridesUpcomingTotal = overridesUpcomingDateTotal.value;
  const overridesUpcomingTotalIsLowerBound = overridesUpcomingDateTotal.kind === "atLeast";

  const overridesPastRowTotal = overridesPastCountResult.count ?? 0;
  const {
    flattenedRows: overridesPast,
    dateTotal: overridesPastDateTotal,
  } = groupAndCapOverridesByDate(
    (overridesPastResult.data ?? []) as OverrideRow[],
    {
      dateCap: adjPastViewAll ? AVAILABILITY_PAST_VIEW_ALL_CAP : AVAILABILITY_PAST_CAP,
      rowTotal: overridesPastRowTotal,
    }
  );
  const overridesPastTotal = overridesPastDateTotal.value;
  const overridesPastTotalIsLowerBound = overridesPastDateTotal.kind === "atLeast";

  // 6.5.4 — no existing read-path logging sink; console.warn is cheap,
  // visible in server logs, and matches "unreachable at current volume".
  if (overridesUpcomingTotalIsLowerBound) {
    console.warn(
      `[admin/availability] upcoming override row-fetch ceiling (${AVAILABILITY_UPCOMING_DEFENSIVE_CAP}) was hit — date total is a lower bound (${overridesUpcomingTotal}+).`
    );
  }
  if (overridesPastTotalIsLowerBound) {
    console.warn(
      `[admin/availability] past override row-fetch ceiling (${AVAILABILITY_PAST_ROW_FETCH_CEILING}) was hit — date total is a lower bound (${overridesPastTotal}+).`
    );
  }
```

Note the upcoming call omits `dateCap` entirely (per the helper's `dateCap?: number` — "omit to keep every date found"), matching §6.4's "no view-all step" instruction for the upcoming bucket without needing an `Infinity` sentinel.

**Import change** (`page.tsx:20-24`):
```diff
 import {
   AVAILABILITY_PAST_CAP,
+  AVAILABILITY_PAST_ROW_FETCH_CEILING,
   AVAILABILITY_PAST_VIEW_ALL_CAP,
   AVAILABILITY_UPCOMING_DEFENSIVE_CAP,
+  groupAndCapOverridesByDate,
 } from "./availability-data";
```

**Query change** — the past bucket's `.limit()` (currently the last line of the query at `page.tsx:295`):
```diff
-      .limit(adjPastViewAll ? AVAILABILITY_PAST_VIEW_ALL_CAP : AVAILABILITY_PAST_CAP),
+      .limit(AVAILABILITY_PAST_ROW_FETCH_CEILING),
```
The upcoming bucket's `.limit(AVAILABILITY_UPCOMING_DEFENSIVE_CAP)` (currently `page.tsx:282`) is **unchanged** — per plan §6.4/§6.8/§6.11 stop condition 5, that ceiling stays 500, unmodified, "unreachable at current volume."

**JSX call site** (`page.tsx:515-525`) — add the two new boolean props:
```diff
         adjustmentsSlot={
           <AvailabilityOverridesManager
             upcoming={overridesUpcoming}
             upcomingTotal={overridesUpcomingTotal}
+            upcomingTotalIsLowerBound={overridesUpcomingTotalIsLowerBound}
             past={overridesPast}
             pastTotal={overridesPastTotal}
+            pastTotalIsLowerBound={overridesPastTotalIsLowerBound}
             pastViewAll={adjPastViewAll}
             pastAllHref={adjPastAllHref}
             pastRecentHref={adjPastRecentHref}
             rules={rules}
             lastSavedBy={overridesTrail}
           />
         }
```

---

## 6. `AvailabilityOverridesManager.tsx` — every site re-located, exact before/after

Re-read the full 530-line file. **No drift** vs. the plan's/prior audit's line numbers for this file specifically (unlike `page.tsx`, item 3 didn't touch this component). Every citation below is current, verified today.

### 6a. Props interface (`:45-62`)

Before:
```ts
interface AvailabilityOverridesManagerProps {
  /** C-16 Step 14 (N3) — `>= today`, defensive-capped only. Query-sorted ascending. */
  upcoming: AvailabilityOverride[];
  /** Fix round (verify-FAIL Check 2, non-blocking) — true count of
   *  `override_date >= today`. Only differs from `upcoming.length` once the
   *  defensive cap is actually hit. */
  upcomingTotal: number;
  /** `< today`, capped (or view-all capped). Query-sorted newest-first. */
  past: AvailabilityOverride[];
  /** True count of `override_date < today` — see availability-data.ts. */
  pastTotal: number;
  pastViewAll: boolean;
  pastAllHref: string;
  pastRecentHref: string;
  rules: AvailabilityRule[];
  /** "Last saved by {actor} on {date}" line for the panel description. */
  lastSavedBy?: string | null;
}
```

After:
```ts
interface AvailabilityOverridesManagerProps {
  /** C-16 Step 14 (N3) — `>= today`, defensive-capped only. Query-sorted ascending. */
  upcoming: AvailabilityOverride[];
  /** Item 6 — count of DISTINCT DATES with `override_date >= today` (not
   *  rows: since C-14 a date can be 2+ segment rows). Only differs from
   *  `upcomingDays.length` once the row-fetch ceiling is actually hit. */
  upcomingTotal: number;
  /** Item 6 — true when `upcomingTotal` is a LOWER BOUND, not exact: the
   *  row-fetch ceiling truncated the fetch before every row was read. See
   *  `groupAndCapOverridesByDate` in availability-data.ts. Optional so
   *  existing test call sites that don't pass it keep type-checking
   *  (treated as falsy when omitted). */
  upcomingTotalIsLowerBound?: boolean;
  /** `< today`, capped (or view-all capped) BY DATE. Query-sorted newest-first. */
  past: AvailabilityOverride[];
  /** Item 6 — count of DISTINCT DATES with `override_date < today` (not
   *  rows) — see availability-data.ts. */
  pastTotal: number;
  /** Item 6 — true when `pastTotal` is a LOWER BOUND, not exact — see
   *  `upcomingTotalIsLowerBound`. */
  pastTotalIsLowerBound?: boolean;
  pastViewAll: boolean;
  pastAllHref: string;
  pastRecentHref: string;
  rules: AvailabilityRule[];
  /** "Last saved by {actor} on {date}" line for the panel description. */
  lastSavedBy?: string | null;
}
```

**Why optional, not required — verified, not assumed:** I read `AvailabilityOverridesManager.test.tsx` in full. Its `renderManager()` helper (`:62-76`) constructs props with `upcoming`, `upcomingTotal`, `past`, `pastTotal`, `pastViewAll`, `pastAllHref`, `pastRecentHref`, `rules` only — **no `upcomingTotalIsLowerBound`/`pastTotalIsLowerBound` at any of its 6 call sites**. Plan §6.6/§6.9 and the prior audit both say this file "should pass unmodified as a regression check, not require rewriting." Making the two new props `boolean` (required) would fail `tsc --noEmit` against this file's existing calls; making them `?: boolean` keeps every existing call site type-correct with the new props defaulting to `undefined` (falsy). This is the concrete resolution of plan §6.11 stop condition 1 (sibling-boolean vs. union) — sibling-boolean, and **optional**, which the plan's own text didn't specify but is required for the "don't touch the test file" constraint to hold.

### 6b. Destructure (`:124-134`)

Before:
```ts
export function AvailabilityOverridesManager({
  upcoming,
  upcomingTotal,
  past,
  pastTotal,
  pastViewAll,
  pastAllHref,
  pastRecentHref,
  rules,
  lastSavedBy,
}: AvailabilityOverridesManagerProps) {
```

After:
```ts
export function AvailabilityOverridesManager({
  upcoming,
  upcomingTotal,
  upcomingTotalIsLowerBound,
  past,
  pastTotal,
  pastTotalIsLowerBound,
  pastViewAll,
  pastAllHref,
  pastRecentHref,
  rules,
  lastSavedBy,
}: AvailabilityOverridesManagerProps) {
```

### 6c. `bannerState` call — `:153-157`

Before:
```ts
  const bannerState = resolveAvailabilityBannerState({
    pastTotal,
    pastShown: past.length,
    viewAll: pastViewAll,
  });
```
After:
```ts
  const bannerState = resolveAvailabilityBannerState({
    pastTotal,
    pastShown: pastDays.length,
    viewAll: pastViewAll,
  });
```
`pastDays` is already in scope (`useMemo(() => groupByDate(past), [past])`, line 147, precedes line 153). **`resolveAvailabilityBannerState` itself is not touched** — only what's fed into it.

### 6d. Badge — `:261-264`

Before:
```tsx
          {upcomingTotal > upcoming.length
            ? `${upcoming.length} of ${upcomingTotal} upcoming`
            : `${upcoming.length} upcoming`}
          {pastTotal ? ` · ${pastTotal} past` : ""}
```
After:
```tsx
          {upcomingTotal > upcomingDays.length
            ? `${upcomingDays.length} of ${upcomingTotal} upcoming`
            : `${upcomingDays.length} upcoming`}
          {pastTotal ? ` · ${pastTotal} past` : ""}
```
`upcoming.length` → `upcomingDays.length` in both branches (unit-comparison fix, §6.4's explicit requirement). `pastTotal` line is untouched in shape — see the open question in §7 below about whether it should carry a "+" suffix.

### 6e. `<details>` disclosure gate — `:418`

Before: `{past.length > 0 ? (`
After: `{pastDays.length > 0 ? (`

**Not in the plan's own §6.4 table** (its staff-tree sibling, `StaffAvailabilityOverridesManager.tsx:455`, IS tabled) — flagged as a gap by the prior audit (§5/§9.3) and included here for consistency. Truth-equivalent today (0 rows ⇔ 0 dates, always, given `flattenedRows` only ever contains whole dates per §4's `keptDates` design), so this is a no-behavior-change consistency fix, not a bug fix.

### 6f. Disclosure summary text — `:421`

Before:
```tsx
<span>Past adjustments ({pastViewAll ? past.length : `${past.length} of ${pastTotal}`})</span>
```
After:
```tsx
<span>Past adjustments ({pastViewAll ? pastDays.length : `${pastDays.length} of ${pastTotal}`})</span>
```

### 6g. Saturation "+" — exact sites, per plan §6.5.3's literal scope

§6.5.3 says the lower-bound suffix belongs "inside the Manager's JSX wherever it currently interpolates `{bannerState.total}`" — a narrower scope than every place `pastTotal`/`upcomingTotal` render. `bannerState.total` appears at exactly two places, both inside the `cappedOut`/`hidden` branches (`:434-463`):

`:436` before:
```tsx
                Showing the first {AVAILABILITY_PAST_VIEW_ALL_CAP} of {bannerState.total} past
                adjustments. The rest aren&rsquo;t reachable from this list.{" "}
```
after:
```tsx
                Showing the first {AVAILABILITY_PAST_VIEW_ALL_CAP} of {bannerState.total}
                {pastTotalIsLowerBound ? "+" : ""} past adjustments. The rest
                aren&rsquo;t reachable from this list.{" "}
```

`:451` before:
```tsx
                  View all {bannerState.total} past adjustments
```
after:
```tsx
                  View all {bannerState.total}{pastTotalIsLowerBound ? "+" : ""} past adjustments
```

The `viewingAll` branch (`:454-462`) never interpolates `bannerState.total` at all (it only shows the literal `AVAILABILITY_PAST_CAP`), so it needs no change.

**Open question I'm flagging, not resolving unilaterally:** applying strict §6.5.3, the top badge (`:264`, `` `· ${pastTotal} past` ``) and the disclosure summary (`:421`, `` `${pastDays.length} of ${pastTotal}` ``) do **not** get the "+" suffix, because neither interpolates `bannerState.total` — they use the raw `pastTotal` prop. The result: if saturation is ever true, the badge and summary line would read "· 200 past" / "200 of 200" while the expanded disclosure banner (when `cappedOut`/`hidden` fires) reads "200+ past". That's an inconsistent user-facing number in two places on the same panel. I implemented the literal plan scope above; extending "+" to `:264` and `:421` as well is a one-line-each change if the Owner wants full consistency instead of matching the plan's literal text — flagging this rather than silently picking one, per the task's "report drift, don't silently adjust" instruction. (At current volume — 0 rows in both override tables — this branch is unreachable either way; see §16 of the prior audit, re-confirmed live in the plan text itself, §6.1: "Both override tables hold 0 rows today.")

### 6h. Nothing else in this file changes

- `groupByDate` (`:75-100`), `upcomingDays`/`pastDays` (`:146-147`), the `EmptyState` gate at `:403` (`upcomingDays.length === 0` — **already date-based today**, confirmed by direct read, not touched), `OverrideRow` (`:471-529`) — all unchanged.
- Imports (`:23-27`, `AVAILABILITY_PAST_CAP`/`AVAILABILITY_PAST_VIEW_ALL_CAP`/`resolveAvailabilityBannerState`) — unchanged; this file does not need `groupAndCapOverridesByDate` or `DateTotal`, since that logic lives entirely in `page.tsx`/`availability-data.ts` before this component ever sees the rows.

---

## 7. What must NOT change — confirmed by direct reading

- **`resolveAvailabilityBannerState`'s own body** (`availability-data.ts:63-79`) — confirmed untouched by every edit above; only its call site's `pastShown` argument changes (§6c). The `cappedOut`-before-`hidden` branch order (lines 69/72) is not reordered.
- **The week-capacity chip** — `page.tsx:491`, `weekAdjustments={weekAdjustmentsByDate.size}` — confirmed present, unchanged, reads `.size` of the by-date `Map` already. `groupOverridesByDate` (`page.tsx:174-185`, feeds this chip and nothing else) is untouched; it has no cap/saturation concept and none is added.
- **`BlockedDatesManager.tsx`** — re-confirmed live via `Grep` this pass: imports `AVAILABILITY_PAST_CAP`, `AVAILABILITY_PAST_VIEW_ALL_CAP`, `resolveAvailabilityBannerState` at lines 19-21, uses them at 91, 392, 398, 416 (exact match to the prior audit's citation, no drift). Not edited. The two constants keep the same numeric values (§1/§4), so this file's behavior is unaffected by the comment-only change.
- **`src/app/admin/availability/actions.ts`** — re-confirmed live via `Grep`: the only `override_date` references are `.eq("override_date", date)` whole-date deletes/inserts (lines 310, 315, 323, 376, 385); no `.limit(`/`.order(` present at all. Unaffected.
- **`AvailabilityOverridesManager.test.tsx`'s 6 existing tests** — confirmed by full read: none assert a numeric relationship between `past.length`/`upcoming.length` and `pastTotal`/`upcomingTotal` that only holds under row-counting; all pass `pastTotal: 0`/rely on defaults. They should pass unmodified — this is *why* the two new props must be optional (§6a).

---

## 8. Blast radius summary (admin tree only)

**Edited:**
- `src/app/admin/availability/availability-data.ts` — new constant, new type, new function, two comment updates.
- `src/app/admin/availability/page.tsx` — import list, one `.limit()` call, the 4-line variable block replaced with the block in §5, two new JSX props.
- `src/app/admin/availability/AvailabilityOverridesManager.tsx` — 2 props added (interface + destructure), 6 call-site edits (§6c–6g).

**Not edited (confirmed, not assumed):** `BlockedDatesManager.tsx`, `AvailabilityRulesManager.tsx`, `WorkingHoursDayEditor.tsx`, `actions.ts`, `AvailabilityOverridesManager.test.tsx`, `__tests__/page.test.ts`, `__tests__/actions.test.ts`.

**New tests belong in** `src/app/admin/availability/__tests__/availability-data.test.ts` (new `describe("groupAndCapOverridesByDate", ...)` block, importing from `../availability-data`), per plan §6.10's six-test table. Not written out in full here (out of this report's 7 numbered questions) — the exported signature in §4 is sufficient to write them directly against.

---

## 9. Verification this report performed

- Read `availability-data.ts`, `page.tsx`, `AvailabilityOverridesManager.tsx` in full (not excerpted) — all citations above are from those direct reads, dated today.
- Read `AvailabilityOverridesManager.test.tsx` and `__tests__/availability-data.test.ts` in full to verify the "optional props" design decision against the actual test code, not the plan's paraphrase of it.
- `Grep`-verified `BlockedDatesManager.tsx`'s import/usage lines and `actions.ts`'s absence of `.limit()`/`.order()` beyond whole-date `.eq()` filters.
- Did **not** run `tsc`/`vitest`/`lint` — this report derives the change for the orchestrator to apply; it does not implement or verify a running build.
