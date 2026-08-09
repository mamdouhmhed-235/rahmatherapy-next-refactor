# C-20 — Closeout verification: Accessibility + Design Tokens + Host Integration

**Role:** read-only verifier. **Scope:** dimension = ACCESSIBILITY + DESIGN TOKENS + HOST INTEGRATION per dispatch.
**HEAD verified against:** `master`, commits `92f031d` (A) `cc32657` (A hardening) `ac0a283` (B) `af2c5b1` (B fix) `9593a74` (C) `83c670f` (D) — confirmed present via `git log --oneline` on the exact assigned paths (see §0).
**Working tree:** `git status --porcelain` on all assigned paths (`src/components/address`, `src/lib/address`, `AboutYouStep.tsx`, `ManualBookingForm.tsx`, `.env.example`) returns empty — clean, nothing to isolate. `src/lib/maintenance.ts` untouched/not inspected (out of scope, per standing rule).

No live Google Places calls were made. No typing into any address field in a browser. All findings below are from reading source (project code + `node_modules` framework internals actually opened this session) and existing test files.

---

## 0 — Commit/identity check

```
83c670f feat(redesign): C-20 Phase D — admin form address autocomplete + env docs
9593a74 feat(redesign): C-20 Phase C — customer form address autocomplete
af2c5b1 fix(redesign): C-20 Phase B — host-themed suggestion list + widen address primary types
ac0a283 feat(redesign): C-20 Phase B — shared address autocomplete component
cc32657 fix(redesign): C-20 Phase A — close two proven-vacuous parser assertions
92f031d feat(redesign): C-20 Phase A — parser + fixtures/tests
```
Matches the six SHAs listed in the dispatch exactly, in the plan's own commit-cadence order. ✅

---

## 1 — WAI-ARIA combobox correctness — PASS

`src/components/address/AddressAutocompleteField.tsx:429-478`:
- `role="combobox"`, `aria-expanded={open}`, `aria-controls={listboxId}`, `aria-autocomplete="list"` on the input (429-444).
- `aria-activedescendant` only set `open && activeIndex >= 0` (436-438), value `${listboxId}-option-${activeIndex}`. The matching `<li id={`${listboxId}-option-${index}`}>` (459) is only absent when the index is out of range, and `activeIndex` is clamped to `[0, suggestions.length-1]` by the ArrowUp/ArrowDown handlers (413-416) — so whenever `aria-activedescendant` is set, that id exists in the DOM. Confirmed.
- Popup: `<ul role="listbox">` (446-455) of `<li role="option" aria-selected=...>` (457-474). Correct roles.
- ArrowDown/ArrowUp move `activeIndex` (411-416); Enter with an active index calls `selectSuggestion` (417-421); Enter with none active is a documented no-op (422-424, matches deviation #4 — free text stands). Confirmed by the "keyboard navigation" and "free typing" test blocks in `AddressAutocompleteField.test.tsx:391-474`, both of which pass against the real component code (read, not re-executed — `pnpm vitest` not run per the dispatch's "do not run full suites," but the assertions were traced against the implementation line by line and are non-vacuous).

## 2 — Escape — BLOCKING finding (see Finding 1 below)

The **component-local** conditional is correct: `handleKeyDown` (394-407) calls `preventDefault()`+`stopPropagation()` only `if (open)`, and simply `return`s (no-op, event allowed to propagate) when the list is already closed. Verified against both branches in `AddressAutocompleteField.test.tsx:534-573`, which passes.

**However**, this only proves that the event stops propagating through *React's own synthetic ancestor-handler chain*. It does not prove Escape is contained relative to the actual Base UI modal dialog Phase C mounts this field inside — that mechanism is not a React `onKeyDown` prop on an ancestor, it is a **separate native `document`-level listener** outside React's synthetic system entirely. Traced this in full — see Finding 1.

## 3 — Tokens — PASS

**Shared component (`AddressAutocompleteField.tsx`)**: grepped for colour literals and `--rahma-*`/`--admin-*` tokens — zero hits outside comments (lines 51, 243-244, which only *describe* the contract). The three colour props (`listClassName`, `optionClassName`, `activeOptionClassName`) are declared **required, no default** (249-253, `AddressAutocompleteFieldProps`), so a caller that omits them fails `tsc`, not runtime. Confirmed.

**Customer host (`AboutYouStep.tsx:66-69`)**:
```
ADDRESS_LIST_CLASS = "border border-rahma-border bg-rahma-surface shadow-card"
ADDRESS_OPTION_CLASS = "text-rahma-charcoal hover:bg-rahma-ivory"
ADDRESS_ACTIVE_OPTION_CLASS = "bg-rahma-ivory text-rahma-green"
```
All `rahma-*` (Tailwind utilities mapped from `--rahma-*` custom properties via `--color-rahma-*` in `tokens.css:703-711`). Zero `admin-*` references. Confirmed.

**Admin host (`ManualBookingForm.tsx:501-506`)**:
```
ADDRESS_LIST_CLASS = "border border-[var(--admin-border)] bg-[var(--admin-panel)] shadow-[var(--admin-shadow-overlay)]"
ADDRESS_OPTION_CLASS = "text-[var(--admin-body)] hover:bg-[var(--admin-panel-muted)]"
ADDRESS_ACTIVE_OPTION_CLASS = "bg-[var(--admin-panel-muted)] text-[var(--admin-heading)]"
```
All `--admin-*`. Zero `rahma-*` or literal-colour references. Confirmed — correct family per host, no cross-contamination.

**Token definitions** (`src/styles/tokens.css`), checked for both hosts' full token set:
- `--rahma-border`, `--rahma-surface`, `--rahma-charcoal`, `--rahma-ivory`, `--rahma-green` — all defined in `:root` (lines 2-19). Public site has no dark variant (by design — line 315: "Light stays the `:root` default so the public site is untouched").
- `--admin-border`, `--admin-panel`, `--admin-panel-muted`, `--admin-heading`, `--admin-body`: defined in the **light** default (`:root`, lines 68-75) **and** in the **dark** override block (`[data-theme="dark"], [data-admin-theme-root][data-theme="dark"] ~ *`, lines 331-345). `--admin-shadow-overlay`: light at line 196, dark at line 414. All six confirmed present in both blocks — since admin defaults to dark for any staff member with no saved preference (per the component's own file comment, corroborated by the token file's own header at lines 300-329), this is the load-bearing check and it holds.

## 4 — Customer host integration — PASS

- **Hard covered-area gate still blocks.** `validateServiceArea` (`src/features/booking/schemas/booking-schema.ts:139-164`) is a `superRefine` that reads only `value.city` (a plain string) — it has no dependency on *how* `city` was set. `applyAddressParts` (`AboutYouStep.tsx:216-...`) fills `city` via the same `setValue("city", v, { shouldValidate: true, shouldDirty: true })` path a covered-town chip click uses (`setCity`, lines 204-209) — same mechanism, so the gate at `BookingExperience.tsx:389-396` fires identically for a selected city as for a typed/chip-picked one. Confirmed by direct read of both files; not executed live (would require a real API call).
- **City-change date reset fires identically.** `availabilityInputsKey` (`BookingExperience.tsx:157-165`) is a `useMemo` keyed off `detailsPreview.city.trim().toLowerCase()` — it reads the *form value*, not the UI event that produced it. The effect at `BookingExperience.tsx:265-273` calls `setPreferredDate(null)` whenever that key changes. Since `applyAddressParts` writes `city` through `setValue` exactly like typing does, this reset is mechanically identical regardless of origin. Confirmed by reading `BookingExperience.tsx:150-165, 265-273` directly.
- **Postcode/city/area stay visible and editable.** `AboutYouStep.tsx:531-570` renders normal `register("city")`/`register("area")`/`register("postcode")` inputs unchanged; only the address field's inner `<input>` was swapped for `<AddressAutocompleteField>` (`AboutYouStep.tsx:577-596`, via `Controller`). Confirmed.
- **No `window.alert`.** Grepped `AboutYouStep.tsx` and `AddressAutocompleteField.tsx` for `alert(` — zero matches; the "no addressComponents" and "fetchFields failed" paths in the shared component are both silent no-ops (`AddressAutocompleteField.tsx:386, 389-391`), and this is exercised by a passing test (`AddressAutocompleteField.test.tsx:354-388`, which explicitly spies on `window.alert` and asserts it was never called).

## 5 — Admin host integration — PASS

`ManualBookingForm.tsx:1065-1114` (`applyAddressParts`):
- **Six-state reset** on a real city change, not four: `setBookingDate("")`, `setStartTime("")`, `setAvailChecked(false)`, `setAvailSlots([])`, `setFemaleAvailChecked(false)`, `setMaleAvailChecked(false)` — all six present (lines 1098-1103), guarded by `parts.city !== city` (1093). Matches the typed handler's own six resets at line 1723 exactly (grepped and diffed the two by hand). C20-F6's "four" undercount (flagged in the progress file's own §0.1) is confirmed fixed in the shipped code.
- **`markEdited` fires per filled field**: `markEdited("address")` (1074), `markEdited("postcode")` (1079), `markEdited("area")` (1087), `markEdited("city")` (1091) — all four, each gated on that part being present.
- **`postcodeLookupError` clears on postcode fill**: `setPostcodeLookupError("")` at line 1082, inside the `if (parts.postcode)` block.
- **Empty part never blanks an existing value**: every one of the four fields is behind its own `if (parts.x)` guard (1072, 1077, 1085, 1089) — an absent component from Google is simply skipped, never written as `""`.
- **Coexistence with postcode-lookup autofill**: `handlePostcodeBlur` (1036-1053) only fills `city` when `!city.trim()` and never touches `area`; `applyAddressParts` fills unconditionally whenever the corresponding part is present, so an explicit selection wins over the postcode-lookup path by construction (no shared mutable flag to race). Confirmed by reading both functions in full.
- **`stepErrors` for filled fields are cleared** (1107-1113) — the implementer's own progress note (§1b.2 item 1) flags these as currently unreachable through the UI (Continue is `disabled` before `stepErrors` can be set) — read `ManualBookingForm.tsx` around the `isStepReady`/`handleContinue` logic and confirm this characterisation is accurate: `stepErrors.address/postcode/city` are set by `validateStep`, only surfaced via `handleContinue` (1117-1131), and the Continue action is `disabled={!isStepReady}` per the plan/progress note. This is dead-but-harmless code, already disclosed — not re-flagged as a new finding.

## 6 — Mobile-first / 375px — PARTIALLY VERIFIABLE, one pre-existing residual corroborated

Could not open a browser at 375px with a live suggestion list (doing so requires typing into the address field, which triggers a real, billed Places request — explicitly forbidden by the dispatch). Reasoned from CSS/DOM structure instead:

- **Customer dialog**: `BookingDialog.tsx:106` renders `<div ref={contentGridRef} className={styles.contentGrid}>` as the step content's scroll container, and `BookingExperience.module.css:284-285` confirms `.contentGrid { overflow-y: auto; ... }`. The `AddressAutocompleteField`'s suggestion list is `position: absolute; top: full` (`AddressAutocompleteField.tsx:428, 451`) relative to its own wrapping `<div className="relative">`, which sits inside this scrolling container. An absolutely-positioned dropdown rendered near the bottom of a scrollable ancestor's current viewport **can be clipped by that ancestor's overflow box** until the user scrolls — this is a real, structurally-confirmed risk, not a hypothetical. It is already disclosed by the implementer as an open residual in the progress file (§1a.2, "`.contentGrid` is the dialog's scroll container... could clip until the user scrolls") — I corroborate the CSS evidence for it here but did not newly discover it, and cannot resolve it without a live 375px pass with the list open. **Listed under checks not run, not raised as a new blocking item** (it is honestly disclosed already and gated behind the same live-browser restriction I'm under).
- **Admin form**: grepped `ManualBookingForm.tsx` for `sticky`/`overflow-y-auto`/`overflow-auto` — zero matches near the address field's region. The admin create-booking page is not wrapped in a scrolling sub-container the way the customer dialog is, so the equivalent clipping risk is structurally lower there, but this is inference from absence, not a live 375px screenshot.
- Z-index: because option B (in-dialog list, not `PlaceAutocompleteElement`/`.pac-container`) was chosen, the suggestion list renders as a normal DOM child *inside* the dialog's own stacking context, so it does not need to out-rank the dialog's own `z-index: 9999` (`BookingExperience.module.css:20`) the way a body-portaled Google dropdown would have. This is a structural (not merely tested) guarantee — confirmed by reading the component's render tree (no `createPortal` anywhere in `AddressAutocompleteField.tsx`).

---

## Finding 1 — BLOCKING: Escape while the suggestion list is open plausibly also closes the surrounding booking dialog

**Claim.** `AddressAutocompleteField`'s Escape handler (`AddressAutocompleteField.tsx:394-407`) calls `e.stopPropagation()` on the React synthetic event to keep Escape from reaching the Base UI dialog's own close handler while the suggestion list is open. This is the correct fix *if* the dialog's Escape-to-close behaviour were implemented as a React ancestor `onKeyDown` prop. It is not: Base UI implements Escape-to-dismiss via a **separate, native `document`-level `keydown` listener**, registered outside React's synthetic event system entirely. `stopPropagation()` on a React synthetic event does not — and, per the DOM event-dispatch algorithm, cannot — prevent a *different*, independently-registered listener on the *same* target node (`document`) from also firing. The two systems are not connected the way the component's own comment (lines 65-69) assumes.

**Evidence chain (every link read directly this session, not from memory):**

1. Next.js hydrates the whole app directly onto `document` in App Router, not a nested container div:
   `node_modules/next/dist/client/app-index.js:32` — `const appElement = document;`
   `node_modules/next/dist/client/app-index.js:293` — `_client.default.hydrateRoot(appElement, reactEl, {...})`.
   This means React's own delegated event listeners for the whole app are attached directly on `document`.

2. React (19.2.4, confirmed via `package.json`) registers **both** a capture-phase and a bubble-phase native listener for every delegated event type — including `keydown` — on the root container:
   `node_modules/react-dom/cjs/react-dom-client.development.js:19209-19227` (`listenToAllSupportedEvents`), `19228-19272` (`addTrappedEventListener`, showing the literal `addEventListener(domEventName, ..., capture: true/false)` calls). Since the root container is `document` (point 1), both of these are on `document`.

3. React's synthetic `stopPropagation()` calls the underlying native `event.stopPropagation()` — **not** `stopImmediatePropagation()`:
   `node_modules/react-dom/cjs/react-dom-client.development.js:3394-3398`.
   Per the DOM Events spec, plain `stopPropagation()` prevents an event from reaching *other nodes*, but does **not** prevent *other listeners already registered on the same node* from firing — only `stopImmediatePropagation()` does that.

4. Base UI's dialog-dismiss logic (`useDismiss`, which `Dialog.Root` wires up for every modal) registers its Escape handler as a **plain native bubble-phase listener directly on `document`** — a second, independent listener on the exact same node React's own listener sits on:
   `node_modules/@base-ui/react/floating-ui-react/hooks/useDismiss.js:397` — `addEventListener(doc, 'keydown', closeOnEscapeKeyDown)` (no capture flag).
   `node_modules/@base-ui/utils/addEventListener.js` — confirms the 4th `options` argument, when omitted, is passed through as `undefined`, i.e. default bubble phase.
   `closeOnEscapeKeyDown` itself (`useDismiss.js:84-115`) calls `store.setOpen(false, ...)` on any unmodified `Escape` keydown while the dialog is open and `escapeKey` is enabled.

5. Escape-to-dismiss is *enabled* for this dialog: `node_modules/@base-ui/react/dialog/root/useDialogRoot.js:90` passes `escapeKey: isTopmost` to `useDismiss`, and the booking dialog is never nested, so `isTopmost` is always `true` when it's the open dialog. `BookingDialog.tsx:57` renders `<Dialog.Root open={open} onOpenChange={onOpenChange} modal>` with no `dismissible`/escape override.

6. Nothing in this app's own code filters the resulting close-reason: `BookingExperience.tsx:350-356` (`handleOpenChange`) unconditionally does `setOpen(nextOpen)` for any `false` — it does not inspect *why* Base UI wants to close.

**Failure scenario.** Customer opens the booking dialog, reaches the About step, focuses the address field, types a partial address, the (real, billed) suggestion list opens, and presses Escape intending to dismiss just the dropdown (the documented, tested intent of `AddressAutocompleteField.tsx:394-407`). Because React's own document-level `keydown` listener was registered at app hydration — before the dialog ever opened — and Base UI's dismiss listener is registered later (only once the dialog opens), React's listener runs first among the `document`-level bubble listeners for `keydown`; it performs its full internal synthetic dispatch (walking down to our `<input>`'s `onKeyDown`, which calls `stopPropagation()`) entirely within that single callback, then returns. Control then passes to the *next* `keydown` listener registered on `document` — Base UI's `closeOnEscapeKeyDown` — which fires regardless, sees the dialog is open and topmost, and calls `store.setOpen(false, ...)`, closing the **entire booking dialog** and discarding the customer's in-progress form. This is precisely the "Escape that always swallows would trap a customer... worse than the bug it prevents" scenario, just from the opposite direction: instead of trapping the user inside the dialog, it silently destroys their booking progress on a keystroke they only meant to use to close a dropdown.

**Why I could not settle this with a live test.** Reproducing it for real requires the suggestion list to actually be open, which requires typing into the address field and triggering a real Places Autocomplete request — explicitly forbidden by this dispatch's hard restrictions ("MAKE NO LIVE GOOGLE PLACES API CALLS... Do not type into an address field in a browser"). I am also restricted to writing only this report file, so I could not build an isolated jsdom/Node reproduction outside the project tree to confirm empirically without touching a live key. The finding rests on tracing the actual shipped `node_modules` framework code line by line (all six citations above were read directly this session, not recalled from training), which is the strongest evidence available to me under these constraints, but it has not been visually confirmed against the running app with the dialog genuinely open.

**Why the component's own passing test doesn't cover this.** `AddressAutocompleteField.test.tsx:534-573` proves the stopPropagation branch works against a `<div onKeyDown={parentKeyDown}>` stand-in — a **React synthetic bubble handler**. That is not the mechanism Base UI actually uses (a native `document`-level listener outside React's event system), so the test's green result does not, and structurally cannot, exercise the real integration risk the component's own file comment (lines 65-69) says it's guarding against.

**Suggested fix.** Either (a) call `e.nativeEvent.stopImmediatePropagation()` in addition to `stopPropagation()` in the `if (open)` branch at `AddressAutocompleteField.tsx:402-404` — this would still not help, since `stopImmediatePropagation` only blocks *further* listeners at the same node *after* the one calling it in registration order, and React's listener (which is where our code runs) is registered *before* Base UI's, so by the time our code runs, Base UI's listener hasn't fired yet — `stopImmediatePropagation` on the *native* event from within a React handler, called synchronously during React's own document-listener callback, executes *before* the browser moves to the next same-node listener, so it *would* work, provided it is the native event's `stopImmediatePropagation` (`e.nativeEvent.stopImmediatePropagation()`), not the synthetic wrapper's; or (b) intercept and stop the key at capture phase on an element the field controls (e.g. wrap the input's container in `onKeyDownCapture` and call `nativeEvent.stopImmediatePropagation()` there too, for defence in depth); or (c) the more robust, framework-idiomatic fix: pass `Dialog.Root`'s escape handling a guard — Base UI's `Dialog.Root` (or the underlying `useDismiss`) may accept an `onOpenChange` reason check, or the app's own `handleOpenChange` (`BookingExperience.tsx:350`) could inspect the change *reason* Base UI passes and ignore `escapeKey`-triggered closes while a tracked "suggestion list is open" flag (lifted out of the field, e.g. via a ref/callback) is true. Whichever fix is chosen, it must be **live-verified** (real dialog, real open suggestion list, real Escape press, confirm dialog stays open) since this exact scenario is unreachable from a jsdom unit test that doesn't reconstruct Base UI's actual dismiss wiring.

---

## Checks not run (require a live browser + billed API, forbidden by this dispatch)

- Live confirmation of Finding 1 (Escape with the real suggestion list open, inside the real running booking dialog).
- 375px / 1280px screenshots of the suggestion list in both hosts, including the `.contentGrid` clipping risk already disclosed in the progress file (§1a.2).
- Screen-reader announcement of the listbox popup (requires an actual AT, not just ARIA-role inspection).
- `pnpm vitest run` / `pnpm lint` / `npx tsc --noEmit` were not executed (dispatch: "Do NOT run the full test suites"); all test-file assertions above were verified by manual line-by-line tracing against the implementation, not by execution.

---

## Summary

Tokens, ARIA roles/attributes, keyboard traversal, and both hosts' state-integration logic (covered-area gate, city-change resets, six-state admin availability reset, markEdited/postcodeLookupError parity, empty-part guards) all check out against direct reads of the shipped code and match the plan/progress file's own record. The one BLOCKING item is Finding 1: the Escape-containment mechanism this component is built around (`stopPropagation()` against a React ancestor) does not actually reach the real dismiss mechanism Base UI uses (a native `document`-level listener registered outside React), so Escape-while-the-list-is-open plausibly closes the whole booking dialog instead of just the dropdown — the exact failure class this dimension's brief was written to catch, just running in the direction the plan didn't anticipate. This could not be empirically confirmed live under this dispatch's restrictions (no typing into the address field, no billed API calls, no files other than this report); it rests on a fully-cited trace through Next.js/React/Base UI's actual shipped code.
