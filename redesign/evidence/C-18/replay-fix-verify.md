# C-18 Replay credential-leak fix — verification

VERDICT: PASS

Commit verified: `09b2e26577b37b816c336bb2913728c150dbd3e1` (HEAD, branch `master`).
Files touched (confirmed via `git show 09b2e26 --stat`): exactly
`sentry.client.config.ts`, `src/components/SentryProvider.tsx`,
`src/components/__tests__/SentryProvider.test.tsx`.
Sentry packages inspected at the pinned installed version: `@sentry/core`,
`@sentry/browser`, `@sentry/react`, `@sentry/nextjs`, `@sentry-internal/replay`
all resolve to **10.51.0** in `node_modules/.pnpm`.

---

## CHECK 1 — `integrations: []` keeps error reporting (the load-bearing claim)

Confirmed true, traced through the full call chain at v10.51.0:

1. `node_modules/.pnpm/@sentry+core@10.51.0/.../build/esm/integration.js:36-59`
   (`getIntegrationsToSetup`): when `userIntegrations` is an array (`[]`
   qualifies — `Array.isArray([])` is `true`), line 49-50 does
   `integrations = [...defaultIntegrations, ...userIntegrations]`. An empty
   user array is a no-op merge, not a replacement. Replacement only happens
   in the `typeof userIntegrations === 'function'` branch (line 51-53), which
   is not what this code does.
2. `@sentry/browser` client init
   (`.../@sentry+browser@10.51.0/.../build/npm/esm/prod/sdk.js:84-101`):
   `defaultIntegrations = options.defaultIntegrations == null ? getDefaultIntegrations() : options.defaultIntegrations`.
   `getDefaultIntegrations()` (same file, lines 16-36) returns 11 integrations
   — `inboundFiltersIntegration`, `functionToStringIntegration`,
   `conversationIdIntegration`, `browserApiErrorsIntegration`,
   `breadcrumbsIntegration`, `globalHandlersIntegration`,
   `linkedErrorsIntegration`, `dedupeIntegration`, `httpContextIntegration`,
   `cultureContextIntegration`, `browserSessionIntegration`. Replay is **not**
   in this list — it was never a browser default, confirming the implementer's
   claim.
3. `@sentry/nextjs` client init
   (`.../@sentry+nextjs@10.51.0_.../build/esm/client/index.js:68-73,114-143`):
   builds `opts = { environment, defaultIntegrations: getDefaultIntegrations(options), release, ...options }`.
   Its own `getDefaultIntegrations` (line 114-143) appends
   `browserTracingIntegration()` and
   `nextjsClientStackFrameNormalizationIntegration(...)` to the browser
   defaults — again, no Replay. Because `...options` is spread *after*
   `defaultIntegrations` and `sentry.client.config.ts`'s `Sentry.init({...})`
   call never sets a `defaultIntegrations` key, this computed default list
   survives untouched into `opts`.
4. `@sentry/react` init
   (`.../@sentry+react@10.51.0_.../build/esm/sdk.js:8-16`) is a pure
   passthrough (`{...options}`) to `@sentry/browser`'s `init`.
5. Result: `@sentry/browser`'s `init` receives `defaultIntegrations` =
   (11 browser defaults + tracing + nextjs frame normalization) and
   `options.integrations = []`, merges them per step 1, and installs the
   full default set with zero omissions. No `defaultIntegrations: false` or
   equivalent kill-switch appears anywhere in the diff or in this chain.

**Conclusion: `integrations: []` is provably a no-op on error reporting.**
Every default error-reporting integration (global error/promise-rejection
handlers, breadcrumbs, dedupe, linked errors, HTTP context, browser session,
tracing) stays installed. Only Replay — which required an explicit
`Sentry.replayIntegration()` call that no longer appears in `Sentry.init`
— is removed. This is the single most important thing this fix could have
gotten wrong, and it did not.

Unchanged `Sentry.init` options, confirmed from the diff hunk context
(`sentry.client.config.ts:38-47`, only the `integrations` line changed):
`dsn: process.env.NEXT_PUBLIC_SENTRY_DSN`, `sendDefaultPii: false`,
`tracesSampleRate`, `replaysSessionSampleRate: 0.1`,
`replaysOnErrorSampleRate: 1.0`, `enableLogs: true`,
`beforeSend: scrubSentryEvent` — all present, all untouched.

---

## CHECK 2 — the four URL channels

**Channel 1 — `replay_event.urls[]`.** `sentry.client.config.ts:54-71`
registers `Sentry.addEventProcessor((event) => { if (event.type !== "replay_event") return event; ... })`
unconditionally at module top level, immediately after `Sentry.init`.
Traced the reach:
- `Sentry.addEventProcessor` (`@sentry/core` `exports.js:251-253`) calls
  `getIsolationScope().addEventProcessor(callback)` — writes to the
  **isolation scope**.
- Replay's `sendReplayRequest` builds `baseEvent = { type: REPLAY_EVENT_NAME, urls, ... }`
  (`@sentry-internal/replay/.../build/npm/esm/index.js:8231-8243`, and
  `REPLAY_EVENT_NAME = 'replay_event'` at line 11) and calls
  `prepareReplayEvent({ scope, client, replayId, event: baseEvent })`.
- `prepareReplayEvent` (same file, lines 8148-8200) calls
  `prepareEvent(client.getOptions(), event, eventHint, scope, client, getIsolationScope())`
  — explicitly passing the isolation scope through.
- `prepareEvent` (`@sentry/core` `utils/prepareEvent.js:69-94`) does
  `data = getCombinedScopeData(isolationScope, finalScope)` and
  `eventProcessors = [...clientEventProcessors, ...data.eventProcessors]`,
  then runs them via `notifyEventProcessors`.
- `getCombinedScopeData` (`@sentry/core` `utils/scopeData.js:102-107`) merges
  the isolation scope's data (including its event processors) into the
  result. **This is exactly where the registered callback re-enters the
  pipeline.**

Confirmed reachable and correctly gated on `event.type === "replay_event"`.

**Channel 2 — `replay_event.request.url` + `request.headers.Referer`.**
`httpContextIntegration.preprocessEvent`
(`@sentry+browser@10.51.0/.../integrations/httpcontext.js:8-28`) sets
`event.request = { ...reqData, ...event.request, headers }` where
`reqData = getHttpRequestData()`
(`.../helpers.js:160-176`) returns `{ url: getLocationHref(), headers: { Referer: document.referrer, 'User-Agent': ... } }`
— i.e. the *current* `window.location.href` verbatim, on every event this
integration preprocesses. `prepareReplayEvent` calls
`client.emit('preprocessEvent', event, eventHint)` (line 8165) **before**
`prepareEvent` runs the event processors, so the order is: raw URL/Referer
written in → custom processor redacts it. `sentry.client.config.ts:62-68`
redacts both `request.url` and `request.headers.Referer` via the same
`redactBlockedUrl`. This channel was correctly identified as not covered by
the original investigation doc and is now closed.

**Channel 3 — custom recording frames (`performanceSpan`, navigation
breadcrumb).** Confirmed both halves:
- Gate: `maybeApplyCallback(event, callback)`
  (`@sentry-internal/replay/.../index.js:6412-6427`) only invokes
  `beforeAddRecordingEvent` `if (typeof callback === 'function' && isCustomEvent(event))`,
  and `isCustomEvent` (line 6286-6288) is `event.type === EventType.Custom`.
- Both frame types are indeed `EventType.Custom`: breadcrumbs via
  `addBreadcrumbEvent` (line 4593-4617, `data: { tag: 'breadcrumb', payload: normalize(breadcrumb, ...) }`)
  and history/navigation spans via `createPerformanceSpans`
  (line 6843-6866, `data: { tag: 'performanceSpan', payload: { op: type, description: name, ... } }`)
  fed by `handleHistory` (line 6868-6882, `type: 'navigation.push', name: to`
  where `to` is the `history.pushState` target — i.e. the URL being
  navigated to, written synchronously on the push, before any React effect
  runs).
- Drop semantics: in `_addEvent` (line 6328-6359), if
  `maybeApplyCallback` returns a falsy value (the implementation's callback
  returns `null` when `JSON.stringify(event.data).includes(REPLAY_BLOCKED_PATH)`),
  the function does a bare `return;` at line 6355-6357 — `eventBuffer.addEvent(...)`
  is never called, so the frame never enters the buffer. Genuinely dropped,
  not just marked.

**Channel 4 — `Meta.data.href` (no hook, session-mode-vs-buffer-mode
argument).** This is the subtlest claim and I verified both halves
independently:
- `Meta` events are only emitted from `takeFullSnapshot`
  (`@sentry-internal/replay/.../index.js:4276-4290`,
  `type: EventType.Meta, data: { href: window.location.href, ... }`).
- Whether a *further* full snapshot fires depends on `checkoutEveryNms`,
  passed into `record()` in `startRecording()` (lines 8811-8848). For
  session mode, `checkoutEveryNms` is only set if
  `this._options._experiments.continuousCheckout` is truthy (line
  8828-8832); the integration's default is `_experiments = {}` (line
  9910), so `continuousCheckout` is `undefined` and `checkoutEveryNms` is
  never set in session mode — **no periodic full snapshot, no further
  `Meta` event, after the initial one taken on the previous (non-blocked)
  page.** Confirmed.
- For buffer mode, `checkoutEveryNms: BUFFER_CHECKOUT_TIME` (= `60000`, line
  27) **is** always set — so buffer mode genuinely can produce a `Meta`
  event carrying the manage-page URL if the user stays on the page >60s
  before an error occurs. The claim's second half is that this is rendered
  moot by `stop()`. Confirmed: `syncSessionReplay`'s `void replay?.stop()`
  calls the **public** `ReplayApi.stop()`
  (`.../index.js:10088-10094`), which computes
  `forceFlush: this._replay.recordingMode === 'session'` — i.e. `false` in
  buffer mode. The internal `stop({forceFlush = false, reason})`
  (lines 8874-8918) only calls `await this._flush({force: true})` (line
  8904-8906) `if (forceFlush)`; when `false`, that branch is skipped
  entirely and it proceeds straight to `this.eventBuffer?.destroy(); this.eventBuffer = null;`
  (lines 8908-8910) — the buffer, and anything in it, is discarded without
  ever being sent. Both halves of the claim check out exactly as described.

Note for the record: in **session** mode, the public `stop()` computes
`forceFlush: true`, which is what the code comment in
`sentry.client.config.ts:87-89` refers to as "stop() force-flushes in
session mode" — this is precisely why channels 1-3 need to be closed
independently (a session-mode stop on entering `/booking/manage` does send
whatever is in the current recording), and I confirmed above that they are.

---

## CHECK 3 — guard coverage

- **Direct load, no resumption.** Replay's `afterAllSetup(client)`
  (`.../index.js:10045-10056`) is what calls `this._setup(client)` and
  `this._initialize(client)` (session sampling / sticky-session resumption
  lives inside `_initialize`, line 10151-10158). `afterAllSetup` only runs
  via `afterSetupIntegrations`, which only runs for integrations passed to
  `Sentry.init` or added via `client.addIntegration`
  (`@sentry/core` `client.js:456-469`, confirms `addIntegration` also
  triggers `afterSetupIntegrations` for newly-added integrations). On a
  direct load of `/booking/manage`, `isReplayBlockedPath` is true and
  `syncSessionReplay` returns after `replay?.stop()` **without ever calling
  `Sentry.addIntegration`** — so the Replay integration object is never
  constructed, `afterAllSetup`/`_initialize` never run, and sticky-session
  resumption from `sessionStorage` (key `sentryReplaySession`, line 10)
  genuinely cannot occur. Confirmed.
- **Stale-route guard.** `SentryProvider.tsx`'s `isCurrentRoute` closure is
  a standard effect-cleanup guard: each `useEffect` run (keyed on
  `[pathname]`) owns its own `isCurrentRoute` binding, set `false` by that
  run's cleanup when `pathname` changes or the component unmounts. Since
  `import("../../sentry.client.config")` only takes real wall-clock time on
  the very first load (subsequent imports hit the module cache), the guard's
  only live risk window is a fast navigation into `/booking/manage` during
  that first import. Traced through: the stale effect's `.then()` checks
  `if (isCurrentRoute)` — false by then — and skips calling
  `syncSessionReplay(pathname)` with the now-stale, non-blocked pathname,
  which would otherwise have called `Sentry.addIntegration(replayIntegration())`
  unconditionally for a route the user already left. This is exactly the
  failure mode the guard exists to prevent, and the mechanism holds up.
- **Disclosed residual (SPA path).** `maskAllText = true, maskAllInputs = true, blockAllMedia = true`
  are confirmed as the Replay integration's actual defaults
  (`.../index.js:9911-9913`), and the fix does not override them. The
  characterisation — some DOM-mutation frames from `/booking/manage` may be
  captured in the brief window between navigation and `stop()` landing, but
  masked/blocked by these defaults — is accurate. It is a real, honestly
  disclosed, and genuinely unavoidable-after-the-fact residual (the URL/token
  itself is separately covered by channels 1-4 above; this residual is about
  incidental masked DOM content, not the token).
- **No in-app link.** `grep -rn "/booking/manage" src/` finds no `<Link>`,
  `router.push`, or other client-side navigation target — only
  `revalidatePath("/booking/manage")` ×3 in
  `src/app/booking/manage/actions.ts` (server actions, not navigation) and
  `getSiteUrl()}/booking/manage?token=...` in `src/lib/booking/manage-token.ts:31`
  (used for outbound email links only). Confirmed. One honest observation
  beyond what was asked: given no in-app link exists, the "client-side
  navigation" scenario the fix defends against is, today, reachable mainly
  via browser back/forward (popstate, which Next's router intercepts) after
  a user has had `/booking/manage` open in the same tab — not via any
  current in-app affordance. That doesn't weaken the fix; it's still the
  correct defense-in-depth for that path and for any future in-app link.

---

## CHECK 4 — error reporting on the blocked route

`src/app/layout.tsx:6,68` renders `<SentryProvider />` unconditionally in
the ROOT layout (confirmed untouched by this commit — see Check 6), so
`sentry.client.config.ts`'s module-level `Sentry.init(...)` runs on every
route including `/booking/manage`; `isReplayBlockedPath` only gates
`syncSessionReplay`'s Replay-specific behaviour, never the `Sentry.init`
call itself. The test `"never starts Replay on a direct load of
/booking/manage"` (`SentryProvider.test.tsx:156-163`) asserts
`sentryMocks.init` was called exactly once on that route. Not vacuous:
`vi.resetModules()` (line 44, inside `renderProviderAt`) forces the config
module to re-evaluate for this test, so the assertion is exercising a real
first-time module load triggered by the provider's dynamic import, not a
leftover call count from an earlier test.

---

## CHECK 5 — tests and sabotage

Ran the new suite directly: `npx vitest run src/components/__tests__/SentryProvider.test.tsx`
→ **7 passed (7)**. Full suite baseline reported below in Check 6.

Read all 7 tests (`src/components/__tests__/SentryProvider.test.tsx`) and
reasoned through each reported sabotage (I did not apply the sabotage
myself — verifier is read-only outside the one output file — but the logic
traces cleanly against the test code and the source under test):

1. **Disabling the route check** (making `syncSessionReplay` ignore
   `isReplayBlockedPath`) → the two tests that depend on the guard actually
   firing would fail: `"never starts Replay on a direct load of
   /booking/manage"` (addIntegration/replayIntegration would now be called)
   and `"stops a running Replay when a client-side navigation enters
   /booking/manage"` (`runningReplay.stop` would never be called). Matches
   the reported 2 failures.
2. **Restoring `replayIntegration()` in `Sentry.init`** → traced 4 distinct
   assertions that would break: (a) `"initialises error reporting with no
   Replay integration"` — `options.integrations` no longer `[]`,
   `replayIntegration` now called during init; (b) `"never starts Replay on
   a direct load"` — `replayIntegration` now called even on the blocked
   route, since `Sentry.init` runs unconditionally; (c) `"starts Replay on a
   public route"` — `replayIntegration` would be called twice (once in
   init, once in `syncSessionReplay`), failing `toHaveBeenCalledTimes(1)`;
   (d) `"drops recording frames that reference the manage route"` — it reads
   `sentryMocks.replayIntegration.mock.calls[0][0]` to get
   `beforeAddRecordingEvent`, but call index `0` would now be the
   argument-less init-time call, so destructuring `beforeAddRecordingEvent`
   off `undefined` would throw. Matches the reported 4 failures exactly.
3. **`redactBlockedUrl` as passthrough** → only
   `"redacts the token from replay_event URLs..."` asserts on redacted
   content (`expect(JSON.stringify(replayEvent)).not.toContain("SECRET-TOKEN")`
   would fail first); no other test touches this function. Matches the
   reported single failure and the reported failure message shape.

All three sabotage outcomes are consistent with the actual test bodies and
the actual implementation logic.

**Coverage gap, disclosed honestly:** channel 4 (`Meta.data.href` /
`checkoutEveryNms` defaults / buffer-mode `stop({forceFlush:false})`
destroying the buffer unsent) is **not exercised by any of the 7 tests** —
`@sentry/nextjs` is fully mocked (`vi.mock("@sentry/nextjs", () => sentryMocks)`),
so nothing in this suite touches real `@sentry-internal/replay` checkout
timing or buffer-destroy behaviour. That channel's safety currently rests
entirely on the *installed* Sentry SDK's default options (`_experiments = {}`,
`BUFFER_CHECKOUT_TIME = 60000`, `ReplayApi.stop()`'s
`forceFlush: recordingMode === 'session'`) continuing to behave as observed
at v10.51.0, verified above via direct package-source inspection, with no
regression test to catch a future SDK upgrade changing those defaults. This
doesn't block the fix — the fix is correct against the code as it exists
today, and I found nothing to suggest imminent change — but it is a real,
unpinned residual worth naming.

---

## CHECK 6 — scope and gates

- `git show 09b2e26 --stat`: exactly `sentry.client.config.ts`,
  `src/components/SentryProvider.tsx`,
  `src/components/__tests__/SentryProvider.test.tsx`. **`src/app/layout.tsx`
  is untouched** (confirmed not in the diff; confirmed it already renders
  `<SentryProvider />` unconditionally, so no change was needed there).
- Confirmed untouched (`git status --short` on the exact paths, and absent
  from the commit's file list): `src/components/GoogleAnalytics.tsx`,
  `(public)/layout.tsx`, `src/app/admin/**`, middleware, `next.config.ts`,
  `wrangler.jsonc`. `src/lib/maintenance.ts` shows as modified in the
  working tree, but that is the pre-existing Owner-owned uncommitted change
  called out in the dispatch — it is not part of commit `09b2e26` (confirmed
  absent from `git show --stat`) and I did not touch it.
- `npx tsc --noEmit` → **0 errors.**
- `npx vitest run` → **5 failed, 1827 passed** (192 test files, 190 passed /
  2 failed). Failing tests by identity:
  `src/lib/auth/admin-access.test.ts` > "gives Owner broad access while
  keeping owner-only role actions permission-gated",
  `src/lib/auth/admin-access.test.ts` > "gives Admin broad operational
  access without role template management",
  `src/app/admin/bookings/new/ManualBookingForm.test.tsx` > "renders step 1
  on first load", "moves focus to the first invalid field when continuing
  with errors", "shows the consent error when trying to create booking
  without consent" — exactly `admin-access.test.ts` ×2 +
  `ManualBookingForm.test.tsx` ×3, matching the inherited baseline by
  identity. No new failures, no swapped failures.
- `npx eslint .` → **66 problems (59 errors, 7 warnings)**, confirmed via
  JSON output to span exactly six files:
  `design_handoff_area_pages/prototype/area-page.jsx`,
  `design_handoff_area_pages/prototype/shared.jsx`,
  `design_handoff_area_pages/prototype/site-chrome.jsx`,
  `src/features/booking/BookingExperience.tsx`,
  `src/features/booking/BookingExperienceLoader.tsx`,
  `src/features/booking/utils/returning-customer.ts`. Matches the inherited
  baseline (59 errors / 7 warnings, same six files) by identity.
- `npx next build` → clean, no build errors. Public routes retain their
  expected rendering mode — `/`, `/about`, `/areas`, `/faqs-aftercare`,
  `/home`, `/reviews`, `/services` are `○ (Static)`; `/areas/[slug]` and
  `/services/[slug]` are `● (SSG)`; none of these deopted to `ƒ (Dynamic)`.
  `/booking/manage` is `ƒ (Dynamic)`, consistent with it already depending
  on a runtime `searchParams` token (`src/app/booking/manage/page.tsx:18,46`)
  independent of this fix. **No prerender deopt from `usePathname()` in the
  root layout's client component was observed.**

  One discrepancy I want to flag honestly rather than paper over: the build
  output lists **53** route entries, not the 52 stated in the inherited
  baseline. I could not resolve this with certainty because verifiers are
  git-`checkout`-forbidden, so I could not build the parent commit to
  diff route counts directly. What I can say: none of the three changed
  files add, remove, or rename a route (`sentry.client.config.ts` and both
  `SentryProvider` files contain no routing surface), and every
  previously-static public route is still correctly `○`/`●`, not `ƒ` — so
  there is no evidence this fix caused the discrepancy. My best guess is an
  off-by-one in how the baseline was originally tallied (e.g. `/_not-found`
  counted or not), but I did not verify that guess and am not asserting it
  as fact.

---

## Summary

The fix is sound. Check 1 — the check that mattered most, whether error
reporting silently breaks — is unambiguously false as a concern: the merge
semantics of `getIntegrationsToSetup` are exactly as claimed, traced through
all four layers (`core` → `browser` → `react` → `nextjs`) at the actually
installed v10.51.0. All four leak channels from Check 2 are real,
independently traced to source, and each is closed by the mechanism the
implementer described, including the subtle Channel 4 argument about
`checkoutEveryNms` defaults and buffer-mode `stop()` semantics. The guard's
coverage (Check 3) and the sabotage-round reasoning (Check 5) hold up
against direct code reading. The only two things worth carrying forward,
neither of which changes the verdict: Channel 4 has no regression test
(rests on SDK defaults, verified but unpinned), and the build's route count
(53 vs. baseline's stated 52) could not be reconciled without a checkout I
was not permitted to perform.
