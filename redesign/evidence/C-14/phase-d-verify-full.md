# C-14 Phase D — FULL independent verification

**VERDICT: PASS**

Verifier: independent, read-only. Model: Claude Sonnet 5 (`claude-sonnet-5`).
Commit under review: `4583573` ("feat(redesign): C-14 Phase D — customer booking-window date guard").
Verified at HEAD `4611ee7`, branch `master`. Tree dirty only in `src/lib/maintenance.ts` (standing Owner change, untouched, confirmed via `git status --porcelain -- src/`).

---

## 0 — Independently-derived boundary, with arithmetic

Live `business_settings` (re-queried myself via `execute_sql`, project `twzutkfgqclqurvkmvqz`):
`booking_window_days = 29`, `minimum_notice_hours = 4`, `db now() = 2026-08-09 14:46:33 UTC` (= `2026-08-09 15:46 BST`).

**Upper bound.** `today = getBusinessDate(now)` formats via `Intl.DateTimeFormat(timeZone: "Europe/London")` → `2026-08-09` (BST and UTC agree on the calendar day at this hour). `latest = addBusinessDays("2026-08-09", 29)`: August has 31 days; `9 + 29 = 38`; `38 − 31 = 7` → **`2026-09-07`**. Inclusive.

**Lower bound.** `isDateInBusinessWindow` calls `getBookingDateBounds` with `minimumNoticeHours` omitted → defaults to `0` inside the helper → `earliest = today = 2026-08-09`, regardless of the live `minimum_notice_hours=4` setting (by design — see §2 below; the day-level floor is deliberately notice-blind, the per-slot check is where 4h notice actually bites).

So my own re-derivation: **earliest = 2026-08-09, latest = 2026-09-07** — matching the implementer's claim exactly.

**Live cross-check against the running dev server** (read-only `POST /api/availability`, service slug `massage-30`, `city: "Luton"`, `participantGenders: ["female"]` — no booking created):

| date | result |
|---|---|
| `2026-08-08` | `{"reason":"Date is outside the booking window."}` |
| `2026-08-09` (today) | accepted (`durationMins:30`, no rejection reason) |
| `2026-09-06` | accepted (empty slots that day, but no window-rejection reason) |
| `2026-09-07` | accepted — **24 slots** returned |
| `2026-09-08` | `{"reason":"Date is outside the booking window."}` |

The implementer's commit message/progress note claims 23 slots on `2026-09-07`; I independently got 24 with a different service (`massage-30` vs whatever they used) and gender combination — slot count is service/duration/staff-roster dependent and irrelevant to the property under test. **The boundary itself is exactly as claimed: last accepted date `2026-09-07`, first rejected date `2026-09-08`; lower bound `2026-08-09` accepted, `2026-08-08` rejected.** This is the core property (§ dispatch) and it holds.

---

## 1 — Sweep test vs. genuine pre-refactor algorithm

Pulled the actual pre-commit source: `git show 4583573^:src/lib/time/london.ts`. The pre-refactor `isDateInBusinessWindow`:

```ts
export function isDateInBusinessWindow({
  date,
  now = new Date(),
  bookingWindowDays,
}: {
  date: string;
  now?: Date;
  bookingWindowDays: number;
}) {
  const today = getBusinessDate(now);
  const lastBookableDate = addBusinessDays(today, bookingWindowDays);

  return date >= today && date <= lastBookableDate;
}
```

The sweep test's inline `legacy` re-implementation (`src/lib/time/london.test.ts`, added by `4583573`):

```ts
const legacy = ({ date, now: at, bookingWindowDays }: {...}) => {
  const today = getBusinessDate(at);
  const lastBookableDate = addBusinessDays(today, bookingWindowDays);
  return date >= today && date <= lastBookableDate;
};
```

Identical logic, only the `now` parameter is locally renamed to `at`. This is a faithful re-implementation, not a strawman — **claim 1 confirmed.**

Sweep shape verified by reading the test body: 5 instants (`2026-08-09T09:00Z` mid-morning BST, `2026-08-08T23:30Z` already-tomorrow-in-London, `2026-10-24T23:30Z` BST→GMT change, `2026-01-15T00:30Z` GMT, `2026-12-31T23:00Z` year rollover) × 5 `bookingWindowDays` values (`[0, 1, 29, 30, 365]`) × 36 offsets (`for (let offset = -2; offset <= 33; offset += 1)`) = 900 comparisons, `expect(...).toEqual(...)` against `legacy` each time. Ran it myself as part of the full `london.test.ts` suite (14/14 pass, see §5) — the sweep test (`is unchanged by the refactor — matches the pre-refactor algorithm`) passed.

**Post-refactor `isDateInBusinessWindow`** now:
```ts
const { earliest, latest } = getBookingDateBounds({ now, bookingWindowDays });
return date >= earliest && date <= latest;
```
With `minimumNoticeHours` omitted from the call → `getBookingDateBounds` defaults it to `0` → its ternary `minimumNoticeHours > 0 ? ... : today` returns `today` → `earliest === today`, `latest === addBusinessDays(today, bookingWindowDays)`. Semantically identical to the pre-refactor two-liner. Confirmed both by reading and by the sweep.

---

## 2 — Notice semantics

Confirmed from source: `isDateInBusinessWindow` calls `getBookingDateBounds({ now, bookingWindowDays })` — **no `minimumNoticeHours` argument**, so the helper's default (`= 0`) applies and `earliest` stays `today` regardless of the live `minimum_notice_hours=4` setting.

`isOutsideMinimumNotice` (the fine-grained, per-slot check) is **untouched** by the diff — same file, no changes shown in `git show 4583573 -- src/lib/time/london.ts` beyond the two functions covered in §1. Confirmed it still exists at `src/lib/time/london.ts:145-160` doing `requestedAt >= minimumNoticeAt` per slot.

Confirmed both call sites in the slot engine still use the correct guard for the correct purpose, unchanged by this commit (no diff to `availability.ts` at all — see §8):
- `src/lib/booking/availability.ts:735-743` — `isOutsideMinimumNotice({ date, time: startTime, now, minimumNoticeHours: settings.minimum_notice_hours })` inside the per-slot loop. This is where the live 4h notice actually filters slots.
- `src/lib/booking/availability.ts:819-824` and `:906-910` — `isDateInBusinessWindow({ date, now, bookingWindowDays: settings.booking_window_days })`, **no notice param**, both call sites.

If the refactor had accidentally threaded notice into `isDateInBusinessWindow`'s day-level guard, `earliest` would move forward on high-notice settings and same-day evening slots would vanish entirely (the exact regression the brief and progress note warn about). It did not — **confirmed not notice-aware, as required.**

---

## 3 — Timezone

`getBookingDateBounds` and `isDateInBusinessWindow` compose only the existing `london.ts` primitives — `getBusinessDate` (formats via `Intl.DateTimeFormat({ timeZone: "Europe/London" })`) and `addBusinessDays` (UTC-noon-anchored date arithmetic on the resulting `YYYY-MM-DD` string, avoiding DST-edge wall-clock ambiguity). No raw `Date.getDate()`/`getMonth()`/local-timezone arithmetic introduced.

The notice-floor branch does `new Date(now.getTime() + minimumNoticeHours * 60 * 60 * 1000)` then re-formats through `getBusinessDate` — correct: adding wall-clock-independent milliseconds to an instant, then reading the London calendar date off the result, is the right way to advance time across a timezone.

BST→GMT boundary is explicitly exercised: `london.test.ts`'s `"applies the notice floor in London time across the BST→GMT change"` test pins `2026-10-24T23:30:00.000Z` + 4h notice → `2026-10-25` (the clock-change date, London's 01:00–02:00 repeats) and I confirmed this test passes (§5).

Client-side (`ScheduleStep.tsx`, `DatePickerField.tsx`): `parseISO` of the date-only `earliest`/`latest` strings produces **local-midnight** `Date` objects, consistent with the pre-existing convention already used for `monthDays`/`fullDates`/`availableDates` in the same component (`DatePickerField.tsx:51`, unchanged by this diff). Since react-day-picker's day cells are also drawn from local-calendar Date arithmetic, the London-calculated calendar-date string maps 1:1 onto the same-numbered cell in the customer's own calendar regardless of the customer's timezone — no new drift is introduced; this is the codebase's existing, accepted pattern for the customer picker, not a new UTC/local mismatch.

---

## 4 — Step 5, cross-plan hazard (admin calendar)

Read `src/app/admin/bookings/new/AvailabilityCalendarField.tsx:231` directly:
```tsx
disabled={[{ before: minDate }]}
```
`minDate = parseLocalDate(min) ?? new Date()` (line 187), `min` prop documented as "today, preserved as the only disabled boundary" (line 61). **No `after` bound anywhere in the file.** Grepped the whole file and found zero references to `getBookingDateBounds`, `date-bounds`, `earliestBookable`, or `latestBookable`. Also grepped all of `src/app/admin/` for those symbols — the only hits are unrelated English-language comments ("date-bounds" as a phrase) in three other admin modules, not this C-14 helper.

`AvailabilityCalendarField.tsx` does not appear in `git show 4583573 --stat` — untouched by this commit. C-23 brief finding 3 ("informs, never blocks") is intact. **No cross-plan regression.**

---

## 5 — Mutation testing (2 mutants, run myself on scratchpad copies)

Per the "never mutate in place" + "vitest include glob is `src/**`" constraint: copied `src/lib/time/london.ts` and `src/lib/time/london.test.ts` (unmodified, relative import `./london` still resolves) into `src/lib/time/__c14_mutation_scratch__/`, ran vitest against that isolated copy only, then deleted the directory and re-confirmed `git status --porcelain -- src/` shows only `maintenance.ts`.

Baseline (unmutated scratch copy): `npx vitest run src/lib/time/__c14_mutation_scratch__/london.test.ts` → **14/14 pass.**

| # | Mutation | Result | Tests that caught it |
|---|---|---|---|
| 1 | Upper bound made exclusive: `isDateInBusinessWindow`'s `date <= latest` → `date < latest` | **2 tests failed** | `isDateInBusinessWindow > accepts today and the last day of the window, and nothing outside` (expected `2026-09-07` in-window, got rejected); `isDateInBusinessWindow > is unchanged by the refactor — matches the pre-refactor algorithm` (sweep detects divergence at `bookingWindowDays=0`, `offset=0`, i.e. `date === today === latest`) |
| 2 | Off-by-one +1 on the upper bound: `getBookingDateBounds`'s `latest: addBusinessDays(today, bookingWindowDays)` → `addBusinessDays(today, bookingWindowDays + 1)` | **6 tests failed** | `makes \`latest\` today + bookingWindowDays, inclusive`; `counts the window from the London date, not the server's UTC date`; `applies the notice floor in London time across the BST→GMT change`; `reads the clock when \`now\` is omitted`; `isDateInBusinessWindow > accepts today and the last day of the window, and nothing outside`; `isDateInBusinessWindow > is unchanged by the refactor — matches the pre-refactor algorithm` |

Both mutants killed cleanly, by name. Scratch directory removed; `git status --porcelain -- src/` confirmed clean except `maintenance.ts` before and after.

---

## 6 — Deviation 1 audit: `src/app/(public)/layout.tsx`

Confirmed via `git show 4583573 --stat`: this file is in the diff and was **not** on the plan's files-touched list — a genuine Rule-4(b) violation (implementer proceeded rather than halting; see Findings NB-1).

On the merits, verified point-by-point:
- **`createSupabaseAdminClient()`, no `cookies()`/`headers()` anywhere in the path.** Traced `layout.tsx` → `getPublicBookingWindow()` (`src/lib/booking/booking-window-settings.ts`) → `createSupabaseAdminClient()` (`src/lib/supabase/admin.ts`). Grepped all three files for `cookies\|headers` — zero hits outside a code comment explaining *why* the admin client is used (`unstable_cache forbids cookies()`). `createSupabaseAdminClient` itself is a pure `process.env` read via `getServerEnv`, nothing dynamic.
- **Wrapped in `unstable_cache`.** Confirmed: `unstable_cache(async () => {...}, ["public-booking-window"], { revalidate: 60, tags: [TAGS.SETTINGS] })`.
- **`try/catch → null`.** Confirmed: the entire Supabase read is inside a `try { ... } catch { return null; }` block, and a `!data` guard also returns `null`.
- **Every bound optional, failed read degrades to prior behaviour.** `PublicLayout` computes `bookingWindow = MAINTENANCE_MODE ? null : await getPublicBookingWindow()`, threads `bookingWindow?.bookingWindowDays` / `bookingWindow?.minimumNoticeHours` (both optional chaining) down through `BookingExperienceLoader` → `BookingExperience` → `ScheduleStep`, all as optional props with `undefined` defaults. `ScheduleStep` computes `bounds = bookingWindowDays === undefined ? null : getBookingDateBounds(...)`, and `DatePickerField` falls back to `earliestBookable ?? today` / omits the `after` matcher entirely when `latestBookable` is undefined — verified this exact fallback is unit-tested (`DatePickerField.test.tsx`: `"leaves out-of-window days clickable when no bounds are supplied"`, `"still disables past days when no bounds are supplied"`).
- **Only JSON-safe primitives cross the cache boundary — no `Set`/`Map`/`Date`.** `PublicBookingWindow` is `{ bookingWindowDays: number; minimumNoticeHours: number }`. Confirmed by reading the full file — nothing else returned from the cached function.
- **Dates derived on the visitor's clock, not baked into the cached value.** The cached function returns only the two numbers. `ScheduleStep.tsx` (confirmed `"use client"` at line 1) calls `getBookingDateBounds({ bookingWindowDays, minimumNoticeHours: minimumNoticeHours ?? 0 })` **without a `now` argument**, so the helper's `now = new Date()` default runs in the browser at render time, on the visitor's own clock. A prerendered/cached page cannot bake in a stale "today" because "today" is never computed on the server side of this path.
- **`src/lib/maintenance.ts` not touched.** The diff only reads the pre-existing `MAINTENANCE_MODE` import (already present at line 6 before this commit, not added by it) — confirmed the file itself does not appear in `git show 4583573 --stat`.

**Build check: could not run.** `pnpm build` is banned for this agent per SUBAGENT-RULES. I did not run it and am not claiming the prerendering/static-route-count check passed — this remains the one named check the progress file itself flags as pending for the end-of-programme build (baseline: 54/54 static). Recorded under "Checks I could not run" below.

---

## 7 — Deviation 2 audit: `getBookingDateBounds` location (circular-import claim)

Verified the claim is real, not a rationalization. Root cause: the brief's own D11 finding (independently re-confirmed by reading current `london.ts`) is that `isDateInBusinessWindow` — the function Step 2 requires to be refactored to call the new helper — **already lives in `src/lib/time/london.ts`** (not `availability.ts`, which is what the plan's Step 2 text assumed when it was written). `london.ts` is also the only module that exports `getBusinessDate` and `addBusinessDays`, which `getBookingDateBounds` needs for its own arithmetic (confirmed: no duplicate exports of those two names exist anywhere else in the tree).

Had `getBookingDateBounds` been placed in the plan's `src/lib/booking/date-bounds.ts` as written:
- `date-bounds.ts` would need to `import { getBusinessDate, addBusinessDays } from "@/lib/time/london"` (no alternative source exists), and
- `london.ts`'s `isDateInBusinessWindow` would need to `import { getBookingDateBounds } from "@/lib/booking/date-bounds"` to satisfy Step 2.

That is a direct two-file cycle (`london.ts → date-bounds.ts → london.ts`), not a hypothetical one. Co-locating `getBookingDateBounds` inside `london.ts` itself (what `4583573` actually did) removes the cycle by construction — it's a same-file call, no cross-module edge at all. **Claim confirmed genuine**, given the reality the brief had already surfaced (the plan's premise — that `isDateInBusinessWindow` sits in `availability.ts` — is what's stale here, not the implementer's reasoning).

---

## 8 — Scope

Confirmed via `git show 4583573 --stat` (9 files, matching the progress note's file list exactly: `src/lib/time/london.ts`, `london.test.ts`, new `src/lib/booking/booking-window-settings.ts`, `DatePickerField.tsx` + new `.test.tsx`, `ScheduleStep.tsx`, `BookingExperience.tsx`, `BookingExperienceLoader.tsx`, `src/app/(public)/layout.tsx`).

- **`src/lib/booking/availability.ts` — zero diff.** Not in the stat list at all. `calculateAvailableSlots`'s contract, C-23's `{ ignoreBookingWindow, ignorePublicPause }` options bag, and `calculateAvailableDays` are all untouched by this commit.
- **Admin month route** (`src/app/api/admin/availability/month/route.ts`) — not in the stat list.
- **Booking flow step order/validation/payload** — `BookingExperience.tsx`'s diff is limited to an added optional-props interface and passing two numbers one level deeper to `ScheduleStep`; no changes to step sequencing, `bookingDetailsSchema`/`bookingAcknowledgementSchema`, or the booking POST payload shape.
- **No Phase A/B/C leakage.** No migration file in the diff; grepped the repo for `working-hours-segments.ts` and `WorkingHoursDayEditor` — neither exists yet (confirmed: Phase A/B/C are recorded as "not started" in the progress file, and no such files appear in `git show 4583573 --stat` or on disk).

---

## Gates — by identity

| Gate | Result | Identity match |
|---|---|---|
| `npx tsc --noEmit` | **0 errors** | matches |
| `pnpm vitest run` | **5 failed / 2070 passed / 2075 total** — `admin-access.test.ts` × 2 (`gives Owner broad access while keeping owner-only role actions permission-gated`, `gives Admin broad operational access without role template management`), `ManualBookingForm.test.tsx` × 3 (`renders step 1 on first load`, `moves focus to the first invalid field when continuing with errors`, `shows the consent error when trying to create booking without consent`) | exact match by name, no swapped-in failures |
| `pnpm lint` | **66 problems (59 errors, 7 warnings)** in exactly 6 files: `design_handoff_area_pages/prototype/{area-page.jsx, shared.jsx, site-chrome.jsx}` + `src/features/booking/{BookingExperience.tsx, BookingExperienceLoader.tsx, utils/returning-customer.ts}` | exact match; no seventh file appeared (verified by grepping all reported file-header lines in the raw lint output). The three booking files' errors are at lines the diff did not touch (`BookingExperience.tsx:201,253,340,386`; `BookingExperienceLoader.tsx:34`; `returning-customer.ts:61`, all pre-existing `react-hooks`/`no-unused-vars` issues unrelated to the added props) — confirmed **not fixed** by this commit (still present, still errors) |
| `pnpm build` | **NOT RUN** — banned for this agent per SUBAGENT-RULES | recorded, not claimed |

---

## Findings

**BLOCKING:** none.

**NON-BLOCKING:**
1. **Process deviation, already self-reported.** `src/app/(public)/layout.tsx` was edited despite not being on the plan's files-touched list, which SUBAGENT-RULES Rule 4(b) requires to be a halt-and-return, not a proceed-and-flag. The progress file (`redesign/per-page-progress/C-14-granular-working-hours-breaks-progress.md:65-67`) already records this as "the process failing; recorded as a deviation, not excused" — I concur with that framing and am not treating it as a new finding, but it is worth the orchestrator's attention as a repeat-pattern risk for future phases (Phase D also touched a second unlisted location, `getBookingDateBounds`'s file, under the same non-halt pattern — see §7).
2. **Outstanding end-of-programme build check.** The progress file (line 73) names a specific check that has not yet run: confirm public routes still prerender and the build stays at the recorded 54/54-static baseline after `layout.tsx` became `async`. I could not run `pnpm build` (banned) to check this myself. Nothing in my review contradicts the implementer's static-safety reasoning (no `cookies()`/`headers()` in the path — see §6), but this is real unverified risk until that build runs, with an explicit revert path already documented if it fails (`layout.tsx` + `booking-window-settings.ts`; Steps 1/2/3/5 stand alone without them).
3. **Minor, informational only:** my live slot count for `2026-09-07` (24, via `massage-30`/female/Luton) differs from the implementer's reported 23 (unspecified service). This is expected service/staff-roster variance, not a boundary-correctness issue — the window-acceptance/rejection boundary itself matched exactly in my independent check.

---

## Checks I could not run

- `pnpm build` — banned for this agent per SUBAGENT-RULES; the 54/54-static-prerender check named in the progress file remains unverified pending the orchestrator's single end-of-programme build.
- Playwright/browser-driven verification of the picker's actual clickable/greyed rendering — not run; verification here was via the unit/component test suite (`DatePickerField.test.tsx`, `london.test.ts`) plus direct source reading and live `/api/availability` calls, which together cover the property under test without needing a browser session.
- Full RSC-payload inspection confirming `/services/` actually carries `bookingWindowDays: 29, minimumNoticeHours: 4` at runtime — the progress file (line 77) claims this was checked by the implementer; I did not re-run a live RSC-payload capture myself (would require driving the public site through a browser, out of scope for a source+API-level verification pass). The prop-threading was instead verified by reading every hop of the chain (`layout.tsx` → `booking-window-settings.ts` → `BookingExperienceLoader` → `BookingExperience` → `ScheduleStep` → `DatePickerField`) and confirming types/optionality/fallbacks at each hop, plus `tsc --noEmit` passing (which would fail on a broken prop chain).
