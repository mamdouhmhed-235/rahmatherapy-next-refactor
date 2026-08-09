# C-23 Phase C (Steps 5–6) — Independent Verification

**VERDICT: PASS**

**Commit verified:** `a345d99705aaf72e3295effdfa90b5b6618c0cee` — "feat(redesign): C-23 Phase C — availability calendar field + month cache hook"
**Tier:** TARGETED (declared in advance per dispatch — component is presentational, wired nowhere until Phase D)
**Verifier:** read-only subagent, model **Claude Opus 5** (per Co-Authored-By convention used in this programme; agent identity as instructed by dispatch)
**Working tree:** `C:/Users/mamdo/Desktop/rahmatherapy - Copy/rahmatherapy-next-refactor`, branch `master`

---

## 1. `disabled` never exceeds `{ before: min }`

**Verdict: PASS**

`src/app/admin/bookings/new/AvailabilityCalendarField.tsx:200`:
```tsx
disabled={[{ before: minDate }]}
```
This is the entire `disabled` prop passed to `<DayPicker>` — a single-element array containing only the `{ before: minDate }` matcher. No availability data, cohort array, or predicate is spread or concatenated into it anywhere in the file (confirmed by reading the full 254-line file; the only other reference to "disabled" is a code comment restating the rule).

**Test evidence (real suite):** `AvailabilityCalendarField.test.tsx:34-58` — asserts a day before `min` has `data-disabled="true"`, `min` itself is selectable, and a day with `hasSlots: false` is `data-disabled: null` / `button.disabled === false`. Ran green (see §Gates).

**Non-vacuity spot-check (executed, not just read):** I copied the component to the scratchpad (`.../scratchpad/mutation-check/AvailabilityCalendarField.mutated-disabled.tsx`) and mutated the COPY to widen `disabled` to `[{ before: minDate }, ...noneDays]` (i.e., also disable days with no confirmed availability — the exact FAIL condition this point exists to prevent). I built an ad hoc `vitest.mutation-check.config.ts` in the scratchpad (jsdom, `@` alias → the repo's real `src/`) and a Windows directory junction `scratchpad/mutation-check/node_modules → <repo>/node_modules` (junction only, no repo file was ever written to) so the driver spec could resolve `@testing-library/react`/`vitest`/`react-day-picker` from the real install. Ran the real test's assertion against the mutated copy:
```
FAIL  mutated-disabled.test.tsx > ... a day with hasSlots: false is still selectable
AssertionError: expected 'true' to be null
```
The assertion fails exactly as expected against the broken copy — proving it is load-bearing, not vacuous, against the real (unmutated) implementation. Junction removed afterward (`cmd /c rmdir`); confirmed real repo `node_modules/vitest` still resolves post-cleanup; `git status --porcelain -- src/app/admin/bookings/new src/lib/booking src/app/api` returned empty throughout — the repo was never touched by this check.

---

## 2. Marker resolution logic

**Verdict: PASS**

`AvailabilityCalendarField.tsx:84-93`:
```ts
function resolveMarkerState(dateKey: string, cohorts: CohortMarkers[]): MarkerState {
  if (cohorts.length === 0) return "none";
  let servable = 0;
  for (const cohort of cohorts) {
    if (cohort.days.get(dateKey) === true) servable += 1;
  }
  if (servable === cohorts.length) return "available";
  if (servable > 0) return "partial";
  return "none";
}
```
Traced by hand: 2 cohorts, both servable → `servable===2===cohorts.length` → `"available"`. Exactly one → `servable===1>0` → `"partial"`. Neither → `servable===0` → `"none"`. 1 cohort: `servable` is 0 or 1, so it's either `===cohorts.length` (available) or `0` (none) — `"partial"` is mathematically unreachable with a single cohort, matching the spec exactly.

**Test evidence:** `AvailabilityCalendarField.test.tsx:61-131` — four cases (both-servable → available; one-servable → partial, distinct shape/label from available; neither → de-emphasised and not disabled; single-cohort → only available/none reachable, never partial). All green.

**Non-vacuity spot-check (executed):** mutated copy `AvailabilityCalendarField.mutated-marker.tsx` inverts the thresholds (`servable === cohorts.length → "partial"`, `servable > 0 → "available"`). Ran the real test's two marker-resolution assertions against it via the same scratchpad harness:
```
FAIL mutated-marker.test.tsx > ... marks a day servable by both cohorts as available
Expected: "availability confirmed"   Received: "... — availability for one participant group only"
FAIL mutated-marker.test.tsx > ... marks a day servable by exactly one cohort as partial
Expected: "availability for one participant group only"   Received: "... — availability confirmed"
```
Both fail against the inverted copy, confirming the real assertions are non-vacuous.

---

## 3. Non-colour encoding reaches assistive tech (gate §3.9)

**Verdict: PASS**

**(a) Shape glyph, genuinely non-colour, hidden from AT:**
`AvailabilityCalendarField.tsx:128-144` (`MarkerDayButton`) renders, only when `isAvailable`, a `rounded-full` filled circle (`bg-[var(--admin-status-confirmed-text)]`); only when `isPartial`, a `rotate-45` square (a diamond silhouette, `bg-[var(--admin-status-attention-text)]`) — genuinely different **shapes**, not two colours of the same dot. Both spans carry `aria-hidden="true"` (lines 133, 139), so they are decorative and not double-announced by AT.

I compared `MarkerDayButton` against react-day-picker 9.14.0's actual shipped default (`node_modules/react-day-picker/dist/esm/components/DayButton.js`):
```js
export function DayButton(props) {
    const { day, modifiers, ...buttonProps } = props;
    const ref = React.useRef(null);
    React.useEffect(() => {
        if (modifiers.focused) ref.current?.focus();
    }, [modifiers.focused]);
    return React.createElement("button", { ref, ...buttonProps });
}
```
`MarkerDayButton` destructures `day`, `modifiers`, plus (additionally) `className`/`children` and re-splices them (`<button ref={ref} className={cn("relative", className)} {...buttonProps}>{children}...`) — functionally identical output to the default, including the exact same roving-focus `useEffect` (keyboard arrow-key navigation depends on this focus-on-`modifiers.focused` behaviour; it is reproduced verbatim, not paraphrased).

**Test evidence:** keyboard-selection test (`AvailabilityCalendarField.test.tsx:160-170`) — `button.focus(); userEvent.keyboard("{Enter}")` → `onChange` called — passes, corroborating the roving-focus reproduction didn't break keyboard operability.

**(b) `labels.labelDayButton` wraps, doesn't replace, the default — today/selected text is preserved:**
`AvailabilityCalendarField.tsx:98-108`:
```ts
const labelDayButtonWithAvailability: typeof defaultLabelDayButton = (date, modifiers, options, dateLib) => {
  const base = defaultLabelDayButton(date, modifiers, options, dateLib);
  if (modifiers.available) return `${base} — availability confirmed`;
  if (modifiers.partial) return `${base} — availability for one participant group only`;
  return base;
};
```
I read the actual shipped default (`node_modules/react-day-picker/dist/esm/labels/labelDayButton.js`):
```js
export function labelDayButton(date, modifiers, options, dateLib) {
    let label = (dateLib ?? new DateLib(options)).format(date, "PPPP");
    if (modifiers.today) label = `Today, ${label}`;
    if (modifiers.selected) label = `${label}, selected`;
    return label;
}
```
The wrapper calls this real function **first** and only appends a suffix — it never reimplements date formatting and never discards the `today`/`selected` prefixes/suffixes. I traced how the label is actually applied: `node_modules/react-day-picker/dist/esm/DayPicker.js:322` sets `"aria-label": labelDayButton(date, modifiers, dateLib.options, dateLib)` on the rendered `<button>` (the `components.DayButton` slot), and `getLabels()` (`helpers/getLabels.js:22-27`) confirms a custom `labels.labelDayButton` prop fully substitutes for the default via `resolveLabel`, i.e. exactly the composition path this component uses.

**Test evidence:** `aria-label` assertions in `AvailabilityCalendarField.test.tsx:86-131` confirm the suffix lands in the actual rendered `aria-label` attribute (not just an internal function's return value) — these are DOM-level assertions against the real rendered button.

---

## 4. `use-month-availability.ts` hook

**Verdict: PASS**

- **Cache keyed on `month|services|genders|city` (all four):** `use-month-availability.ts:53-55` — `cacheKey = [monthKey, serviceIdsKey, gendersKey, city.trim().toLowerCase()].join("|")`. All four components present. The code does **not** claim (in comments or docs) stability under key-*reordering* of `serviceIds`/`genders` within a call — `Array.join(",")` is order-sensitive — so there is no unfulfilled claim to check there; the cache-hit/cache-miss test (`use-month-availability.test.ts:23-50`) exercises the key changing across months, hits the cache on return to a prior month (`fetchMock` called exactly twice across three renders), and this passed.
- **`AbortController` fires on key change AND on unmount:** the effect (`:57-118`) creates one `AbortController` per run and returns `() => controller.abort()` as its cleanup, with deps `[cacheKey, enabled]`. React invokes that same cleanup closure both when a dependency changes *and* on unmount — this is standard React effect semantics, not hook-specific logic, so "fires on unmount" follows from the identical code path already exercised by the key-change test (`use-month-availability.test.ts:52-73`, which asserts `capturedSignal.aborted === true` after a `rerender`). There is no dedicated *unmount*-specific test, but the cleanup function is unconditional (not gated on the reason for cleanup), so it fires identically either way — verified by code inspection, not a separate executed unmount test. Noted under "Checks I could not run."
- **Fetch failure resolves to `null`, silently:** `:94-97` (`!response.ok || !data.days` → `setDays(null)`, no throw) and `:102-106` (catch block: `AbortError` → silent return; any other error → `setDays(null)`). No error is ever re-thrown out of `loadMonthAvailability`, and the caller never `await`s or attaches a `.catch` to it (fire-and-forget, matching the lifted `ScheduleStep.tsx` shape) — no unhandled-rejection path exists since all failure branches are caught internally. Test evidence: `use-month-availability.test.ts:75-85` (`ok: false` response → `result.current.days === null`, `loading === false`, no thrown error observed by the test).
- **`enabled` introduces no new preconditions:** `:65-69` — when `enabled` is false the effect resolves `setDays(null); setLoading(false)` and returns before any fetch; this is the *only* gate. The component itself (`AvailabilityCalendarField`) never reads `enabled` and always renders every day fully selectable regardless of `cohorts`/`loading` (see §5) — so a disabled hook simply yields `cohorts: []`-equivalent data upstream (Phase D's job to wire), and the calendar keeps behaving per §5's "renders unmarked, not broken" guarantee. No additional precondition is introduced beyond what `enabled` already was upstream (brief finding 4).

---

## 5. Renders unmarked but not broken — empty `cohorts` and `loading`

**Verdict: PASS**

`AvailabilityCalendarField.tsx:166-188` — the `useMemo` computing `availableDays`/`partialDays` treats `loading` by substituting `effectiveCohorts = loading ? [] : cohorts`, and an empty `effectiveCohorts` short-circuits to empty arrays before touching any `Map`. No code path throws, no early return skips rendering the `<DayPicker>`, no day becomes `disabled` from either state.

**Test evidence:** `AvailabilityCalendarField.test.tsx:134-157` — "shows no markers when cohorts is empty" (calendar still renders `[data-day]` cells, greater than 0) and "shows no markers while loading, even with cohort data present" (loading suppresses markers even though `cohorts` has real data) — both green.

---

## Gates by identity

| Gate | Command | Result | Identity match |
|---|---|---|---|
| TypeScript | `npx tsc --noEmit` | **0 errors** | ✅ matches expected (0) |
| Vitest (full) | `pnpm vitest run` | **5 failed / 2007 passed (2012)** — failures are exactly `admin-access.test.ts` ×2 (`gives Owner broad access...`, `gives Admin broad operational access...`) + `ManualBookingForm.test.tsx` ×3 (`renders step 1 on first load`, `moves focus to the first invalid field...`, `shows the consent error...`) | ✅ same named failures, same totals as the inherited baseline at `a345d99` — no swapped-in new failure |
| Lint | `pnpm lint` | **59 errors / 7 warnings** (66 problems), in exactly: `design_handoff_area_pages/prototype/{area-page,shared,site-chrome}.jsx` + `src/features/booking/{BookingExperience.tsx,BookingExperienceLoader.tsx,utils/returning-customer.ts}` | ✅ exact file-set match; grepped output for `AvailabilityCalendarField`/`use-month-availability` — zero matches, neither new file appears |
| New files' own suites | `pnpm vitest run` on both new test files | **2 test files passed, 14/14 tests passed** | ✅ full green |

---

## Diff scope

`git show a345d99 --stat`:
```
 .../new/AvailabilityCalendarField.test.tsx         | 212 +++++++++++++++++
 .../bookings/new/AvailabilityCalendarField.tsx     | 254 +++++++++++++++++++++
 .../bookings/new/use-month-availability.test.ts    |  86 +++++++
 .../admin/bookings/new/use-month-availability.ts   | 121 ++++++++++
 4 files changed, 673 insertions(+)
```
Confirmed via both `--stat` and `--name-only`: **exactly the four new files**, all insertions, zero deletions. `ManualBookingForm.tsx`, `src/lib/booking/availability.ts`, and everything under `src/app/api/availability/**` (public or admin) are **absent** from the diff — confirmed by direct inspection of the commit's file list, not inferred. The whole public booking flow (`src/features/booking/**`) is likewise absent.

---

## Isolation

`git status --porcelain`: no changes staged or modified under `src/app/admin/bookings/new`, `src/lib/booking`, or `src/app/api` (checked explicitly, empty). The only modified-tracked-file in the wider tree is `src/lib/maintenance.ts` — excluded per dispatch (Owner-owned standing change), untouched by me. Remaining untracked entries (`.playwright-mcp/*` deletions, `design_handoff_area_pages/`, `design_handoff_public_pages/*` deletions, `photos-rahma-therapy/`, `redesign/evidence/C-21/*.png`, `test-results/`) match the dispatch's named pre-existing-dirt exclusions.

One untracked entry not on the dispatch's named exclusion list: `src/app/(public)/privacy/` (contains only `page.tsx`). It is untracked (not staged, not modified), unrelated to any of C-23's target paths, and predates this verification session — noted for completeness, not a finding against this commit.

⛔/⏸ markers: the plan file (`C-23-admin-availability-calendar-plan.md`) contains exactly one such marker in its entire text (`grep -n "⛔\|⏸"` → one hit, line 34, the Pre-flight #4 HARD-STOP about submitting real bookings). Steps 5–6 (Phase C, the scope of this commit) contain **zero** ⛔/⏸ markers — nothing to silently implement or defer-and-hide.

---

## Code rules (SUBAGENT-RULES §8)

- `border-l-4`: absent (grepped both new source files — zero matches).
- `prefers-reduced-motion` / `motion-reduce`: the component applies no `transition`/`animate-*`/`duration-*` classes anywhere (grepped) — nothing animates, so there is nothing for a reduced-motion rule to guard; not a violation.
- `Set`/`Map`/`Date` through `unstable_cache`: neither file imports or calls `unstable_cache` at all (grepped, zero matches) — not applicable.
- Admin-scoped tokens only: every colour/spacing/radius reference uses `--admin-*` custom properties (`--admin-panel`, `--admin-border`, `--admin-status-confirmed-*`, `--admin-status-attention-*`, `--admin-primary`, `--admin-text-muted`, `--admin-radius-card`). The single `--rahma-*` string in the file is inside a code comment explicitly describing what **not** to do — grepped and confirmed it is not used as an actual class.
- Matches file's neighbours: `--rdp-day_button-width/height: 2.75rem` (44px) mirrors admin's `h-11` touch-target convention used by `CalendarDatePopover.tsx`; no CSS module was introduced (styling precedent gap is explicitly discussed in the file's header comment, matching the surface map's Risk 4 finding).
- Mobile-first / 375px: reasoned from CSS only (no live browser check possible — component has no caller yet, consistent with the plan's own Phase D deferral). The day-button sizing (44px targets) plus a `flex flex-wrap` legend row means nothing is fixed-width beyond the DayPicker grid itself; no horizontal-scroll-inducing rule was found. Not independently verified in a browser — see "Checks I could not run."

---

## Findings

No BLOCKING findings.

1. **NON-BLOCKING** — `AvailabilityCalendarField.tsx:180-188`: days that resolve to `"none"` (no confirmed availability) receive **no** `modifiersClassNames` entry at all — they render with react-day-picker's plain default day styling, identical in markup to a day rendered during `loading`/empty-`cohorts` states. The commit message describes this as "days without confirmed availability get a de-emphasis modifier only," which reads as if an active dimming modifier exists; in the actual code, the "de-emphasis" is achieved purely by *contrast* (marked days are coloured, unmarked days are plain), not by an explicit additional CSS treatment applied to the "none" state specifically. Functionally this still satisfies brief finding 3 (visibly distinct from marked days, never disabled, never blocked) — it is a documentation/commit-message precision gap, not a behavioural defect.

---

## Checks I could not run

- **Live browser / screen-reader verification** of the 375px layout and actual AT announcement — the component has no caller yet (Phase D wires it into `ManualBookingForm.tsx`), so there is no live page to load. Verified by source/CSS inspection and by cross-referencing react-day-picker's actual shipped source instead, per the dispatch's own acknowledgement that this is unrunnable at this phase.
- **A dedicated unmount-specific test** for the `AbortController` — the hook's cleanup closure is unconditional and identical for both the dependency-change and unmount cases (verified by reading the code and by React's documented effect-cleanup semantics), but no test explicitly unmounts the hook mid-fetch and asserts the signal. The existing key-change test exercises the same cleanup code path.
- `pnpm build` / `next build` — explicitly banned by the dispatch (has crashed the Owner's dev server before); not run.
- Any Supabase SQL — not needed for this commit; not run.
