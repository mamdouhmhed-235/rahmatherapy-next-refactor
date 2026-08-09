# C-20 Phase B fix-round — independent re-verification

**VERDICT: PASS**

Fresh, independent re-verifier (did not write the fix, did not write the original FULL verification). Verified `af2c5b1ee7acea32d18e821c3ffd39361d87848c` ("fix(redesign): C-20 Phase B — host-themed suggestion list + widen address primary types") against `ac0a283b50d5fb0f9ac0feb1bd82097e59d34cdd`, the two BLOCKING findings from `redesign/evidence/C-20/phase-b-verify-full.md` LED POINT 1 and LED POINT 2. Checked out at `master` HEAD `8acfb5d403efe77c28eaf1629635d619fa6fe1ab`; confirmed `af2c5b1` is an ancestor of HEAD and `git diff af2c5b1 HEAD -- src/components/address/` is empty — the files under review are unchanged since the fix commit.

Model I ran as: Claude Sonnet 5 (`claude-sonnet-5`), independent-verifier role, re-verification tier.

---

## FIX 1 — host-themed suggestion list (LED POINT 1)

**Claim under test:** three required, defaultless props (`listClassName`, `optionClassName`, `activeOptionClassName`) push all list colour to the host, so a host that forgets to theme the list fails to compile instead of shipping a hardcoded white box into a dark admin form.

**Interface check** (`src/components/address/AddressAutocompleteField.tsx:249,251,253`):
```ts
listClassName: string;
optionClassName: string;
activeOptionClassName: string;
```
No `?` optional marker on any of the three. Destructured at the top of the component (`:261-263`) with no default value (`listClassName,` / `optionClassName,` / `activeOptionClassName,` — no `= "..."`). Grepped the whole file for `defaultProps` and `??`: the only `??` in the file is `librariesRef.current ?? (await loadMapsApi())` (`:308`), unrelated to these props — no fallback exists for any of the three. **Required, no default, confirmed.**

**Colour-literal grep** across the full file for `bg-white`, `bg-gray`, `text-gray`, `border-gray`, hex/`rgb(`/`rgba(`/`oklch(`: **zero matches**. Only structural classes remain on the `<ul>` (`absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-md py-1 text-sm`, plus the `animate-in`/`motion-reduce` block) and on each `<li>` (`cursor-pointer px-3 py-2`). **No colour literal survives.**

**Plumbing reaches the DOM:** `<ul>` className is `cn(structural, structural, listClassName)` (`:450-454`); each `<li>` className is `cn("cursor-pointer px-3 py-2", optionClassName, index === activeIndex ? activeOptionClassName : undefined)` (`:467-471`) — `activeOptionClassName` is applied **on top of**, not instead of, `optionClassName`, only for the active row.

**New test in the fix commit** — `AddressAutocompleteField.test.tsx`, describe block "host-supplied list/option classes (theming contract)": renders two suggestions, asserts the `<ul>` carries `TEST_LIST_CLASS_NAME`, both `<li>`s carry `TEST_OPTION_CLASS_NAME` but not the active class, then presses ArrowDown and re-asserts option 0 gains `TEST_ACTIVE_OPTION_CLASS_NAME` while option 1 does not. Every other render call site in the test file (11 call sites total) was updated to pass all three test class names — none left un-migrated.

**Mutant proof (own scratchpad copy, independent of any prior agent's mutants):** copied the current `AddressAutocompleteField.tsx` + `AddressAutocompleteField.test.tsx` to `scratchpad/reverify-mutant-listclass/`, removed `listClassName` from the `<ul>`'s `cn(...)` call only (structural classes and the `<li>` classes left untouched). Ran the real, unmodified test file against the mutant via the standalone harness (`scratchpad/vitest.mutant.config.ts` — alias-only, points `root` at the real project so `node_modules` resolves, never touches the project's own `vitest.config.ts`).
**Result: 11 tests, 1 failed** — exactly `"applies listClassName to the listbox and optionClassName/activeOptionClassName to the right options"`:
```
AssertionError: expected [ 'absolute', 'left-0', …(14) ] to include 'test-list-class'
```
No other test broke. **Non-vacuous — confirmed independently.**

---

## FIX 2 — widened `includedPrimaryTypes` (LED POINT 2)

**Shipped value** (`AddressAutocompleteField.tsx:322`): `includedPrimaryTypes: ["street_address", "premise", "subpremise"]`.

**Independent live-documentation check** (Browser pane against the raw rendered page — not a summarising fetch, per the dispatch's explicit warning that a summarising fetch previously gave contradictory answers):

1. `https://developers.google.com/maps/documentation/places/web-service/place-types` — Table B's own header text, read verbatim from the rendered page:
   > "The Place type values in Table B may be returned as part of a Place Details (New), Nearby Search (New), Text Search (New), or Autocomplete (New) response. **These types are also supported by `includedPrimaryTypes` for Autocomplete (New) requests.**"

   Table B's list (read verbatim) contains `postal_town`, **`premise`**, `route`, **`street_address`**, ... **`subpremise`**, among others — all three shipped values are confirmed Table B entries. `subpremise`'s description in the same page's "Address types and address component types" section:
   > "subpremise — An addressable entity below the premise level, such as an apartment, unit, or suite."

2. `https://developers.google.com/maps/documentation/javascript/reference/autocomplete-data` — the `AutocompleteRequest.includedPrimaryTypes` field description, read verbatim from the rendered page:
   > "includedPrimaryTypes ... Included primary Place type (for example, `"restaurant"` or `"gas_station"`). A Place is only returned if its primary type is included in this list. **Up to 5 values can be specified.** If no types are specified, all Place types are returned."

   Confirms both required facts: all three values are individually valid `includedPrimaryTypes` entries for Autocomplete (New), and the field accepts multiple values (up to 5) — three is within the limit.

   The same page also re-confirms (still true on a live re-fetch, unrelated to this fix but part of LED POINT 4's protected claim): `region` "This does not restrict results to the specified region" and `includedRegionCodes` "Only include results in the specified regions" — unchanged from the original verification.

**Test pin in the fix commit:** the debounce test's assertion was widened from `toMatchObject({ input: "Luton" })` to `toMatchObject({ input: "Luton", includedPrimaryTypes: ["street_address", "premise", "subpremise"] })`. Because `toMatchObject` requires an array value to match exactly (same length and elements, not merely a superset), a revert to `["street_address"]` alone fails this assertion.

**Mutant proof (own scratchpad copy):** copied the current files to `scratchpad/reverify-mutant-primarytypes/`, reverted only the `includedPrimaryTypes` line to `["street_address"]`. Ran the real, unmodified test file via the same harness.
**Result: 11 tests, 1 failed** — exactly `"collapses rapid keystrokes into exactly one request, for the final value"`:
```
AssertionError: expected { input: 'Luton', …(5) } to match object { input: 'Luton', …(1) }
```
No other test broke. **Non-vacuous — confirmed independently.**

---

## Byte-unchanged confirmation — the six protected behaviours

Confirmed by reading the full `git diff ac0a283..af2c5b1 -- src/components/address/` (reproduced/inspected directly, not summarised): the diff touches only (a) header-comment prose, (b) the three new interface fields + destructuring, (c) the single `includedPrimaryTypes` line, and (d) the two JSX `className={cn(...)}` blocks (dropping fixed colour literals, adding the host props). No other line in the file changed.

| Protected behaviour | Location | Status |
|---|---|---|
| `fetchFields` field list — `["addressComponents", "location"]`, never `displayName` | `PLACE_DETAIL_FIELDS` (`:231`), used at `:378` | **Byte-unchanged** — not touched by the diff; confirmed present verbatim in the current file, no `displayName` anywhere (grepped) |
| `includedRegionCodes: ["gb"]` (the actual restriction; `region` is formatting/ranking only) | `:321` (`includedRegionCodes`), `:323` (`region`) | **Byte-unchanged** — diff hunk only replaced the adjacent `includedPrimaryTypes` line; `includedRegionCodes` and `region` lines are outside the hunk |
| Session-token lifecycle (one per session, reused across fetches, nulled after selection for a fresh one next session) | `ensureSessionToken` (`:300-305`), null-out at `:383` | **Byte-unchanged** — not touched by the diff |
| ~300 ms debounce | `AUTOCOMPLETE_DEBOUNCE_MS = 300` (`:226`), `handleChange` (`:348-367`) | **Byte-unchanged** — not touched by the diff |
| Unmount guard | `mountedRef` set/cleared in the mount effect (`:277-285`), checked in `runFetch` (`:309`) and `selectSuggestion` (`:379`) | **Byte-unchanged** — not touched by the diff |
| Escape `stopPropagation` branching (dismiss list only while open; fall through to the dialog while closed) | `handleKeyDown` (`:394-407`) | **Byte-unchanged** — not touched by the diff |

---

## Gates by identity

| Gate | Command | Result | Identity match |
|---|---|---|---|
| Types | `npx tsc --noEmit` | **0 errors**, exit 0, empty output file | With the three props now required and still no caller anywhere in the repo (`grep -rn "AddressAutocompleteField" src` outside `src/components/address` → no matches), this is expected — no breakage |
| Address-scope tests | `pnpm vitest run src/components/address` | **1 file, 11 tests, all passed** | 10 pre-fix tests + 1 new theming-contract test = 11; consistent with the diff adding exactly one new `it` |
| Full tests | `pnpm vitest run` | **2 files failed, 206 passed (208 files); 5 failed, 2027 passed (2032 tests)** | Failures are **exactly**: `src/lib/auth/admin-access.test.ts` × 2 ("gives Owner broad access while keeping owner-only role actions permission-gated", "gives Admin broad operational access without role template management") + `src/app/admin/bookings/new/ManualBookingForm.test.tsx` × 3 ("renders step 1 on first load", "moves focus to the first invalid field when continuing with errors", "shows the consent error when trying to create booking without consent"). Matches the dispatch's inherited baseline identity exactly; totals (5 failed / 2027 passed / 2032) match exactly, not approximately |
| Lint | `pnpm lint` | **66 problems (59 errors, 7 warnings)**, exit 1 | All 59 errors + 7 warnings fall in exactly the six baseline files: `design_handoff_area_pages/prototype/{area-page,shared,site-chrome}.jsx` + `src/features/booking/{BookingExperience.tsx,BookingExperienceLoader.tsx,utils/returning-customer.ts}`. Neither `src/components/address/*` nor `src/lib/address/*` appears anywhere in the lint output |
| Build | `pnpm build` | **NOT RUN** | Deliberately skipped — banned for this dispatch |

---

## Diff scope, dependencies, secrets

- `git show af2c5b1 --stat` → exactly two files changed: `src/components/address/AddressAutocompleteField.test.tsx` (109 lines changed) and `src/components/address/AddressAutocompleteField.tsx` (56 lines changed); totals `2 files changed, 150 insertions(+), 15 deletions(-)`. No `.env`, no form wiring, no `cookie-registry.ts`, no other path.
- `git diff ac0a283 af2c5b1 -- package.json pnpm-lock.yaml` → empty. No dependency added.
- `git diff ac0a283 af2c5b1 -- .env .env.example` → empty. No env change.
- Grepped the fix diff for `AIza`/`api[_-]?key\s*=` patterns → no matches. No API key literal.

## Isolation

`git status --porcelain` (full repo) → only known pre-existing dirt: `.playwright-mcp/*` deletions, `design_handoff_public_pages/*` deletions, untracked `design_handoff_area_pages/`, `photos-rahma-therapy/`, `redesign/evidence/C-21/*.png`, `test-results/`, plus the deliberate standing `M src/lib/maintenance.ts` (excluded per instructions — left untouched, unstaged, unreverted), plus the untracked `redesign/evidence/C-20/phase-b-verify-full.md` (the prior FULL verification's own evidence file). No new untracked PNGs under `redesign/evidence/C-23/` were present at the time of this check — none to disregard. Nothing in `src/components/address/`, `src/features/booking/`, `src/lib/address/`, or `src/app/admin/bookings/new/` is dirty.

---

## Findings

**BLOCKING:** none.

**NON-BLOCKING:** none identified beyond what the original FULL verification already recorded as open/forward-looking (Phase C/D browser confirmation of the dark-mode fix and the Escape/dialog interaction — both still legitimately deferred, as neither caller exists yet; confirmed again here via `grep -rn "AddressAutocompleteField" src` outside the component's own directory returning no matches).

---

## Checks I could not run

- **Live Places API calls** — prohibited (billed). The `includedPrimaryTypes` widening is confirmed against Google's current documentation (quoted above, fetched live via the Browser pane, not from memory or a summarising fetch), not an empirical repro against a real flat address. Final empirical confirmation remains the later, unwaivable §3.2 real-address matrix.
- **Browser/visual confirmation of the dark-mode fix in situ** — Phase D (`ManualBookingForm.tsx` wiring) has not landed; no live mount of this component in the admin tree exists yet to screenshot. Confirmed no caller exists anywhere in `src/` outside the component's own directory.
- **Browser/visual confirmation of the Base UI modal Escape interaction** — Phase C (`AboutYouStep.tsx`/`BookingDialog.tsx` wiring) has not landed; same reasoning.
- **`pnpm build`** — deliberately not run per explicit instruction.
