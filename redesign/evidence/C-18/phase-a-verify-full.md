# C-18 Phase A — FULL verification

VERDICT: FAIL

**Repo `master` @ `60114d3`. Commits verified: `6ef68a7` (registry + `/cookies` page) and `60114d3` (accuracy correction). Verifier role: read-only. No writes made anywhere except this file. Git limited to `log`/`diff`/`show`/`status`. No server started/stopped; curled the Owner's warm dev server at `localhost:3000` only.**

Two accuracy defects found in Check 1 that neither evidence file supports and that source-code inspection actively contradicts. This is a public legal statement about what the site stores in a visitor's browser; both defects overstate the visitor-friendliness of what actually happens. That is enough to fail this tier on its own stated purpose ("is the page TRUE"), independent of the otherwise-clean gates in Checks 4–6.

---

## CHECK 1 — is the page TRUE? (per-entry truth table)

| Entry | Field | Registry claim (`src/lib/consent/cookie-registry.ts`) | Evidence says | Verdict |
|---|---|---|---|---|
| `zam-therapy-booking-draft-v3` | name/provider/type | `Rahma Therapy`, `localStorage` | source `:25`, browser checkpoint 3a — matches exactly | TRUE |
| | purpose | `essential` | source §2 reasoning: defensible, e-commerce-cart analogue | TRUE, defensible (see Check 2) |
| | **duration** | *"No fixed expiry — cleared automatically when your booking is submitted, or you can clear it yourself..."* (`cookie-registry.ts:97-98`) | Source doc's own duration column says only: *"No expiry set... survives indefinitely until `resetDraft()` clears it or the user clears browser storage"* — it makes **no** claim about automatic clearing on submit. | **FALSE.** Verified against source, not just evidence: `resetDraft()` (`booking-store.ts:72`) is called from exactly one place, `startOver()` at `BookingExperience.tsx:522-523`, wired to `onStartOver` on `SuccessScreen` (`BookingExperience.tsx:689`), which fires only when the visitor clicks **"Start a new request"** (`SuccessScreen.tsx:105-111`). The successful-submit handler itself (`BookingExperience.tsx:480-508`) calls `submitBookingRequest`, `saveReturningCustomer`, and transitions to the success step — it never calls `resetDraft()`. A visitor who submits and simply closes the dialog (the ordinary case) keeps this localStorage key, with their selected package IDs, sitting on their device — not cleared "automatically when your booking is submitted." grep confirms `resetDraft`/`clearPackages` have no other call sites. |
| | description | Names the specific function (in-progress package selection) | Matches source §2 reasoning | TRUE |
| `rahma-booking-contact-v1` | name/provider/type | `Rahma Therapy`, `localStorage` | matches | TRUE |
| | purpose | `functional`, with `provisionalNote` | Owner has not ruled (progress §1); matches source's "contested" framing exactly | TRUE, correctly NOT promoted to essential (see Check 2) |
| | duration | "180 days, or until you clear it" | `returning-customer.ts:8` `MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000`; clear via user action (`clearReturningCustomer`) or auto-expiry on next read | TRUE |
| | write-only-on-success | "**After you complete a booking**, stores your name, phone number, email and address..." | Browser evidence §2: confirmed NOT written mid-form or at unsubmitted Confirm step, consistent with write only firing at `BookingExperience.tsx:494` after `submitBookingRequest` resolves | TRUE — correctly conveys a visitor who abandons the form never receives it |
| | **field list** | "your name, phone number, email and address" | `returning-customer.ts:10-21` (`storedContactSchema`) stores 9 fields beyond timestamp: `fullName, phone, email, clientGender, city, area, postcode, address, accessNotes, parkingNotes`; source evidence table lists the same 9 fields explicitly as "directly PII-adjacent" | **Understated.** The description omits `clientGender`, `accessNotes`, and `parkingNotes` entirely — three fields not covered even loosely by "address." `accessNotes`/`parkingNotes` are freeform text a visitor could use to describe access needs; on a legal disclosure page for a health-services site, omitting them from "what we store" is a real gap, not a paraphrase. |
| `_ga` / `_ga_*` | provider/type/purpose | `Google (Google Analytics 4)`, `cookie`, `analytics` | matches source | TRUE |
| | duration | "Up to 13 months (Google's documented default for this cookie family; this site does not set a custom expiry)" | Source doc §1 + §4 item 4: "commonly documented as ~13 months... **not verified here**"; browser doc §4: "remain outstanding — only a production check settles them" (GA cannot load on a dev server, confirmed absent from local `.env`) | **Soft finding, not a hard fail.** The registry attributes the figure to Google rather than presenting it as this site's observed behaviour, which is a reasonable hedge — but it drops the evidence's explicit "not independently verified" caveat. A visitor reading "Google's documented default" would reasonably assume someone checked; no one has, on this domain, in production. Recommend adding an explicit unverified note, but this is not on the same level as the two findings above. |
| `maintenance-modal-seen` | all fields | `sessionStorage`, `essential`, `dormant: true`, description names the specific function | Source: dormant since `MAINTENANCE_MODE = false`; browser pass confirms it never appeared at any checkpoint, settling source's own open item §6.7 | TRUE |
| `sentryReplaySession` | provider | "Sentry (Functional Software, Inc.)" | Not stated in either evidence file (well-known public fact, low risk, but technically an unsourced addition) | Minor / unverified-by-evidence, low materiality |
| | type/purpose | `sessionStorage`, `analytics` | matches Owner decision (progress §3 #1: "not essential... consent-gate it"); `analytics` bucket is an implementer choice within that decision, reasonable given only 3 buckets exist and the stated rationale ("same purpose as GA") is recorded in-file | TRUE / reasonable |
| | duration | "Session — cleared when you close your browser tab" | matches | TRUE |
| | **"Every visit is recorded... about 10% of visits are sent automatically, and any visit where an error occurs is sent too"** | This is the corrected sentence from `60114d3`. | Browser evidence §2: "the sessionStorage write itself is unconditional on every page load... only the *content* (full recording vs. error-triggered buffering) depends on the sample outcome" — two fresh loads observed, one `sampled:"buffer"` (the 90% case, `replaysOnErrorSampleRate: 1.0`), one `sampled:"session"` (the 10% case, continuously uploaded) | **TRUE and a genuine improvement over the string it replaced** ("About 10% of visits are recorded" — confirmed absent from the live page, see Check 6). "Recorded" correctly describes rrweb's continuous buffer-mode capture (which is what makes error-triggered retroactive send possible at all), separately from "sent," which is accurately described as conditional. Not misleading in either direction on the evidence available. |
| | scope (public/admin vs `/booking/manage`) | Code comment (not the visitor-facing sentence) correctly states Replay "reaches (public) and /admin, not /booking/manage" per the `09b2e26` fix, browser-confirmed at cookie-inventory-browser.md §3 Scenario A | Matches | TRUE (comment only; the visitor-facing description doesn't scope itself, but the `/cookies` page is reached from `(public)` pages where Replay does run, so this isn't materially misleading) |
| | **"Only starts once you accept analytics cookies."** | End-state copy, explicitly marked false-today by a `PHASE D DEPENDENCY` comment | Confirmed independently: `grep -n "consent" sentry.client.config.ts src/components/SentryProvider.tsx` → zero matches. No gating exists. Replay starts unconditionally for every visitor today. | **Registry is honest about this being false-today** (self-flagged, not a silent lie) — see Check 3 for whether the guard around it actually works. |

**Nothing in either evidence file is missing from the registry**, and the registry's 5 entries exactly match the 5 visitor-facing items in `cookie-inventory-source.md` §1 (confirmed by `registry-completeness.test.ts`'s bidirectional parity tests, see Check 5). The Sentry tunnel network request noted in the browser evidence (§2, "newly discovered") correctly is **not** added as a registry entry — it sets no cookies and isn't a storage mechanism, matching the evidence document's own conclusion.

---

## CHECK 2 — "essential" classifications, judged on merits

- **`zam-therapy-booking-draft-v3` — essential.** Survives scrutiny. It persists only `selectedPackageIds` (enforced by `partialize`, `booking-store.ts:77-79`, browser-confirmed at checkpoint 3a: raw value was exactly `{"state":{"selectedPackageIds":[...]},"version":0}`), and exists to prevent losing an in-progress selection the visitor is actively making. This is the same shape as an e-commerce cart cookie, which PECR/ICO guidance treats as strictly necessary. Legitimate essential classification. (The duration-field inaccuracy found in Check 1 does not change this — the classification itself is sound, only the copy describing when it clears is wrong.)
- **`maintenance-modal-seen` — essential.** Survives scrutiny. A one-time-per-session dismiss flag with no personal data, gating a single interstitial the visitor has already seen. Standard strictly-necessary UX pattern; currently dormant (`MAINTENANCE_MODE = false`, confirmed unmodified per rules).
- **`rahma-booking-contact-v1` — confirmed classified `functional`, NOT essential.** `cookie-registry.ts:109` sets `purpose: "functional"`; `provisionalNote` at `:113-114` is present, non-empty, and explicitly states the Owner has not ruled. `registry-completeness.test.ts:83-88` pins both facts (`purpose === "functional"` and `provisionalNote` truthy) and passed. Not quietly promoted to essential — correct.

---

## CHECK 3 — the Phase D pin

Read both tests (`registry-completeness.test.ts:110-141`).

- **Test 1 ("sanity check")**: `expect(registrySource).toContain(PHASE_D_CLAIM)` — exact substring match against `"Only starts once you accept analytics cookies."`.
- **Test 2 ("keeps the marker")**: `expect(registrySource.includes(PHASE_D_MARKER)).toBe(true)` — exact substring match against `"PHASE D DEPENDENCY"`.

**(a) Marker deleted, claim intact** — caught. Test 2 fails unconditionally if the marker string disappears, regardless of the claim.
**(b) Claim reworded so the guard no longer matches** — caught by Test 1: any change to the exact claim sentence (including a well-intentioned rewrite to present-tense-honest copy) makes the substring match fail, forcing a human to touch this test file and reconsider. Verified independently that `sentry.client.config.ts` and `SentryProvider.tsx` currently contain **zero** references to "consent" (`grep -n "consent"` on both files → no matches), confirming the claim is false today exactly as the marker admits, and that neither companion test does anything beyond string-matching this one file.
**(c) Phase D never shipping at all** — **not caught, and this is the real gap.** Both tests only assert that two literal strings coexist inside `cookie-registry.ts`. Neither test reads `SentryProvider.tsx`, `sentry.client.config.ts`, or any other file to confirm gating actually exists. If Phase A (already merged) ships to production and the programme later pauses, descopes, or indefinitely defers Phases B–D — a realistic outcome for a 7-phase, multi-session plan — nothing in this test suite would ever fail. The marker and the claim would sit untouched in the file, `registry-completeness.test.ts` would stay green forever, and the live `/cookies` page would keep telling visitors Replay "only starts once you accept analytics cookies" while it in fact starts for everyone, indefinitely. The pin only guards against *edits to this one file*; it does nothing to verify the state of the world the file is making a claim about. This is exactly the risk the dispatch asked me to judge honestly, and the answer is: nothing would stop it.

---

## CHECK 4 — single source of truth

- `groupRegistryByPurpose()` (`cookie-registry.ts:212-221`) is the only grouping path. Its only non-test caller is `CookieRegistryGroups.tsx:69` (confirmed via `grep -rn "groupRegistryByPurpose"` — the only other hits are the definition itself and the test file).
- `page.tsx` contains **zero** literal cookie names/durations/descriptions — it imports only `CONSENT_BANNER_VERSION` and `formatBannerVersionDate` for the "last updated" line (`page.tsx:3,79-81`) and delegates all per-entry rendering to `<CookieRegistryGroups />`. `CookieRegistryGroups.tsx` renders exclusively from `groupRegistryByPurpose()`'s output — no separately maintained list exists anywhere (confirmed by grepping both files for `oklch(` and `border-l-4` — zero hits — and for any hardcoded entry-name string — none found outside the registry file and its test).
- `?cookie-settings=1` seam: `page.tsx:16-24` documents it in a code comment (mirrors `BookingExperienceLoader`'s pattern for the future panel: URL param watch + `[data-cookie-settings-trigger="true"]` event delegation) and the "Change your choices" button (`page.tsx:61-67`) is a plain relative-href `<a>` — clicking it just appends the query string to the current URL with no error and no dead link. Honest no-op, consistent with Phase C not existing yet.

---

## CHECK 5 — the completeness test

20 tests, all read (`registry-completeness.test.ts`), all passing (`npx vitest run src/lib/consent/__tests__/registry-completeness.test.ts` → 1 file, 20/20 passed).

- **Bidirectional parity confirmed.** `"every inventoried item has a registry entry"` (`:38-43`) catches under-registration; `"has no registry entry beyond the inventoried set (symmetric check)"` (`:45-53`) independently catches over-registration; `"has exactly the 5 visitor-facing entries"` (`:34-36`) is a third, count-based cross-check. All three would independently fail under a mutation that adds an unauthorized entry or silently drops one.
- **Non-circular, genuinely transcribed.** `INVENTORY_NAMES` (`:22-28`) is a literal array hardcoded in the test file — not imported from `cookie-registry.ts` — and the file's header comment (`:1-9`) cites `cookie-inventory-source.md §1` as its source. Compared name-for-name against that document's table: `zam-therapy-booking-draft-v3`, `rahma-booking-contact-v1`, `` `_ga` / `_ga_*` ``, `maintenance-modal-seen`, `sentryReplaySession` — exact match. Because the reference list is a separate literal in the test file rather than derived from the registry under test, a mutation to the registry's names would produce a real mismatch, not a tautology.
- Other coverage worth noting: required-field non-emptiness + enum validity (`:60-69`), an "essential description names a function" length heuristic (`:71-81`, self-acknowledged as weak but reasonable), the `rahma-booking-contact-v1` provisional-note pin, the `maintenance-modal-seen` dormant pin, the `sentryReplaySession`/`_ga` purpose pins, banner-version format + value pins, `formatBannerVersionDate` behaviour, and `groupRegistryByPurpose` ordering/labels. All read; all defensible; none are vacuous.

---

## CHECK 6 — gates and rendering

**`git show --stat` (both commits, combined):** exactly the four assigned files —
```
6ef68a7: src/app/(public)/cookies/CookieRegistryGroups.tsx (new)
         src/app/(public)/cookies/page.tsx (new)
         src/lib/consent/__tests__/registry-completeness.test.ts (new)
         src/lib/consent/cookie-registry.ts (new)
60114d3: src/lib/consent/__tests__/registry-completeness.test.ts (edit)
         src/lib/consent/cookie-registry.ts (edit)
```
No other file appears in either commit.

**Untouched, confirmed:** `sentry.client.config.ts`, `src/components/SentryProvider.tsx`, `src/components/GoogleAnalytics.tsx`, `src/app/(public)/layout.tsx`, `src/components/layout/SiteFooter.tsx`, root `src/app/layout.tsx`, `src/app/admin/**`, `src/middleware.ts`, build configs, `wrangler.jsonc` — none appear in either commit's diff. `git status --porcelain` on this exact file set shows only `M src/lib/maintenance.ts`, which is the pre-existing Owner-owned uncommitted change noted in the rules — not part of either C-18 commit, correctly out of scope.

**Live page:** `curl -s -L -o ... http://localhost:3000/cookies` → `HTTP_STATUS:200`. Grepped the response body: all five entry names present (`zam-therapy-booking-draft-v3`, `rahma-booking-contact-v1`, `_ga`, `maintenance-modal-seen`, `sentryReplaySession`), all three purpose-group labels present (`Essential`, `Functional`, `Analytics`), the corrected sentence `"Every visit is recorded"` present, and the old string `"About 10% of visits are recorded"` — zero matches (confirmed gone).

**`npx tsc --noEmit`** → 0 errors (no output).

**`npx vitest run`** (full suite) → tail:
```
Test Files  2 failed | 191 passed (193)
     Tests  5 failed | 1847 passed (1852)
```
Failures, by identity: `src/lib/auth/admin-access.test.ts` ×2 (`gives Owner broad access...`, `gives Admin broad operational access...`) + `src/app/admin/bookings/new/ManualBookingForm.test.tsx` ×3 (`renders step 1 on first load`, `moves focus to the first invalid field...`, `shows the consent error...`) — exactly the inherited baseline set, no new failures, no swapped failures. `registry-completeness.test.ts` run in isolation: 1 file, 20/20 passed.

**`npx eslint .`** → `66 problems (59 errors, 7 warnings)` — matches baseline count. File-by-file: `design_handoff_area_pages/prototype/area-page.jsx`, `.../shared.jsx`, `.../site-chrome.jsx` + `src/features/booking/BookingExperience.tsx`, `.../BookingExperienceLoader.tsx`, `.../utils/returning-customer.ts` — exactly the six baseline files; none of the four C-18 Phase A files appear.

**Style:** no `border-l-4`, no hardcoded `oklch(...)` in any of the four files (grepped directly). Responsive classes (`sm:`) used throughout; `SectionContainer`/`SectionHeading` are established shared components used across `about`, `area-pages`, `faqs-aftercare`, etc. (confirmed via `grep -rl "SectionContainer" src/`), so the page matches the existing `(public)` design pattern rather than inventing a new one.

---

## Summary of findings

**Fail-causing (Check 1):**
1. `zam-therapy-booking-draft-v3`'s duration text ("cleared automatically when your booking is submitted") is false — `resetDraft()` only fires from the visitor-initiated "Start a new request" action, never from the submit-success path. Neither evidence file supports this claim; source code contradicts it directly.
2. `rahma-booking-contact-v1`'s description omits 3 of the 9 fields the code actually stores (`clientGender`, `accessNotes`, `parkingNotes`) — understates what's collected on a legal disclosure page for a health-services site.

**Worth having, not independently fatal:**
3. The `_ga`/`_ga_*` 13-month duration is phrased with more confidence than the evidence's explicit "not verified here" caveat supports (soft finding).
4. The Phase D dependency pin (Check 3) only verifies that two strings coexist in one file — it has no mechanism to detect Phase D being permanently descoped after Phase A ships. If that happens, the page would keep stating a false claim with a fully green test suite.

**Everything else** — the two essential classifications, the `functional` non-promotion of `rahma-booking-contact-v1`, the Replay "every visit is recorded" rewrite, single-source-of-truth architecture, completeness-test bidirectional parity and non-circularity, and all static/gate checks — verified clean.
