# Y1 — What breaks (item 8 Phase 2, app layer)

## Methodology note — read this first

This repo was **under active, concurrent modification while this investigation ran**
(observed ~00:19–00:28 local, 2026-08-12). Earlier passes of this same investigation
caught genuinely transient intermediate states — e.g. a moment where
`booking-schema.ts` had already dropped `BOOKING_ALLOWED_CITIES` but
`AboutYouStep.tsx` still imported it (an unresolved-import state that would have
failed the build), and a moment where `tsc` reported a real, different error at
`layout.tsx:49` (`Type 'string[] | readonly []' is not assignable to type
'string[] | undefined'`). Neither of those reflects the code as it stands now — by
the time of the final, consistent sweep below, both had resolved. **Everything
reported as a finding past this point is anchored to that final sweep**, verified
by fresh `Read`s of all six touched files back-to-back, a clean non-incremental
`tsc --noEmit` (exit 0), a targeted `vitest run` across the eight files item 8
Phase 2 touches (108 passed, 3 failed — all three pre-existing and unrelated, see
Finding 4), and a targeted `eslint` run over the seven touched source files.

**Bottom line: items (a), (b), (c), (d) and (f) from the brief already appear to be
implemented and verified green. Item (e) — `ManualBookingForm.tsx` — has not been
touched.** This report is no longer a "what would break if…" exercise for most of
its scope; it verifies what actually shipped and ranks the residual, still-live
risks in it.

---

## Verified current state (as of the final sweep)

| File | Item | State |
|---|---|---|
| `src/features/booking/schemas/booking-schema.ts` | (a) | `BOOKING_ALLOWED_CITIES` and `validateServiceArea` are gone; both `.superRefine(validateServiceArea)` call sites are gone; `bookingLocationSchema` is now `= bookingLocationFieldsSchema` (no refine) at line 136 |
| `src/lib/booking/availability.ts` | (b) | City gate deleted from `loadContextRest`; `getAllowedCities`/`isCityAllowed` **deleted with it** (not left orphaned); `BusinessSettingsRecord.free_travel_cities` field removed since nothing reads it anymore |
| `src/lib/booking/free-travel-cities.ts` | (c) | **New file**, exists, mirrors `booking-window-settings.ts`'s cache pattern exactly (`unstable_cache`, 60s, `TAGS.SETTINGS`, admin client, fail-safe) |
| `src/app/(public)/layout.tsx` | (c) | Fetches `getFreeTravelCities()` alongside `getPublicBookingWindow()` via `Promise.all`, threads `freeTravelCities` into `<BookingExperienceLoader>` |
| `src/features/booking/BookingExperienceLoader.tsx` | (c) | Threads `freeTravelCities` through to `<BookingExperience>` |
| `src/features/booking/BookingExperience.tsx` | (c) | `BookingExperienceProps.freeTravelCities?: string[]` added; threaded into `<AboutYouStep>` at line 689 |
| `src/features/booking/components/AboutYouStep.tsx` | (d) | `BOOKING_ALLOWED_CITIES` import removed; `freeTravelCities?: string[]` prop added (default `[]`, line 100); `isCovered`/`isOutsideCoverage` derive from the prop; outside-coverage copy rewritten to neutral, non-blocking wording |
| `src/features/booking/schemas/booking-schema.test.ts` | (f) | Manchester case inverted (now asserts `success: true`), a second case added against `bookingDetailsSchema`, and an anti-drift guard test added (lines 66–80) |
| `src/features/booking/components/AboutYouStep.test.tsx` | (f) | `renderStep` harness passes `freeTravelCities={["Luton", "Dunstable"]}` (line 118); outside-coverage test rewritten for the new copy |
| `src/app/admin/bookings/new/ManualBookingForm.tsx` | (e) | **Untouched.** Stale doc comment (547–550) and stale advisory copy (1728) still describe a server-side gate that no longer exists |

Verification commands run (read-only):
- `npx tsc --noEmit --incremental false` → exit 0, no output.
- `npx vitest run` across `booking-schema.test.ts`, `AboutYouStep.test.tsx`, the four
  `src/lib/booking/__tests__/*.test.ts` files, `ManualBookingForm.test.tsx`, and
  `updateBusinessSettings.test.ts` → **Test Files: 1 failed | 7 passed (8). Tests: 3
  failed | 108 passed (111).** All 3 failures are in `ManualBookingForm.test.tsx`
  and are pre-existing (see Finding 4).
- `npx eslint` over the seven touched source files → 4 errors, all in
  `BookingExperience.tsx` (3) and `BookingExperienceLoader.tsx` (1), all pre-existing
  `react-hooks/*` findings at shifted line numbers (see Finding 5). Zero findings in
  `availability.ts`, `AboutYouStep.tsx`, `booking-schema.ts`, `layout.tsx`, or the new
  `free-travel-cities.ts`.

---

## Findings, ranked by severity

### 1. [MEDIUM-HIGH, live, non-blocking] Empty/failed `freeTravelCities` makes AboutYouStep call every city — including genuinely covered ones — "outside our free-travel areas"

**Where:** `src/features/booking/components/AboutYouStep.tsx`

```
 96	export function AboutYouStep({
 97	  form,
 98	  prefilled = false,
 99	  onClearPrefill,
100	  freeTravelCities = [],
101	}: AboutYouStepProps) {
```

```
129	  const normalizedCity = city.trim().toLowerCase();
130	  const hasCityValue = normalizedCity.length > 1;
131	  const isCovered =
132	    hasCityValue &&
133	    freeTravelCities.some((town) => {
134	      const allowed = town.trim().toLowerCase();
135	      return (
136	        allowed !== "" &&
137	        (normalizedCity === allowed || normalizedCity.includes(allowed))
138	      );
139	    });
140	  // Informational only. Nothing downstream blocks on this — an address outside
141	  // the free-travel areas is bookable (item 8 Phase 2).
142	  const isOutsideCoverage = hasCityValue && !isCovered;
```

```
502	      <div className={styles.stepBlock}>
503	        <h3 className={styles.blockTitle}>Where should we visit?</h3>
504	        <div className={styles.chipRow}>
505	          {freeTravelCities.map((town) => {
```

```
531	        {isOutsideCoverage ? (
532	          <div className={styles.notice}>
533	            <MapPin aria-hidden="true" size={18} />
534	            <p>
535	              <strong>Outside our free-travel areas:</strong> This address can
536	              still be booked.
537	              {freeTravelCities.length > 0
538	                ? ` We travel to ${formatTownList(freeTravelCities)} at no extra charge.`
539	                : ""}
540	            </p>
541	          </div>
542	        ) : null}
```

**Failure scenario:** `getFreeTravelCities()` (`src/lib/booking/free-travel-cities.ts`)
is explicitly fail-safe: any error — missing row, a transient Supabase blip, a
`business_settings.free_travel_cities` value that isn't an array — makes it
`return []`, by design (its own header comment says so). That `[]` flows,
unmodified, through `layout.tsx` → `BookingExperienceLoader` →
`BookingExperience` → `AboutYouStep`. With `freeTravelCities = []`:
`freeTravelCities.some(...)` is `false` for **every** city, so `isCovered` is
always `false` and `isOutsideCoverage` is `true` for any city the customer types
or picks — including a real Luton address. Concretely: a customer in Luton, during
the up-to-60-second window after a cache-refresh hiccup, sees an **empty**
"Where should we visit?" chip row (nothing to click) and "**Outside our
free-travel areas:** This address can still be booked." under their own,
genuinely-covered town.

**Why it's not higher severity:** nothing gates on `isCovered`/`isOutsideCoverage`
anywhere (confirmed: these two identifiers have zero other readers in `src/`, and
the actual submission gate — `bookingDetailsSchema.safeParse` in
`BookingExperience.tsx` — no longer has a city refine at all). The booking still
succeeds. The copy itself is reassuring ("This address can still be booked"), not
a refusal, and the `freeTravelCities.length > 0 ? …: ""` guard at line 537
correctly avoids a dangling "We travel to ." sentence. So this degrades trust in
the coverage widget for up to a minute, not the booking flow itself.

**Fix (a judgment call, not a correctness bug):** gate `isOutsideCoverage` on
`freeTravelCities.length > 0` too, e.g. `hasCityValue && freeTravelCities.length >
0 && !isCovered` — this makes an empty/failed list hide the notice entirely
instead of asserting "outside" for a city that might well be covered. This is
exactly the fail-open convention `ManualBookingForm.tsx` already uses for the same
underlying data (see Finding 3).

### 2. [MEDIUM, confirmed outstanding — item (e) not yet done] `ManualBookingForm.tsx` still documents and shows a gate that no longer exists anywhere

**Where:** `src/app/admin/bookings/new/ManualBookingForm.tsx`, both untouched since
before this investigation began (grep-reconfirmed against the same line numbers
P4's earlier report found):

```
547	  /** C-07 Step 5 (W02-E-1) — business_settings.free_travel_cities, for the
548	   * inline (non-blocking) city warning below; create_booking_request still
549	   * enforces this server-side, reading the `allowed_cities` column the
550	   * settings form keeps in step with it until item 8 Phase 2 removes the gate. */
551	  allowedCities?: string[];
```

```
1726	            {!isCityKnown ? (
1727	              <p className="text-xs text-[oklch(26%_0.14_25)]" role="alert">
1728	                &ldquo;{cityTrimmed}&rdquo; is outside our current service area. We deliver to: {allowedCities.join(", ")}.
1729	              </p>
1730	            ) : null}
```

**Concrete problem:** the doc comment (548–550) claims `create_booking_request`
still enforces the gate server-side "until item 8 Phase 2 removes the gate" — but
per this task's own state-of-the-world briefing the SQL gate is already gone
(migration `20260811230807`), and this investigation confirms the client-side
schema gate is gone too. The comment is now doubly wrong. The visible copy at 1728
— `"…is outside our current service area. We deliver to: {list}."` — reads as a
refusal ("we deliver to X" implies "and nowhere else"), which contradicts the
booking actually succeeding for any city. This is admin-only and non-blocking
(`isCityKnown` never gates the Create-booking button — confirmed: its only reads
are the definition at 1688 and this one render check at 1726), so nothing crashes
or is prevented; it actively misinforms whoever is entering the booking on the
admin's behalf.

**Fix:** reword to match `AboutYouStep`'s neutral framing (e.g. "outside our
free-travel areas — still bookable, travel charge may apply") and update/delete
the stale doc comment.

### 3. [LOW] The two "empty list" fail-safes now disagree with each other

`ManualBookingForm.tsx`'s `isCityKnown` (1688–1694) treats an *empty* `allowedCities`
as "known" — i.e. it fails **open**, showing no warning at all:

```
1688	  const isCityKnown =
1689	    cityTrimmed.length === 0 ||
1690	    allowedCities.length === 0 ||
1691	    allowedCities.some((allowed) => {
```

`AboutYouStep.tsx`'s `isOutsideCoverage` (Finding 1) fails **closed** — an empty
`freeTravelCities` makes every city look uncovered. Same underlying column
(`business_settings.free_travel_cities`), same failure mode (a settings read that
comes back empty), opposite user-facing behaviour on the two entry points for the
exact same booking record. Neither is a functional bug on its own (Finding 1
explains why AboutYouStep's version is non-blocking), but it's worth a single,
conscious convention rather than two that happened to diverge — see the fix
suggested in Finding 1.

### 4. [Not a regression — flagging to prevent misattribution] `ManualBookingForm.test.tsx`'s 3 failures are pre-existing and unrelated

`npx vitest run src/app/admin/bookings/new/ManualBookingForm.test.tsx` fails on:
`renders step 1 on first load`, `moves focus to the first invalid field when
continuing with errors`, `shows the consent error when trying to create booking
without consent`. All three fail on an unrelated symptom — a `waitFor(() =>
screen.getByText("Services & participants…"))` timeout after clicking Continue
from step 1, alongside a `"A React form was unexpectedly submitted…"` console
error — nothing to do with city/`allowedCities`/`isCityKnown`. This matches the
repo's already-documented baseline of known pre-existing failures. Re-running the
full suite after item 8 Phase 2 lands will still show these 3 red; that is
expected and should not be attributed to this work.

### 5. [Informational — checked, not found] The specific hard regressions this task asked to hunt for did not happen

- **No 7th lint-baseline file.** `getAllowedCities`/`isCityAllowed` were deleted
  together with the gate in `availability.ts`, not left orphaned — `eslint` on that
  file returns zero findings. `AboutYouStep.tsx`, `booking-schema.ts`, `layout.tsx`,
  and the new `free-travel-cities.ts` are all clean too. `BookingExperience.tsx`'s 3
  pre-existing `react-hooks/*` errors and `BookingExperienceLoader.tsx`'s 1 are
  still there, at shifted line numbers only (201→209, 253→261, 340→348, and 34→35
  respectively — consistent with the lines added for the new prop/JSDoc) — same
  `{file, ruleId}` identity as the documented baseline, not new violations.
- **No hardcoded town list survives in shipped code.** Repo-wide, case-insensitive
  grep for `dunstable|houghton regis|harpenden|st albans` under
  `src/features/booking/` and `src/lib/booking/` returns matches only in test
  fixtures, test comments, and two explanatory (non-list) comments in
  `free-travel-cities.ts` and `availability-options.test.ts`. `BOOKING_ALLOWED_CITIES`
  no longer exists anywhere in `src/`.
- **The anti-drift guard is real but narrowly scoped.** `booking-schema.test.ts`
  (lines 66–80) asserts `BOOKING_ALLOWED_CITIES` isn't exported and
  `validateServiceArea`/`"houghton regis"` aren't in that one file's own source —
  it would not catch a hardcoded list reappearing in a *different* file (e.g. a
  fallback constant added later inside `AboutYouStep.tsx`). None exists today
  (previous bullet), but there's no repo-wide guard for this concern analogous to
  `src/content/site/__tests__/canonical-domain.test.ts`'s `sourceFiles()` walk — an
  optional hardening, not a current defect.
- **No new inconsistent gating state.** The DB (`create_booking_request`), the
  admin manual form (`isCityKnown`, always advisory-only), and the customer form
  (`bookingDetailsSchema`, refine removed) are all uniformly permissive now — an
  out-of-zone address is bookable through every path. The only surviving asymmetry
  is the *messaging* convention in Finding 3, not gating.
- **`tsc --noEmit` is clean** (exit 0, zero diagnostics) against the final state.

---

## Summary for the caller

Ranked action items, most to least important:

1. Decide on and apply the `isOutsideCoverage` empty-list guard in
   `AboutYouStep.tsx` (Finding 1) — optional but recommended, cheap, one line.
2. Update `ManualBookingForm.tsx`'s doc comment (547–550) and advisory copy (1728)
   — item (e) is the one piece of the brief's (a)–(f) list not yet done.
3. If Finding 1's fix lands, apply the same convention to
   `ManualBookingForm.tsx`'s `isCityKnown` reasoning for consistency, or explicitly
   decide the asymmetry is fine and drop this from the backlog.
4. No action needed for lint, the anti-drift guard, hardcoded-list survival, or
   gating consistency — all verified clean as of this sweep.
