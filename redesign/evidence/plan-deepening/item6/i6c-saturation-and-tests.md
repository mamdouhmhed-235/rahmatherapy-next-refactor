# ITEM 6c — saturation disclosure plumbing + complete test set

**Scope of this report:** PART 1 (exact saturation-disclosure plumbing, end to end) and PART 2 (complete
test set, both trees) for Plan ITEM 6, Option A. Read-only derivation — no `src/` file was modified.

**Base for anchors:** plan text re-read in full at `redesign/plans/POST-BAND-C-FOLLOWUP-plan.md` lines
1237–1461 (§6.1–§6.12). Prior audit re-read in full at
`redesign/evidence/plan-deepening/item-06-count-by-date.md`. Every symbol below was re-located by
reading the live file, not by trusting either document's line numbers.

---

## 0. Drift found before starting (report, not silently adjust)

1. **Item 3 has shipped** (`git show --stat 5212bc4`, confirmed: "order override lists by start_time
   within a date"). The plan's own §6.4 line numbers for the four override queries in `page.tsx`
   pre-date this commit and are now off by up to 2 lines each, because item 3 inserted a second
   `.order("start_time", …)` call into every query it touched. Re-verified live positions:

   | Query | Plan said | Actual (live) |
   |---|---|---|
   | admin upcoming overrides | `:275-280` | `:276-282` |
   | admin upcoming count | `:283-286` | `:285-288` |
   | admin past overrides | `:287-292` | `:289-295` |
   | admin past count | — | `:296-299` |
   | staff upcoming overrides | `:149-155` | `:149-156` |
   | staff upcoming count | `:156-162` | `:159-163` |
   | staff past overrides | `:163-169` | `:164-171` |
   | staff past count | — | `:172-176` |

   Not a defect — just confirming the plan's own rule ("re-locate by symbol, don't trust stored line
   numbers") is load-bearing here. All four queries now correctly carry the secondary `start_time` sort;
   nothing about the row/date-count defect this item fixes has changed shape.

2. **`AvailabilityOverridesManager.test.tsx` now has 7 tests, not 6.** The prior audit (§7, §15 of its
   findings) and the plan's own §6.6 ("six existing tests... pass `pastTotal: 0`") both say 6. Item 3's
   commit (`5212bc4`) added a 7th: `"renders a date's segments in start-time order even when the input
   rows arrive out of order"` (`AvailabilityOverridesManager.test.tsx:91-102`). All 7 still pass
   `pastTotal: 0` and assert nothing about numeric row/date equivalence — the "should pass unmodified"
   claim still holds, just against a count of 7, not 6.

3. **`StaffAvailabilityOverridesManager.test.tsx` now exists** (created by the same commit, `5212bc4`,
   its own header says so explicitly: "this file was created alongside item 3's secondary-sort change").
   3 tests: `"groups two segment rows on the same date into a single override entry"`, `"renders a date's
   segments in start-time order even when the input rows arrive out of order"`,
   `"renders the empty state when there are no upcoming overrides"`. This resolves the older audit's
   "no test file exists" gap and matches the task brief's framing of it as **"NEW as of 5212bc4"** —
   confirmed correct, no drift on this point.

---

## PART 1 — the saturation disclosure, exact end-to-end plumbing

### 1.1 Which function computes/returns the saturation flag

A new pure helper, added once per tree (duplicated, not shared — `availability-data.ts` header line 38,
`lib.ts` header lines 65-69, both re-confirmed live). Exact shape:

**`src/app/admin/availability/availability-data.ts`** — add, after `resolveAvailabilityBannerState`:

```ts
/**
 * C-14 Phase C dropped the unique constraint that made one override row equal
 * one override date. Rows must be grouped by date before they are counted or
 * capped — see this file's header. `rowTotal` is the exact row-count query's
 * result; `rows` is whatever the row-fetch ceiling actually returned. If
 * `rowTotal > rows.length`, the fetch itself was truncated: the number of
 * distinct dates found among `rows` is then only a LOWER BOUND on the true
 * date total, because more dates could exist among the rows never fetched.
 */
export interface AvailabilityOverrideRow {
  id: string;
  override_date: string;
  start_time: string;
  end_time: string;
  reason: string | null;
}

export type DateTotal =
  | { kind: "exact"; value: number }
  | { kind: "atLeast"; value: number };

export function groupAndCapPastByDate(
  rows: AvailabilityOverrideRow[],
  opts: { dateCap: number; rowTotal: number }
): { flattenedRows: AvailabilityOverrideRow[]; dateTotal: DateTotal } {
  const { dateCap, rowTotal } = opts;
  const saturated = rowTotal > rows.length;

  const byDate = new Map<string, AvailabilityOverrideRow[]>();
  for (const row of rows) {
    const bucket = byDate.get(row.override_date);
    if (bucket) bucket.push(row);
    else byDate.set(row.override_date, [row]);
  }

  const dates = [...byDate.keys()];
  const cappedDates = dates.slice(0, dateCap);
  const flattenedRows = cappedDates.flatMap((date) => byDate.get(date)!);

  const dateTotal: DateTotal = saturated
    ? { kind: "atLeast", value: dates.length }
    : { kind: "exact", value: dates.length };

  return { flattenedRows, dateTotal };
}
```

**`src/app/admin/staff/[staffId]/availability/lib.ts`** — same shape, staff-tree names, mirroring how
this file already names its duplicates (`STAFF_` prefix on constants, `Staff` infix on functions/types —
`resolveStaffAvailabilityBannerState`, `StaffAvailabilityBannerState`):

```ts
export interface StaffAvailabilityOverrideRow {
  id: string;
  override_date: string;
  start_time: string;
  end_time: string;
  reason: string | null;
}

export type StaffDateTotal =
  | { kind: "exact"; value: number }
  | { kind: "atLeast"; value: number };

export function groupAndCapStaffPastByDate(
  rows: StaffAvailabilityOverrideRow[],
  opts: { dateCap: number; rowTotal: number }
): { flattenedRows: StaffAvailabilityOverrideRow[]; dateTotal: StaffDateTotal } {
  // identical body to groupAndCapPastByDate
}
```

**Naming note — my proposal, not settled anywhere in the plan:** the plan's §6.4 gives the admin-tree
signature (`groupAndCapPastByDate`) but never states the staff-tree function/type names, only that they
must be duplicated. `groupAndCapStaffPastByDate` / `StaffDateTotal` are chosen to match this file's own
existing convention, not dictated by the plan — flag before implementing if a different naming is
preferred.

**Row-type note:** this is a **fourth** structurally-identical `{id, override_date, start_time, end_time,
reason}` shape in the codebase (page.tsx's private `OverrideRow`, the manager's private
`AvailabilityOverride`, `AvailabilityOverride`/`StaffAvailabilityOverride` in the two Manager `.tsx`
files). None of these are imported across each other today; TypeScript's structural typing means the new
exported `AvailabilityOverrideRow`/`StaffAvailabilityOverrideRow` types are assignment-compatible with
all of them without adding a single import — consistent with the file's own "duplicated, not shared"
rule, and the lowest-diff option.

**Where called (context, not this report's job to finalize query wiring):** `page.tsx`
`overridesUpcoming`/`overridesUpcomingTotal`/`overridesPast`/`overridesPastTotal` are currently assigned
at lines 347-350 (admin tree) straight from `.data`/`.count`. Both `groupAndCapPastByDate` calls
(upcoming and past) belong immediately after this block, before line 515's
`<AvailabilityOverridesManager …>` call. Upcoming has no date-level cap (per §6.4: "an equivalent
unconditional grouping call with no cap applied, since upcoming has no view-all step") — call it with
`dateCap: Number.POSITIVE_INFINITY` (`dates.slice(0, Infinity)` is valid JS and returns every date).

### 1.2 Which prop carries it into each Manager — name, type, both trees

Given `AvailabilityOverridesManager.test.tsx` and `StaffAvailabilityOverridesManager.test.tsx` both pass
`pastTotal: 0`/`pastTotal` as a bare `number` at every existing call site (10 sites combined: 7 in the
admin file via its `renderManager` default plus overrides, 3 in the staff file), and per §6.5.2's
lower-diff recommendation (elevated to a default by Stop Condition §6.11.1: *"Default to the
sibling-boolean recommendation in 6.5 unless there is a concrete reason to prefer the union"*):

**`AvailabilityOverridesManagerProps`** (`AvailabilityOverridesManager.tsx:45-62`) — add two **optional**
props, defaulting `false`, so every existing test call site keeps compiling and passing unmodified:

```ts
interface AvailabilityOverridesManagerProps {
  upcoming: AvailabilityOverride[];
  upcomingTotal: number;
  /** True when `upcomingTotal` is a LOWER BOUND (the upcoming row-fetch
   *  ceiling truncated), not an exact date count. See availability-data.ts's
   *  groupAndCapPastByDate. Defaults false — unreachable at current volume,
   *  but must render honestly if it ever fires. */
  upcomingTotalIsLowerBound?: boolean;
  past: AvailabilityOverride[];
  pastTotal: number;
  /** Same meaning as upcomingTotalIsLowerBound, for the past bucket. */
  pastTotalIsLowerBound?: boolean;
  pastViewAll: boolean;
  pastAllHref: string;
  pastRecentHref: string;
  rules: AvailabilityRule[];
  lastSavedBy?: string | null;
}
```

Destructure with defaults in the component signature:
```ts
export function AvailabilityOverridesManager({
  upcoming,
  upcomingTotal,
  upcomingTotalIsLowerBound = false,
  past,
  pastTotal,
  pastTotalIsLowerBound = false,
  pastViewAll,
  pastAllHref,
  pastRecentHref,
  rules,
  lastSavedBy,
}: AvailabilityOverridesManagerProps) {
```

**`StaffAvailabilityOverridesManagerProps`** (`StaffAvailabilityOverridesManager.tsx:100-118`) — identical
shape, same two prop names (`upcomingTotalIsLowerBound?: boolean`, `pastTotalIsLowerBound?: boolean`),
same defaulting.

### 1.3 Exactly which rendered strings change, and how — the plan's own vagueness, closed

**This is where the plan (§6.5.3) is genuinely under-specified, and the task brief is right to flag it.**
§6.5.3's literal text: *"wherever it currently interpolates `{bannerState.total}`, render
`` `${bannerState.total}+` `` instead... when the corresponding `*IsLowerBound` flag is true."* Read
literally, that sentence only reaches the two banner paragraphs that consume `bannerState.total`
(`cappedOut`/`hidden`) — **not** the badge fragment or the `<summary>` "N of M" text, both of which
render `pastTotal`/`upcomingTotal` directly, never through `bannerState.total`.

If implemented exactly as literally written, the result is internally inconsistent and reproduces the
**exact failure mode this section exists to prevent** — an invisible undercount, just relocated: the top
badge would say `"3 · 30 past"` (a bare, confident-looking number) two lines above a "View all 30+ past
adjustments" banner that just told the same user the true figure is unknown. A user glancing at the badge
alone — the more likely first read, since it's always visible and the banner is inside a closed
`<details>` — gets the old lie back.

**Resolution (this report's recommendation, needed because the plan doesn't reach far enough on its own
words):** apply the same `${total}${isLowerBound ? "+" : ""}` treatment to **every** user-facing
interpolation of `pastTotal`/`upcomingTotal`, not only the two that flow through `bannerState.total`.
This is consistent with §6.5's own governing sentence — *"A silent truncation here is a plan failure, not
an acceptable simplification"* — which is stated as a general principle, not scoped to the banner
specifically.

**Complete site-by-site table, `AvailabilityOverridesManager.tsx` (current live line numbers):**

| Site | Now (after §6.4's date-unit fix, before §6.5's saturation layer) | Becomes (§6.5, this report) |
|---|---|---|
| `:261-263` badge, upcoming | `` upcomingTotal > upcomingDays.length ? `${upcomingDays.length} of ${upcomingTotal} upcoming` : `${upcomingDays.length} upcoming` `` | `` upcomingTotal > upcomingDays.length ? `${upcomingDays.length} of ${upcomingTotal}${upcomingTotalIsLowerBound ? "+" : ""} upcoming` : `${upcomingDays.length} upcoming` `` |
| `:264` badge, past | `` pastTotal ? ` · ${pastTotal} past` : "" `` | `` pastTotal ? ` · ${pastTotal}${pastTotalIsLowerBound ? "+" : ""} past` : "" `` |
| `:421` `<summary>` "N of M" | `` pastViewAll ? pastDays.length : `${pastDays.length} of ${pastTotal}` `` | `` pastViewAll ? pastDays.length : `${pastDays.length} of ${pastTotal}${pastTotalIsLowerBound ? "+" : ""}` `` |
| `:436` `cappedOut` banner | `Showing the first {AVAILABILITY_PAST_VIEW_ALL_CAP} of {bannerState.total} past adjustments.` | `Showing the first {AVAILABILITY_PAST_VIEW_ALL_CAP} of {bannerState.total}{pastTotalIsLowerBound ? "+" : ""} past adjustments.` |
| `:451` `hidden` banner | `View all {bannerState.total} past adjustments` | `View all {bannerState.total}{pastTotalIsLowerBound ? "+" : ""} past adjustments` |
| `:460` `viewingAll` banner | `Show recent {AVAILABILITY_PAST_CAP} only` | **unchanged** — this branch names the cap, never the total; nothing to disclose |

**Same table, `StaffAvailabilityOverridesManager.tsx`:**

| Site | Now | Becomes |
|---|---|---|
| `:272-274` badge, upcoming | `` upcomingTotal > upcomingDays.length ? `${upcomingDays.length} of ${upcomingTotal} upcoming` : `${upcomingDays.length} upcoming` `` | `` …${upcomingTotal}${upcomingTotalIsLowerBound ? "+" : ""} upcoming`` … `` |
| `:275` badge, past | `` pastTotal ? ` · ${pastTotal} past` : "" `` | `` pastTotal ? ` · ${pastTotal}${pastTotalIsLowerBound ? "+" : ""} past` : "" `` |
| `:458` `<summary>` "N of M" | `` pastViewAll ? pastDays.length : `${pastDays.length} of ${pastTotal}` `` | `` …`${pastDays.length} of ${pastTotal}${pastTotalIsLowerBound ? "+" : ""}` `` |
| `:473` `cappedOut` banner | `Showing the first {STAFF_AVAILABILITY_PAST_VIEW_ALL_CAP} of {bannerState.total} past overrides.` | `…of {bannerState.total}{pastTotalIsLowerBound ? "+" : ""} past overrides.` |
| `:488` `hidden` banner | `View all {bannerState.total} past overrides` | `View all {bannerState.total}{pastTotalIsLowerBound ? "+" : ""} past overrides` |
| `:497` `viewingAll` banner | `Show recent {STAFF_AVAILABILITY_PAST_CAP} only` | unchanged |

**Real example strings** (`pastTotal = 30`, `pastTotalIsLowerBound = true`):
- Badge: `"· 30+ past"` (never `"· 30 past"`)
- Summary: `"12 of 30+"` (never `"12 of 30"`)
- Banner: `"View all 30+ past adjustments"` / `"Showing the first 200 of 30+…"` (the cappedOut case can't
  co-occur with a small `pastTotal` in practice, but the interpolation is the same either way)

`resolveAvailabilityBannerState`/`resolveStaffAvailabilityBannerState` are untouched — confirmed against
live code (`availability-data.ts:63-79`, `lib.ts:89-105`): both still take only
`{ pastTotal, pastShown, viewAll }` and return the same four-way union with no saturation concept. The
`+`-suffixing is display-only, applied at every JSX interpolation site listed above, never inside the
resolver.

### 1.4 What "logged" means concretely in this repo

**No admin-tree idiom for a non-fatal, informational, read-path condition exists.** Every `console.*`
call under `src/app/admin/` is `console.error` (grepped, 60+ hits), and every one of them logs a genuine
failure — a Supabase error, a failed email send, a caught exception in an error boundary. None logs "this
happened, it's fine, but you should know."

**A repo-wide idiom for exactly that shape does exist, just not in `src/app/admin/`:**
```ts
// src/app/api/bookings/route.ts:78
console.warn("[C-22] honeypot tripped", { at: new Date().toISOString() });

// src/lib/email/notifications.ts:902-904
console.warn(
  `sendRecurringSeriesCancelledEmail: template ${templateId} client has no email; skipping notification.`
);
```
Both are `console.warn` (not `.error`), both fire on a detected-but-non-fatal condition, both continue
execution afterward. `route.ts`'s honeypot warn is also the one place in the repo with a matching test
assertion style (`route.test.ts:118`, `expect(console.warn).toHaveBeenCalledWith(...)`), confirming
`console.warn` is an established, testable pattern here — just not one any admin page has needed before.

**Recommendation, matching this idiom's message format (`scope: description.`):** a bare `console.warn`
in each `page.tsx`, immediately after the corresponding `groupAndCapPastByDate`/`groupAndCapStaffPastByDate`
call, gated on `dateTotal.kind === "atLeast"`:

```ts
// admin/availability/page.tsx, after the past-bucket helper call
if (pastDateTotal.kind === "atLeast") {
  console.warn(
    `admin/availability page.tsx: past overrides row-fetch ceiling reached ` +
      `(fetched ${overridesPast.length} of ${overridesPastTotal} rows); ` +
      `past date total is a lower bound.`
  );
}
```
Same shape for the upcoming bucket (own message, own gate) and for both staff-tree calls. Four possible
warn sites total (admin past, admin upcoming, staff past, staff upcoming) — each independent, each fires
only on its own bucket's saturation.

**Not recommended:** a new logging sink, table, or alerting integration. §6.5.4 explicitly rules this out
("do not spend effort building alerting for a branch that is unreachable at today's volume") and nothing
in the codebase's existing patterns (audit_log is mutation-only, confirmed by the earlier audit §10.4 and
independently by this pass's grep) supports anything heavier. `console.warn` plus the unit test in Part 2
below is the smallest honest thing, matching the one idiom this codebase actually has for this shape.

**Not unit-tested itself:** the `console.warn` call lives in an async Server Component
(`page.tsx`), which this codebase does not unit-test directly anywhere (its only existing pure-fn test
file, `__tests__/page.test.ts`, tests exported helpers — `formatSegments`, `resolveWeekdayRule`,
`groupOverridesByDate` — never the component/page function itself). Asserting the warn fired would
require a new testing pattern this codebase doesn't have; the helper's own `dateTotal.kind` unit test
(Part 2 below) is what actually guards the saturation *detection*, which is the permanent, testable
contract. The `console.warn` call is a cheap, un-tested-but-reviewable belt-and-braces addition on top of
that, exactly as §6.5.4 frames it.

### 1.5 Reachability at projected volume

**Confirmed unreachable today, by construction.** `AVAILABILITY_PAST_ROW_FETCH_CEILING` (proposed
`= 800`, per §6.4) is sized to "comfortably cover `PAST_VIEW_ALL_CAP` (200 dates) × ~4 segments/date
worst case." The file's own header (`availability-data.ts:8-9`, re-confirmed live) projects "~25-100
overrides over 5 years" — at 3 segments each (this file's own stated worst case), that's 75-300 rows
total, roughly 3-11× under the 800-row ceiling. `rowTotal > rowsFetched` cannot fire at any volume the
system's own design documentation predicts.

**This must still be implemented and unit-tested on both buckets regardless — the plan's own words apply
here verbatim:** *"'unreachable' is exactly what was said about one-row-per-date before C-14"* (§6.5).
Before C-14, a real DB constraint enforced the invariant that made row-counting safe; that constraint was
silently dropped and nothing detected it until this plan. The saturation branch has no such constraint
protecting it — only a size estimate in a code comment. The row-fetch ceiling is the one thing standing
between "silently wrong" and "honestly uncertain" if that estimate is ever wrong, so it is tested here as
load-bearing, not as a formality. See Part 2 §2.1 test 4/5 (admin) and their staff-tree mirrors for the
unit tests that hold this contract, and §2.2 for the component-level tests proving the UI actually
surfaces it rather than merely computing it correctly and discarding the signal.

---

## PART 2 — the complete test set, both trees

### 2.0 Where each test belongs — file-by-file confirmation

All five files named in the assignment were opened and read in full:

| File | Exists? | Current test count | Role for item 6 |
|---|---|---|---|
| `src/app/admin/availability/__tests__/availability-data.test.ts` | Yes | 5 (`describe("resolveAvailabilityBannerState")`) | **Add new `describe("groupAndCapPastByDate")` block** |
| `src/app/admin/staff/[staffId]/availability/__tests__/lib.test.ts` | Yes | 4 (`describe("resolveStaffAvailabilityBannerState")`) | **Add new `describe("groupAndCapStaffPastByDate")` block** |
| `src/app/admin/availability/AvailabilityOverridesManager.test.tsx` | Yes | 7 (not 6 — see §0.2) | **Add new `describe(" — saturation disclosure")` block**; existing 7 need no change |
| `src/app/admin/staff/[staffId]/availability/StaffAvailabilityOverridesManager.test.tsx` | Yes, created by `5212bc4` (see §0.3) | 3 | **Add new `describe(" — saturation disclosure")` block**; existing 3 need no change |
| `src/app/admin/availability/__tests__/page.test.ts` | Yes | 12 across 3 `describe` blocks, incl. `groupOverridesByDate` (the pure-fn precedent named in the brief) | **Not touched** — different function (week-chip grouping only, §6.2), confirmed unaffected |

### 2.1 New pure-function tests — admin tree

Add to **`src/app/admin/availability/__tests__/availability-data.test.ts`**, below the existing
`resolveAvailabilityBannerState` describe block. New import line:
```ts
import {
  AVAILABILITY_PAST_CAP,
  AVAILABILITY_PAST_VIEW_ALL_CAP,
  resolveAvailabilityBannerState,
  groupAndCapPastByDate,
  type AvailabilityOverrideRow,
} from "../availability-data";
```

Full new block:
```ts
function overrideRow(
  overrides: Partial<AvailabilityOverrideRow> = {}
): AvailabilityOverrideRow {
  return {
    id: "id",
    override_date: "2026-01-01",
    start_time: "09:00:00",
    end_time: "12:00:00",
    reason: null,
    ...overrides,
  };
}

describe("groupAndCapPastByDate", () => {
  it("groups three same-date segment rows into one date", () => {
    const rows = [
      overrideRow({ id: "a", override_date: "2026-01-05", start_time: "08:00:00", end_time: "10:00:00" }),
      overrideRow({ id: "b", override_date: "2026-01-05", start_time: "11:00:00", end_time: "13:00:00" }),
      overrideRow({ id: "c", override_date: "2026-01-05", start_time: "14:00:00", end_time: "16:00:00" }),
    ];
    const { flattenedRows, dateTotal } = groupAndCapPastByDate(rows, {
      dateCap: AVAILABILITY_PAST_CAP,
      rowTotal: rows.length,
    });
    expect(dateTotal).toEqual({ kind: "exact", value: 1 });
    expect(flattenedRows).toHaveLength(3);
  });

  it("slices to exactly PAST_CAP dates when more exist", () => {
    const rows: AvailabilityOverrideRow[] = [];
    for (let i = 0; i < AVAILABILITY_PAST_CAP + 5; i++) {
      const d = new Date(Date.UTC(2020, 0, 1 + i));
      rows.push(overrideRow({ id: `d${i}`, override_date: d.toISOString().slice(0, 10) }));
    }
    const { flattenedRows, dateTotal } = groupAndCapPastByDate(rows, {
      dateCap: AVAILABILITY_PAST_CAP,
      rowTotal: rows.length,
    });
    expect(flattenedRows).toHaveLength(AVAILABILITY_PAST_CAP);
    expect(dateTotal).toEqual({ kind: "exact", value: AVAILABILITY_PAST_CAP + 5 });
  });

  it("slices to PAST_VIEW_ALL_CAP dates when viewAll is true", () => {
    const totalDates = AVAILABILITY_PAST_VIEW_ALL_CAP + 10;
    const rows: AvailabilityOverrideRow[] = [];
    for (let i = 0; i < totalDates; i++) {
      const d = new Date(Date.UTC(2020, 0, 1 + i));
      rows.push(overrideRow({ id: `d${i}`, override_date: d.toISOString().slice(0, 10) }));
    }
    const { flattenedRows, dateTotal } = groupAndCapPastByDate(rows, {
      dateCap: AVAILABILITY_PAST_VIEW_ALL_CAP,
      rowTotal: rows.length,
    });
    expect(flattenedRows).toHaveLength(AVAILABILITY_PAST_VIEW_ALL_CAP);
    expect(dateTotal).toEqual({ kind: "exact", value: totalDates });
  });

  it("flags saturation and returns a lower-bound total when the row ceiling truncates mid-fetch", () => {
    // rowTotal (the exact count:"exact" query) exceeds rows.length (what the
    // row-fetch ceiling actually returned): the fetch itself was truncated,
    // so the number of distinct dates found among the rows we DID get is
    // only a lower bound — more dates could exist among rows we never
    // fetched. This is the one genuinely new, unprecedented case (plan §6.5).
    const rows = [
      overrideRow({ id: "a", override_date: "2026-01-01" }),
      overrideRow({ id: "b", override_date: "2026-01-02" }),
      overrideRow({ id: "c", override_date: "2026-01-03" }),
    ];
    const { dateTotal } = groupAndCapPastByDate(rows, {
      dateCap: AVAILABILITY_PAST_VIEW_ALL_CAP,
      rowTotal: 900, // > rows.length — simulates the 800-row ceiling truncating
    });

    // Must be a LOWER BOUND, never presented as an exact figure — the exact
    // bug this item exists to prevent is rendering "3" when the truth could
    // be 900. Assert BOTH the kind and the value: a test that only checked
    // `.value` would pass whether or not saturation was actually detected.
    expect(dateTotal.kind).toBe("atLeast");
    expect(dateTotal).toEqual({ kind: "atLeast", value: 3 });
    expect(dateTotal).not.toEqual({ kind: "exact", value: 3 });
  });

  it("does not flag saturation when the row fetch captured every row (rowTotal === rows.length)", () => {
    // Boundary case for the `>` in `rowTotal > rows.length` — guards against
    // an off-by-one that would falsely mark a COMPLETE fetch as saturated.
    // Not named in the plan's table; recommended addition, not required.
    const rows = [
      overrideRow({ id: "a", override_date: "2026-01-01" }),
      overrideRow({ id: "b", override_date: "2026-01-02" }),
    ];
    const { dateTotal } = groupAndCapPastByDate(rows, {
      dateCap: AVAILABILITY_PAST_CAP,
      rowTotal: rows.length,
    });
    expect(dateTotal).toEqual({ kind: "exact", value: 2 });
  });

  it("never splits one date's segments across the N-th/N+1-th date boundary", () => {
    // 3 dates; the 2nd carries 2 segments (a break). With dateCap=2, date 2
    // must arrive WHOLE (both segments) or not at all — never fragmented.
    const rows = [
      overrideRow({ id: "d1", override_date: "2026-01-01" }),
      overrideRow({ id: "d2-am", override_date: "2026-01-02", start_time: "08:00:00", end_time: "10:00:00" }),
      overrideRow({ id: "d2-pm", override_date: "2026-01-02", start_time: "14:00:00", end_time: "16:00:00" }),
      overrideRow({ id: "d3", override_date: "2026-01-03" }),
    ];
    const { flattenedRows } = groupAndCapPastByDate(rows, { dateCap: 2, rowTotal: rows.length });

    const dates = new Set(flattenedRows.map((r) => r.override_date));
    expect(dates).toEqual(new Set(["2026-01-01", "2026-01-02"]));
    expect(flattenedRows.filter((r) => r.override_date === "2026-01-02")).toHaveLength(2);
    expect(flattenedRows.some((r) => r.override_date === "2026-01-03")).toBe(false);
  });
});
```
(5 required tests, matching the plan's §6.10 table row-for-row, plus 1 clearly-labelled optional boundary
test — 6 new `it()` blocks, file total goes from 5 to 11.)

### 2.2 New pure-function tests — staff tree

Add to **`src/app/admin/staff/[staffId]/availability/__tests__/lib.test.ts`**, same structure, staff-tree
names throughout (`STAFF_AVAILABILITY_PAST_CAP`, `STAFF_AVAILABILITY_PAST_VIEW_ALL_CAP`,
`groupAndCapStaffPastByDate`, `StaffAvailabilityOverrideRow`):

```ts
import {
  STAFF_AVAILABILITY_PAST_CAP,
  STAFF_AVAILABILITY_PAST_VIEW_ALL_CAP,
  resolveStaffAvailabilityBannerState,
  groupAndCapStaffPastByDate,
  type StaffAvailabilityOverrideRow,
} from "../lib";

function overrideRow(
  overrides: Partial<StaffAvailabilityOverrideRow> = {}
): StaffAvailabilityOverrideRow {
  return {
    id: "id",
    override_date: "2026-01-01",
    start_time: "09:00:00",
    end_time: "12:00:00",
    reason: null,
    ...overrides,
  };
}

describe("groupAndCapStaffPastByDate", () => {
  it("groups three same-date segment rows into one date", () => {
    const rows = [
      overrideRow({ id: "a", override_date: "2026-01-05", start_time: "08:00:00", end_time: "10:00:00" }),
      overrideRow({ id: "b", override_date: "2026-01-05", start_time: "11:00:00", end_time: "13:00:00" }),
      overrideRow({ id: "c", override_date: "2026-01-05", start_time: "14:00:00", end_time: "16:00:00" }),
    ];
    const { flattenedRows, dateTotal } = groupAndCapStaffPastByDate(rows, {
      dateCap: STAFF_AVAILABILITY_PAST_CAP,
      rowTotal: rows.length,
    });
    expect(dateTotal).toEqual({ kind: "exact", value: 1 });
    expect(flattenedRows).toHaveLength(3);
  });

  it("slices to exactly PAST_CAP dates when more exist", () => {
    const rows: StaffAvailabilityOverrideRow[] = [];
    for (let i = 0; i < STAFF_AVAILABILITY_PAST_CAP + 5; i++) {
      const d = new Date(Date.UTC(2020, 0, 1 + i));
      rows.push(overrideRow({ id: `d${i}`, override_date: d.toISOString().slice(0, 10) }));
    }
    const { flattenedRows, dateTotal } = groupAndCapStaffPastByDate(rows, {
      dateCap: STAFF_AVAILABILITY_PAST_CAP,
      rowTotal: rows.length,
    });
    expect(flattenedRows).toHaveLength(STAFF_AVAILABILITY_PAST_CAP);
    expect(dateTotal).toEqual({ kind: "exact", value: STAFF_AVAILABILITY_PAST_CAP + 5 });
  });

  it("slices to PAST_VIEW_ALL_CAP dates when viewAll is true", () => {
    const totalDates = STAFF_AVAILABILITY_PAST_VIEW_ALL_CAP + 10;
    const rows: StaffAvailabilityOverrideRow[] = [];
    for (let i = 0; i < totalDates; i++) {
      const d = new Date(Date.UTC(2020, 0, 1 + i));
      rows.push(overrideRow({ id: `d${i}`, override_date: d.toISOString().slice(0, 10) }));
    }
    const { flattenedRows, dateTotal } = groupAndCapStaffPastByDate(rows, {
      dateCap: STAFF_AVAILABILITY_PAST_VIEW_ALL_CAP,
      rowTotal: rows.length,
    });
    expect(flattenedRows).toHaveLength(STAFF_AVAILABILITY_PAST_VIEW_ALL_CAP);
    expect(dateTotal).toEqual({ kind: "exact", value: totalDates });
  });

  it("flags saturation and returns a lower-bound total when the row ceiling truncates mid-fetch", () => {
    const rows = [
      overrideRow({ id: "a", override_date: "2026-01-01" }),
      overrideRow({ id: "b", override_date: "2026-01-02" }),
      overrideRow({ id: "c", override_date: "2026-01-03" }),
    ];
    const { dateTotal } = groupAndCapStaffPastByDate(rows, {
      dateCap: STAFF_AVAILABILITY_PAST_VIEW_ALL_CAP,
      rowTotal: 900,
    });
    expect(dateTotal.kind).toBe("atLeast");
    expect(dateTotal).toEqual({ kind: "atLeast", value: 3 });
    expect(dateTotal).not.toEqual({ kind: "exact", value: 3 });
  });

  it("does not flag saturation when the row fetch captured every row (rowTotal === rows.length)", () => {
    const rows = [
      overrideRow({ id: "a", override_date: "2026-01-01" }),
      overrideRow({ id: "b", override_date: "2026-01-02" }),
    ];
    const { dateTotal } = groupAndCapStaffPastByDate(rows, {
      dateCap: STAFF_AVAILABILITY_PAST_CAP,
      rowTotal: rows.length,
    });
    expect(dateTotal).toEqual({ kind: "exact", value: 2 });
  });

  it("never splits one date's segments across the N-th/N+1-th date boundary", () => {
    const rows = [
      overrideRow({ id: "d1", override_date: "2026-01-01" }),
      overrideRow({ id: "d2-am", override_date: "2026-01-02", start_time: "08:00:00", end_time: "10:00:00" }),
      overrideRow({ id: "d2-pm", override_date: "2026-01-02", start_time: "14:00:00", end_time: "16:00:00" }),
      overrideRow({ id: "d3", override_date: "2026-01-03" }),
    ];
    const { flattenedRows } = groupAndCapStaffPastByDate(rows, { dateCap: 2, rowTotal: rows.length });

    const dates = new Set(flattenedRows.map((r) => r.override_date));
    expect(dates).toEqual(new Set(["2026-01-01", "2026-01-02"]));
    expect(flattenedRows.filter((r) => r.override_date === "2026-01-02")).toHaveLength(2);
    expect(flattenedRows.some((r) => r.override_date === "2026-01-03")).toBe(false);
  });
});
```
(Same 5 required + 1 optional = 6 new `it()` blocks; file total goes from 4 to 10.)

**Note on the existing `"cappedOut" priority` test:** confirmed this is the one plan-cited case needing
**no new test** — `resolveAvailabilityBannerState`/`resolveStaffAvailabilityBannerState` are unchanged,
and both existing `"SABOTAGE TARGET"` tests (`availability-data.test.ts:37-52`, `lib.test.ts:37-52`)
already prove `cappedOut`-before-`hidden` using bare numbers. Since the new helper's `dateTotal.value`
feeds straight into `pastTotal` as a plain `number` (the `+`-suffix is a display-only concern layered on
top in the Manager's JSX, per §6.5.3/§1.3 above — the resolver never sees the `DateTotal` shape at all),
that existing coverage transfers unchanged. Confirmed no staff-tree equivalent of the *second*
order-proof test (`availability-data.test.ts:54-64`, "cappedOut takes priority even when hidden's
condition also holds") exists in `lib.test.ts` — this is the same pre-existing asymmetry the prior audit
flagged (§7 gap list) and is optional, out of this item's required scope, unchanged by this report.

### 2.3 New component-level tests — the saturation UI itself

**Why these are required, not optional:** the pure-function tests above prove `dateTotal.kind ===
"atLeast"` is computed correctly. They prove nothing about whether the "+" actually reaches the screen —
that only happens in the Manager's JSX (§1.3). A pure-fn test suite that stopped here would be exactly
the "test that passes whether or not the feature works" the task brief warns against: the helper could be
wired correctly and the JSX interpolation could still silently omit the `+` (e.g. a future refactor drops
the ternary), and no pure-fn test would ever catch it.

Add to **`src/app/admin/availability/AvailabilityOverridesManager.test.tsx`**, using the file's own
existing `renderManager` helper (no changes needed to it — the two new props are optional):

```ts
describe("AvailabilityOverridesManager — saturation disclosure", () => {
  const PAST_ROW = {
    id: "p1",
    override_date: "2098-01-01",
    start_time: "09:00:00",
    end_time: "12:00:00",
    reason: null,
  };

  it("renders a '+' on the past total in the badge, summary, and banner when pastTotalIsLowerBound is true", () => {
    const { container } = renderManager({
      past: [PAST_ROW],
      pastTotal: 30,
      pastTotalIsLowerBound: true,
      pastViewAll: false,
    });

    // Badge fragment ("· 30+ past") — the number a user sees first, above
    // the closed-by-default past disclosure.
    expect(container.textContent).toContain("30+ past");
    // <summary> "N of M" text inside the disclosure.
    expect(container.textContent).toContain("of 30+)");
    // The "hidden" banner's "View all N past adjustments" link.
    expect(
      screen.getByRole("link", { name: /View all 30\+ past adjustments/ })
    ).toBeTruthy();
  });

  it("renders a bare number with no '+' when pastTotalIsLowerBound is false (default)", () => {
    const { container } = renderManager({
      past: [PAST_ROW],
      pastTotal: 30,
      pastViewAll: false,
    });

    expect(container.textContent).toContain("· 30 past");
    expect(container.textContent).not.toContain("30+");
    expect(
      screen.getByRole("link", { name: /View all 30 past adjustments/ })
    ).toBeTruthy();
  });

  it("renders a '+' on the upcoming total in the badge when upcomingTotalIsLowerBound is true", () => {
    // UPCOMING fixture (module-level) is 2 rows on one date, so upcomingDays
    // has 1 entry — upcomingTotal (600) > 1 triggers the "N of M" branch.
    const { container } = renderManager({
      upcomingTotal: 600,
      upcomingTotalIsLowerBound: true,
    });

    expect(container.textContent).toContain("of 600+ upcoming");
  });

  it("renders the upcoming total plainly when upcomingTotalIsLowerBound is false (default)", () => {
    const { container } = renderManager({ upcomingTotal: 600 });

    expect(container.textContent).toContain("of 600 upcoming");
    expect(container.textContent).not.toContain("600+");
  });
});
```

Add to **`src/app/admin/staff/[staffId]/availability/StaffAvailabilityOverridesManager.test.tsx`**,
mirrored (this file's own `renderManager` helper, same optionality):

```ts
describe("StaffAvailabilityOverridesManager — saturation disclosure", () => {
  const PAST_ROW = {
    id: "p1",
    override_date: "2098-01-01",
    start_time: "09:00:00",
    end_time: "12:00:00",
    reason: null,
  };

  it("renders a '+' on the past total in the badge, summary, and banner when pastTotalIsLowerBound is true", () => {
    const { container } = renderManager({
      past: [PAST_ROW],
      pastTotal: 30,
      pastTotalIsLowerBound: true,
      pastViewAll: false,
    });

    expect(container.textContent).toContain("30+ past");
    expect(container.textContent).toContain("of 30+)");
    expect(
      screen.getByRole("link", { name: /View all 30\+ past overrides/ })
    ).toBeTruthy();
  });

  it("renders a bare number with no '+' when pastTotalIsLowerBound is false (default)", () => {
    const { container } = renderManager({
      past: [PAST_ROW],
      pastTotal: 30,
      pastViewAll: false,
    });

    expect(container.textContent).toContain("· 30 past");
    expect(container.textContent).not.toContain("30+");
    expect(
      screen.getByRole("link", { name: /View all 30 past overrides/ })
    ).toBeTruthy();
  });

  it("renders a '+' on the upcoming total in the badge when upcomingTotalIsLowerBound is true", () => {
    const { container } = renderManager({
      upcomingTotal: 600,
      upcomingTotalIsLowerBound: true,
    });

    expect(container.textContent).toContain("of 600+ upcoming");
  });

  it("renders the upcoming total plainly when upcomingTotalIsLowerBound is false (default)", () => {
    const { container } = renderManager({ upcomingTotal: 600 });

    expect(container.textContent).toContain("of 600 upcoming");
    expect(container.textContent).not.toContain("600+");
  });
});
```

`screen` is already imported in both files (`import { render, screen } from "@testing-library/react"`,
confirmed live in both) — no new import needed beyond destructuring `container` from `render()`'s return
value, which `renderManager` already forwards since it `return render(...)` directly.

### 2.4 Test-count summary (exact before/after, both trees)

| File | Before | New | After |
|---|---|---|---|
| `availability-data.test.ts` | 5 | +6 (5 required + 1 optional) | 11 |
| `lib.test.ts` | 4 | +6 (5 required + 1 optional) | 10 |
| `AvailabilityOverridesManager.test.tsx` | 7 | +4 | 11 |
| `StaffAvailabilityOverridesManager.test.tsx` | 3 | +4 | 7 |
| **Total new `it()` blocks** | | **20** | |

`page.test.ts` (12 tests, incl. `groupOverridesByDate`) is confirmed untouched — different function,
already correct, no dependency on anything item 6 changes (re-confirmed live, §2.0 table).

---

## Verification note

This report derives code, it does not implement or run it — per the read-only mandate, no file under
`src/` was modified and none of the above was executed. Once implemented, the exact verification sequence
is the one already specified in the plan's §6.9 (`npx tsc --noEmit` → 0; the two `__tests__/*.test.ts`
files plus both `*Manager.test.tsx` files individually; then the full `npx vitest run` must stay at the
documented baseline identity — 5 failed / 2236 passed / 2241 total, same five named failures — with the
new 20 `it()` blocks all passing and none of them replacing or renaming an existing assertion.
