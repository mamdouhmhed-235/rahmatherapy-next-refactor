# C-20 — Closeout verification: COST MECHANICS

**Verifier role:** read-only verification subagent, Band C programme.
**Scope:** plan §1 cost table + §3.3 blocking cost checks only. Full test suites NOT run (owned by another agent) — only the targeted files below.
**Repo state verified against:** branch `master`, HEAD `5233518`.
**Files inspected:** `src/components/address/AddressAutocompleteField.tsx`, `src/components/address/AddressAutocompleteField.test.tsx`, `src/lib/address/parse-place.ts`, `src/features/booking/components/AboutYouStep.tsx` (wiring only), `src/app/admin/bookings/new/ManualBookingForm.tsx` (wiring only).

---

## 1. Field list — `["addressComponents", "location"]`, never `displayName`

**Code (`AddressAutocompleteField.tsx:231`):**
```ts
const PLACE_DETAIL_FIELDS = ["addressComponents", "location"];
```
Used at the single call site, `AddressAutocompleteField.tsx:378`: `place.fetchFields({ fields: PLACE_DETAIL_FIELDS })`.

**Repo-wide grep for `displayName`** (`Grep pattern="displayName" path=src`): the only Places-related hits are the file-level warning comments in `AddressAutocompleteField.tsx:35,229` and the test comment at `AddressAutocompleteField.test.tsx:348` — all of them documenting the prohibition, none of them requesting the field. Every other hit (`BookingDetailSidebar.tsx`, `admin/roles/page.tsx`, `PermissionRow.tsx`) is an unrelated local variable named `displayName` for staff/role UI, nothing to do with Places.

**Grep for `fields:` / `fetchFields` / `PLACE_DETAIL_FIELDS` across `src`:** the only production `fetchFields({ fields: ... })` call in the codebase is `AddressAutocompleteField.tsx:378`, using the single `PLACE_DETAIL_FIELDS` constant. No second, parallel Places-field list exists anywhere (both consuming forms — `AboutYouStep.tsx:581`, `ManualBookingForm.tsx:1758` — call the shared component and never touch the field list themselves).

**Guarding test, proven non-vacuous by mutation (mutant run, not from memory):**
`AddressAutocompleteField.test.tsx:349-351` asserts `toHaveBeenCalledWith({ fields: ["addressComponents", "location"] })`.

Procedure: copied the real component + its real, unmodified test file into a scratchpad-mutant pair, mutated only `PLACE_DETAIL_FIELDS` to `["addressComponents", "location", "displayName"]`, then ran the **verbatim, unmodified test file** against the mutant (staged transiently at `src/components/address/__c20_verifier_mutant__/` because Vitest's `include` glob is `src/**` and Vite's bare-import resolution needs the file inside the project tree; deleted immediately after the run — `git status --porcelain -- src/` confirmed clean except the standing `src/lib/maintenance.ts`, no real file was ever touched).

Result:
```
FAIL ... selecting a suggestion > parses the selected place's addressComponents and calls
onAddressSelected with them, requesting exactly the two Essentials fields
AssertionError: expected "vi.fn()" to be called with arguments: [ { fields: [ …(2) ] } ]
Received:
  1st vi.fn() call:
  [ { "fields": [ "addressComponents", "location", "displayName" ] } ]
```
Exactly one test failed (the field-list guard); the other 10 tests in the file still passed. **The guard is real, not vacuous.**

**Verdict: PASS — BLOCKING requirement met.**

---

## 2. Session tokens

**Code:**
- `sessionTokenRef` (`:272`) holds one token for the life of a typing session.
- `ensureSessionToken` (`:300-305`) only mints a new `AutocompleteSessionToken` when `sessionTokenRef.current` is falsy — every subsequent `fetchAutocompleteSuggestions` call in the same session reuses it (`:314`, passed as `sessionToken: token` at `:320`).
- On selection, `selectSuggestion` (`:376-391`) calls `place.fetchFields(...)` (which consumes the token per the new Places API) and then explicitly nulls it out at `:383`: `sessionTokenRef.current = null;` — the next keystroke's `ensureSessionToken` call mints a fresh one.

**Guarding test** (`AddressAutocompleteField.test.tsx:262-313`, "reuses one token across a typing session and mints a fresh one after selection"): asserts two suggestions requests within one session share the identical token instance (`toBe`), then asserts a request after a completed selection gets a **different** token instance.

**Proven non-vacuous by mutation:** copied component + verbatim test again, this time mutating only `ensureSessionToken` to mint a new token on every call (unconditionally) — the field list was left correct (`["addressComponents", "location"]`) so only the token behaviour was under test. Ran the real test file against the mutant (same transient-`src/`-then-delete procedure; cleanup verified).

Result:
```
FAIL ... session tokens (cost-critical) > reuses one token across a typing session and mints a fresh one after selection
AssertionError: expected FakeAutocompleteSessionToken{ id: 1 } to be FakeAutocompleteSessionToken{ id: 2 }
```
Exactly the session-token test failed (1 of 11 in that run); the debounce mutant run alongside it failed only its own test. **The guard is real.**

**Verdict: PASS — BLOCKING requirement met.**

---

## 3. ~300ms debounce

**Code:** `AUTOCOMPLETE_DEBOUNCE_MS = 300` (`:226`); `handleChange` (`:348-367`) clears any pending timer on every keystroke and schedules `runFetch` via `setTimeout(..., AUTOCOMPLETE_DEBOUNCE_MS)` — a fresh keystroke always cancels and restarts the timer, so only the input's settled value after a pause fires a request.

**Guarding test** (`AddressAutocompleteField.test.tsx:220-260`, "collapses rapid keystrokes into exactly one request"): types `L`, `Lu`, `Lut`, `Luto`, `Luton` with no time advance between them, asserts zero calls before the debounce window, then exactly **one** call after advancing fake timers by `AUTOCOMPLETE_DEBOUNCE_MS`.

**Proven non-vacuous by mutation:** copied component + verbatim test, mutated only `handleChange` to call `void runFetch(trimmed)` immediately instead of scheduling the `setTimeout` (field list left correct). Ran the real test file against the mutant (same transient procedure; cleanup verified).

Result:
```
FAIL ... debounce (cost control) > collapses rapid keystrokes into exactly one request, for the final value
AssertionError: expected "vi.fn()" to be called 1 times, but got 5 times
```
Matches the plan's arithmetic directly: 5 keystrokes undebounced → 5 requests, exactly what would blow the ~7,200-vs-~14,400 budget math in §1. **The guard is real.**

**Verdict: PASS — BLOCKING requirement met.**

---

## 4. `includedRegionCodes: ["gb"]` is what restricts — not `region`

**Code (`:321-324`):**
```ts
includedRegionCodes: ["gb"],
includedPrimaryTypes: ["street_address", "premise", "subpremise"],
region: "gb",
language: "en-GB",
```
`includedRegionCodes` and `region`/`language` are four independent, separately-sent request fields — nothing in the code makes UK restriction depend on `region`. Per Google's currently published Autocomplete Data API reference (cited in the progress file, §0.2, verified against the live doc rather than from memory by the implementing session): `region` only affects formatting/ranking, `includedRegionCodes` is the actual filter. The code sends both, correctly assigning restriction to `includedRegionCodes` and leaving `region`/`language` to their documented formatting role.

**Gap found (NON-BLOCKING):** no unit test in `AddressAutocompleteField.test.tsx` pins the literal value `includedRegionCodes: ["gb"]` the way the debounce test pins `includedPrimaryTypes` via `toMatchObject` (`:255-258`). The only verification of the actual restriction is the LIVE, real-API check recorded in the progress file §1a.2 ("every suggestion a real Luton address — `includedRegionCodes: ["gb"]` doing the work"), run once by the orchestrator, not repeatable as a regression guard. If a future edit silently dropped or renamed `includedRegionCodes` (e.g. reverted to `componentRestrictions` from the classic API, or typo'd to `regionCodes`), no automated test would catch it — only a live (billed) manual check would.

**Verdict: PASS on the mechanism itself (code correctly separates restriction from formatting); NON-BLOCKING gap on regression coverage — the restriction is currently correct but not test-pinned.**

---

## 5. `includedPrimaryTypes` = `["street_address", "premise", "subpremise"]`

**Code (`:322`).** Matches exactly. Confirmed via grep as the only occurrence of `includedPrimaryTypes` in the codebase. The file-header comment (`:23-32`) documents this was deliberately widened from Google's own single-value example specifically because `street_address` alone excludes `premise`/`subpremise` (Google's documented type for "an apartment, unit, or suite") — matching progress file §1a.1 finding 2 (a Phase B BLOCKING fix, commit `af2c5b1`).

**Guarding test:** `AddressAutocompleteField.test.tsx:255-258`, `toMatchObject({ includedPrimaryTypes: ["street_address", "premise", "subpremise"] })` — `toMatchObject` requires an array property to match exactly (same length + elements in order), so reverting to `["street_address"]` alone would fail this assertion (test file's own comment at `:250-254` states this explicitly, and the assertion mechanics confirm it — not re-mutated separately since Phase B's own fix-round already exercised this exact regression per progress §1a.1).

**Verdict: PASS.**

---

## 6. Lazy load: script only on first focus, module-level singleton

**Code:**
- `loadMapsApi()` (`:168-220`) is a top-level `let mapsApiPromise` singleton — the very first line (`:169`) is `if (mapsApiPromise) return mapsApiPromise;`, so any caller after the first gets the cached promise, never a second `<script>` injection.
- Only two call sites: `handleFocus()` (`:341-346`, wired to `onFocus` on the `<input>` at `:441`) and `runFetch()` (`:307-311`, only reachable after a debounced keystroke, which itself only happens after focus produced a non-empty value). **Nothing calls `loadMapsApi()` on mount or render** — no `useEffect(() => loadMapsApi(), [])` exists anywhere in the file (confirmed by reading the full component; the only `useEffect`s present are the mount-ref cleanup at `:277-285` and the active-option scroll-into-view at `:287-292`, neither of which touches `loadMapsApi`).
- Idempotency against a pre-existing `google.maps.importLibrary` (e.g. a second field on the page) is explicit at `:185-188`, skipping the `<script>` injection entirely.

**Guarding test** (`AddressAutocompleteField.test.tsx:176-218`, "requests nothing on mount, requests the script on first focus, and a second field reuses the cached load"): renders field A, asserts **zero** `maps.googleapis.com` script tags exist before focus; focuses A, asserts **exactly one**; unmounts A, renders field B (same module graph, so the singleton persists), focuses B, asserts **still exactly one** script tag. This is a `render()` call with no auto-focus — jsdom does not focus elements on render — so "renders nothing on mount" is a genuine assertion, not an artifact of the test harness.

Ran `pnpm exec vitest run src/components/address src/lib/address` directly (real files, no mutation): **20/20 passed**, confirming this test currently passes against the real implementation.

**Verdict: PASS — BLOCKING requirement met.**

---

## 7. No-key fallback

**Code:** `loadMapsApi()` (`:172-178`) — if `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is falsy, `mapsApiPromise = Promise.resolve(null)` and returns immediately; never throws, never rejects. `runFetch()` (`:307-311`) awaits this and short-circuits (`if (!lib) return;`) before any suggestion request — component stays a plain input. The rendered `<input>` (`:429-444`) has no conditional branch on key presence: it is always a real, always-enabled, always-submittable input; only the suggestion dropdown's existence depends on `open && suggestions.length > 0`, and `suggestions` never populates without a key.

**Guarding test** (`AddressAutocompleteField.test.tsx:145-174`): with the key cleared, spies on `console.error`, focuses + types into the field, then asserts: no `maps.googleapis.com` script injected, `onChange` still fires normally (free typing works), `onAddressSelected` never fires, and **`console.error` was never called** — i.e. no user-visible (or even console-visible) error surfaces on the fallback path.

**Verdict: PASS — BLOCKING requirement met.**

---

## Summary

| # | Check | Verdict |
|---|---|---|
| 1 | Field list exactly `["addressComponents","location"]`, no `displayName`, guard proven non-vacuous | PASS |
| 2 | Session tokens reused per session, fresh after selection, guard proven non-vacuous | PASS |
| 3 | ~300ms debounce active, guard proven non-vacuous | PASS |
| 4 | `includedRegionCodes` (not `region`) is the restriction | PASS (mechanism); gap: no unit-test regression guard for this specific field — NON-BLOCKING |
| 5 | `includedPrimaryTypes` = `["street_address","premise","subpremise"]` | PASS |
| 6 | Lazy load on first focus, module-level singleton | PASS |
| 7 | No-key fallback: plain, usable, submittable input, no visible error | PASS |

**No BLOCKING findings.** One NON-BLOCKING gap: `includedRegionCodes: ["gb"]` has no unit test pinning its literal value (unlike `includedPrimaryTypes`, which is pinned via `toMatchObject`); its only verification is a one-time live/manual check recorded in the progress file. A future silent regression here would degrade UK-restriction behaviour without any automated test catching it — worth a follow-up unit-test addition, not worth blocking C-20's cost-mechanics sign-off, since the currently-shipped code is correct and the live gate already confirmed it empirically.

## What was NOT run
- Full `pnpm vitest run` / `pnpm lint` / `pnpm tsc` / `pnpm build` — explicitly out of scope for this dimension (owned by another agent per dispatch).
- No live Google Places API calls were made by this verifier (all checks above are static code reading, grep, or mocked/mutated unit tests run locally).
