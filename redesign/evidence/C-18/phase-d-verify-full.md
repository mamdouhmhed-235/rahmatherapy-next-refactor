# C-18 Phase D — Independent Verification (FULL tier)

**Verifier:** fresh subagent, no prior involvement in C-18 implementation. Read-only against the repo except this file.
**Commits verified:** `eed2aeb` (GoogleAnalytics consent-gated), `d29958f` (Sentry Replay consent-gated + analytics copy flips).
**Phase-start baseline:** `4c25588`. Whole-phase diff: `git diff 4c25588..d29958f`.
**Date:** 2026-08-04.

## Overall verdict: **PASS**

No defect blocks sign-off. One MEDIUM finding (an untested — but, on independent code-path analysis, not currently exploitable — race window in the `registerReplayGate` inversion) and one LOW/disclosed judgement call (the analytics badge's terseness vs. the admin carve-out) are recorded below. Every gate matched the inherited baseline **by identity**. The regulator test was reproduced live against the Owner's dev server, including the highest-priority check (credential guard beats consent on `/booking/manage`). The Sentry package source citations in the commit message were spot-checked against the pinned `10.51.0` source and are accurate to the line.

---

## Lead item verdicts

### 1. Phase 0 leak fix not regressed — **CONFIRMED, highest-priority check verified live**

- `sentry.client.config.ts`'s `syncSessionReplay(pathname)` checks `isReplayBlockedPath(pathname)` **first**, unconditionally, and returns before the Phase D consent check (`replayRequiresConsent(pathname) && !hasAnalyticsConsent()`) is ever reached. Read directly at `sentry.client.config.ts:132-149`. The blocked-path branch cannot be short-circuited by consent state in either code order or test.
- **Live-reproduced in the browser** (Owner's dev server, `localhost:3000`, never restarted): granted analytics consent via the panel, then did a full navigation directly to `/booking/manage?token=fake-test-token-do-not-use`. Result: `Object.keys(sessionStorage)` → `[]`, `sessionStorage.getItem('sentryReplaySession')` → `null`. No Replay session was created despite consent being granted immediately beforehand.
- Test coverage matches: `src/components/__tests__/SentryProvider.test.tsx` — `"still never starts Replay on /booking/manage when analytics consent IS granted"` (lines 202-213) asserts `addIntegration`/`replayIntegration` never called while `init` still fires. Ran and passed.
- The four Phase 0 capture channels (`beforeSend` gate, `addEventProcessor` URL/Referer redaction, the blocked-path check itself, and the credential guard being independent of consent) are all still present and unchanged by this diff — confirmed via `git diff 4c25588..d29958f -- sentry.client.config.ts`, which shows only additive code (new `ADMIN_PATH`/`replayRequiresConsent`/`hasAnalyticsConsent` + the consent arm inside `syncSessionReplay`); the pre-existing blocked-path logic and `addEventProcessor` block are untouched.

**Verdict: CONFIRMED. No regression.**

### 2. Error monitoring — **CONFIRMED unchanged and ungated**

- `Sentry.init({...})` call (lines 79-88) is **byte-identical** in structure to before Phase D — confirmed by diff: the hunk touches only the imports above it and adds new functions/exports below it; no line inside the `Sentry.init` call is added, removed, or reordered. `dsn`, `beforeSend: scrubSentryEvent`, `tracesSampleRate`, `sendDefaultPii: false`, `enableLogs: true`, `integrations: []` all unchanged.
- Error reporting runs unconditionally at module top level — no consent check gates `Sentry.init` or `Sentry.addEventProcessor`. Confirmed by reading the file and by `SentryProvider.test.tsx`'s `"initialises error reporting with no Replay integration"` and the credential-guard tests, which all assert `sentryMocks.init` fires regardless of consent/route state.
- **`SentryProvider.tsx` needed no change — CONFIRMED.** `git diff 4c25588..d29958f --stat` lists only `src/components/__tests__/SentryProvider.test.tsx`, not `src/components/SentryProvider.tsx`. Read the current file: unchanged 24-line component, still an unconditional `useEffect` calling the dynamic import and `syncSessionReplay(pathname)`. The entire consent arm was folded into `syncSessionReplay()` inside `sentry.client.config.ts`, which `SentryProvider` was already calling on every mount/route change — sufficient, no second call site needed.

**Verdict: CONFIRMED. Error monitoring is untouched and ungated for everyone, exactly as Owner decision 1 requires.**

### 3. The GA gate — **CONFIRMED, reproduced independently and more broadly than claimed**

- Read `src/components/GoogleAnalytics.tsx`: `if (!GA_ID || process.env.NODE_ENV !== "production") return null;` (C-17 semantics, unchanged in meaning) then `if (consent?.choices.analytics !== true) return null;` (the new gate). Both must pass.
- `GoogleAnalytics.test.tsx` (9 tests, ran and passed) covers: env-id-unset (denied regardless of consent), non-production (denied regardless of consent), **consent refused in production with id set** (the plan's named case), no choice recorded, malformed record, superseded banner version, full grant renders both scripts, **in-session grant mounts gtag with no navigation**, and server render emits nothing (`renderToStaticMarkup` → `""`).
- **Independently rebuilt the production bundle myself** with `NEXT_PUBLIC_GA_MEASUREMENT_ID` actually set and grepped every generated HTML file (not just the three the implementer named): `grep -rl "googletagmanager\|gtag/js" .next/server/app --include="*.html"` over all 19 static/SSG HTML outputs → **zero matches, exit code 1**. Specifically confirmed `home.html`, `cookies.html`, `about.html` individually: 0 `googletagmanager`, 0 `gtag/js`, and the `consent-default` inline script IS present (1 occurrence each) with 4 `gtag('consent'` call-sites in its source text (default + conditional restore).
- Build output: `53/53` static pages generated; public routes `○`/`●`; `/admin`, `/api/*`, `/booking/manage` all `ƒ`.
- **Single source of Google code — CONFIRMED.** `grep -rniE "googletagmanager|google-analytics\.com|googlesyndication|doubleclick" src/ sentry.client.config.ts sentry.server.config.ts sentry.edge.config.ts next.config.ts` → only `GoogleAnalytics.tsx:53` and its own test file. A broader `grep -rniE "google" src/` sweep turns up only Google Maps review links and `next/font/google` (build-time self-hosted, no runtime request) — no other analytics-related reference anywhere.
- **Not mounted under `src/app/booking/` — CONFIRMED.** `grep` for any import of `@/components/GoogleAnalytics` across `src/` → exactly one hit, `src/app/(public)/layout.tsx:8`. `src/app/booking/__tests__/no-google-analytics.test.ts` (the recursive C-17 anti-drift guard scanning every `.ts`/`.tsx` under `src/app/booking/` for the string `"GoogleAnalytics"`) ran and passed.
- **Live regulator-test reproduction** (see §6) confirms zero Google-host network requests on the dev server across multiple pages, before and after Reject-all.
- Explicitly dev-only limitation, disclosed: `NODE_ENV !== "production"` on the Owner's dev server, so the GA *mount* arm (granted + production + env → renders) cannot be exercised live there; it is covered only by the jsdom test suite, which I ran.

**Verdict: CONFIRMED, and independently strengthened — I checked all 19 generated HTML files, not just the three cited.**

### 4. `registerReplayGate` inversion — **one MEDIUM finding, not currently exploitable**

Read `src/components/consent/consent-store.ts` and `sentry.client.config.ts` in full, and the module-loading order between them.

- **Registration timing.** `registerReplayGate(syncSessionReplay)` executes as top-level code inside `sentry.client.config.ts` (line ~172), which only ever loads via `SentryProvider.tsx`'s `import("../../sentry.client.config")` inside a `useEffect`. Because ES module evaluation completes (running all top-level code, including the `registerReplayGate` call) **before** the import Promise resolves and `.then()` runs `sentry.syncSessionReplay(pathname)`, registration is guaranteed to happen before the first possible call to `syncSessionReplay` for that page load. Consequence: **Replay can never be running while `replayGate` is still `undefined`**, because the only function that ever starts it (`syncSessionReplay` → `Sentry.addIntegration(Sentry.replayIntegration(...))`) cannot execute before registration does.
- **What happens if a withdrawal fires while `replayGate` is still `undefined`** (a narrow window: before `SentryProvider`'s dynamic import resolves on this page load, or permanently if the chunk never loads — e.g. an ad-blocker or network failure blocking `sentry.client.config`'s chunk, which also has no `.catch()` in `SentryProvider.tsx`): `replayGate?.(window.location.pathname)` **silently no-ops** — no throw, no console warning. **`window.location.reload()` is NOT gated behind this call** — it is a separate statement immediately after, so the reload always fires regardless of registration state. Given the ordering guarantee above, a silently-skipped `stop()` call in this state cannot leave an active recording running, because none could have started yet. **This is genuinely not a "control that lies" today** — but the reasoning is subtle (depends on ES module evaluation ordering as an implicit invariant) and:
  - **No test exercises the unregistered case.** `consent-transitions.test.ts`'s `beforeEach` unconditionally calls `registerReplayGate(replayGate)` (a spy) before every test (line 70), so "withdrawal with no registered gate" is never tested. The code comment's own reasoning ("if it has not loaded there is nothing running to stop", `consent-store.ts:125`) is asserted in a comment but not pinned by any test.
  - A future refactor that let Replay start through any path other than `syncSessionReplay()` (however unlikely under the current architecture) would silently reopen this gap with no test to catch it.
  - **Severity: MEDIUM** (test-coverage gap on a safety-relevant invariant; not a live defect as shipped). Recommend a regression test asserting withdrawal with an unregistered gate still reloads and does not throw.
- **Stale-closure / double-registration hazard: none found.** `replayGate` is read at call time (`applyChoiceTransition` reads the module-level variable directly, not a captured value), so there is no staleness. `import()` is called again on every route change inside `SentryProvider`, but ES module resolution caches the module instance — `registerReplayGate` therefore executes exactly once per page load regardless of how many times the effect re-runs; verified by reasoning through the module graph (no test explicitly pins "called exactly once," but the mechanism cannot double-register by construction).
- **`/admin` and `/booking/manage` scoping.** Neither route mounts `CookieBanner`/`ConsentPreferencesPanel` — confirmed by grep (`CookieBanner|ConsentPreferencesPanel|consent-store` → no matches under `src/app/admin` or `src/app/booking`). So a withdrawal can only ever be *initiated* from a `(public)` page; the scoping question for those two routes is about whether Replay *starts* there (governed by `replayRequiresConsent` excluding `/admin`, and by the blocked-path check excluding `/booking/manage`), which item 1 and the tests above already cover. The withdrawal race itself is not reachable from either route.

**Verdict: no live defect found; one MEDIUM test-coverage gap recorded (finding F1 below).**

### 5. Truthfulness sweep — **CONFIRMED, regenerated independently (table below)**

Diffed every copy-bearing file myself (`git diff 4c25588..d29958f` on `cookie-registry.ts`, `CookieRegistryGroups.tsx`, `page.tsx`, `CookieBanner.tsx`, `ConsentPreferencesPanel.tsx`) and read each file in full at `d29958f`. Exactly **6 visitor-facing strings changed** (matching the implementer's claim): the `_ga`/`_ga_*` description, the `sentryReplaySession` description, `PURPOSE_DESCRIPTIONS.analytics`, the `CookieRegistryGroups.tsx` analytics badge, the `/cookies` "How to change your choices" body paragraph, and the `CookieBanner.tsx` first-layer sentence. Full independently-regenerated verdict table is in its own section below.

**Admin carve-out honesty — judged, not just recorded.** The analytics badge (`"Off unless you switch it on"`) is a two-word-terse summary with no room for the admin exception; the fuller `PURPOSE_DESCRIPTIONS.analytics` text and the `sentryReplaySession` entry's own description — both rendered immediately adjacent to the badge in the same DOM section — both name the exception explicitly. Unlike the Phase A false statements (a heading contradicted by its own card with no qualifying text anywhere nearby), the badge here is not read in true isolation: it sits beside text that qualifies it in the same visual block. **My judgement: acceptable as shipped, not a defect** — but it is a closer call than the rest of the sweep, which is why the implementer flagged it rather than treating it as obviously fine. The `sentryReplaySession` entry's own text does not overclaim; it correctly names the one place the gate does not apply.

**PHASE D OBLIGATION block — CONFIRMED updated, not stale.** `cookie-registry.ts:223-257` now reads "ALL SIX DISCHARGED" with each of the 6 gates and their test files named; no item is left claiming "OPEN (Phase D)".

### 6. The regulator test — **run live myself, full cycle reproduced, PASS**

Ran against the Owner's dev server at `http://localhost:3000` (never restarted, never spawned — attached an existing tab to the running server). Sequence, with my own state captured at each step:

1. **Fresh state, no clicks**, navigated home → about → services (3 pages): `read_network_requests` for the whole session → zero requests to any host containing "google". `sessionStorage` empty, no `_ga*`/`rahma_consent` cookies.
2. **Reject-all** clicked via the banner (no prior consent — a first-visit refusal, not a withdrawal): cookie set to `{analytics:false, functional:false}`, no reload (correct per `consent-transitions.test.ts`'s "refusing on a first visit is not a withdrawal"). Navigated to two more pages (reviews, faqs-aftercare): still zero Google-host requests; banner did not reappear (consent no longer `null`); no `sessionStorage` keys written.
3. **Accept-all** (via `?cookie-settings=1` → panel → Accept all): `gtag('consent','update',{analytics_storage:'granted'})` observed firing (I instrumented `window.gtag` before clicking). Cookie updated to `{analytics:true, functional:true}`. No `sessionStorage` key yet (Replay correctly waits for the next route change, not the grant itself).
4. **Navigated** (full navigation to `/reviews/`): `sentryReplaySession` now present in `sessionStorage`, `sampled:"buffer"` (consistent with `replaysSessionSampleRate: 0.1`). Still zero Google-host requests (expected — dev server is not `NODE_ENV=production`, so the GA mount arm cannot fire regardless of consent; this is a dev-only limitation, not a defect).
5. **Withdrawal**: planted fake `_ga`/`_ga_TESTID` cookies myself, then opened the panel and clicked Reject-all from the granted state. Result: `_ga` and `_ga_TESTID` cookies gone, `sentryReplaySession` gone, `rahma_consent` updated to denied, page reloaded (`document.readyState === "complete"` after the click, URL unchanged), zero console errors, and post-reload zero Google-host requests.
6. **Highest-priority check (item 1)**: re-granted consent, then did a **direct load** of `/booking/manage?token=fake-test-token-do-not-use` — `sessionStorage` stayed empty (`sentryReplaySession` never written) despite consent being granted.

Cleaned up all test-planted cookies/storage on the shared dev server afterward (cleared all cookies except the HMR refresh hash, cleared session/local storage) so the Owner's session is not left in an altered state.

**Explicitly dev-only, disclosed:** the GA *mount* arm (granted + production + env set → gtag actually requested) cannot be exercised on this server since `NODE_ENV !== "production"` there; that arm is covered instead by my own production build (item 3) and the jsdom test suite.

### 7. Sentry `stop()`/flush claims — **spot-checked against the pinned package source, all confirmed exact**

Read `node_modules/.pnpm/@sentry-internal+replay@10.51.0/node_modules/@sentry-internal/replay/build/npm/cjs/index.js` at every cited line:

| Claim | Line | Confirmed |
|---|---|---|
| Public `stop()` calls container `stop({forceFlush: recordingMode==='session'})` | `:10090` | Exact — `this._replay.stop({ forceFlush: this._replay.recordingMode === 'session', reason: 'manual' })` |
| Container `stop()` is `async stop({forceFlush=false,reason}={})` | `:8876` | Exact |
| `_removeListeners()` called | `:8900` | Exact |
| `stopRecording()` called | `:8901` | Exact |
| `_debouncedFlush.cancel()` called | `:8903` | Exact |
| `if (forceFlush) await this._flush({force:true})` | `:8906` | Exact |
| Event buffer destroyed | `:8911` | Exact — `this.eventBuffer?.destroy()` |
| `deleteSession()` removes the `sentryReplaySession` key | `:6076` | Exact — `WINDOW.sessionStorage.removeItem(REPLAY_SESSION_KEY)`; reached via `clearSession()` at `:8916`→`:6068`→`:6076` |
| Mode selection (`buffer` vs `session`) | `:8726` | Exact — `this.recordingMode = this.session.sampled === 'buffer' && this.session.segmentId === 0 ? 'buffer' : 'session'` |
| `visibilitychange` listener registered | `:9329` | Exact |
| `_doChangeToBackgroundTasks` | `:9377` | Exact, and confirmed it calls `void this.conditionalFlush()` |
| `conditionalFlush()` only flushes in session mode | `:9074` | Exact — `if (this.recordingMode === 'buffer') return Promise.resolve();` |

Also read `EventBufferArray.destroy()` (`:5609`) directly: `this.events = []` — pure in-memory discard, **no network call**, confirming "buffer destroyed unsent" is literally true, not an inference.

**Conclusion holds: buffer-mode `stop()` transmits nothing on withdrawal (the ~90% path at `replaysSessionSampleRate: 0.1`); session-mode `stop()` cannot discard what's already buffered, but a reload would trigger the identical `conditionalFlush()` path anyway via `visibilitychange`, so calling `stop()` first transmits no more (and less, since recording halts before the flush) than doing nothing.** Every line-number citation in the commit message checked out exactly as described — no defect found here.

### 8. Isolation and discipline — **CONFIRMED**

- `git diff 4c25588..d29958f --stat`: 12 files, all within C-18's extended files-touched list (`sentry.client.config.ts`, `src/components/GoogleAnalytics.tsx` + its test, `src/components/__tests__/SentryProvider.test.tsx`, `src/lib/consent/{consent-state.ts,cookie-registry.ts}`, `src/components/consent/{consent-store.ts,CookieBanner.tsx,ConsentPreferencesPanel.tsx}` + its test, `src/app/(public)/cookies/{page.tsx,CookieRegistryGroups.tsx}`). No unexpected file.
- **`src/lib/maintenance.ts` absent from both commits** — `git show --stat eed2aeb -- src/lib/maintenance.ts` and `git show --stat d29958f -- src/lib/maintenance.ts` both empty. Not touched by me.
- **Root layout (`src/app/layout.tsx`) untouched** — not in the diff --stat list; read directly, still the pre-C-18 24-line file mounting only `SentryProvider` and children.
- **No new packages** — `git diff 4c25588..d29958f -- package.json pnpm-lock.yaml` empty.
- **No `border-l-4`** anywhere in the touched files — `grep -rn "border-l-4"` over the Phase D file set → no matches.
- Commit format correct on both: `feat(redesign): C-18 Phase D — ...`.
- **`git worktree list` clean** — only the main worktree listed, no stray worktrees.
- **258 pre-existing deletions intact** — `git status --porcelain | grep -c "^ D "` → exactly 258.
- `git status --porcelain` (filtered for anything C-18-adjacent): only `M src/lib/maintenance.ts` (the standing Owner change, expected, untouched by me) plus unrelated pre-existing untracked/deleted noise from other plans (C-19/C-21 evidence, `design_handoff_area_pages/`, `design_handoff_public_pages/` deletions, `.playwright-mcp/` log deletions, `test-results/`) — nothing in C-18's scope is dirty.

---

## Gates — verbatim, by identity

### `npx tsc --noEmit`
```
(no output — 0 errors)
```

### Targeted consent/component/booking suites
`npx vitest run src/lib/consent src/components/consent src/components/__tests__/GoogleAnalytics.test.tsx src/components/__tests__/SentryProvider.test.tsx src/app/booking/__tests__/no-google-analytics.test.ts src/features/booking/__tests__/returning-customer-consent-gate.test.ts`
```
 Test Files  10 passed (10)
      Tests  124 passed (124)
```

### Full vitest
```
 Test Files  2 failed | 197 passed (199)
      Tests  5 failed | 1939 passed (1944)
```
Failing tests, by identity:
```
FAIL src/lib/auth/admin-access.test.ts > admin access matrix > gives Owner broad access while keeping owner-only role actions permission-gated
FAIL src/lib/auth/admin-access.test.ts > admin access matrix > gives Admin broad operational access without role template management
FAIL src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > renders step 1 on first load
FAIL src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > moves focus to the first invalid field when continuing with errors
FAIL src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > shows the consent error when trying to create booking without consent
```
**Identity-exact match to the inherited baseline** (`admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3). Totals (5 failed / 1939 passed / 1944 total) exactly match the implementer's own reported figures.

### `npx eslint .`
```
✖ 66 problems (59 errors, 7 warnings)
```
Files, by identity — exactly:
- `design_handoff_area_pages/prototype/area-page.jsx`
- `design_handoff_area_pages/prototype/shared.jsx`
- `design_handoff_area_pages/prototype/site-chrome.jsx`
- `src/features/booking/BookingExperience.tsx`
- `src/features/booking/BookingExperienceLoader.tsx`
- `src/features/booking/utils/returning-customer.ts`

**Identity-exact match to the inherited baseline.** No new file, no new rule.

### `git status --porcelain` isolation
Confirmed clean for C-18 scope (see item 8 above).

### Build
`npx next build` (no special env): `Compiled successfully`, `Generating static pages using 23 workers (53/53)`. Route table: public routes `○ /`, `○ /_not-found`, `○ /about`, `○ /areas`, `● /areas/[slug]` (5 paths), `○ /cookies`, `○ /faqs-aftercare`, `○ /home`, `○ /reviews`, `○ /services`, `● /services/[slug]` (5 paths); `/admin/**`, `/api/**`, `/booking/manage` all `ƒ`. **Matches inherited baseline exactly.**

---

## Findings

| # | Severity | File:line | What's wrong | Evidence |
|---|---|---|---|---|
| F1 | MEDIUM | `src/components/consent/consent-store.ts:231` (`replayGate?.(window.location.pathname)`) | No test exercises a withdrawal while `replayGate` is still `undefined` (before `SentryProvider`'s dynamic import of `sentry.client.config.ts` resolves, or if that chunk never loads at all — e.g. ad-blocker/network failure, and `SentryProvider.tsx`'s `import(...).then(...)` at line 11 has no `.catch()`). On independent analysis this is not currently exploitable: ES module evaluation order guarantees `registerReplayGate` runs before `syncSessionReplay` can ever be invoked, and `syncSessionReplay` is the only function that can start Replay — so if the gate is unregistered, nothing is running to stop, and `window.location.reload()` fires regardless (it is not gated behind the `replayGate?.()` call). But this correctness argument rests on an implicit cross-module ordering invariant that no test pins, so a future refactor could silently reopen it with nothing to catch it. | `src/components/consent/consent-store.ts:138-143` (registration), `:196-233` (withdrawal), `sentry.client.config.ts:172` (registration call site), `src/components/consent/__tests__/consent-transitions.test.ts:70` (`beforeEach` unconditionally registers the gate, so the unregistered case is never tested) |
| F2 | LOW / disclosed judgement call, not a defect | `src/app/(public)/cookies/CookieRegistryGroups.tsx:23` | The analytics badge "Off unless you switch it on" has no room for the `/admin` carve-out and, read in true isolation, over-claims. In practice it sits directly beside `PURPOSE_DESCRIPTIONS.analytics` and the `sentryReplaySession` entry's own description, both of which name the exception. Judged acceptable as shipped — recorded because the implementer flagged it as a judgement call rather than an obviously-safe choice, and my independent read agrees it is a closer call than the rest of the sweep. | `src/app/(public)/cookies/CookieRegistryGroups.tsx:20-24`, `src/lib/consent/cookie-registry.ts:264,213` |

No HIGH or CRITICAL findings.

---

## Independently regenerated string-verdict table (as of `d29958f`)

Enumerated every visitor-facing string reachable from `/cookies`, the banner, and the panel by reading each file directly (not trusting the implementer's list).

| # | Source | String | Verdict | Note |
|---|---|---|---|---|
| 1 | `page.tsx` `<title>` | "Cookies & Site Storage \| Rahma Therapy" | TRUE | generic, accurate |
| 2 | `page.tsx` meta description | "How Rahma Therapy uses cookies and browser storage on rahmatherapy.uk — what each one is for and how long it lasts." | TRUE | |
| 3 | `page.tsx` eyebrow | "Cookies & site storage" | TRUE | |
| 4 | `page.tsx` title | "What we store on your device, and why" | TRUE | |
| 5 | `page.tsx` intro | "This page lists every cookie and browser-storage item our own code sets ... or that a service we use (such as Google Analytics or Sentry) sets on our behalf..." | TRUE | matches registry contents exactly |
| 6 | `page.tsx` heading | "How we record your choice" | TRUE | matches `rahma_consent` behaviour |
| 7 | `page.tsx` body | "...stores that answer in a small cookie on your device... It stays for six months..." | TRUE | matches `CONSENT_MAX_AGE_S` = 182 days |
| 8 | `page.tsx` heading | "How to change your choices" | TRUE | |
| 9 | `page.tsx` body (**CHANGED Phase D**) | "Everything else has its own switch that is off until you turn it on, and each group below tells you exactly what turning it on or off does." | TRUE | both `functional` and `analytics` are now genuinely gated |
| 10 | `page.tsx`/banner/panel link | "Cookie settings" (button/link labels, ×3 sites) | TRUE (functional) | each opens the panel; confirmed live |
| 11 | `page.tsx` heading | "What we store" | TRUE | |
| 12 | `page.tsx` footer | "Last updated: {date} (policy version {version})" | TRUE | derived from `CONSENT_BANNER_VERSION`, unchanged |
| 13-15 | `CookieRegistryGroups.tsx` `TYPE_LABELS` | "Cookie" / "Browser storage (stays until cleared or it expires)" / "Browser storage (this browser tab/session only)" | TRUE | matches each entry's `type` |
| 16 | `CookieRegistryGroups.tsx` `PURPOSE_STATUS.essential` | "Always on — can't be switched off here" | TRUE | |
| 17 | `CookieRegistryGroups.tsx` `PURPOSE_STATUS.functional` | "Off unless you switch it on" | TRUE | gated since Phase C, confirmed live |
| 18 | `CookieRegistryGroups.tsx` `PURPOSE_STATUS.analytics` (**CHANGED Phase D**) | "Off unless you switch it on" | TRUE on the public site; see finding F2 for the admin-carve-out nuance | gated since Phase D, confirmed live and by test |
| 19-20 | `CookieRegistryGroups.tsx`/`ConsentPreferencesPanel.tsx` | "Set by:" / "How long:" | TRUE (functional labels) | data fields render the registry verbatim |
| 21-23 | `cookie-registry.ts` `PURPOSE_LABELS` | "Essential" / "Functional" / "Analytics" | TRUE | |
| 24 | `PURPOSE_DESCRIPTIONS.essential` | "Needed for a function you specifically asked for..." | TRUE | |
| 25 | `PURPOSE_DESCRIPTIONS.functional` | "...Nothing in this group is stored, or read back, unless you switch it on..." | TRUE | matches `saveReturningCustomerIfConsented`/`loadReturningCustomerIfConsented` gate (Phase C, re-confirmed unaffected by Phase D diff) |
| 26 | `PURPOSE_DESCRIPTIONS.analytics` (**CHANGED Phase D**) | "...Nothing in this group loads or runs on the public site unless you switch it on... Our staff-only admin pages sit outside this choice..." | TRUE | matches both GA and Replay gates; admin exception correctly disclosed |
| 27-30 | `rahma_consent` entry (name/provider/duration/description) | — | TRUE | unchanged by Phase D; behaviour re-confirmed via `consent-state.ts` diff (comment-only change) |
| 31-32 | `zam-therapy-booking-draft-v3` entry (duration/description) | — | TRUE | unchanged by Phase D, not in scope of this phase's code changes |
| 33-34 | `rahma-booking-contact-v1` entry (duration/description) | — | TRUE | gate is in `BookingExperience.tsx`, untouched by Phase D (confirmed absent from diff --stat) |
| 35 | `_ga`/`_ga_*` duration | "Up to 13 months (Google's documented default...)" | TRUE | factual/hedged, unchanged |
| 36 | `_ga`/`_ga_*` description (**CHANGED Phase D**) | "They only appear if you switch Analytics on: until you do, Google Analytics isn't loaded at all and your browser doesn't contact Google... Switch Analytics back off and we delete them." | TRUE, unqualified | GA has **no** admin exception — confirmed `GoogleAnalytics.tsx` is imported nowhere under `/admin`; `clearGaCookies()` runs on withdrawal, confirmed live |
| 37-38 | `maintenance-modal-seen` entry (duration/description) | — | TRUE | unchanged, out of Phase D's scope |
| 39 | `sentryReplaySession` duration | "Session — cleared when you close your browser tab" | TRUE | |
| 40 | `sentryReplaySession` description (**CHANGED Phase D**) | "...It only starts if you switch Analytics on, and switching Analytics back off stops it. The exception is our staff-only admin area, including its sign-in page, which keeps recording for error investigation either way..." | TRUE | matches `replayRequiresConsent()` excluding `/admin` exactly; confirmed live (withdrawal removed the key) |
| 41 | `CookieBanner.tsx` aria-label | "Cookie choices" | TRUE (functional) | |
| 42 | `CookieBanner.tsx` sentence (**CHANGED Phase D**) | "We store a few things on your device to make this site work. Analytics, and remembering your details for next time, wait for your answer." | TRUE | both purposes now genuinely gated; does not over-claim "nothing else runs" |
| 43 | `CookieBanner.tsx` link text | "What we store, and what your choice changes" | TRUE | |
| 44-46 | `CookieBanner.tsx` button labels | "Accept all" / "Reject all" / "Cookie settings" | TRUE (functional) | confirmed live: each does exactly what its label says |
| 47 | `ConsentPreferencesPanel.tsx` `Dialog.Title` | "Cookie settings" | TRUE | |
| 48 | `ConsentPreferencesPanel.tsx` `Dialog.Description` | "Choose what we may store on your device. Every group says what your choice changes for it today..." | TRUE | deliberately defers detail to each group, does not itself over-claim |
| 49 | `ConsentPreferencesPanel.tsx` aria-label | "Close cookie settings" | TRUE (functional) | |
| 50 | `ConsentPreferencesPanel.tsx` `lockedReason` | "Without them the site can't do what you've asked it to do..." | TRUE | |
| 51 | `ConsentPreferencesPanel.tsx` disclosure summary | "What's in this group (N)" | TRUE | dynamic count matches `group.entries.length` |
| 52 | `ConsentPreferencesPanel.tsx` link | "Full details of every item are on our cookies page." | TRUE | |
| 53-54 | `ConsentPreferencesPanel.tsx` button labels | "Save choices" / "Accept all" / "Reject all" | TRUE (functional) | confirmed live |

**Total: 54 distinct strings enumerated (implementer's count was 41 — the difference is my sweep counted every data-label instance, e.g. "Set by:"/"How long:" appearing in both `CookieRegistryGroups.tsx` and `ConsentPreferencesPanel.tsx`, and every button-label occurrence separately, where the implementer's count likely collapsed duplicates). All 54 verdicts: TRUE (6 of them changed by Phase D; 1 — item 18 — is TRUE with a recorded nuance, F2 above). No FALSE statements found.**

---

## Bundle — my own measurement + method audit

**My own gzip measurement (real `zlib.gzipSync`, level 9 — matches the implementer's tool exactly, confirmed by reproducing their published figure to the hundredth of a kB):**

Built `npx next build` at `d29958f` (no special env vars), then summed the real gzip size of every `/_next/static/...` script referenced in the prerendered `home.html` (15 chunk files):

```
TOTAL raw: 849.11 kB
TOTAL gz : 261.19 kB
ratio (raw/gz): 3.251
```

**This EXACTLY matches the implementer's claimed "after" figure of 261.19 kB gzipped**, independently reproduced byte-for-byte via a from-scratch script (not copied from their evidence). I also confirmed the compression level matters: Node's default zlib level (6) gives 261.76 kB for the same input — 0.57 kB higher — so the implementer specifically used max-compression gzip (level 9), which I reproduced exactly.

**Method audit: sound and consistently applied.** Summing the real gzip size of every script a route's prerendered HTML actually references is the right measure of "bytes a fresh visitor's browser downloads for this route" — it is robust to Turbopack's content-hashed chunk splitting changing chunk boundaries between builds (which would make a naive per-chunk diff meaningless), because it totals bytes downloaded rather than diffing individual files.

**Phase C's 4.68 kB — ratio-derived, and I found direct evidence in this same programme that the shortcut is unreliable.** Phase C's own text states its delta as "raw delta ÷ measured ratio" (15.3 kB raw ÷ 3.27 ≈ 4.68 kB gzip), not a true before/after gzip-total difference. I cannot reproduce Phase C's own "before" build myself (checking out `971736a` or earlier is prohibited), but I can test the same ratio-derivation shortcut against **Phase D's own numbers, which I can fully reproduce**: Phase C's commit message states its own raw total was 847.9 kB; my independently-measured Phase D raw total is 849.11 kB, giving a **raw** Phase D delta of 1.21 kB. Applying the ratio-derivation shortcut (1.21 kB ÷ 3.251 ≈ 0.37 kB) would have predicted a ~0.37 kB gzip delta for Phase D — but the **true, doubly-measured** gzip delta (260.68 → 261.19, both real totals) is **0.51 kB**, roughly 38% higher than the ratio-derived estimate. **This is direct, reproducible evidence from within this same phase that the ratio-derivation method can materially understate a true gzip delta** — supporting real caution about whether Phase C's 4.68 kB (and therefore the cumulative ~5.19 kB claimed against the +5 kB ceiling) is trustworthy. It could equally have overstated Phase C's true cost; the point is the method's error is not bounded or predictable from what's available to me, and I have now shown it materially diverges at least once in this programme.

**Phase D's own delta (+0.51 kB) is a true measured difference, not ratio-derived**, and is further corroborated: the Phase C verifier's own independent measurement (progress §3.4, a different agent, different build run) reported "home route 260.7 kB gzip" for the identical commit state the implementer calls Phase D's "before" (260.68 kB) — two independent measurements landing within 0.02 kB of each other. I could not run that build myself (prohibited), but this cross-agent corroboration, combined with my own independently-reproduced "after" figure matching exactly, gives me reasonable confidence the +0.51 kB Phase D delta itself is accurate, even though the cumulative C-18 total resting partly on Phase C's ratio-derived component should not be treated as precise.

**I did not, and per the dispatch's hard rules could not, create a worktree, run `pnpm install`, or check out any commit to establish my own "before" baseline.** This is disclosed, not worked around.

---

## Implementer claims I could NOT independently confirm

1. **"consent, component and booking suites 117/117"** — I ran a differently-scoped (broader) selection of test files and got 124/124 passing; I did not reproduce their exact 117-count file selection, so I cannot confirm the identity of their specific 117 one-for-one. Everything in my broader run passed, which is consistent with — but not identical proof of — their claim.
2. **The exact "before" bundle figure, 260.68 kB gzip, and Phase C's 847.9 kB raw** — I could not rebuild the `4c25588` (or earlier) commit myself (checkout prohibited). I have corroborating evidence (a different agent's independent 260.7 kB gz measurement of the same commit state, recorded in the progress file) but did not measure it myself.
3. **The precise magnitude of any real-world race window for F1** — I established the ordering guarantee analytically (ES module evaluation semantics) and confirmed no test exercises it, but I did not attempt to force the race condition itself in a live browser (this would require artificially delaying the dynamic import or blocking the chunk, which risks destabilizing the shared dev server and is outside what a static/analytical check can respons‑ibly attempt in this environment).
4. **Ad-blocker behaviour specifically** — I did not have an ad-blocker available to test whether it would actually block the `sentry.client.config` chunk in this environment; I reasoned about the consequence (registration never happens, error reporting also never initializes for that visitor) from the code rather than observing it.

---

*End of report.*
