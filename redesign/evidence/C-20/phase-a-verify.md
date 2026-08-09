# C-20 Phase A — Independent Verification (TARGETED tier)

**VERDICT: PASS**

Commit under review: `92f031d` — "feat(redesign): C-20 Phase A — parser + fixtures/tests"
Files: `src/lib/address/parse-place.ts` (59 lines), `src/lib/address/parse-place.test.ts` (119 lines)
Verifier: read-only subagent, model `sonnet` (Claude Sonnet 5)
Working dir: `C:/Users/mamdo/Desktop/rahmatherapy - Copy/rahmatherapy-next-refactor`, branch `master`

The one BLOCKING-adjacent item is a genuine test-coverage gap (§4, Finding F1) — it does not block PASS because the code itself is correct (verified independently by direct reading + the area-chain control mutant, which the same fixture set *does* catch), but it means the city-fallback ORDER and the postcode short/long CHOICE are currently unverified by any test and could regress silently. See Findings.

---

## 1 — Diff scope

`git show 92f031d --stat`:
```
 src/lib/address/parse-place.test.ts | 119 ++++++++++++++++++++++++++++++++++++
 src/lib/address/parse-place.ts      |  59 ++++++++++++++++++
 2 files changed, 178 insertions(+)
```
Exactly the two expected new files, nothing else. PASS.

## 2 — UK mapping vs plan §2 Step 1

Read directly from `src/lib/address/parse-place.ts:43-58`:

| Field | Code | Plan (§2 Step 1) | Match |
|---|---|---|---|
| `address` | `[streetNumber, route].filter(Boolean).join(" ")` | `street_number` + `route`, space-joined, empties dropped | ✅ |
| `city` | `pick("postal_town") \|\| pick("locality") \|\| pick("administrative_area_level_3")` | `postal_town` → `locality` → `administrative_area_level_3` | ✅ order matches |
| `area` | `pick("administrative_area_level_2") \|\| pick("administrative_area_level_1")` | `administrative_area_level_2` → `administrative_area_level_1` | ✅ order matches |
| `postcode` | `pick("postal_code", true)` (short=true) | `postal_code`, short text | ✅ |

Cross-checked against every fixture by hand (all 6 match the parser's actual output — see §8 vitest run). The fallback order as *written* is correct. Whether the order is *proven* by the tests is a separate question — see §4 mutation testing, Finding F1.

## 3 — Hard contract: never `undefined`, missing part = `""`

Code (`parse-place.ts:44-48`): `pick()` returns `""` when no component matches (`if (!match) return "";`), and additionally guards `(short ? match.shortText : match.longText) ?? ""` for defensive-but-harmless belt-and-braces. `address` uses `.filter(Boolean).join(" ")` which is always a string, never undefined.

Confirmed by execution, not just reading: `parse-place.test.ts` has an explicit `"returns all empty strings for an empty component array"` case and a `"never returns undefined for any key"` case that loops all 6 fixtures + `[]` asserting `not.toBeUndefined()` on every key. Both passed in the real run (§8). PASS.

## 4 — Test non-vacuity — mutation testing (executed, not assumed)

Method: copied `parse-place.ts` unmodified into isolated scratchpad folders (never touched the tracked file), applied one targeted mutation per copy, ran the real `parse-place.test.ts` (also copied, unmodified) against each mutated copy via a throwaway `vitest.config.ts` + `--root`/`--config` pointed at the scratch folder. Scratch paths used (all under the assigned scratchpad, none in the repo):
`.../scratchpad/mutation-city/`, `.../scratchpad/mutation-postcode/`, `.../scratchpad/mutation-area/`, `.../scratchpad/mutation-sanity/`.

| Mutant | Change | Result | Verdict |
|---|---|---|---|
| **Sanity control** | `address` join `" "` → `"-"` | 5/7 tests FAIL | ✅ harness genuinely detects regressions — confirms the method itself is sound, not silently no-op |
| **Area fallback order** | `area: pick("administrative_area_level_1") \|\| pick("administrative_area_level_2")` (swapped) | 1/7 tests FAIL (Luton terrace: expected `"Bedfordshire"`, mutant gives `"England"`) | ✅ **caught** — the area-chain priority IS genuinely tested, because `lutonTerrace` is the one fixture with both `administrative_area_level_2` and `administrative_area_level_1` present simultaneously |
| **City fallback order** | `city: pick("locality") \|\| pick("postal_town") \|\| pick("administrative_area_level_3")` (swapped) | 7/7 tests PASS (mutant survives) | ❌ **NOT caught** — see Finding F1 |
| **Postcode short/long** | `postcode: pick("postal_code", false)` (long instead of short) | 7/7 tests PASS (mutant survives) | ❌ **NOT caught** — see Finding F1 |

The sanity control and the area-order mutant prove the method works and that at least one fallback chain's priority is genuinely exercised. The city-order and postcode mutants prove two specific claims in the plan/header comment are **currently unverified by any test**, even though the code itself is written correctly (confirmed by direct reading in §2).

**Root cause (verified by inspecting the fixtures):** no fixture has two city candidates present at once — every fixture has *either* `postal_town` *or* `locality`, never both, and none has `administrative_area_level_3` at all — so no permutation of the 3-way city OR-chain can be distinguished by the current suite. Similarly, every fixture's `postal_code` component has identical `longText`/`shortText` (e.g. `"LU1 1EY"`/`"LU1 1EY"`), so choosing short vs. long text produces the same string in every case and the choice is untestable with these fixtures as constructed.

## 5 — Fixture honesty

`parse-place.test.ts:4-8` carries an explicit comment: fixtures are "CONSTRUCTED to the documented `AddressComponent` shape... modelled on real UK addresses — they are NOT captured from a live Places API call... Do not treat these as evidence of live API behaviour." This matches the progress file's §0.2/§1 orchestrator ruling that live capture is forbidden in Phase A. Not presented as live-captured evidence. PASS.

All five plan §3.2 cases present and correctly labelled:
1. Standard Luton terrace → `lutonTerrace`
2. Flat/apartment → `flatWithSubpremise`
3. New-build with no `postal_town` → `newBuildNoPostalTown`
4. Postcode-less → `postcodeLess`
5. London (postal_town="London", no level_2) → `londonNoLevel2`

## 6 — JUDGEMENT CALL: is the London `area` fallback to level_1 ("England") sensible?

Executed: for `londonNoLevel2`, the parser genuinely produces `area: "England"` (confirmed by the real vitest run, test `"falls back area to administrative_area_level_1 for a London address (no level_2)"`, passing).

**My view: the fallback to level_1 is defensible as written but is a weak design choice for this specific field, and I'd lean toward NOT falling back that far.**

Reasoning:
- `administrative_area_level_1` for any UK address is one of {England, Scotland, Wales, Northern Ireland} — for a business that (per the fixtures and the plan) operates entirely within England, this value is **constant across every possible customer who has no level_2**, i.e. it carries zero discriminating information. It doesn't help an admin distinguish one customer's area from another's.
- The field is labelled "Area / County" elsewhere in the form (per the plan's Step 5/7 wiring into existing `<Field>` markup). No human operator, asked to fill in "Area / County" for a London address, would type "England" — they'd type a borough, or leave it blank pending the postcode/city being enough. A value nobody would type by hand is exactly the failure mode flagged in my brief: it looks like the field was populated with real data, discouraging a human from checking it, when in fact it holds no usable signal.
- Contrast with `city`'s three-level fallback, which IS meaningful at every level (`postal_town`, `locality`, `administrative_area_level_3` are all genuinely different town/city names) — the `area` chain doesn't have that property once it reaches level_1 for this specific country.
- Against this: an empty string is itself ambiguous too (did autocomplete run and find nothing, or did the user just not use autocomplete?), and the plan's own gate text (§3.2 case 4) only asks for "area falls back sensibly" without specifying which of {non-empty, empty} counts as sensible — so the current implementation is not a violation of anything explicitly written.

**Recommendation:** stop the `area` chain at `administrative_area_level_2` and leave `area: ""` when absent, rather than falling through to a same-for-everyone country name. This is a plan-level design question, not a coding defect — the code correctly implements what plan Step 1's literal chain specifies — so I'm reporting it as a finding for the orchestrator/Owner to decide, not something the implementer got wrong.

## 7 — Types / dependencies

- `git show 92f031d -- package.json pnpm-lock.yaml` → empty diff. Confirmed untouched.
- `grep` of the full commit diff for `@types` / `google.maps`: only appears inside comments (`parse-place.ts:140,145,172-173` in the diff, i.e. the header/type comments), never as an import statement. No `@types/google.maps` import anywhere.
- `PlaceAddressComponent` is a hand-written minimal structural type (`parse-place.ts:37-41`), not sourced from any package.
- All `types` string literals passed to `pick()` remain snake_case (`street_number`, `route`, `postal_town`, `locality`, `administrative_area_level_1/2/3`, `postal_code`) — confirmed by direct reading, no camelCased type string anywhere. Not a defect.

## 8 — Gates by identity

| Gate | Command | Result | Identity match |
|---|---|---|---|
| TypeScript | `npx tsc --noEmit` | **0 errors**, exit 0 | ✅ |
| Address suite | `pnpm vitest run src/lib/address` | **1 file, 7/7 passed** | ✅ new suite fully green |
| Full vitest | `pnpm vitest run` | **2019 total, 2014 passed, 5 failed** | ✅ failures are exactly `src/lib/auth/admin-access.test.ts` × 2 (`gives Owner broad access...`, `gives Admin broad operational access...`) + `src/app/admin/bookings/new/ManualBookingForm.test.tsx` × 3 (`renders step 1 on first load`, `moves focus to the first invalid field when continuing with errors`, `shows the consent error when trying to create booking without consent`) — identical names to the inherited baseline in the progress file §0. Total grew by exactly 7 (2012→2019 files-tests, 2007→2014 passed) matching the 7 new address tests landing; no new failure identity. |
| Lint | `pnpm lint` | **59 errors / 7 warnings**, 66 problems | ✅ files with problems, confirmed by extracting every file header in the output: `design_handoff_area_pages/prototype/area-page.jsx`, `.../shared.jsx`, `.../site-chrome.jsx`, `src/features/booking/BookingExperience.tsx`, `src/features/booking/BookingExperienceLoader.tsx`, `src/features/booking/utils/returning-customer.ts` — exactly the expected set. Neither new address file appears. |
| Build | `pnpm build` | **NOT RUN** | Deliberately skipped — banned for agents this session, per dispatch instruction. |

## 9 — Isolation

`git status --porcelain`, filtered to exclude the documented pre-existing untracked dirt (`.playwright-mcp/`, `design_handoff_*`, `photos-rahma-therapy/`, `test-results/`, `redesign/evidence/**`):

```
 M src/app/(public)/privacy/page.tsx
 M src/lib/maintenance.ts
```

Both are expected and excluded per the dispatch: `src/lib/maintenance.ts` is the standing Owner-owned uncommitted change (never touched, never reported as dirt beyond this note); `privacy/page.tsx` is a concurrently-running sibling implementer's in-progress edit (explicitly flagged as expected in the dispatch). No C-20-related file is staged or modified outside the reviewed commit. PASS.

## 10 — Scope discipline

Read both files in full. Confirmed: no component, no form wiring, no `.env` change, no script loading, no Places API call, no React/browser code at all — `parse-place.ts` is a pure synchronous function with one exported type and one exported interface; `parse-place.test.ts` is unit tests with hand-built literal fixtures. PASS.

---

## Findings

**F1 — NON-BLOCKING (test-coverage gap, not a code defect).** The city-fallback ORDER (`postal_town` → `locality` → `administrative_area_level_3`) and the postcode short-vs-long CHOICE are both implemented correctly (confirmed by direct code reading, §2) but are **not actually exercised by any current test** — proven by mutation testing (§4): swapping the city chain's first two candidates and switching the postcode pick from short to long text both leave all 7 tests green, because no fixture has two city candidates present simultaneously, and no fixture's `postal_code` component has differing `longText`/`shortText`. A future regression on either point (e.g. an accidental reorder during a refactor, or restoring `pick("postal_code")` without the `true` flag) would ship silently. File: `src/lib/address/parse-place.test.ts` (fixtures at lines 10-52). Recommend (not actioned, per read-only scope): add one fixture with both `postal_town` and `locality` present (to pin the order), and one `postal_code` fixture with `longText` ≠ `shortText` (e.g. an abbreviation) if Google's API can realistically produce one — if it cannot for `postal_code` specifically, that should be recorded in a comment rather than left implicit, since the current fixtures give the *appearance* of testing the short-text choice without actually doing so.

**F2 — NON-BLOCKING (judgement call, plan-level not code-level).** See §6: falling the `area` field back to `administrative_area_level_1` produces "England" for London-type addresses (and any UK address without a level_2), which is constant across nearly all customers and not something an operator would type by hand into an "Area / County" field. Recommend the orchestrator/Owner decide whether to stop the `area` chain at level_2 (leaving `""` on absence) rather than falling through to a country-level value. Not a defect in what was implemented — the code correctly follows the plan's literal Step 1 chain.

No BLOCKING findings.

## Checks I could not run

- `pnpm build` — deliberately not run per dispatch (banned for agents this session).
- Anything requiring a browser, a live Places API call, or the Google Maps key — out of scope for Phase A (pure function, no browser) per the declared TARGETED tier and the dispatch's explicit restriction against spawning/using a browser or reading the key.
