# Item 8 Phase 2 — Y2: completeness and contradictions

Read-only pass over P1–P4's reports plus independent re-derivation from source.
**Headline finding, ahead of everything else below: the working tree is no
longer at HEAD.** `git status` at the time of this read shows five files
modified and one new file, uncommitted, on top of `46f9369`:

```
 M src/app/(public)/layout.tsx
 M src/features/booking/BookingExperience.tsx
 M src/features/booking/BookingExperienceLoader.tsx
 M src/features/booking/components/AboutYouStep.tsx
 M src/features/booking/schemas/booking-schema.ts
 M src/lib/booking/availability.ts
?? src/lib/booking/free-travel-cities.ts
```

Someone (a concurrent implementer, presumably acting on P1–P4) has **already
applied almost the entire Phase 2 app-layer change** while this review was in
flight — confirmed by direct re-read, not inferred from the diff alone. I
watched `AboutYouStep.tsx` change under me mid-session: my first read (before
I ran `git status`) showed the old `BOOKING_ALLOWED_CITIES`-importing version
byte-for-byte as P1/P2/P3 quoted it; a later read of the same file showed the
new prop-driven version. **Treat this report as a snapshot; by the time it's
read, the state may have moved further still.** Everything below is what I
directly observed, with line numbers and command output, not a re-statement
of P1–P4's now-partially-stale claims.

## 0. What the concurrent implementer has already done (verified live)

- **`booking-schema.ts`** — `BOOKING_ALLOWED_CITIES` and `validateServiceArea`
  are gone; both `superRefine(validateServiceArea)` call sites are gone.
  `bookingLocationSchema` is now `export const bookingLocationSchema = bookingLocationFieldsSchema;`
  (no refine). `bookingDetailsSchema`'s chain now ends
  `.superRefine(validateParticipantGenders);` only. Grep confirms **zero**
  town-name literals remain anywhere in the file. This is exactly P1's
  recommended edit, done.
- **`availability.ts`** — `getAllowedCities`/`isCityAllowed` and the
  `loadContextRest` gate (old :454-456) are gone; `free_travel_cities` was
  also dropped from `BusinessSettingsRecord` and from the `loadSettings`
  select-column list entirely (going further than P4's "delete the two
  functions" recommendation, since the column is no longer read here at all).
  I ran the four real test files that exercise this path:
  `override-windows.test.ts`, `staff-recurring-windows.test.ts`,
  `working-hours-segments.test.ts`, `availability-options.test.ts` — **all 55
  tests pass** against the edited file.
- **New prop-threading chain**, matching P3's Path B almost exactly: new file
  `src/lib/booking/free-travel-cities.ts` exports `getFreeTravelCities():
  Promise<string[]>` (unstable_cache, `TAGS.SETTINGS`, admin client, empty
  array on any failure — same shape as `getPublicBookingWindow`). Threaded
  through `(public)/layout.tsx` → `BookingExperienceLoader.tsx` →
  `BookingExperience.tsx` (new `freeTravelCities?: string[]` prop, JSDoc at
  lines 83-89) → `<AboutYouStep freeTravelCities={freeTravelCities} />` at
  `BookingExperience.tsx:689`.
- **`AboutYouStep.tsx` — fully rewritten**, not merely prop-threaded. Current
  state, byte-exact:
  - Import list no longer includes `BOOKING_ALLOWED_CITIES` (only
    `type BookingDetailsFormValues` remains, line 17).
  - `AboutYouStepProps` (lines 23-34) now has a fourth prop:
    ```
    23	interface AboutYouStepProps {
    24	  form: UseFormReturn<BookingDetailsFormValues>;
    25	  prefilled?: boolean;
    26	  onClearPrefill?: () => void;
    27	  /**
    28	   * business_settings.free_travel_cities, threaded from the public layout
    29	   * (item 8 Phase 2). DISPLAY ONLY — nothing here blocks an address outside
    30	   * the list. Empty when the read failed, which hides the town names rather
    31	   * than rendering an empty sentence.
    32	   */
    33	  freeTravelCities?: string[];
    34	}
    ```
  - Destructured with a safe default: `freeTravelCities = []` (line 100) —
    so no required-prop compile break for any caller that doesn't pass it.
  - `isCovered`/`isOutsideCoverage` (lines 129-142) now derive from the
    **prop**, not a static import:
    ```
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
  - Town chips (line 505) now map over `freeTravelCities` instead of the old
    static `COVERED_TOWNS`.
  - **The outside-coverage notice has already been rewritten** to something
    that is no longer false, and it no longer uses the red `noticeError`
    style — both boxes now share the neutral `styles.notice` class:
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
    (`formatTownList`, lines 60-63, joins with an Oxford-less "and" —
    `"Luton, Dunstable, Houghton Regis, Harpenden and St Albans"` — same style
    as the old hardcoded sentence.)

**This already satisfies the spirit of Y2 lens 3** (stop the copy being false,
without inventing Phase 5's fee wording) — see §3 for an assessment of this
specific string plus alternates, since the task asked for candidates
regardless of what's already shipped.

## 1. What's still broken or unfinished (verified by running tests, not guessed)

Both `booking-schema.test.ts` and `AboutYouStep.test.tsx` are **unmodified**
(absent from `git status`), so they still assert the pre-Phase-2 behavior
against the now-edited source. I ran them:

```
npx vitest run src/features/booking/schemas/booking-schema.test.ts src/features/booking/components/AboutYouStep.test.tsx
```

Result: **2 test files failed, 3 individual tests failed, 7 passed.**

1. `booking-schema.test.ts > booking schema > rejects unsupported service areas before time selection` (test body at :39-47) — `expect(result.success).toBe(false)` now receives `true`: Manchester parses successfully, exactly as P1 predicted. **Needs deletion/rewrite.**
2. `AboutYouStep.test.tsx > ... > fills address, city, area and postcode ... covered-area notice follows` — fails with `Unable to find an element with the text: Covered area:`. Root cause: the test's `renderStep()` harness (still, unmodified, lines 99-120) renders `<AboutYouStep form={form} />` with **no `freeTravelCities` prop**, so it defaults to `[]`, so `isCovered` is unconditionally `false` no matter what city is typed — the harness itself must start passing a `freeTravelCities` fixture. This is exactly the risk P2 flagged in the abstract ("if Phase 2 adds a new prop... this harness will need updating too") — now realized as an actual failing test, not a hypothetical.
3. `AboutYouStep.test.tsx > ... > surfaces the outside-coverage notice when the selected address is out of area` — fails with `Unable to find an element with the text: Outside current home visit area:`. Root cause: the implementer already renamed the heading from `"Outside current home visit area:"` to `"Outside our free-travel areas:"` (§0 above) — the test's literal string (line 278) is now stale.

**Not yet touched by the concurrent implementer** (confirmed unmodified —
absent from `git status`, and read directly):

- `src/app/admin/bookings/new/ManualBookingForm.tsx` — `isCityKnown`
  (comment 1681-1685, computation 1686-1694, notice 1726-1730 — all
  byte-exact as P4 quoted, re-confirmed by direct read this session) is
  unchanged. Its notice still reads `"{cityTrimmed}" is outside our current
  service area. We deliver to: {allowedCities.join(", ")}."` and the prop
  doc comment (547-550) still says `create_booking_request still enforces
  this server-side ... until item 8 Phase 2 removes the gate` — which is now
  doubly stale: the DB gate was already removed (migration `20260811230807`,
  per the task brief) *and* the app-layer gate the comment is bracing for is
  now also gone in the working tree, uncommitted. Nothing here is functionally
  broken (this warning was always non-blocking, confirmed: exactly 2
  references to `isCityKnown` in the file, definition + one read gating only
  the `<p role="alert">`), but the copy is now inaccurate in a second,
  independent place from the customer-facing one.
- `booking-schema.test.ts` and `AboutYouStep.test.tsx` themselves (see above).
- No anti-drift guard test exists yet (§4).
- No test proves an out-of-zone city yields real slots (§4).

## 2. Complete inventory — every hardcoded UK town-name hit, by role

Case-insensitive grep for `luton|dunstable|houghton regis|harpenden|st
albans` across `src/` returns 111 files; `e2e/` returns 0; `scripts/` returns
1 (`scripts/seed-e2e-staff.mjs`, a seed script — not gating, not read).
Sorted into roles:

**A — the actual coverage-gate feature (fully accounted for above):**
`booking-schema.ts` (list now removed), `AboutYouStep.tsx` (one placeholder
string left, `placeholder="e.g. Luton"` at line 552 — a UX hint, not a gate),
`availability.ts` (never hardcoded names — reads the settings column
dynamically, confirmed both before and after the edit), `ManualBookingForm.tsx`
(reads `allowedCities` prop dynamically, never hardcodes the list — the only
literal is the postcode-format placeholder `"LU1 1AA"` and city placeholder
`"Luton"`, both examples, not gates).

**B — admin settings/staff UI, display or fallback only, not customer-facing gating:**
- `src/app/admin/settings/SettingsForm.tsx:424` — `placeholder="e.g. Luton town centre"` (free-text input hint).
- `src/app/admin/staff/[staffId]/StaffProfileForm.tsx:340` — `hint="e.g. Luton, Dunstable, Houghton Regis"` — this is the **staff service-area** field (which towns a *therapist* covers), a different feature from the customer booking gate; `"Service areas"` at `dashboard/ProfileCompletionNudge.tsx:45` and `staff/[staffId]/page.tsx:301,946` are the same staff-profile feature, unrelated to Item 8.
- `src/app/admin/settings/page.tsx:19` — `fallbackSettings.free_travel_cities = ["Luton", "Dunstable", "Houghton Regis"]`, used only if the settings-row fetch fails entirely. **Pre-existing inconsistency worth a footnote**: this fallback lists 3 towns, not the real 5 — not part of Item 8's scope and not customer-facing (admin-only, failure path), but if anyone touches this file for Phase 2 it should not be left looking authoritative.

**C — marketing/SEO copy naming Luton as the business's home city** (NOT under
`src/app/(public)/areas`, so not covered by the Owner's explicit
out-of-scope carve-out, but unrelated to the coverage gate and not proposed
for change here): `src/content/site/identity.ts`, `src/content/site/social.ts`
(Instagram handle only), `src/app/layout.tsx` (metadata title/description),
`src/components/layout/SiteFooter.tsx`, and the home/about/services/reviews/
faqs-aftercare page + component files (`src/content/pages/{home,about,
services,faqsAftercare}.ts`, `src/components/{home,about,services,reviews,
faqs-aftercare}/*.tsx`). These say "Luton and surrounding areas" as a tagline;
none of them gate, warn, or read `business_settings`.

**D — the areas feature, explicitly OUT OF SCOPE by Owner decision, listed
only, no changes proposed:** `src/app/(public)/areas/page.tsx`,
`src/app/(public)/areas/[slug]/page.tsx`, `src/content/pages/areaPages.ts`,
`src/components/area-pages/*.tsx` (AreaStats, AreaTherapists, AreaNearby,
AreaMap, AreaLinks, AreaFinalCTA, AreaPackages), `src/components/area-pages/
area-json-ld.ts`.

**E — generic test fixtures, ~85 of the 111 files, using "Luton" as a
plausible sample address for an unrelated feature** (email-template
snapshot tests, client CRUD tests, dashboard card tests, bookings-admin view
tests, `sample-data.ts`/`templates-data.ts` fixture data) — none of these
exercise or assert on the coverage-gate feature; they'd use any placeholder
city with identical results.

**F — the genuine service-area test/spec files**, covered in §1 above, plus
two more not mentioned by any of P1–P4 because none of them read `e2e/`:
- `e2e/admin-settings.spec.ts:70,93-94` — asserts the settings form submits
  `free_travel_cities` and that no `allowed_cities` input exists. This is a
  **Phase 1** concern (already shipped, 46f9369) and is unaffected by
  anything in this pass.
- `e2e/booking-public.spec.ts` — **full file read, 21 lines.** Its one test
  is titled `"booking page exposes the service step and can show unsupported
  service area feedback"` (line 7) but the test body (lines 10-19) only opens
  the booking dialog, picks a package, and asserts the "who is this for" step
  appears — **it never types an out-of-area city and never asserts on any
  coverage notice.** It is also gated behind `test.skip(!hasBaseUrl(), ...)`
  (line 5), so it doesn't run without `E2E_BASE_URL` set. Nobody's report
  flagged this because none of P1–P4 searched `e2e/`. Its title is now
  doubly misleading post-Phase-2 (it never tested rejection, and there is no
  rejection left to test) — flagged as a real, if low-severity, gap: this is
  the one E2E spec whose name promises exactly the coverage this whole item
  is about, and it delivers none of it.

## 3. Interim copy — assessment of what's shipped, plus alternates

The task's constraint: must stop being false; must not invent a fee amount or
name the mileage origin (Phase 5, needs Owner sign-off).

**What's already in the working tree** (§0, `AboutYouStep.tsx:531-542`):

> **Outside our free-travel areas:** This address can still be booked. We
> travel to Luton, Dunstable, Houghton Regis, Harpenden and St Albans at no
> extra charge.

Assessment: **passes the constraint.** It names no fee amount and no mileage
origin — "at no extra charge" describes the five *named* towns only (a true,
already-decided fact — those towns are the free-travel zone by definition),
and says nothing about what an out-of-zone address will cost. It is no
longer false: it doesn't tell the customer they must change city before
continuing. Styling was also softened from `noticeError` (red) to `notice`
(neutral), which matches the softened claim. **Test impact:** breaks
`AboutYouStep.test.tsx:278` (`getByText("Outside current home visit
area:")`) because the *heading* changed too, not just the body — this is
listed as a currently-failing test in §1 regardless of which candidate is
chosen going forward, since the heading text is already gone from the source.

**Two alternates**, in case the heading change above is unwanted (e.g., to
minimize the test diff by keeping the original heading intact):

**Candidate B — keep the original heading, change only the directive sentence:**
> **Outside current home visit area:** We currently cover Luton, Dunstable,
> Houghton Regis, Harpenden and St Albans, but we're happy to consider
> nearby locations too — go ahead and choose a time.

Test impact: `AboutYouStep.test.tsx:278` asserts only on the bold heading
fragment `"Outside current home visit area:"` (confirmed by direct read —
no test in this file asserts on any other substring of the notice body), so
this candidate is a **strictly smaller test diff than what's already
shipped**: it would make the `getByText` assertion pass again unmodified,
leaving only the `renderStep`-harness fix (test 1, §1) to make. It also
keeps the smallest possible text delta from the pre-Phase-2 string, which
may matter if anyone is diffing customer-facing copy for a changelog.

**Candidate C — heading changed, no "no extra charge" claim at all (most conservative on money-adjacent language):**
> **Outside our usual coverage area:** This location is a little outside our
> typical range, but you can still choose a time — we'll confirm everything
> about the visit with you directly.

Test impact: same as the shipped copy — breaks `AboutYouStep.test.tsx:278`
(heading text changed). Rationale for offering it anyway: "at no extra
charge" (shipped copy, Candidate A) is truthful today only because free
travel really is free for the five named towns, but it sits one inference
away from implying something about cost for the *customer's actual* address,
which is exactly the kind of adjacency the task asked to avoid until Phase 5
signs off on real fee wording. Candidate C never uses the words "charge",
"extra", or "at no cost" in either direction, which is the safest reading of
"must not invent the fee-mentioning wording."

None of the three candidates revive `booking-schema.test.ts:39-47` — that
test is gone regardless of copy, because it asserts on `bookingLocationSchema`
rejecting Manchester outright, and the schema-level rejection has already
been removed from the source (§0), independent of any copy decision.

## 4. Tests that should exist, and whether current infra supports them

**(a) Guard: the public form's town list comes from the database, not a
constant.** Two distinct things worth testing, only one of which the
existing infra directly supports:

- *Static anti-drift guard* ("no hardcoded town list reappears under
  `src/features/booking/` or `src/lib/booking/`"): **fully supported by an
  existing, already-verified idiom** — `src/content/site/__tests__/
  canonical-domain.test.ts` (read in full this session, confirmed matching
  P1's quotes exactly). Its `sourceFiles()` walker (lines 23-29) plus the
  "appears nowhere" assertion pattern (lines 37-45, with the
  `files.length > 100` vacuous-pass guard at line 39) is directly reusable:
  scope `sourceFiles()` to `src/features/booking` and `src/lib/booking`,
  scan for the five lowercase town needles, assert zero offenders. No new
  test infrastructure needed — this is a same-shape new file, not a new
  pattern.
- *Runtime proof the value actually flows from the DB* (not just "no literal
  exists"): **partially supported.** `AboutYouStep.test.tsx`'s `renderStep()`
  harness (lines 99-120) already has the right shape (mount via a real
  `useForm` + dynamic import) but its signature currently accepts no props
  override — it would need a small, additive change (an optional second
  argument threading `freeTravelCities` into `<AboutYouStep>`) to let a test
  pass e.g. `freeTravelCities={["Manchester"]}` and assert the chip renders
  and `isCovered` flips true for a Manchester city — proving the component
  reads its prop rather than a constant. This is the same fix already needed
  to un-break test 1 in §1, so it is not extra work, just work that should be
  done deliberately rather than as an incidental fix.

**(b) Behavioral test: an out-of-zone city now yields slots, not an empty
calendar.** **Fully supported by existing infra, zero new patterns needed.**
The four files `override-windows.test.ts`, `staff-recurring-windows.test.ts`,
`working-hours-segments.test.ts`, `availability-options.test.ts` all build a
fake Supabase client via `createFakeAdminClient({ business_settings: { data:
{ ..., free_travel_cities: [...] }, error: null }, ... })` (quoted verbatim,
`override-windows.test.ts:78-88`) and call `calculateAvailableSlots(...,
{ city: "Luton", ... })` (`override-windows.test.ts:155-160`). **Every
existing fixture across all four files uses `city: "Luton"`** — confirmed by
grep, zero exceptions — so **no test today proves the positive case.** A new
test (or a new `it()` in `availability-options.test.ts`, which already
imports `calculateAvailableDays`/`AvailableDaysResult`) using the identical
harness with `city: "Manchester"` and asserting the result is real slots
(not `{ reason: "Location is outside the service area.", durationMins: 0 }`,
which the same grep confirms is no longer even reachable — the string was
deleted along with the gate) would close this gap with no new infrastructure.

**(c) Not asked for but surfaced by this pass — should also be tracked:**
the 3 currently-failing tests in §1 (these aren't proposals, they're active
breakage that blocks calling Phase 2 "done"), and `e2e/booking-public.spec.ts`'s
mistitled test (§2, category F) — if it's meant to cover this feature at
all, it should type an out-of-area city and assert the new notice, not just
reach the "who is this for" step.

## Summary for the caller

Phase 2's app-layer code changes are **already ~90% written, uncommitted, in
the working tree** — not merely planned. What remains: (1) fix or rewrite the
3 tests broken by that work (§1), (2) decide on final vs. one of the
alternate interim strings (§3 — the shipped one already clears the
fee/mileage-origin bar, so this is a polish decision, not a correctness
one), (3) update `ManualBookingForm.tsx`'s stale doc comment and admin
warning copy for consistency (§1, not itself broken), (4) add the anti-drift
guard and the out-of-zone-yields-slots test (§4), (5) optionally fix
`e2e/booking-public.spec.ts`'s mistitled test. None of P1–P4's individual
line-number claims were found to be wrong on their own terms (their
"CONFIRMED" verdicts held up against fresh reads at the time each was
written); the only real "contradiction" this pass found is temporal — the
ground moved under all four reports while they were being written and after.
