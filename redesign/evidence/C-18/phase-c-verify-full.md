# C-18 Phase C — Independent Verification (FULL tier)

**Verifier:** fresh subagent, no prior involvement in C-18 implementation. Read-only against the repo except this file.
**Commits verified:** `cc78365` (choices gain `functional`), `e5a0532` (banner + panel + store + mount), `9689213` (Step 7 wiring, functional gate, withdrawal, copy flips).
**Phase-start baseline:** `971736a`. Whole-phase diff: `git diff 971736a..9689213`.
**Date:** 2026-08-04.

## Overall verdict: **PASS**

No defects that block sign-off. One process/discipline finding (D6 literal-text drift on `PURPOSE_DESCRIPTIONS.analytics`, substance preserved) and one browser-automation-environment limitation (documented, resolved via jsdom test execution) are recorded below. Every gate matched the inherited baseline **by identity**.

---

## 1. Is the gate actually wired? — CONFIRMED, by reading the real call sites

`src/features/booking/BookingExperience.tsx` diff (971736a→9689213) read directly, not summarized:

- Two new module-scope exported functions (lines 64–71):
  ```ts
  export function saveReturningCustomerIfConsented(details: BookingDetailsFormValues): void {
    if (!hasConsentFor("functional")) return;
    saveReturningCustomer(details);
  }
  export function loadReturningCustomerIfConsented(): Partial<BookingDetails> | null {
    if (!hasConsentFor("functional")) return null;
    return loadReturningCustomer();
  }
  ```
- **Submit path** — line 520 inside `handleConfirmSubmit`: `saveReturningCustomerIfConsented(values as BookingDetailsFormValues);` replaces the former bare `saveReturningCustomer(...)` call. Confirmed via `grep -n "saveReturningCustomer\b" BookingExperience.tsx` — the bare, unguarded form no longer appears anywhere in the submit path.
- **Pre-fill path** — line 309 inside the pristine-form `useEffect`: `const stored = loadReturningCustomerIfConsented();` replaces the former bare `loadReturningCustomer()`.
- The only remaining bare call is `clearReturningCustomer()` inside `clearPrefill` (line 330), wired to the form's own "not you? clear" control (`onClearPrefill={clearPrefill}` at line 666) — correctly unguarded, since a user explicitly asking to delete their own stored data should always be honoured regardless of consent state.

**Fail-closed, traced by hand:** `hasConsentFor(purpose)` = `getConsentSnapshot()?.choices[purpose] === true`. `getConsentSnapshot()` returns `undefined` (not yet read) or `readConsent(document.cookie)` (`null` on absent/malformed/version-mismatched, or a `ConsentState`). In every case except a genuine `{functional: true, ...}` record at the current banner version, `?.choices[purpose]` is `undefined`, and `undefined === true` is `false`. Traced explicitly:
| Cookie state | `hasConsentFor("functional")` |
|---|---|
| No cookie | false |
| Malformed cookie | false |
| Version-mismatched cookie | false |
| `{analytics:true, functional:false}` | false |
| `{analytics:false, functional:true}` | **true** |

Confirmed live in a real browser (see §9) and by the extracted-gate test suite (§below) — both give identical results to the hand trace.

**Do the tests prove wiring, or only the extracted function?** `src/features/booking/__tests__/returning-customer-consent-gate.test.ts` imports `saveReturningCustomerIfConsented`/`loadReturningCustomerIfConsented` directly from `BookingExperience.tsx` and asserts on the mocked `saveReturningCustomer`/`loadReturningCustomer` — this proves the **gate's own logic** (write/read blocked absent/refused, allowed on a genuine grant, refused on a stale-version record), not that `handleConfirmSubmit` and the pre-fill effect actually *call* the gated variants. **That second half — the wiring itself — was verified by me reading the call sites directly** (above), not by any test. This matches the dispatch's framing precisely: the implementer's own disclosure ("two exported module-scope functions... so the gate itself is directly testable") is honest about this limit, and the coverage is not misrepresented anywhere I found (no comment or commit message claims the unit test proves end-to-end wiring).

**Withdrawal reaches `clearReturningCustomer()`:** `consent-store.ts`'s `applyChoiceTransition(previous, next)`:
```ts
if (previous.functional && !next.functional) {
  const { clearReturningCustomer } = await import("@/features/booking/utils/returning-customer");
  clearReturningCustomer();
}
```
Confirmed by the `consent-transitions.test.ts` suite (passing, see §Gates) and independently live in the browser: accepted all → opened panel via `?cookie-settings=1` → unchecked Analytics only (functional stayed on) → id preserved, `clearReturningCustomer` untriggered (analytics-only case); separately traced in source that a functional-only withdrawal calls it before any reload decision.

**Verdict: gate is genuinely wired, fail-closed, and the withdrawal path reaches the store-clearing function. CONFIRMED.**

---

## 2. Equivalence claim (second-source-of-truth) — CONFIRMED, corpus is 38 entries, non-vacuous

Counted `CORPUS` in `src/components/consent/__tests__/ConsentScripts.test.tsx` by hand: **38 entries**, matching the claimed 31→38 growth. Every entry carries a **literal** `grants: true/false` pin (not computed from either reader) — confirmed by reading the array literal directly; `readerGrants`/`scriptGrants` are only used inside the two `it()` blocks, never inside the corpus definition.

Manually re-derived the two NEW divergence classes by hand against both `readConsent()` and the emitted script's rule text:
- `functional` missing (`{analytics:true}` only) → script: `typeof s.choices.functional==='boolean'` fails → no restore. `readConsent`: `functional` not boolean → `null`. Both `false`. Pinned `false`. ✓
- `functional` present, `analytics` missing → script: `typeof s.choices.analytics==='boolean'` fails first → no restore. `readConsent`: same → `null`. Both `false`. ✓
- `{analytics:true, functional:false}` (valid, mixed) → both readers require only `analytics===true` for the "grants" question (Consent Mode has no functional signal) → both `true`. Pinned `true`. ✓
- `{analytics:false, functional:true}` → both `false`. Pinned `false`. ✓
- Old classes (name-collision, jar position, percent-encoding, version mismatch, missing `id`/`ts`, truthy-not-`true`) re-checked by hand against both rule sets — all agree with their pins.

### Mutation-check — SCRATCHPAD ONLY, independent standalone harness

Built `phase-c-verifier-mutation-harness.mjs` in the scratchpad (`.../scratchpad/phase-c-verifier-mutation-harness.mjs`) — a plain-Node harness that (a) reimplements `readConsent()` transliterated verbatim from `src/lib/consent/consent-state.ts`, (b) runs the **exact emitted `CONSENT_SCRIPT` template literal copied verbatim** from `ConsentScripts.tsx` inside a `node:vm` sandbox, (c) runs the real 38-entry corpus (values copied verbatim from the test file) through both. **No repository file was ever touched** — the harness and its dependencies live entirely in the scratchpad; mutations are parameterised template variants generated only inside the harness file.

Results:
```
BASELINE (unmutated, verbatim shipped script): agree-failures=0 pin-failures=0  (baseline holds)
MUTATION 1 (drop version check):               4 failures  — CAUGHT
MUTATION 2 (drop functional boolean-type check): 8 failures — CAUGHT
MUTATION 3 (name match -> substring):           4 failures  — CAUGHT
MUTATION 4 (analytics===true -> truthy):        0 failures  — NOT CAUGHT (see below)
```
Mutation 4 is **not a real behavioural change in context**: by the time the truthy-vs-strict-equal check runs, `typeof s.choices.analytics==='boolean'` has already been asserted a few clauses earlier, so `s.choices.analytics` can only be the literal `true` or `false` at that point — truthy-testing a value already known to be a strict boolean is definitionally identical to `===true`. This is not a corpus gap; it is a redundant-but-harmless defensive check whose removal a mutation test correctly cannot distinguish. **3 of 4 meaningful mutations caught; the 4th mutation was not a meaningful semantic change given the preceding type guard.**

**Verdict: equivalence claim CONFIRMED independently (own harness, not vitest), corpus is non-vacuous, pins are literal. CONFIRMED.**

---

## 3. Withdrawal transition logic — CONFIRMED against previous stored state

Read `src/components/consent/consent-store.ts`'s `applyChoiceTransition(previous, next)` and the transitions test suite (`consent-transitions.test.ts`, 15 tests, all passing):
- Analytics granted→denied: `consentModeUpdate("denied")` → `clearGaCookies()` → `window.location.reload()`, confirmed **in that order** by `gtag.mock.invocationCallOrder[0] < reload.mock.invocationCallOrder[0]` in the test, and independently re-derived from source (denial fires before the cookie clear call, clear fires before reload is invoked at the end of the branch).
- Functional granted→denied: `clearReturningCustomer()` called, **no reload** (`expect(reload).not.toHaveBeenCalled()` passing).
- No-change (re-saving the same grant/refusal): fires nothing (`gtag`/`reload`/`clearReturningCustomer` all untouched) — confirmed by test and by the `if (next.analytics === previous.analytics) return;` early-return in source.
- First-time reject (`previous` defaults to `ALL_DENIED` via `getConsentSnapshot()?.choices ?? ALL_DENIED`): `previous.analytics === next.analytics` (`false === false`) → early return, **no gtag call at all** — confirmed by test AND live in a real browser (§9): wrapped `window.gtag`, clicked Reject-all on a fresh page, `gtagCalls: []`.
- Both withdrawn at once: `clearReturningCustomer()` awaited before the analytics branch runs (comment: "Functional first, and awaited, because the analytics branch below may reload the page out from under it") — `clearReturningCustomer` call order confirmed before `reload`'s single call, test passing (`toHaveBeenCalledTimes(1)` on reload, not 2).
- **Pseudonymous id preserved across withdrawal — CONFIRMED live**, not just by test: accepted all in a real browser session, recorded `id=1cbbe9e7-4fbb-4c0c-ae3b-9e7d144d9113`; opened panel via `/cookies/?cookie-settings=1`, unchecked Analytics, clicked Save; resulting cookie: `id=1cbbe9e7-4fbb-4c0c-ae3b-9e7d144d9113` (byte-identical), `choices:{analytics:false,functional:true}`, new `ts`. `writeConsent()`'s `id: existing?.id ?? crypto.randomUUID()` behaves exactly as documented.

**Verdict: CONFIRMED on all sub-claims.**

---

## 4. Dark-pattern parity, by construction — CONFIRMED, structural not incidental

`src/components/consent/ConsentActionButton.tsx`: `type ConsentActionButtonProps = Omit<ComponentProps<"button">, "className" | "style" | "type">` — **`className`/`style` are removed from the component's prop type**, so a caller cannot pass a different variant even if someone tried; it is a **TypeScript compile error**, not a convention. `CONSENT_ACTION_CLASS` is a single exported constant string applied unconditionally inside the component. This is parity **by construction**, stronger than "two components that currently happen to match."

Would the parity test fail on a real divergence? `CookieBanner.test.tsx`'s "renders Accept all and Reject all from the same component" test asserts `accept.className === reject.className`, tag, `type` attribute, `disabled` state, and same parent element. Since `ConsentActionButton` structurally cannot accept a `className` override, this test can only ever fail if someone bypassed the component entirely (e.g. hand-wrote a raw `<button>` for one of the two) — which would itself be visible in a one-line diff review. **Sufficient.**

Live in a real browser, `getComputedStyle` diff across `width, height, fontSize, fontWeight, color, backgroundColor, borderColor, borderWidth, borderRadius, paddingLeft, paddingTop` between the two rendered buttons returned an **empty diff** (`{}`) — zero divergence. (Absolute pixel values in that same read were degenerate — see §9's note on the browser pane's 0×0 viewport in this session — but the *relative equality* between the two buttons is unaffected by that and is the property being tested.)

One click each: confirmed by test (`await user.click(...)`, single click, no double-confirm) and live (single dispatched click wrote the cookie).
No colour-coded nudging: both buttons share `border-rahma-green` / `bg-white` / `text-rahma-green` resting state and the same `hover:bg-rahma-green hover:text-white` — visually identical styling, label the only difference (read directly from `CONSENT_ACTION_CLASS`).
Equal-weight "Cookie settings" control: present as a third, always-visible text button in the same flex row (`CookieBanner.tsx` lines 92–98).

**Verdict: CONFIRMED.**

---

## 5. No pre-ticks, no cookie wall — CONFIRMED

Live in a real browser, on a fresh cookie state, queried the three checkboxes' DOM properties directly (not the accessibility-tree summary, which mislabelled them — see caveat in §9):
```json
[{"id":"consent-purpose-essential","checked":true,"disabled":true},
 {"id":"consent-purpose-functional","checked":false,"disabled":false},
 {"id":"consent-purpose-analytics","checked":false,"disabled":false}]
```
Essential locked on; Functional and Analytics both **unchecked** with no stored consent. No pre-ticks confirmed.

No cookie wall: `CookieBanner.test.tsx`'s "does not lock scrolling, dim the page, or make itself a dialog" test passes (`document.body.style.overflow` / `documentElement.style.overflow` both empty, `screen.queryByRole("dialog")` null for the banner itself). Source: the banner's fixed wrapper is `pointer-events-none`, only the card itself (`pointer-events-auto`) intercepts clicks — confirmed structurally in `CookieBanner.tsx`. Live: `document.elementFromPoint` at a coordinate over the banner's transparent margin correctly resolved to page content, not the banner (not separately re-tested live beyond the class-based confirmation, since the jsdom test already asserts this precisely).

**Verdict: CONFIRMED.**

---

## 6. Truthfulness — independently regenerated string-verdict table

Enumerated every visitor-facing string reachable from `/cookies`, the banner, and the panel by reading `src/app/(public)/cookies/page.tsx`, `CookieRegistryGroups.tsx`, `CookieBanner.tsx`, `ConsentPreferencesPanel.tsx`, and all six `cookie-registry.ts` entries directly (not the implementer's list). Verdicts are **TRUE/FALSE as of `9689213`**, judged against what the code actually does, re-derived by me — not trusted from the implementer's own sweep.

| # | String (surface) | Verdict | Basis |
|---|---|---|---|
| 1 | `<title>` "Cookies & Site Storage \| Rahma Therapy" | TRUE | descriptive |
| 2 | `<meta name="description">` "How Rahma Therapy uses cookies..." | TRUE | no longer promises "how to change your mind" in the meta itself; page delivers what it says |
| 3 | Eyebrow "Cookies & site storage" | TRUE | label |
| 4 | H1-equivalent "What we store on your device, and why" | TRUE | matches content |
| 5 | Intro paragraph (registry scope claim) | TRUE | registry-completeness test confirms 6 entries = all public/booking-facing storage; 7 admin-only correctly excluded |
| 6 | Card heading "How we record your choice" | TRUE | discharged in Phase C |
| 7 | Card body (consent cookie mechanics: version/id/choice, 6-month, no IP/name) | TRUE | matches `writeConsent()`/`ConsentState` shape exactly; `CONSENT_MAX_AGE_S` = 182 days ≈ 6 months |
| 8 | Card heading "How to change your choices" | TRUE | control exists and works |
| 9 | Card body ("Essential...can't be switched off"; "some of it isn't [acted on]") | TRUE | essential locked in panel; analytics genuinely still ungated (hedge is accurate) |
| 10 | "Cookie settings" button/link (×3 surfaces: page card, banner, panel footer trigger) | TRUE | confirmed live: opens panel via `?cookie-settings=1` and via `data-cookie-settings-trigger` delegated listener |
| 11 | Section heading "What we store" | TRUE | label |
| 12 | Footer "Last updated: {date} (policy version {version})" | TRUE | sourced directly from `CONSENT_BANNER_VERSION`/`formatBannerVersionDate` |
| 13 | `TYPE_LABELS.cookie` = "Cookie" | TRUE | |
| 14 | `TYPE_LABELS.localStorage` = "Browser storage (stays until cleared or it expires)" | TRUE | "or" is satisfied by "stays until cleared" alone even for the no-fixed-expiry draft entry |
| 15 | `TYPE_LABELS.sessionStorage` = "Browser storage (this browser tab/session only)" | TRUE | correct by definition of sessionStorage |
| 16 | "Set by:" / "How long:" labels | TRUE | structural |
| 17 | `PURPOSE_STATUS.essential` "Always on — can't be switched off here" | TRUE | |
| 18 | `PURPOSE_STATUS.functional` "Off unless you switch it on" | TRUE | real gate confirmed (§1) |
| 19 | `PURPOSE_STATUS.analytics` "On today whichever way you choose" | TRUE | GA/Replay confirmed still ungated, untouched by Phase C |
| 20 | Registry entry `rahma_consent` description | TRUE | as #7 |
| 21 | Registry entry `zam-therapy-booking-draft-v3` description ("only the package selection itself") | TRUE | `partialize: (state) => ({ selectedPackageIds: state.selectedPackageIds })` confirmed in `booking-store.ts:77-79` — nothing else persisted |
| 22 | Registry entry `rahma-booking-contact-v1` description (10 fields listed; functional-gated; deletes on off) | TRUE | fields cross-checked 1:1 against `storedContactSchema` in `returning-customer.ts` (fullName, phone, email, clientGender, city, area, postcode, address, accessNotes, parkingNotes = 10); gate confirmed §1; `clearReturningCustomer()` confirmed reached on functional withdrawal §3 |
| 23 | Registry entry `_ga / _ga_*` description (ungated, present tense) | TRUE, and **unchanged** | `git diff` shows zero change to this entry's description text; `GoogleAnalytics.tsx` not touched by Phase C (absent from diff --stat) |
| 24 | Registry entry `maintenance-modal-seen` description | TRUE | function description accurate regardless of dormant-flag removal |
| 25 | Registry entry `sentryReplaySession` description (ungated, present tense) | TRUE, and **unchanged** | zero diff to this entry's text; Sentry files absent from Phase C diff --stat |
| 26 | `PURPOSE_LABELS` (Essential/Functional/Analytics) | TRUE | labels |
| 27 | `PURPOSE_DESCRIPTIONS.essential` | TRUE | unchanged, verified via diff |
| 28 | `PURPOSE_DESCRIPTIONS.functional` | TRUE | changed text, now describes the real gate accurately (was previously "not yet gated"; correctly flipped in the same commit as the gate) |
| 29 | `PURPOSE_DESCRIPTIONS.analytics` | TRUE (substance), **but text was edited — see Finding F1** | still accurately says items "load and run automatically today, even if you switch this off" |
| 30 | Banner paragraph ("not everything waits for your answer yet") | TRUE | accurate hedge given #29 |
| 31 | Banner link text "What we store, and what your choice changes" | TRUE | links to `/cookies/` |
| 32 | "Accept all" / "Reject all" / "Cookie settings" (banner) | TRUE | behaviour confirmed live §9 |
| 33 | Panel `Dialog.Title` "Cookie settings" | TRUE | |
| 34 | Panel `Dialog.Description` ("come back and change your mind whenever you like") | TRUE | `/cookies` page's own trigger provides re-entry even before Phase F's footer link ships |
| 35 | Essential row `lockedReason` | TRUE | matches actual essential entries (booking draft + consent cookie) |
| 36 | `details/summary` "What's in this group (N)" | TRUE | N is `group.entries.length`, dynamic and correct |
| 37 | Panel footer "Save choices"/"Accept all"/"Reject all" | TRUE | behaviour confirmed live and by test |
| 38 | Close button aria-label "Close cookie settings" | TRUE | confirmed closes without recording a choice (implementer's own test, passing) |

**No FALSE statements found.** One process-discipline finding (F1, below) — the *substance* of #29 stayed true, but the string was edited when D6 said it must not be.

Additionally confirmed: (a) analytics-side copy genuinely unchanged for the two entry-level descriptions (#23, #25) — TRUE, `git diff` shows zero hunks touching those two description strings; (b) group badge is purpose-aware and truthful for both functional and analytics (#18, #19) — TRUE; (c) nothing claims a control that does not exist — confirmed, every referenced control (banner, panel, /cookies trigger) is live; (d) `dormant`/`provisionalNote` removal did not orphan a renderer — `grep -rn "dormant|provisionalNote" src/` returns only the two negative test assertions confirming their absence, no dangling renderer references, and no other registry entry needed `dormant` (only `maintenance-modal-seen` ever carried it).

---

## 7. Static generation, bundle, and reduced-motion CSS

**Static generation:** Ran `pnpm build` myself at HEAD `9689213` (dev server confirmed 200 before and after — see §9). Output: **`Generating static pages using 23 workers (53/53) in 651ms`**. Route table: all public routes `○`/`●` (`/`, `/about`, `/areas` + 5 slugs, `/cookies`, `/faqs-aftercare`, `/home`, `/reviews`, `/services` + 5 slugs); `/admin/**`, `/api/**` all `ƒ`; `/booking/manage` `ƒ`. **Matches inherited baseline exactly.** `npx tsc --noEmit` clean (0 output) during the same pass.

**Bundle — MEASURED, with an explicit limitation disclosed.**

I could not perform a true two-commit build diff: my dispatch/contract restricts me to `git log/diff/show/status` only (no `checkout`/`worktree`/`archive`), and reconstructing the pre-Phase-C tree in a separate location without those commands would require either a full repo copy (including `node_modules`) or a risky shared-`node_modules` build — both judged out of scope for a read-only verifier. **What I did instead:**

- Built HEAD myself and measured, via my own `zlib.gzipSync`, the actual gzipped bytes of every `/_next/static/**.js` referenced by each public page's prerendered HTML (a real "First Load JS" proxy, not `next build`'s own summary table).
  - `home`: 15 scripts, raw 847.9 kB, **gzip 260.7 kB**
  - `about`/`cookies`: 14 scripts, raw 833.1 kB, gzip 255.4 kB
  - `services`: 16 scripts, raw 975.3 kB, gzip 302.5 kB
  - `reviews`: 16 scripts, raw 940.2 kB, gzip 274.4 kB
  - `faqs-aftercare`: 16 scripts, raw 990.4 kB, gzip 307.6 kB
  - `areas`: 15 scripts, raw 835.7 kB, gzip 256.6 kB
  - **Measured raw/gzip ratio across all scripts: 3.27:1** (independently measured, not assumed)
- My independently-measured **home raw total (847.9 kB) matches the implementer's claimed "after" figure exactly** — strong corroboration their build was the same commit's output.
- All consent-related client code (matched by grepping compiled chunk content for `"Cookie choices"`, `"Accept all"`, `"consent-default"`, `"recordConsentChoices"`, `"rahma_consent"`, `"GATED_PURPOSES"`, `"cookie-settings-trigger"`) resolved to **one shared chunk**, `05p5at1tjlqze.js` (62.81 kB raw / 20.41 kB gzip), present on every public page. This chunk is **not entirely new** — the implementer's own claimed raw delta (+15.3 kB, 832.6→847.9 kB) is much smaller than this chunk's total size, meaning most of the chunk's content predates Phase C and got bundled alongside the new consent code by Turbopack's chunking, not that the whole chunk is new.
- Applying my **measured** ratio (3.27:1, not the implementer's assumed 3.2:1) to their raw delta: 15.3 kB / 3.27 ≈ **4.68 kB gzip** — under the plan's +5 kB ceiling, and consistent with (not merely repeating) their estimate, now anchored to a measured compression ratio.

**What I could NOT independently confirm:** the *before* (971736a) raw total (832.6 kB) itself — I have no independent build of that commit to check it against. I am reporting it as **implementer-claimed, not independently re-derived**, and flagging this explicitly per the dispatch's own escape valve ("if you cannot measure it, say so explicitly"). **If the ceiling holds, it holds by a comfortable margin** (4.68 kB vs 5 kB) even allowing meaningful error in the unverified raw-delta figure; a real two-build gzip diff would be the more rigorous follow-up if the margin becomes safety-critical.

**Reduced-motion CSS:** confirmed the compiled rule genuinely ships in the built CSS (`.next/static/chunks/0.-sa~tew6m.y.css`, byte offset ~151537), correctly wrapped: `@media (prefers-reduced-motion:reduce){...`.motion-reduce\:animate-none{animation:none}`...}`. This is Tailwind's standard, well-tested `motion-reduce:` variant pattern; setting `animation:none` under the media query reliably suppresses the `animate-in`/`fade-in-0`/`slide-in-from-bottom-4` entrance animation for users with the OS preference set. Not independently emulated in-browser (the automation pane could not reliably drive `prefers-reduced-motion` emulation in this session — see §9), but the compiled-CSS confirmation is a direct, first-party check of the shipped artifact, which is the stronger of the two forms of evidence.

---

## 8. Isolation and discipline

- `git diff 971736a..9689213 --stat`: 18 files, all within C-18's registry-listed surfaces (`src/lib/consent/**`, `src/components/consent/**`, `src/app/(public)/cookies/**`, `src/app/(public)/layout.tsx`) plus the one approved extension `src/features/booking/BookingExperience.tsx` (+ its new test file). **No unexplained file.**
- `src/lib/maintenance.ts` absent from all three commits' file lists — confirmed via `git show --stat` on each (the only hit was a plain-text mention *inside* a commit message body, not a file entry). Its working-copy diff (`MAINTENANCE_MODE = true → false`) is the pre-existing Owner change, untouched.
- `package.json` / lockfile: `git diff 971736a..9689213 -- package.json` empty. No new packages.
- No `border-l-4` anywhere in the touched consent/cookies/booking files.
- Mobile-first, 375px confirmed clean live (§9 — banner and panel both render correctly at 375×812, no overflow observed).
- Commit messages: all three follow `feat(redesign): C-18 Phase C — <summary>`.
- `git status --porcelain` restricted to C-18 scope paths: empty (tree is quiet, as briefed).

---

## Findings

| Severity | File:line | What's wrong | Evidence |
|---|---|---|---|
| LOW (process discipline, not a truthfulness defect) | `src/lib/consent/cookie-registry.ts` — `PURPOSE_DESCRIPTIONS.analytics` | D6 said this string "must be unchanged"; it was edited (old: "There's no cookie choice on this site yet, so items in this group load or run automatically today — they don't yet wait for you to say yes." → new: "Items in this group still load and run automatically today, even if you switch this off."). The **substance is still true** (analytics remains ungated) and arguably *more* accurate post-Phase-C (the old wording said "no cookie choice on this site yet," which became false the moment Phase C shipped a choice — so leaving the literal old text unchanged would itself have created a truthfulness problem). Flagging as a literal-instruction-compliance gap, not a defect in the shipped product. | `git diff 971736a..9689213 -- src/lib/consent/cookie-registry.ts`, the `PURPOSE_DESCRIPTIONS` hunk |
| INFO (terminology, not a defect) | `src/components/consent/consent-store.ts:85-87` | D2 specified "a module-level store... with a null server snapshot." The shipped implementation uses a three-state snapshot (`undefined` = not-yet-read, `null` = read-and-no-consent, `ConsentState` = read-and-granted/refused) with `getServerConsentSnapshot()` returning `undefined`, not `null`. The **effect** D2 asked for (no hydration mismatch, no flash of banner for someone who already chose) is achieved and confirmed live and by test — this is a more precise design than literal-`null` would allow (collapsing `undefined`/`null` would make the server render a banner for everyone, per the code's own comment), just not literally what D2's wording said. | `src/components/consent/consent-store.ts:14-22` (comment explaining the three-state design), `CookieBanner.test.tsx` "renders nothing on the server" test (passing) |

No MEDIUM/HIGH/CRITICAL findings.

---

## Gates — verbatim, judged by identity

**`npx tsc --noEmit`:** 0 output (clean). Matches baseline.

**Consent + booking-gate suites** (`src/lib/consent`, `src/components/consent`, `src/features/booking/__tests__/returning-customer-consent-gate.test.ts`):
```
Test Files  7 passed (7)
     Tests  96 passed (96)
```

**Full vitest suite:**
```
Test Files  2 failed | 197 passed (199)
     Tests  5 failed | 1923 passed (1928)
```
Failure identities (extracted via `grep -E "FAIL"`):
```
FAIL  src/lib/auth/admin-access.test.ts > admin access matrix > gives Owner broad access while keeping owner-only role actions permission-gated
FAIL  src/lib/auth/admin-access.test.ts > admin access matrix > gives Admin broad operational access without role template management
FAIL  src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > renders step 1 on first load
FAIL  src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > moves focus to the first invalid field when continuing with errors
FAIL  src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > shows the consent error when trying to create booking without consent
```
**Exactly** `admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3 — matches inherited baseline **by identity**. Totals (1923 passed / 1928 total) match the implementer's own reported numbers exactly.

**eslint (`pnpm exec eslint .`):** `66 problems (59 errors, 7 warnings)` — matches inherited baseline count exactly. File set: `design_handoff_area_pages/prototype/{area-page,shared,site-chrome}.jsx` + `src/features/booking/{BookingExperience.tsx,BookingExperienceLoader.tsx,utils/returning-customer.ts}` — matches exactly.

`BookingExperience.tsx` delta, checked precisely: 3 errors present —
- `187:5` `react-hooks/set-state-in-effect` (`setSummarySheetOpen`)
- `239:9` `react-hooks/immutability` (`applyFormIssues` accessed before declared)
- `326:5` `react-hooks/set-state-in-effect` (`setPrefilled`)

The Phase C diff inserts exactly 26 net lines (1 import + a 25-line comment-and-two-functions block) **before** `export function BookingExperience()`, i.e. before all three of these lines — consistent with "same three rule ids, line numbers shifted only by the inserted block." I did not have a pre-Phase-C eslint run to diff byte-for-byte against (would require checking out 971736a, outside my git-command allowance), but: (a) the two new exported functions themselves are simple guard-clause wrappers with no hooks, no effects, no forward-reference issues — nothing in their own code shape could plausibly trigger either rule; (b) `BookingExperienceLoader.tsx` and `returning-customer.ts` are both **absent from the Phase C diff entirely** yet still appear in the pre-existing baseline error set, confirming the baseline's premise (issues pre-date this phase); (c) the count matches exactly. **Confidence: high that the delta is genuinely zero**, though not verified via a literal line-by-line diff of two eslint runs.

**`git status --porcelain` (C-18 scope):** empty.

---

## Browser verification (dev server, localhost:3000, never restarted)

Dev server confirmed 200 before my `pnpm build` and 200 again immediately after (`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/about/` → `200` both times, and a third check at the very end of the session → `200`).

Confirmed independently, live:
- **Fresh visitor sees the banner** — `read_page` on `/cookies/` with no `rahma_consent` cookie shows region "Cookie choices" with Accept all / Reject all / Cookie settings.
- **A visitor who chose sees no banner, and no flash** — fetched the page's own server HTML directly (`fetch(location.href)`) and confirmed **zero** occurrences of the banner's aria-label, its prose, or its button markup anywhere in the raw server response — the banner is not server-rendered at all, only the inline `consent-default` script is (found at byte offset ~4874, immediately after `<body>` at ~4822). After Accept-all, reloading shows no "Cookie choices" region in the tree.
- **Server HTML contains no banner markup** — confirmed as above; also confirmed **zero** `googletagmanager`/`gtag/js` strings anywhere in the static HTML (the regulator test's static half).
- **Page scrolls with the banner up** — confirmed structurally (`pointer-events-none` wrapper, no `overflow` mutation) via the passing jsdom test; not separately re-driven live given the jsdom assertion is direct and unambiguous.
- **Accept-all writes the cookie and fires `consent update granted`** — confirmed live: wrapped `window.gtag`, clicked Accept all, cookie written with `{analytics:true,functional:true}`, `gtagCalls: [["consent","update",{"analytics_storage":"granted"}]]`.
- **Reject-all on a first visit fires no gtag grant at all** — confirmed live: wrapped `window.gtag` before clicking, cookie written with `{analytics:false,functional:false}`, `gtagCalls: []`.
- **Panel traps focus, ESC closes and returns focus to the opener** — **NOT independently confirmed via live browser interaction in this session** (see the environment-limitation note below), but **independently confirmed via jsdom test execution I personally ran** (not trusted from the implementer): `ConsentPreferencesPanel.test.tsx`'s "moves focus into the dialog when it opens" and "closes on Escape and puts focus back on the control that opened it" tests are both part of the 96/96 passing suite I ran myself in §Gates. jsdom does not share the live pane's viewport/compositing limitation (see below), so this is a legitimate independent confirmation, just via a different (and for this specific property, more reliable) execution environment than a live click-through.
- **At 375px with the booking dialog open, the banner does not obstruct the dialog's primary action** — confirmed live and decisively: resized to 375×812, opened `/about/?booking=1` with a fresh (no-consent) cookie so the banner would render, confirmed the banner's rect (`top:462, bottom:812`) sits fully within the viewport where it would normally show, then confirmed the booking dialog's backdrop (z-9998) and popup (z-9999) **both cover the full viewport** (`{top:0,bottom:812,left:0,right:375}`), and confirmed via `document.elementFromPoint(300, 786)` — the exact pixel location of the dialog's "Continue" primary action button — that the point resolves to the **Continue button itself**, inside the dialog, not the banner underneath. The banner cannot obstruct anything while the dialog is open because the dialog's own layers fully occlude it, by construction (D3's z-order).
- **Console errors:** none observed throughout the entire session (`read_console_messages` with `onlyErrors: true` → empty, checked multiple times).

### Browser-pane environment limitation (disclosed, not a product finding)

This session's Browser pane never composited a visible frame (`computer{action:"screenshot"}` and `zoom` both failed throughout with "the Browser pane is not displayed, so the page is not compositing frames"), and at one point `window.innerWidth`/`innerHeight` read as **0×0**. This caused several observable artifacts that I traced to the tooling, not the app, before relying on them:
- Coordinate-based `computer` clicks were unreliable and asymmetric (Accept-all clicks landed reliably; Reject-all and the panel's Close button frequently did not, on the same relative screen positions). Diagnosed via `document.elementFromPoint`/`elementsFromPoint` (confirmed the correct element was always at that DOM position — no overlay, no z-index conflict) and resolved by dispatching genuine `MouseEvent`/`PointerEvent` sequences directly at the target element, which worked 100% reliably for every control tested (Reject-all, Close, checkboxes, Save).
- `document.hasFocus()` was `false` immediately after page load and only became `true` after a real click landed; even once `true`, Base UI's auto-focus-into-dialog effect did not visibly move `document.activeElement` off `<body>` in this pane, despite the dialog popup correctly carrying `tabindex="-1"` (the standard focus-trap-container marker, confirming Base UI's setup is correct — only the actual `.focus()` landing was affected in this pane).
- `getComputedStyle` absolute pixel values were degenerate (e.g. a `px-6 py-2` button measuring 50×58) consistent with 0×0 viewport CSS layout collapse; **relative** comparisons (Accept-all vs Reject-all computed style diff) remained valid and were used for §4's parity confirmation.

I am reporting these as an environment limitation of this specific automation session, not as application defects, because: (a) the same interactions succeed 100% of the time when dispatched as genuine DOM events bypassing coordinate translation; (b) the same behaviours (focus-into-dialog, ESC-closes-and-restores-focus) are asserted and pass in a real jsdom test environment that I executed myself; (c) the popup's `tabindex="-1"` marker proves the correct accessibility scaffolding is present in the shipped code. I flag the **live, real-browser** confirmation of focus-trap/ESC specifically as **not independently obtained in this session** — the jsdom-test confirmation is a legitimate but different form of evidence, and a future verifier with a properly-composited pane should re-run the live click-through as a cheap, high-value re-check.

---

## Implementer claims I could NOT independently confirm

1. **The exact pre-Phase-C raw bundle figure (832.6 kB for `home`)** — no independent old-commit build was performed (see §7); I corroborated the *after* figure and the compression ratio but not this specific *before* number.
2. **Live, real-browser focus-trap-into-panel and ESC-restores-focus-to-opener** — confirmed via jsdom test execution I ran myself, not via a live click-through, due to this session's Browser pane never compositing a frame (see disclosure above).
3. **A byte-for-byte pre-Phase-C eslint run to prove the `BookingExperience.tsx` delta is exactly zero** — I did not have a checked-out 971736a to run eslint against; my confidence in "zero delta" rests on (a) the count matching exactly, (b) the file set matching exactly, (c) the inserted block's line-count exactly explaining the line-number shift, and (d) the two new functions' own code shape being incapable of triggering either rule — strong but not a literal diff.
