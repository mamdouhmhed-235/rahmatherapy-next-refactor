# C-20 — Adversarial closeout review

**Reviewer:** read-only verification subagent, dimension "adversarial" (protocol §2.5).
**Scope command run:**
```
git diff 33f74fb..5233518 -- src/lib/address src/components/address src/features/booking src/app/admin/bookings/new .env.example
```
**C-20's actual commit set, confirmed via `git log --oneline 33f74fb..5233518`:** `92f031d` (A parser), `cc32657` (A hardening), `ac0a283` (B component), `af2c5b1` (B fix round), `9593a74` (C customer form), `83c670f` (D admin form + `.env.example`). Matches the dispatch list exactly — no extra commits attributable to C-20.

**Interleaved-but-not-C-20 commits in the same window, confirmed excluded by path:** `d701d9a`, `d142897`, `2ad93d0` (C-23 Phase D — availability calendar, DATE region) touch `src/app/admin/bookings/new/ManualBookingForm.tsx` and add `AvailabilityCalendarField.tsx`/`use-month-availability.test.ts`. `git log --oneline 33f74fb..5233518 -- ManualBookingForm.tsx` shows only `83c670f` (C-20) + those three C-23 commits; `git log ... -- AvailabilityCalendarField.*` shows only the C-23 commits, never `83c670f`. C-20's own diff to `ManualBookingForm.tsx` was isolated with `git show 83c670f -- ManualBookingForm.tsx` (210 lines) and reviewed on its own — not attributed to or conflated with C-23's date-picker work.

Full suites were not run (per dispatch instruction). No live Google Places calls were made; no `.env` file opened; no key value read or printed.

---

## 1. Verdict on the two supplied claims

### Claim 1 (NON-BLOCKING — `includedRegionCodes` untested) — **CONFIRMED**

- `src/components/address/AddressAutocompleteField.tsx:321` — `includedRegionCodes: ["gb"]`, inside the `fetchAutocompleteSuggestions` call at lines 318–325; `region: "gb"` / `language: "en-GB"` sit at lines 323–324, separately, as the claim states.
- `grep -n "includedRegionCodes" src/components/address/AddressAutocompleteField.test.tsx` → **zero matches**. The only field-shape assertion in the debounce test is `toMatchObject({ input: "Luton", includedPrimaryTypes: [...] })` at `AddressAutocompleteField.test.tsx:255-258` — confirmed by direct read, `includedRegionCodes` is absent from that (or any) assertion.
- The only verification of the actual UK restriction is the live/manual note in the progress file (§1a.2: "every suggestion a real Luton address") — a one-time, billed, human-run check, not a repeatable CI guard.
- Verdict: **claim holds as stated.** This is a real, if minor, test-coverage gap — a future accidental rename/typo/drop of `includedRegionCodes` would not be caught by `pnpm vitest run`.

### Claim 2 (BLOCKING — Escape inside the open suggestion list plausibly also closes the booking dialog) — **CONFIRMED**

Traced end to end, independently, against the actual installed dependency versions in this tree (not assumed from the claim's citations):

1. **React 19.2.4**, **Next.js 16.2.4** confirmed via `node_modules/react-dom/package.json` and `node_modules/next/package.json`.
2. `node_modules/next/dist/client/app-index.js:32` — `const appElement = document;` — confirmed; used at both the `createRoot` (line 290) and `hydrateRoot` (line 293) call sites. The React root container for this whole app **is `document` itself**.
3. `node_modules/react-dom/cjs/react-dom-client.development.js:19193-19221` — `listenToNativeEvent(domEventName, isCapturePhaseListener, target)` calls `addTrappedEventListener(target, …)` with `target = rootContainerElement`; `listenToAllSupportedEvents(rootContainerElement)` is called with that same root. Because the root container passed at hydration is `document` (nodeType 9), React's own delegated `keydown` listener (bubble phase, i.e. `isCapturePhaseListener = false` branch) is registered **directly on `document`**, at hydration time — i.e., before any dialog ever opens.
4. `react-dom-client.development.js:3394-3401` — `SyntheticBaseEvent.stopPropagation` calls `event.stopPropagation()` on the **native** event (never `stopImmediatePropagation()`). Confirmed by direct read of the exact function body.
5. `node_modules/@base-ui/react/floating-ui-react/hooks/useDismiss.js:396-397` — `const doc = ownerDocument(floatingElement); … addEventListener(doc, 'keydown', closeOnEscapeKeyDown)` — no third `capture` argument, i.e. **bubble phase**, registered on `document` (the dialog's owner document), but only inside a `React.useEffect` gated on `open` — i.e. **after** the dialog opens, which is necessarily after React's own hydration-time listener was registered.
6. `useDismiss.js:84-115` — `closeOnEscapeKeyDown` checks only `event.key !== 'Escape'` and an IME-composing guard. **It never checks `event.defaultPrevented`.** So the component's `e.preventDefault()` (`AddressAutocompleteField.tsx:402`) has no effect on whether Base UI closes the dialog.
7. `node_modules/@base-ui/react/dialog/root/useDialogRoot.js:90` — `escapeKey: isTopmost` — confirmed true for a non-nested dialog.
8. `src/features/booking/components/BookingDialog.tsx:57` — `<Dialog.Root open={open} onOpenChange={onOpenChange} modal>`, no `dismissible`/`escapeKey` override.
9. `src/features/booking/BookingExperience.tsx:350-356` — `handleOpenChange` unconditionally calls `setOpen(nextOpen)` for any close, without inspecting the close reason (e.g. it does not check `eventDetails.reason !== 'escapeKey'` or similar).

**Mechanism, confirmed via source, not inference:** both React's document-level keydown listener and Base UI's document-level keydown listener sit on the exact same node (`document`), both in the bubble phase. Per the DOM Event spec, `stopPropagation()` (as opposed to `stopImmediatePropagation()`) does not prevent *other* listeners already registered on the *same* node from firing — it only stops the event from reaching *further* ancestor nodes. Registration order matters for same-node/same-phase listeners, and React's listener was registered first (at hydration, well before the dialog exists), so it runs first; it calls our component's `onKeyDown`, which calls `stopPropagation()` on the synthetic event → the native event's `stopPropagation()` — but Base UI's separately-registered listener on that same `document` node still fires afterward and unconditionally closes the dialog, since it never checks `defaultPrevented`.

**The unit test does not exercise this path.** `AddressAutocompleteField.test.tsx:534-573` ("dismisses only the suggestion list…") wraps the field in a **plain `<div onKeyDown={parentKeyDown}>`** — a React-synthetic-only stand-in — and asserts `parentKeyDown` isn't called. This proves React-tree propagation stops, which is true and irrelevant: Base UI's dismiss listener is not a React ancestor prop at all, it's an independent native listener on `document`, so this test cannot catch (and does not catch) the failure mode described above.

**Live-verification gap, confirmed by re-reading the progress file:** §1a.2 records the Step 4a D20 spike as "PASSES on both halves" — but the two halves tested were (a) the list renders above the dialog backdrop/popup and (b) **clicking** a suggestion doesn't dismiss the dialog. Neither recorded check exercises **Escape** while the list is open. No other evidence file in `redesign/evidence/C-20/` records an Escape-specific live check either (`phase-a-verify.md`, `phase-b-verify-full.md`, `phase-b-fix-reverify.md`, `phase-d-admin-address-filled-1280.png`, `closeout-a11y-tokens.md`, `closeout-cost-mechanics.md`, `closeout-gates-scope.md` were listed via `ls`; none of their filenames indicate an Escape-in-dialog check, and this reviewer did not find one on inspection of the ones most likely to contain it).

**Verdict: CONFIRMED, BLOCKING.** Gate §3.4 explicitly requires "Escape dismisses [the list]... focus returns sanely" and the customer-context addendum explicitly requires "Escape behaviour must dismiss the suggestion list WITHOUT closing the dialog (verify explicitly)" — this has not actually been verified against Base UI's real dismiss mechanism, only against a synthetic stand-in, and the code-level trace shows the stand-in's guarantee does not transfer to the real integration.

---

## 2. Lost-steps checklist (plan §2 Steps 1-9 + §3 gates)

| Step | Status | Evidence |
|---|---|---|
| 1 — `parse-place.ts` | ✅ present | `src/lib/address/parse-place.ts`, `92f031d` |
| 2 — parser unit tests, 5 real-shaped fixture cases | ✅ present, plus 2 hardening cases | `src/lib/address/parse-place.test.ts` — Luton terrace, flat/subpremise, new-build no `postal_town`, postcode-less, London (no level_2) all present with exact `toEqual` assertions; `cc32657` added 2 more fixtures closing mutation-testing gaps (postal_town-vs-locality order, short-vs-long postcode) |
| 3 — `AddressAutocompleteField.tsx` | ✅ present, internals sanctioned-different from plan prose | New-API `AutocompleteSuggestion` + own input/list (option B), per progress §0.2/§0.2a — external `{value,onChange,onAddressSelected,inputProps}` contract preserved |
| 4 — component test (mocked Maps global) | ✅ present | `AddressAutocompleteField.test.tsx`, 631 lines, covers plain-input fallback, selection, free-typing no-op, debounce, session tokens, Escape (see finding above re: coverage gap), unmount safety |
| 4a — modal-dialog dropdown spike (BLOCKING) | ✅ present, re-scoped per D20 | Progress §0.2a explains the re-scope (own in-dialog list makes the classic `.pac-container` failure mode moot by construction); §1a.2 records a live PASS for z-index + click-select-doesn't-dismiss. Escape was not part of the recorded spike — see Claim 2 above |
| 5 — wire into `AboutYouStep.tsx` | ✅ present, matches prescribed code exactly | `9593a74`; `Controller` + `applyAddressParts` at `AboutYouStep.tsx:216-229` is a verbatim match to the plan's Step 5 snippet |
| 6 — customer-side check + new test file | ✅ present | `AboutYouStep.test.tsx`, 297 lines, 6 `it()`s incl. fill-from-selection, never-blank, typing-only, out-of-coverage, no-key fallback |
| 7 — wire into `ManualBookingForm.tsx`, typed-behaviour parity | ✅ present, six-piece reset confirmed correct (not the four C20-F6 originally listed) | `83c670f`; `applyAddressParts` at `ManualBookingForm.tsx:1065-1114` matches the typed City handler at `:1723` exactly (six state setters, `markEdited`, `postcodeLookupError` clear) |
| 8 — admin-side check + test extension | ✅ present | `ManualBookingForm.test.tsx` gains 6 new `it()`s under `describe("ManualBookingForm address autocomplete (C-20 Phase D)")` at lines 1003-1211, covering all 4-field fill, `markEdited` parity, single-cohort reset, mixed-gender reset, postcode-lookup-error clear, never-blank |
| 9 — env docs (env half) | ✅ present, diff is exactly one new commented entry | `.env.example` diff shown in `83c670f`: adds only `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-maps-api-key` + comment block, no placeholder-as-real-key, no other line touched |
| 9 — cookie-registry half | ⏸ deferred, sanctioned | `git diff 33f74fb..5233518 --stat -- src/lib/consent` → empty; `git status --porcelain -- src/lib/consent` → empty. Genuinely untouched, as the progress file claims, pending the Owner's consent-classification decision |
| §3.1 static gates | not run (full-suite ban); no evidence of new lint/tsc errors from reading the diffs (no obvious type errors, no `any` casts beyond the documented "minimal structural types, no `@types/google.maps`" choice) | not independently re-run |
| §3.2 real-address matrix (5 cases) | Per progress: 2 of 5 done live (Luton terrace, Dunstable) at time of this review's HEAD; flat, new-build, out-of-area cases recorded as outstanding in progress §2 | Not independently re-verifiable without live billed calls (prohibited) |
| §3.5 key safety sign-off | recorded ANSWERED (do not rotate) + referrer list DONE | Not independently verifiable (Cloud Console is external); accepted as recorded per SANCTIONED DECISIONS |
| §3.6 cost posture | post-deploy, not yet due | n/a |

No step was silently skipped or silently downgraded without a recorded reason. The one step with a real gap (Step 4a / §3.4's Escape-in-dialog requirement) is not *absent* — it has code, a plausible-looking unit test, and a live PASS record — but the live record and the unit test both test a different, easier scenario (click-select, not Escape), which is exactly the seam this review exists to catch.

---

## 3. Cross-phase seams

- **Parser → component:** `parsePlaceToAddressParts(components: PlaceAddressComponent[]): AddressParts` (Phase A) is called at `AddressAutocompleteField.tsx:388` with `fetched.addressComponents` (Phase B), which is typed `PlaceAddressComponent[] | null | undefined` and guarded (`if (!components || components.length === 0) return;`) before the call. Shape match confirmed: `AddressParts = {address, city, area, postcode}` is consumed identically by both hosts' `applyAddressParts`.
- **Component → hosts:** both hosts import the same `AddressParts` type from `@/lib/address/parse-place` and the same `AddressAutocompleteField` from `@/components/address/AddressAutocompleteField`; both required list-theming props (`listClassName`/`optionClassName`/`activeOptionClassName`) are supplied by both hosts with disjoint token families (`--rahma-*` vs `--admin-*`) — confirmed by direct read of both call sites (`AboutYouStep.tsx:591-593`, `ManualBookingForm.tsx:1779` onward).
- **Cost fields, defined once:** `PLACE_DETAIL_FIELDS = ["addressComponents", "location"]` (Phase B) is the only field list in the shipped code and the only `fetchFields` call site. `grep -rn "displayName" src/lib/address src/components/address src/features/booking/components/AboutYouStep.tsx src/app/admin/bookings/new/ManualBookingForm.tsx` → **zero matches** across every phase. **Claim/hunt item 6 (the cost trap) is independently confirmed clean — no defect.**
- **`includedRegionCodes`/`region`/`language` defined once, in Phase B, used identically for both hosts** (the hosts never touch the fetch — they only receive `onAddressSelected`), so there is no "two hosts diverging" risk on this axis; the region restriction is structurally shared, not duplicated per host.

No instance found of a value being defined in one phase and misused or reinterpreted with a different meaning in another. The one genuine seam defect is the Escape/dialog interaction (Claim 2) — it is a seam between Phase B (the component's own `stopPropagation` defence) and the pre-existing Base UI dialog infrastructure Phase C mounts it inside, and it was missed by every phase's own testing because each phase's test only exercises its own layer.

---

## 4. The two hosts diverging — deliberate vs accidental

| Difference | Customer (`AboutYouStep.tsx`) | Admin (`ManualBookingForm.tsx`) | Verdict |
|---|---|---|---|
| Binding | `Controller` + RHF `setValue` | `useState` setters | Deliberate — matches each host's pre-existing form architecture (brief §2.1 "both binding styles supported") |
| `autoComplete` | `"street-address"` (explicit in `inputProps`) | left at component default `"off"` (no `autoComplete` key in `inputProps`, confirmed by reading the object at `ManualBookingForm.tsx:1762-1778`) | Deliberate and justified in-line (comment at `ManualBookingForm.tsx:1740-1747`): staff type a *client's* address, so the browser's own saved-address autofill would surface the *wrong person's* data; customers type their own address, so keeping browser autofill is a genuine convenience. Confirmed pre-existing baseline had **no** `autoComplete` attribute at all on the admin address input (`git show 33f74fb:...ManualBookingForm.tsx \| grep autoComplete` → no output), so "off" is a new, deliberate choice, not an accidental carry-over |
| City-change reset scope | Relies on the pre-existing `watch("city")` → `availabilityInputsKey` effect in `BookingExperience.tsx` (no explicit reset code needed in `AboutYouStep.tsx` itself) | Explicit 6-piece reset in `applyAddressParts` (`ManualBookingForm.tsx:1093-1104`), matching the typed City handler's own 6 setters at `:1723` | Deliberate — the two hosts' underlying state machines differ (customer: a single derived key feeding one effect; admin: six independent `useState` slots including two per-gender availability flags with no admin-side equivalent to a single derived key). Each host's `applyAddressParts` correctly mirrors its *own* typed-input code path, not the other host's |
| List theming | `--rahma-*` tokens (`ADDRESS_LIST_CLASS` etc., `AboutYouStep.tsx:66-69`) | `--admin-*` tokens (`ADDRESS_LIST_CLASS` etc., `ManualBookingForm.tsx`) | Deliberate, required by the component's no-default contract; confirmed no `--admin-*` token leaks into the customer file and vice versa |
| `stepErrors`/error clearing | RHF's own `errors.address` etc., cleared by `setValue(..., {shouldValidate:true})` automatically | Manual `stepErrors` dict, explicitly cleared for `filled` keys in `applyAddressParts` (`ManualBookingForm.tsx:1107-1113`) | Per-host clearing mechanism matches each host's pre-existing validation architecture; the admin clearing is provably dead code for `address`/`postcode`/`city` (Continue is `disabled={!isStepReady}`, and `isStepReady` step-3 already requires all three non-empty, so `validateStep(3)` can never run with any of them empty to produce those particular `stepErrors` keys) — flagged by the implementer, confirmed independently (see §5 below), not a functional bug, just defensive code that can't execute |

No unjustified/accidental divergence found between the two hosts.

---

## 5. Honesty spot-checks (progress file vs code/git — 4 checked, target was ≥3)

1. **"Both Continue buttons are `disabled={!isStepReady}`, and step-3 readiness already requires `address && postcode && city && bookingDate && startTime`... those keys can never be set."** (§1b.2 item 1)
   Confirmed exactly: `isStepReady` step-3 branch at `ManualBookingForm.tsx:1176-1179` is `!!(address.trim() && postcode.trim() && city.trim() && bookingDate && startTime)`; `validateStep(3)` at `:232-238` sets `errs.address`/`errs.postcode`/`errs.city` only when the respective field is empty. Since the Continue button (`:2362`, `:2462`, both `disabled={!isStepReady}`) blocks `handleContinue` from running while any of those three is empty, `validateStep(3)` can never actually populate those three keys through the UI. **Accurate.**

2. **"`autoComplete='off'` on the admin address input (it previously had no attribute, i.e. browser default on)"** (§1b.2 item 3)
   Confirmed: `git show 33f74fb:src/app/admin/bookings/new/ManualBookingForm.tsx | grep autoComplete` → no output (zero occurrences pre-C-20). **Accurate.**

3. **"This file's local `FieldLabel`/`FieldError` hardcode `oklch(26% 0.14 25)`... pre-existing elsewhere in the file (~3 sites) — logged, not fixed."** (§1b.2 item 4)
   Confirmed the literal (`oklch(26%_0.14_25)`, Tailwind arbitrary-value syntax) is pre-existing (identical count, 13, before `33f74fb` and after `5233518` — `grep -c` on both revisions), i.e. C-20 added zero new occurrences and the new address-field markup at `ManualBookingForm.tsx:1740-1778` genuinely uses a token (`var(--admin-status-cancelled-text)`) instead. **However, the "~3 sites" count is an undercount** — the literal appears **13 times** in the file (12 usage sites plus a border variant), not ~3. This is a minor inaccuracy in an otherwise-accurate self-report; it does not change the substance of the claim (pre-existing, not introduced by C-20, correctly avoided in the new code) but the file undersells the pre-existing debt by roughly 4×. **Logged as a NON-BLOCKING honesty finding below — the direction of the error is the safe one (understating a pre-existing problem the plan explicitly says not to fix), not a cover-up of new C-20 work.**

4. **"Step 9 (env half only)... `.env.example` diff shows only the one new commented entry."** (plan §2 Step 9 verify clause, matched against the actual commit)
   Confirmed via `git show 83c670f -- .env.example`: the diff adds exactly one new block (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-maps-api-key` plus an 8-line comment), no other line touched, placeholder value only (no real key). **Accurate.**

3 of 4 checks fully accurate; 1 (the "~3 sites" figure) is a minor, safely-directioned undercount.

---

## 6. Findings summary

Findings are reported via the structured tool. In prose:

- **BLOCKING** — Escape while the address suggestion list is open, inside the booking dialog, plausibly also closes the dialog itself, not just the dropdown. Confirmed end-to-end via source inspection of React 19's document-level event delegation, Base UI's independent document-level `keydown` listener (which never checks `defaultPrevented`), and the DOM spec's same-node `stopPropagation` semantics. The shipped unit test only proves propagation stops against a synthetic React-tree stand-in, which cannot and does not exercise Base UI's real native listener — so it provides false confidence. No live check (recorded or found) exercises this specific path either; the recorded Step 4a spike PASS covers only z-index and click-to-select, not Escape.
- **NON-BLOCKING** — `includedRegionCodes: ["gb"]`, the literal doing the UK-restriction work, has no unit assertion pinning it; only `includedPrimaryTypes` is pinned in the debounce test. Confirmed by direct grep of the test file (zero matches) and direct read of the assertion block.
- **NON-BLOCKING** — the progress file's "~3 sites" figure for the pre-existing hardcoded `oklch(26%_0.14_25)` literal in `ManualBookingForm.tsx` undercounts the actual 13 occurrences by roughly 4×. Not a C-20 defect (the count is unchanged by C-20's commits, and C-20's own new code correctly avoids the literal) — a minor self-report inaccuracy only, in the safe (understating pre-existing debt) direction.

No scope creep found (every file touched by C-20's six commits is exactly a plan-listed file; the only other admin/bookings/new activity in the window belongs to C-23's separately-committed date/availability work and was excluded by commit, not just by eyeballing the diff). No lost steps found beyond the sanctioned Step 9 registry deferral. No cost-trap violation (`displayName` appears nowhere in any phase). No accidental host divergence found — every customer/admin difference traced to a deliberate, in-code-commented reason consistent with each host's pre-existing architecture.
