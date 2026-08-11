# P4-availability-and-manual — verification report

Files read in full:
- `src/lib/booking/availability.ts` (969 lines)

Files read in part (targeted ranges + repo-wide grep for every symbol/string named in the task):
- `src/app/admin/bookings/new/ManualBookingForm.tsx` (2485 lines total; read 1650-1749 and 515-575 in full)
- `eslint.config.mjs`, `node_modules/eslint-config-next/dist/typescript.js` (to verify the `no-unused-vars` severity claim)
- `src/lib/booking/__tests__/{availability-options,override-windows,staff-recurring-windows,working-hours-segments}.test.ts`, `src/app/api/availability/route.test.ts` (grep + spot-read, to verify the "no test file" claim)

Repo-wide greps run: `getAllowedCities`, `isCityAllowed`, `Location is outside the service area`, `isCityKnown`, `allowedCities`, `isFreeTravelZone`/`free_travel_cities`.

---

## A.1 — Byte-exact city gate in `loadContextRest`, actual lines

**Actual lines 454-456** (function starts at line 449, JSDoc at 443-448):

```
454	  if (!isCityAllowed(input.city, getAllowedCities(settings.free_travel_cities))) {
455	    return { reason: "Location is outside the service area.", durationMins: 0 };
456	  }
```

Confirms Phase 1 already changed the read from `settings.allowed_cities` to `settings.free_travel_cities` (this is the only change Phase 1 made here — the block is still a hard blocking gate).

---

## A.2 — "Nothing else in `loadContextRest` (lines 449-559) reads `input.city` after this" — CONFIRMED, plus the unused-vars analysis

Repo-wide grep for `input.city` returns exactly **one hit in the whole file**: line 454. Full-function read (449-559) confirms no other reference — the rest of the function only touches `input.serviceIds` (line 461) and `input.participantGenders` (lines 471, 482, 489). So the claim is **CONFIRMED**.

**Does `city` become unused / trip `no-unused-vars` if the block is deleted? NO, for the field itself — but YES for the two helper functions (see A.3).**

- The `city` **field** lives in two places: the exported `CalculateAvailableSlotsInput`/`CalculateAvailableDaysInput` interfaces (lines 18, 38) and the inline parameter type of `loadContextRest` (line 452: `input: { serviceIds: string[]; participantGenders: TherapistGender[]; city: string }`). `@typescript-eslint/no-unused-vars` operates on JS *bindings* (variables, params, imports, function declarations) — it does not flag an object-type **property** that's declared but never read, because a type-literal property isn't a binding. TypeScript's own unused-parameter/local checks behave the same way (they don't cover object-type members). So deleting lines 454-456 leaves `city: string` sitting unread in three type declarations, and **none of that trips the lint rule or `tsc`.**
- The `input` **parameter** of `loadContextRest` itself stays used (via `.serviceIds`/`.participantGenders`), so it's never flagged either.
- The exported interfaces' `city` field is also still required by every external caller (`calculateAvailableSlots`/`calculateAvailableDays` inputs, which callers in `src/app/api/availability/route.ts`, `src/app/api/availability/month/route.ts`, `src/app/api/admin/availability/month/route.ts` all populate) — removing it from the type would be a separate, larger breaking change the task doesn't ask for, and isn't needed to avoid a lint regression.

**What actually breaks the baseline is the two functions, not the field — see A.3.**

---

## A.3 — `getAllowedCities` / `isCityAllowed` call sites, and what must happen

Repo-wide grep (not just this file) for `getAllowedCities` and `isCityAllowed`:

```
src\lib\booking\availability.ts:243:function getAllowedCities(value: unknown) {
src\lib\booking\availability.ts:251:function isCityAllowed(city: string, allowedCities: string[]) {
src\lib\booking\availability.ts:454:  if (!isCityAllowed(input.city, getAllowedCities(settings.free_travel_cities))) {
```

Both are declared with a bare `function` keyword — **not exported** (confirmed by reading lines 243 and 251 directly; no `export` prefix). Line 454 is their **only call site anywhere in the repository**. If lines 454-456 are deleted and the functions are left in place untouched, both become entirely dead, non-exported function declarations.

**This does trip `@typescript-eslint/no-unused-vars`.** Verified the actual rule config, not assumed: `eslint.config.mjs` spreads `nextTs` (`eslint-config-next/typescript`), and `node_modules/eslint-config-next/dist/typescript.js` sets:

```js
'@typescript-eslint/no-unused-vars': 'warn',
```

on top of `typescript-eslint.configs.recommended`. The rule's default scope (`vars: "all"`) covers unused function declarations exactly like unused variables — an unreferenced, non-exported top-level `function` is a textbook hit. So deleting only the gate block and leaving `getAllowedCities`/`isCityAllowed` in place produces **two new `warn`-level `no-unused-vars` hits in `src/lib/booking/availability.ts`** — a file not currently in the lint baseline (memory: "lint 59E/7W in six files"), i.e. exactly the "seventh file" regression the task warned about.

**What the caller must do — pick one:**
1. **Delete both functions** along with the gate block. Simplest, no dead code, no new lint surface. Nothing else in the repo calls them (confirmed above), and no return type (`AvailableSlotsResult`, `AvailableDaysResult` — lines 21-32, 41-52) currently has a field for a "is this a free-travel city" flag, so deleting has zero downstream type impact.
2. **Repurpose them** into a non-blocking `isFreeTravelZone` computation, called from `loadContextRest` and threaded onto the context/result so a consumer (e.g. an admin-only inline hint, mirroring `ManualBookingForm.tsx`'s `isCityKnown`) can display it without blocking slot calculation. This requires *also* adding a field to `AvailabilityContext`/`AvailableSlotsResult`/`AvailableDaysResult` and updating every call site that destructures those results — confirmed by grep that **no such field or consumer exists anywhere in `src/` today** (`isFreeTravelZone` has zero hits repo-wide).

**Recommendation: option 1 (delete).** Nothing currently consumes a free-travel-zone signal from `availability.ts`'s public API, so repurposing adds unused-today plumbing to avoid unused-today functions — same problem, larger surface. If a later item wants a non-blocking "outside free-travel area, mileage may apply" hint on the customer-facing calendar, that's a new, separately-scoped feature with its own return-type change, not a side effect of removing a blocking gate.

---

## A.4 — Does anything depend on the `"Location is outside the service area."` string?

Repo-wide grep for the exact string:

```
src\lib\booking\availability.ts:455:    return { reason: "Location is outside the service area.", durationMins: 0 };
```

is the **only hit in `src/`, `e2e/`, or any test file**. All other hits are in `supabase/migrations/*.sql` (the old SQL exception text — DB-side, already superseded per the task's stated Phase 2 migration `20260811230807`) and in `redesign/**` evidence/plan docs (excluded from lint, not code). **No test asserts on this exact string** — confirmed by the same grep; nothing under `src/**/*.test.ts(x)` or `e2e/**` matches. Safe to delete/change with no test-string-match fallout.

---

## A.5 — Is there an existing test file for `availability.ts`? Plan claims none — REFUTED as stated, true only in the narrowest sense

No file is literally named `availability.test.ts`. But grepping for `from "../availability"` / `from "@/lib/booking/availability"` shows **five test files directly import and exercise its exported functions**:

```
src\lib\booking\__tests__\override-windows.test.ts:32:import { calculateAvailableSlots } from "../availability";
src\lib\booking\__tests__\staff-recurring-windows.test.ts:32:import { calculateAvailableSlots } from "../availability";
src\lib\booking\__tests__\working-hours-segments.test.ts:13:import { calculateAvailableSlots } from "../availability";
src\lib\booking\__tests__\availability-options.test.ts:24 (import block):   calculateAvailableDays
src\app\api\availability\route.test.ts:7 (import block):   from "@/lib/booking/availability"
```

`availability-options.test.ts` imports `calculateAvailableDays`, `type AvailableDaysResult`, `type CalculateAvailableDaysInput` (lines 20-24). All four `src/lib/booking/__tests__/*.test.ts` fixtures already mock `free_travel_cities: ["Luton"]` and pass `city: "Luton"` (confirmed by grep — Phase 1's rename is already reflected in every one of them, consistent with 46f9369 being committed). These four genuinely execute the real `loadContextRest`/`isCityAllowed`/`getAllowedCities` code path against a fake Supabase client — an edit to any of the three touches all four.

`src/app/api/availability/route.test.ts` is a different case, checked in full: it calls `vi.mock("@/lib/booking/availability", () => ({ calculateAvailableSlots: vi.fn(), calculateAvailableDays: vi.fn() }))` (lines 21-24) — the **entire module is mocked**. Its `city: "Luton"` fixtures (lines 33, 40) are just request-body payload the route handler forwards; the test never executes `loadContextRest` or the city gate at all, so it is **not at risk** from edits inside `loadContextRest`/`getAllowedCities`/`isCityAllowed` and doesn't need re-running for this change.

**Practical implication:** the source plan doc (`redesign/evidence/plan-deepening/x3-tests-and-baselines.md:101`) is self-contradictory — it lists `availability-options.test.ts`, `override-windows.test.ts`, `staff-recurring-windows.test.ts`, `working-hours-segments.test.ts` as `src/lib/booking/**` tests **in the same breath** as claiming "No file tests `availability.ts` itself." Those four files exist specifically to exercise `calculateAvailableSlots`/`calculateAvailableDays`, which live in `availability.ts`, and are the ones that must be run against any edit to `loadContextRest`, `getAllowedCities`, or `isCityAllowed`. `route.test.ts` does not need to be in that set (module-mocked), so the real count of tests-at-risk is **four, not zero**.

---

## B.6 — Byte-exact `isCityKnown`, its comment, and the `role="alert"` notice — actual lines

All three claimed ranges are **off by exactly one line** from the plan (drift of -1, i.e. actual = claimed + 1).

**Comment — claimed 1680-1684, actual 1681-1685:**

```
1681	  // C-07 Step 5 (W02-E-1) — mirrors create_booking_request's own check
1682	  // (`lower(v_clean_city) like '%' || lower(trim(allowed.city)) || '%'`):
1683	  // the entered city must equal or contain an allowed city, case-insensitive.
1684	  // Kept permissive to match the server exactly — a stricter client check
1685	  // would warn on cities the server actually accepts.
```

**`isCityKnown` — claimed 1687-1693, actual 1686-1694** (includes the two supporting `const`s the plan's range omitted):

```
1686	  const cityTrimmed = city.trim();
1687	  const cityNormalised = cityTrimmed.toLowerCase();
1688	  const isCityKnown =
1689	    cityTrimmed.length === 0 ||
1690	    allowedCities.length === 0 ||
1691	    allowedCities.some((allowed) => {
1692	      const allowedNormalised = allowed.trim().toLowerCase();
1693	      return allowedNormalised === cityNormalised || cityNormalised.includes(allowedNormalised);
1694	    });
```

**`role="alert"` notice — claimed 1725-1729, actual 1726-1730:**

```
1726	            {!isCityKnown ? (
1727	              <p className="text-xs text-[oklch(26%_0.14_25)]" role="alert">
1728	                &ldquo;{cityTrimmed}&rdquo; is outside our current service area. We deliver to: {allowedCities.join(", ")}.
1729	              </p>
1730	            ) : null}
```

Full copy, verbatim: `"{cityTrimmed}" is outside our current service area. We deliver to: {allowedCities.join(", ")}.` — rendered inside `<p className="text-xs text-[oklch(26%_0.14_25)]" role="alert">`.

---

## B.7 — Confirm `isCityKnown` is non-blocking

Grep for every use of `isCityKnown` in the file returns **exactly two hits**:

```
1688:  const isCityKnown =
1726:            {!isCityKnown ? (
```

One definition, one read — and that single read (line 1726) only gates whether the warning `<p role="alert">` renders; it is not read anywhere else in the 2485-line file. In particular it does **not** appear in the `stepErrors` object, in any `disabled` prop, or in any step-advance/validation function (those would necessarily produce a third grep hit referencing `isCityKnown`, and there isn't one). **CONFIRMED non-blocking, display-only**, exactly as the plan claims.

---

## B.8 — Copy that needs rewording away from "outside our current service area"

Two places reference that framing; both are candidates for a Phase 2 reword, but the task's own scope note ("Phase 2 changes only the user-facing copy") points at the second one:

1. **User-facing (line 1728, quoted verbatim above):** `&ldquo;{cityTrimmed}&rdquo; is outside our current service area. We deliver to: {allowedCities.join(", ")}.` — this is what a staff member sees inline in the admin manual-booking form.
2. **Doc comment on the `allowedCities` prop (lines 547-550, not user-facing but worth flagging as stale):**
   ```
   547	  /** C-07 Step 5 (W02-E-1) — business_settings.free_travel_cities, for the
   548	   * inline (non-blocking) city warning below; create_booking_request still
   549	   * enforces this server-side, reading the `allowed_cities` column the
   550	   * settings form keeps in step with it until item 8 Phase 2 removes the gate. */
   ```
   This comment already says "until item 8 Phase 2 removes the gate" — per the task's stated state of the world, the SQL gate is **already removed** (migration `20260811230807`), so this comment is now inaccurate independent of any copy change: it describes `create_booking_request` as still enforcing server-side, which is no longer true. Flagging for the caller's awareness; not itself one of the two "independent city checks" the task asked me to locate, but it sits three lines above `isCityKnown`'s own comment (1681-1685) and references the same server behavior, so a Phase 2 pass touching this area should not leave it saying the opposite of what's now true.

---

## Summary table

| # | Symbol | Plan's claimed lines | Actual lines | Verdict |
|---|---|---|---|---|
| A.1 | `loadContextRest` city gate | 454-456 | **454-456** | CONFIRMED (Phase 1 already swapped the column name in-place) |
| A.2 | "nothing else reads `input.city`" | 449-559 | confirmed, plus: field-unused ≠ lint risk | CONFIRMED, with the added unused-vars nuance in A.3 |
| A.3 | `getAllowedCities`/`isCityAllowed` calls | 243-257 | only call site is :454 | Deleting the gate without deleting/repurposing these adds 2 new `warn` hits → 7th lint-baseline file. Recommend delete. |
| A.4 | Reason string dependents | — | zero in `src/`, `e2e/`, tests | CONFIRMED safe to change |
| A.5 | "no test file for availability.ts" | — | 4 test files execute its real code path (+1 more, `route.test.ts`, imports it but module-mocks it, so not at risk) | REFUTED as commonly meant; TRUE only for the literal filename |
| B.6 | `isCityKnown` / comment / alert | 1687-1693 / 1680-1684 / 1725-1729 | **1686-1694** / **1681-1685** / **1726-1730** | All three DRIFTED by exactly +1 line |
| B.7 | `isCityKnown` non-blocking | — | 2 total references (def + 1 read) | CONFIRMED |
| B.8 | Copy to reword | ~1728 | **1728** (+ stale doc comment 547-550) | Located, quoted verbatim |
