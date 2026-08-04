# C-17 Phase B (Steps 4–5) — FULL verification

**Commit verified:** `e545f38` — "feat(redesign): C-17 Phase B — booking_request_submitted conversion event"
**Repo/branch:** `master` @ HEAD `e545f38`. Verifier is read-only; git limited to `log`/`diff`/`show`/`status`.

---

## VERDICT: PASS

**Lead finding (Check 1):** A single real booking **cannot** produce two `booking_request_submitted` events under the code as committed. `SuccessScreen` is rendered under a **stable React key (`"success"`, a hardcoded literal, not derived from booking id)** inside `AnimatePresence`/`MotionStep` at `src/features/booking/BookingExperience.tsx:684-692`. As long as `currentStep === "success"`, that key never changes, so React never unmounts/remounts the `SuccessScreen` instance (and therefore never resets `trackedSubmissionRef`) merely because `BookingExperience` or `SuccessScreen` itself re-renders (e.g. `copied` toggling, `navDirection` changing, parent state updates). I traced every mechanism the brief's check asked about — `AnimatePresence`'s `mode="wait"`, the `useReducedMotion()` branch inside `MotionStep`, ancestor keys/Suspense/route transitions, resize, and session/URL/storage restoration of the "success" step — and found no live path that recreates the `SuccessScreen` instance while the same completed booking is on screen. Details and evidence below. This is a genuinely fragile invariant (a future change that keys `MotionStep`/`SuccessScreen` by booking id, or reintroduces a real unmount+remount, would silently double-count), but as shipped it holds.

---

## CHECK 1 — fire-once claim vs AnimatePresence remount

**Render site:** `src/features/booking/BookingExperience.tsx:684-692`
```
684  {currentStep === "success" && (
685    <MotionStep key="success" direction={navDirection}>
686      <SuccessScreen
687        bookingId={submittedBookingId}
688        manageUrl={submittedManageUrl}
689        onStartOver={startOver}
690      />
691    </MotionStep>
692  )}
```
`key="success"` is a **literal constant**, not `` `success-${bookingId}` `` or similar. React's reconciliation only tears down and recreates a component instance (and its `useRef`s) when (a) the element disappears from the tree, (b) its `key` changes, or (c) its element *type* at that position changes. None of those happen while `currentStep` stays `"success"`.

1. **`AnimatePresence mode="wait"` (`BookingExperience.tsx:620`):** `mode="wait"` only affects the *transition* between different keyed children (e.g. `"confirm"` exiting before `"success"` enters) — it does not re-trigger while the *same* keyed child (`"success"`) remains current. No exit/enter cycle occurs for an already-mounted, still-current key.

2. **`useReducedMotion()` branch inside `MotionStep` (`src/features/booking/components/MotionStep.tsx:19-23`):**
   ```
   19  const shouldReduceMotion = useReducedMotion();
   20
   21  if (shouldReduceMotion) {
   22    return <div>{children}</div>;
   23  }
   ```
   This *looks* like a live hazard — a `div` vs `motion.div` branch is a different element type, and if it flipped mid-display it would tear down `children` (i.e. `SuccessScreen`) and remount it with a fresh ref. I checked framer-motion's actual implementation (`node_modules/.pnpm/framer-motion@12.38.0.../dist/es/utils/reduced-motion/use-reduced-motion.mjs:32-45`):
   ```
   32  function useReducedMotion() {
   36      !hasReducedMotionListener.current && initPrefersReducedMotion();
   37      const [shouldReduceMotion] = useState(prefersReducedMotion.current);
   43      /** TODO See if people miss automatically updating shouldReduceMotion setting */
   44      return shouldReduceMotion;
   45  }
   ```
   This is a **lazy `useState` initializer with no effect/listener** — the library's own TODO comment confirms it does *not* live-update after mount. So toggling OS-level "reduce motion" (or the browser's devtools emulation) while the success screen is showing has **no effect** on the already-mounted `MotionStep` instance for `key="success"`; the branch was decided once, at that instance's first render, and cannot flip later. This closes the specific hazard the check asked about.

3. **Ancestor key / Suspense / route transition:** `BookingExperienceLoader.tsx` gates the whole feature behind a one-way `shouldLoad` boolean (`useState(false)` flipped to `true` once, never back to `false` — `BookingExperienceLoader.tsx:23,30,53`), so `BookingExperience` itself mounts exactly once per page life and is never remounted by an ancestor. No Suspense boundary wraps this subtree. There is no client-side route change involved — the booking flow is a dialog overlay, not a page navigation.

4. **Window resize:** grepped `src/features/booking/**` for `matchMedia|innerWidth|resize|useMediaQuery` — no hits (only an unrelated `resize: vertical` CSS rule in `BookingExperience.module.css:796`). Resizing the viewport cannot alter this tree's shape.

5. **Dialog close/reopen while stuck on "success":** `Dialog.Root open={open}` (`BookingDialog.tsx:57`) unmounts its `Portal`/`Popup` content when `open` is false (no `keepMounted` prop anywhere in this codebase — confirmed by grep). If the user closes the dialog from the success screen, the whole `SuccessScreen` genuinely unmounts (end of that flow, not a spurious double). Reopening is the only path back in, and **every** customer-facing trigger goes through the single click handler in `useBookingUrlState.ts:47-77`, which does:
   ```
   69  setOpen(true);
   70  if (currentStep === "success") {
   71    setCurrentStep("service");
   72  }
   ```
   `setOpen`/`setCurrentStep` are called synchronously in the same handler and batch into one React update, so `Dialog.Root` never re-mounts its content tree with `currentStep` still `"success"` — the step is already `"service"` by the time content remounts. I grepped every `data-booking-trigger="true"` usage across `src/` (23 call sites) and confirmed none bypasses this handler; there is no separate `Dialog.Trigger` wired to this dialog (`BookingDialog.tsx` has no `Dialog.Trigger`).

**Session-level semantics** (does a *new* `SuccessScreen` mount ever happen without a *new* submission?):
- `currentStep` lives in the Zustand `booking-store.ts`, whose `persist.partialize` only persists `selectedPackageIds` (`store/booking-store.ts:76-79`) — `currentStep` is **not** persisted, so a page reload always starts at `"service"`, never resurrects `"success"`.
- The URL sync (`useBookingUrlState.ts:79-95`) uses `window.history.replaceState`, not `pushState` — there is no history entry per step, so browser Back/Forward cannot step through `"success"`.
- `BOOKING_STEPS` (`types.ts:11-16`) excludes `"success"` entirely, and `goBackToStep`/`goBack` in `BookingExperience.tsx` are index-bounded against that array — there is no UI back-action that lands on `"success"`.
- Net: the only path to `currentStep === "success"` is a fresh, successful `handleConfirmSubmit()` → `submitBookingRequest()` (`BookingExperience.tsx:480-508`). The implementer's "one event per real submission" claim is correct, and I found no deep-link, storage-restore, or back-navigation path that reaches a new mount without a new submission.

**Conclusion:** not a blocking finding. The ref guard itself would do nothing against a genuine remount (a fresh instance gets a fresh `false` ref) — the reason fire-once holds is that no genuine remount path exists while `currentStep === "success"`, not the ref alone. This distinction is worth carrying forward as a standing invariant to protect (see Check 5 coverage gap).

---

## CHECK 2 — no payload, no PII

`src/features/booking/components/SuccessScreen.tsx:26-33`:
```
26  useEffect(() => {
27    if (trackedSubmissionRef.current) return;
28    trackedSubmissionRef.current = true;
29    (window as { gtag?: (...args: unknown[]) => void }).gtag?.(
30      "event",
31      "booking_request_submitted"
32    );
33  }, []);
```
Exactly two arguments to `gtag(...)` — `"event"` and `"booking_request_submitted"`. No third options object. The effect body references only `trackedSubmissionRef` and `window`/`gtag` — no `bookingId`, `manageUrl`, `email`, `name`, `service`, `price`, or `postcode` (the component's own props `bookingId`/`manageUrl` are used elsewhere in the render, e.g. lines 58-61, 72-97, but never inside this effect). Matches brief §2.4 ("No PII in the payload — event name only").

Test assertion (`SuccessScreen.test.tsx:26`): `expect(gtag).toHaveBeenCalledWith("event", "booking_request_submitted");`. Vitest's `toHaveBeenCalledWith` (Jest-compatible) does a deep-equal match against the *actual* recorded arguments array — a third argument on the real call would make the recorded args array length 3 vs the expected length 2, failing the assertion. Confirmed exact-args by design, not just by name-matching.

---

## CHECK 3 — ad-blocker path (zero console errors)

Optional chaining is on the **call**, not just the property read: `.gtag?.("event", ...)`. Reading `window.gtag` when `gtag` is `undefined` cannot throw (plain property access on `window`); calling `undefined?.(...)` short-circuits to `undefined` without invoking anything. The cast `(window as { gtag?: ... })` is TypeScript-only and has zero runtime effect. The only other statements in the effect are the `if (trackedSubmissionRef.current) return;` guard and the `trackedSubmissionRef.current = true;` assignment — both are plain synchronous ref operations that cannot throw. No other expression in the effect body touches `gtag` or any external API. `SuccessScreen.test.tsx:37-49` exercises this directly (`gtag` left `undefined`, asserts the render `not.toThrow()`), and it passed under `npx vitest run` (see Check 6 output). Confirmed: this path cannot break a live booking's confirmation screen.

---

## CHECK 4 — nothing else about the success screen changed

Full diff for `SuccessScreen.tsx` (via `git show e545f38`):
```
@@ -1,6 +1,6 @@
 "use client";

-import { useRef, useState } from "react";
+import { useEffect, useRef, useState } from "react";
 ...
@@ -16,6 +16,21 @@ export function SuccessScreen({
 }) {
   const [copied, setCopied] = useState(false);
   const copiedTimerRef = useRef<number | null>(null);
+  const trackedSubmissionRef = useRef(false);
+
+  useEffect(() => { ... }, []);
```
Only the import line and the new ref + effect block were added — nothing else changed. No edits to rendering, copy, `success-heading` (`SuccessScreen.tsx:55`, untouched), `tabIndex={-1}` (same line, untouched), focus management, animation behaviour, or the pre-existing `copied` state/`copyManageUrl` logic (`SuccessScreen.tsx:35-48`, byte-identical to the previous version per the diff hunk boundaries — the diff shows no `@@` hunk touching those lines). The effect's deps array is `[]` (empty), confirmed at `SuccessScreen.tsx:33` — it cannot re-run when `copied` toggles or on any other re-render; it runs exactly once per mount (subject to the StrictMode double-invoke discussed in Check 5).

---

## CHECK 5 — the test

`src/features/booking/components/SuccessScreen.test.tsx` (74 lines, new file) covers all three required cases:
1. **gtag present → exactly one call** (`it("calls window.gtag once...")`, lines 20-33): asserts `toHaveBeenCalledTimes(1)` and the exact args.
2. **gtag absent → no throw** (`it("does not throw when gtag is absent...")`, lines 35-49): asserts `window.gtag` is `undefined`, then asserts the render call `not.toThrow()`.
3. **StrictMode double-mount → still one** (`it("nets exactly one event under StrictMode's dev double-mount")`, lines 51-73): genuinely renders `<StrictMode><Dialog.Root open><SuccessScreen .../></Dialog.Root></StrictMode>` (source read directly, `import { StrictMode } from "react"` at line 1, used at line 63) and asserts `toHaveBeenCalledTimes(1)`.

**Would tests pass with the guard removed?** Reasoned from source, not executed (removing the guard would require editing `SuccessScreen.tsx`, out of scope for a read-only verifier — I did not modify source to test this). Test 1 (single non-StrictMode render) and Test 2 (no-throw) are guard-independent and would pass either way. Test 3 is the one that depends on the guard: React's StrictMode dev double-invoke runs `setup → cleanup → setup` on the **same component instance** (refs are not reset between the synthetic cleanup and the second setup — this is why a `useRef` guard, not a `useState` guard, is the correct pattern here), so without `trackedSubmissionRef`, the second `setup` invocation would call `gtag` again, and `toHaveBeenCalledTimes(1)` would report 2, failing. This matches the implementer's stated "called 2 times" observation. I verified this by reading framer-react's/React's documented StrictMode effect semantics and the test's actual StrictMode usage, not by executing a guard-removed variant.

**Does any test cover the AnimatePresence remount scenario from Check 1?** **No** — none of the three tests render `SuccessScreen` inside `MotionStep`/`AnimatePresence`, and none simulates a genuine unmount+remount (a brand-new component instance, as opposed to StrictMode's same-instance double-invoke). This is a **coverage gap**, not a blocking defect given the Check 1 source analysis found no live path to a genuine remount — but it means a future regression (e.g. someone parametrizing the `MotionStep`/`SuccessScreen` key by `bookingId`, or wrapping it in something that changes element type conditionally) would not be caught by this test suite. Worth flagging to the owner as a follow-up, not required by this plan's Step 5 wording (which only asked for the three cases actually present).

---

## CHECK 6 — scope and gates

**`git show e545f38 --stat`:**
```
 .../booking/components/SuccessScreen.test.tsx      | 74 ++++++++++++++++++++++
 src/features/booking/components/SuccessScreen.tsx  | 17 ++++-
 2 files changed, 90 insertions(+), 1 deletion(-)
```
Exactly two files, both inside `src/features/booking/components/`. Confirmed untouched via `git diff e545f38^ e545f38 --stat -- src/app .env.example middleware.ts wrangler.jsonc src/lib/maintenance.ts` → empty output. Also confirmed via direct search: `src/components/GoogleAnalytics.tsx` and both layouts exist but were not modified by this commit (not in the stat list); `src/lib/maintenance.ts` is untouched by the commit (its pre-existing uncommitted working-tree modification, visible in `git status`, is the standing Owner-owned change and is unrelated to `e545f38`).

**No Zone-2 action:** this is a pure code diff; no env var change, no deploy, no `wrangler` invocation appears in or was triggered by the commit.

**Style rules:** `git show e545f38 | grep -n "border-l-4\|oklch("` → no output (neither pattern present in the diff). `prefers-reduced-motion` handling is untouched (Check 1, item 2) — the pre-existing `MotionStep` behaviour is unaffected by this commit. Style (comment format, effect shape) matches the file's existing conventions.

**`npx tsc --noEmit`** → clean, 0 errors (no output).

**`npx vitest run`** → tail:
```
Test Files  2 failed | 188 passed (190)
     Tests  5 failed | 1818 passed (1823)
```
Failing tests by identity:
```
FAIL  src/lib/auth/admin-access.test.ts > admin access matrix > gives Owner broad access while keeping owner-only role actions permission-gated
FAIL  src/lib/auth/admin-access.test.ts > admin access matrix > gives Admin broad operational access without role template management
FAIL  src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > renders step 1 on first load
FAIL  src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > moves focus to the first invalid field when continuing with errors
FAIL  src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > shows the consent error when trying to create booking without consent
```
Matches the inherited baseline exactly by identity (`admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3), no swapped-in new failure. Isolated run of the new spec (`npx vitest run src/features/booking/components/SuccessScreen.test.tsx`) → `Test Files 1 passed (1)` / `Tests 3 passed (3)`.

**`npx eslint .`** → `✖ 66 problems (59 errors, 7 warnings)`. File list with errors/warnings (via grep on the output):
```
design_handoff_area_pages\prototype\area-page.jsx
design_handoff_area_pages\prototype\shared.jsx
design_handoff_area_pages\prototype\site-chrome.jsx
src\features\booking\BookingExperience.tsx
src\features\booking\BookingExperienceLoader.tsx
src\features\booking\utils\returning-customer.ts
```
Exactly the six files named in the inherited baseline (`design_handoff_area_pages/prototype/*.jsx` ×3 + `src/features/booking/*` ×3). Count (59/7) matches the baseline exactly. `SuccessScreen.tsx` and `SuccessScreen.test.tsx` produce **no** lint errors — confirming no new entries were introduced by this commit, and none of the six pre-existing entries were touched/"fixed" (their line numbers and messages are unchanged from the known baseline set: `react-hooks/set-state-in-effect` ×3, `react-hooks/immutability` ×1 in `BookingExperience.tsx`/`BookingExperienceLoader.tsx`, plus the `design_handoff_area_pages` prototype `react/jsx-no-undef` errors).

---

## Summary

All six checks ran to completion; no check was skipped or assumed. The commit is scoped exactly to its two declared files, introduces no new lint/type/test failures by identity, carries no PII, cannot throw when GA is blocked, and — per a full source-level trace of `AnimatePresence`/`MotionStep`/`useReducedMotion`/routing/storage — cannot double-fire for a single real booking under the current render tree. The one non-blocking item worth carrying forward: no test exercises a genuine component-remount scenario for `SuccessScreen`, so the fire-once invariant is currently protected by source-level reasoning (this review) rather than a regression test.
