# Sentry Session Replay — booking-token exposure & consent-gating investigation

**Scope:** read-only investigation for C-18. Repo `rahmatherapy-next-refactor`, branch `master`, HEAD `70e2103`. Installed Sentry packages verified at **v10.51.0** across the board (`@sentry/nextjs`, `@sentry/browser`, `@sentry/react`, `@sentry/core`, `@sentry-internal/replay`, `@sentry-internal/replay-canvas`, `@sentry-internal/browser-utils`) — confirmed via `node_modules/.pnpm/@sentry+*@10.51.0*` and `package.json:32` (`"@sentry/nextjs": "^10.51.0"`). No package installs were performed; all findings come from the already-installed tree plus current `context7` docs (`/getsentry/sentry-docs`).

---

## Q1 verdict (line 1, as required)

**YES — conditional on sampling.** On today's configuration, if a visitor opens `/booking/manage?token=<real token>` and their session is sampled for Replay (10% chance per `replaysSessionSampleRate: 0.1`, or on-error buffering per `replaysOnErrorSampleRate: 1.0`), **the token leaves the browser and lands in Sentry.** `beforeSend` (the app's `scrubSentryEvent`) never runs on any part of the Replay payload — verified from the installed package's source, not inferred. The token reaches Sentry through **two independent paths that `beforeSend` cannot touch**, and there is currently no configured mechanism (in this app's `sentry.client.config.ts`) that touches either path.

---

## Q1 evidence, point by point

### 1. Does `beforeSend` apply to Replay envelopes, or only to error/transaction events?

**Only error/transaction events. Definitively confirmed by code, not inference.**

- `beforeSend` is invoked inside `Client._processEvent()` → `processBeforeSend()`, and is gated by `isErrorEvent(processedEvent)`:
  `node_modules/.pnpm/@sentry+core@10.51.0/node_modules/@sentry/core/build/esm/client.js:1022-1028`:
  ```js
  const { beforeSend, beforeSendTransaction, ignoreSpans } = options;
  ...
  if (isErrorEvent(processedEvent) && beforeSend) {
    return beforeSend(processedEvent, hint);
  }
  ```
- Replay never calls `client._processEvent()` / `client.captureEvent()`. The Replay metadata event (`replay_event`) is built and sent by `sendReplayRequest()`, which explicitly bypasses the client's private processing method:
  `node_modules/.pnpm/@sentry-internal+replay@10.51.0/node_modules/@sentry-internal/replay/build/npm/esm/index.js:8183-8185`:
  ```js
  // This normally happens in browser client "_prepareEvent"
  // but since we do not use this private method from the client, but rather the plain import
  // we need to do this manually.
  ```
  It instead calls the plain-imported `prepareEvent()` utility (`.../index.js:8167-8174`, importing `prepareEvent` from `@sentry/core`). That utility — `node_modules/.pnpm/@sentry+core@10.51.0/node_modules/@sentry/core/build/esm/utils/prepareEvent.js` — runs registered event processors (`notifyEventProcessors`, lines 69-94) but **contains no reference to `beforeSend` anywhere in the file** (grepped, zero matches).
- The `replay_recording` payload (the actual rrweb DOM/session recording — a compressed binary/string blob) is built by `prepareRecordingData()` (`.../index.js:8118-8143`) with **zero event-processing pipeline at all** — it's raw bytes assembled and handed straight to `transport.send(envelope)` (`.../index.js:8292-8297`).
- **Official confirmation (context7, `/getsentry/sentry-docs`, `docs/platforms/javascript/common/session-replay/privacy.mdx`):** Sentry's own docs recommend `Sentry.addEventProcessor()` with an explicit `if (event.type !== "replay_event") return event;` guard specifically *because* `beforeSend` does not reach replay events — this is the sanctioned workaround, not `beforeSend`.

**Verdict: `beforeSend` (and therefore `scrubSentryEvent`, `src/lib/observability/sentry-scrubbing.ts`) has zero effect on Replay data of any kind.**

### 2. Does Replay record the page URL, including the query string? Is anything redacted by default?

**Yes, in at least two independent places, and nothing redacts either by default.**

a) **Replay-event metadata `urls` field** (sent as JSON, separately from the recording): built in `ReplayContainer.setInitialState()`:
   `.../@sentry-internal/replay/build/npm/esm/index.js:9158-9170`:
   ```js
   setInitialState() {
     const urlPath = `${WINDOW.location.pathname}${WINDOW.location.hash}${WINDOW.location.search}`;
     const url = `${WINDOW.location.origin}${urlPath}`;
     ...
     this._context.initialUrl = url;
     this._context.urls.push(url);
   }
   ```
   `WINDOW.location.search` — the literal query string, e.g. `?token=<real token>` — is concatenated in unmodified. This becomes `replay_event.urls[]` in `sendReplayRequest()` (`.../index.js:8237`). SPA navigations add further URLs the same way via `handleHistorySpanListener` (`.../index.js:6899-6900`, `replay.getContext().urls.push(result.name)`).

b) **The DOM recording itself** embeds the full URL in every full-snapshot ("checkout") event, which fires when a Replay session starts recording on a page (including on first load of `/booking/manage?token=...` if that page happens to be where sampling occurs, or on any full re-snapshot during a sticky session):
   `.../@sentry-internal/replay/build/npm/esm/index.js:4280-4287`:
   ```js
   wrappedEmit({
     type: EventType.Meta,
     data: {
       href: window.location.href,   // full URL incl. query string
       width: getWindowWidth(),
       height: getWindowHeight()
     }
   }, isCheckout);
   ```
   This `Meta` event is part of the raw `replay_recording` blob from point (1) above — it never passes through any event processor, `beforeSend`, or (per point 3 below) `beforeAddRecordingEvent`.

- `sendDefaultPii: false` (currently set, `sentry.client.config.ts:6`) has **no effect** on either of these — grepped the entire replay bundle for `sendDefaultPii`: zero matches. It is not consulted by Replay at all.
- No default redaction of URLs exists anywhere in `ReplayPluginOptions` (full interface read: `.../replay/build/npm/types/integration.d.ts:81-228` — no url-redaction option of any kind is defined).

### 3. What ARE the correct hooks for filtering/scrubbing replay data in v10.51.0?

Enumerated directly from the installed `ReplayPluginOptions` interface (`.../replay/build/npm/types/integration.d.ts`) — this is what exists, not a generic list:

| Hook / option | What it actually touches | Reaches the token? |
|---|---|---|
| `beforeAddRecordingEvent` (line 177) | Only **custom** recording events (`event.type === EventType.Custom`) added by the Replay integration itself — confirmed at `.../index.js:6417`: `if (typeof callback === 'function' && isCustomEvent(event))`. Per the type's own doc comment (lines 169-171): *"Events added by the underlying DOM recording library can not be modified, only custom recording events... will trigger the callback."* The `Meta` event (§2b) is a library event, **not** Custom — this hook cannot see or scrub it. |
| `beforeErrorSampling` (line 186) | Gates whether an *error* is allowed to trigger on-error replay sampling. Not a scrubber. | No |
| `networkDetailAllowUrls` / `networkDetailDenyUrls` / `networkCaptureBodies` / `networkRequestHeaders` / `networkResponseHeaders` (lines 43-79) | Gate whether XHR/fetch **request/response bodies and extra headers** are captured. Default `networkDetailAllowUrls: []` (confirmed default at `.../index.js:9921`) means bodies/headers are NOT captured by default for any URL. **However**, the bare request `url`, `method`, and `statusCode` are always captured in the network breadcrumb regardless of these lists (`ReplayNetworkRequestData` type, `.../replay.d.ts:451-459`, has `url: string` outside the gated `request`/`response` fields) — so if the app made a fetch/XHR call with the token in its URL, that URL would still show up in a replay network breadcrumb even with all the deny lists engaged. (Not independently verified here whether `ManageBookingForms` makes such a call — it submits the token as a hidden form field, `src/app/booking/manage/ManageBookingForms.tsx:49,64,83`, not observed to hit an API URL containing the token.) |
| `Sentry.addEventProcessor()` (general Sentry API, not a Replay option) | **Does** run on `replay_event` (confirmed: `prepareEvent()` runs `client.getEventProcessors()` + scope processors, `.../core/build/esm/utils/prepareEvent.js:69-94`), so it can rewrite `event.urls[]`. This is the pattern Sentry's own docs show (context7, `privacy.mdx`, "Scrub URLs in Replay Events with `addEventProcessor`"). It does **not** reach the `replay_recording` binary blob (§3a below), so it cannot touch the `Meta.data.href` field from point 2b. |
| `beforeSendReplay` | **Does not exist in this version.** Grepped `@sentry-internal/replay`, `@sentry/core`, `@sentry/browser`, `@sentry/nextjs` (10.51.0) for the literal string `beforeSendReplay` — zero matches anywhere in the installed tree. |

### 4. What do `replayIntegration()`'s defaults actually do? Do they affect URLs?

Confirmed from the `Replay` class constructor defaults, `.../@sentry-internal/replay/build/npm/esm/index.js:9902-9938` (this is exactly what the app gets, since `sentry.client.config.ts:13` calls `Sentry.replayIntegration()` with **no options**):

```js
maskAllText = true,
maskAllInputs = true,
blockAllMedia = true,
networkDetailAllowUrls = [],
```

- `maskAllText: true` (default ON) — masks the **text content** of DOM elements in the recorded snapshot.
- `maskAllInputs: true` (default ON) — masks the **displayed value** of form inputs.
- `blockAllMedia: true` (default ON) — blocks images/video/svg.
- **None of these touch URLs.** `href` on the `Meta` event (§2b) is SDK-internal metadata assembled from `window.location.href`, not DOM text content — masking DOM text does not intercept it. Same for `_context.urls[]` (§2a) — it is built directly from `WINDOW.location.search`/`.pathname`, never passed through the text-masking code path at all (confirmed: the masking functions operate on `rrweb.record()`'s DOM-serialization callbacks — `maskTextFn`/`maskInputFn`/`maskAttributeFn`, `.../index.js:9953-9959` — which are wired into `_recordingOptions` for `rrweb`'s snapshot function, an entirely separate code path from `setInitialState()`/`sendReplayRequest()`).

### 5. Bottom line

**Conditional yes**, stated precisely:

- **Condition:** the visitor's session must be sampled for Replay — either session-mode (10% of all sessions, `replaysSessionSampleRate: 0.1`) or error-mode (100% of sessions that experience an error, `replaysOnErrorSampleRate: 1.0`, buffered and flushed on error).
- **If sampled:** the token in `?token=...` reaches Sentry via at minimum the `replay_event.urls[]` metadata field (§2a) and, if/when a full DOM snapshot occurs while `/booking/manage?token=...` is the active URL, also via the `Meta.data.href` field embedded in the actual session recording (§2b). Both paths are independent of `beforeSend`/`scrubSentryEvent` and independent of `maskAllText`/`maskAllInputs`/`blockAllMedia`.
- This is not an inference: every claim above traces to a specific line in the installed `@sentry-internal/replay@10.51.0` or `@sentry/core@10.51.0` source, cross-checked against current official Sentry documentation (context7) which independently confirms both the `beforeSend`-doesn't-apply fact and the `addEventProcessor`-for-`replay_event.urls` workaround.
- **What would additionally settle it beyond doubt:** a live/staging capture — sample a session on `/booking/manage?token=test123`, inspect the resulting `replay_event` and `replay_recording` payloads in the Sentry dashboard's raw event JSON (or via a network-tab capture of the `POST .../envelope/` request) to see `test123` verbatim. This investigation did not perform that live capture (no server was started, per the read-only/no-server constraint) — the conclusion rests on source-code tracing of the exact installed version, which is the strongest evidence available without running the app.

---

## Q2 mechanism — consent-gating Replay in v10.51.0

All of the following are directly supported by the installed SDK and corroborated by current official docs (context7, `/getsentry/sentry-docs`).

### Can `replayIntegration()` be added after init?

**Yes — `Sentry.addIntegration(Sentry.replayIntegration())` is fully supported and is Sentry's own documented lazy-load pattern.**

- `Sentry.addIntegration` is exported through the full chain the app already uses (`import * as Sentry from "@sentry/nextjs"` → `export * from '@sentry/react'` (`.../nextjs/build/types/client/index.d.ts:3`) → `export * from '@sentry/browser'` (`.../react/build/types/index.d.ts:1`) → `export { ..., addIntegration, ... } from '@sentry/core'` (`.../browser/build/npm/types/exports.d.ts:3`)).
- Calling it on an already-initialized client runs `setupIntegration()` then, if not already installed, `afterAllSetup()` for that one integration — confirmed at `.../core/build/esm/client.js:456-469` and `.../core/build/esm/integration.js:145-154`. For the `Replay` class, `afterAllSetup()` is exactly the method that calls `this._setup(client); this._initialize(client);` (`.../replay/build/npm/esm/index.js:10045-10056`), i.e. adding it later triggers the same setup as if it had been in the initial `integrations: []` array.
- Official pattern (context7, `platform-includes/session-replay/setup/javascript.nextjs.mdx`):
  ```typescript
  Sentry.init({ integrations: [] });   // no Replay at init
  // later, on consent:
  import("@sentry/nextjs").then((lazyLoadedSentry) => {
    Sentry.addIntegration(lazyLoadedSentry.replayIntegration());
  });
  ```
  This is the Next.js-specific documented variant, matching this app's `@sentry/nextjs` usage exactly.

### Is there a manual-start mode, and how do sample rates interact?

**Yes — confirmed in code and in official docs, and the "`replaysSessionSampleRate: 0` + manual start" pattern the Owner described is exactly what Sentry documents.**

- `loadReplayOptionsFromClient()` (`.../replay/build/npm/esm/index.js:10192-10223`) reads `sessionSampleRate`/`errorSampleRate` **from the top-level `Sentry.init()` options** (`replaysSessionSampleRate`/`replaysOnErrorSampleRate`), not from options passed to `replayIntegration({...})` itself (the `InitialReplayPluginOptions` type explicitly omits `sessionSampleRate`/`errorSampleRate` — `.../integration.d.ts:233`). Setting both top-level rates to `0` means `ReplayContainer.initializeSampling()` (called automatically from `afterAllSetup`/`_initialize`, whether Replay is in the initial config or added later) samples nothing — Replay is installed but records nothing until told to.
- The `Replay` class exposes public `start()` (session mode, ignores sample rate, always creates a session — `.../index.js:10065-10070`) and `startBuffering()` (buffer mode — `.../index.js:10076-10082`), reachable via `Sentry.getReplay()` (re-exported the same way as `addIntegration`, confirmed at `.../browser/build/npm/types/index.d.ts:10`: `export { replayIntegration, getReplay } from '@sentry-internal/replay';`, and `getReplay()` implementation at `.../replay/build/npm/esm/index.js:10232-10235` — `client.getIntegrationByName('Replay')`).
- **Official confirmation** (context7, `docs/platforms/javascript/common/session-replay/understanding-sessions.mdx`, "Manually Start Sentry Session Replay in JavaScript"):
  ```javascript
  Sentry.init({
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    integrations: [Sentry.replayIntegration()],
  });
  const replay = Sentry.getReplay();
  replay.start();          // session mode, regardless of sample rates
  // OR
  replay.startBuffering();  // buffer mode, regardless of sample rates
  ```
  Docs also state: calling `start()`/`startBuffering()` when a session is already running is a safe no-op (debug log only).

**Two viable, SDK-supported patterns exist for C-18 Phase D** (this investigation does not choose between them — that is a scoping decision for the Owner):
1. Keep `replayIntegration()` in `integrations: []` at init (so it "runs at app start" in the sense of being loaded/registered), set `replaysSessionSampleRate: 0` / `replaysOnErrorSampleRate: 0`, call `Sentry.getReplay()?.start()` (or `.startBuffering()`) only once consent is granted.
2. Omit `replayIntegration()` from the initial `integrations: []` entirely; call `Sentry.addIntegration(Sentry.replayIntegration())` only once consent is granted (Sentry's own documented lazy-load pattern for this exact scenario — also reduces bundle size pre-consent since the Replay module isn't even loaded).

### How would Replay be stopped and buffered data discarded on withdrawal?

**Partially supported — with a material gap that needs to be flagged, not glossed over.**

- The public `Replay.stop()` method (`.../index.js:10088-10094`):
  ```js
  stop() {
    if (!this._replay) return Promise.resolve();
    return this._replay.stop({ forceFlush: this._replay.recordingMode === 'session', reason: 'manual' });
  }
  ```
  **`forceFlush` is hardcoded to `true` whenever `recordingMode === 'session'`** — i.e. if Replay was started with `.start()` (session mode, the mode that matches "record the whole session"), calling `Sentry.getReplay()?.stop()` will **flush and SEND whatever has been buffered so far, before stopping.** This is the opposite of "discard": in session mode there is no public API to hard-cancel and drop unsent data. The internal `ReplayContainer.stop({forceFlush, reason})` (`.../index.js:8874-8918`) does accept an explicit `forceFlush` boolean, but that internal container (`this._replay`) is a `private` field on the `Replay` class per the type definition (`.../integration.d.ts:44`) and is not exposed for consumers to call with `forceFlush: false`.
  - If Replay was started with `.startBuffering()` (buffer mode) instead, `recordingMode` is `'buffer'`, so `forceFlush` evaluates `false` on `.stop()` — the buffered (unsent) segments are simply destroyed (`eventBuffer.destroy(); eventBuffer = null;`, `.../index.js:8908-8910`) without being sent. Buffer mode is Sentry's "last 60s before an error" pattern though, not a general session-replay mode — it is not obviously a fit for "record the consented visitor's whole session."
- Regardless of mode, `stop()` **does** clear the persisted session automatically: `clearSession(this)` is called unconditionally inside `ReplayContainer.stop()` (`.../index.js:8914`), and `clearSession()` removes the sessionStorage entry: `WINDOW.sessionStorage.removeItem(REPLAY_SESSION_KEY)` where `REPLAY_SESSION_KEY = 'sentryReplaySession'` (`.../index.js:10`, `6080`). **So: the `sentryReplaySession` sessionStorage key does NOT need to be cleared explicitly — calling `Sentry.getReplay()?.stop()` already does it.** (This only holds if `.stop()` is actually called before/during withdrawal; if withdrawal instead just reloads the page without calling `.stop()` first, the stale session key would persist across the reload since sessionStorage survives reloads.)
- **Gap to flag for the Owner/orchestrator:** in session mode (the mode that matches what "Replay must not run until consent, then records the session" implies), there is no public API to stop-and-discard without first sending the already-buffered segment. The cleanest available sequence for withdrawal is: call `Sentry.getReplay()?.stop()` (accept that it flushes whatever was recorded up to that point — which, note, is data the visitor had already consented to at the time it was recorded, since consent was active until the withdrawal moment) then reload, mirroring the GA withdrawal pattern (`clearGaCookies()` → reload, per `redesign/plans/C-phase/C-18-cookie-consent-plan.md:80`). Achieving a true "nothing sent after the withdrawal click" guarantee is not something the public API provides in session mode.

### Does error reporting keep working with Replay ungated?

**Yes — confirmed by architecture, not just assumption.** Error capture (`captureException`/`captureMessage` → `client.captureEvent()` → `_processEvent()`) is a completely separate code path from Replay; it does not check whether the `Replay` integration exists, is started, or has recorded anything. `@sentry/browser`'s default integrations (error handlers, breadcrumbs, dedupe, inbound filters, etc.) are independent of `integrations: []` user-supplied entries like Replay. Both of the patterns in the "manual-start mode" section above leave `Sentry.init()` — and therefore all error/transaction reporting — running unconditionally for every visitor from app start; only the Replay recording itself is deferred to a `.start()`/`.startBuffering()`/`addIntegration()` call gated on consent. This matches the Owner's requirement directly: error monitoring stays universal, only Replay is gated.

---

## Unresolved / would need X to settle

1. **Live confirmation of token leakage** — this investigation is conclusive from source-code tracing of the exact installed version (10.51.0), cross-checked against current official docs, but no live/staging capture was performed (no server was started, per the investigation's constraints). To fully close the loop: sample a Replay session on `/booking/manage?token=test123` in a non-production environment and inspect the raw `replay_event`/`replay_recording` envelope contents in Sentry's dashboard or via a captured network request.
2. **Whether `ManageBookingForms` (or any other booking/manage client code) makes fetch/XHR calls with the token in the URL** (as opposed to the hidden-form-field POST body observed at `src/app/booking/manage/ManageBookingForms.tsx:49,64,83`) — not fully traced; if any such call exists, it would be a second leak vector via replay network breadcrumbs (bare request `url` is always captured regardless of `networkDetailAllowUrls`, per Q1.3 table).
3. **Whether hidden `<input type="hidden" value={token}>` form fields get captured verbatim in the DOM snapshot** despite `maskAllInputs: true` — rrweb's input-masking behavior for `type="hidden"` specifically was not verified in this pass; flagged as a secondary, unconfirmed question, separate from the primary (and conclusively answered) query-string leak.
4. **Scoping decision**: neither pattern in "Q2 mechanism" is currently owned by any plan. `redesign/plans/C-phase/C-18-cookie-consent-plan.md` Phase D (line 82: "Gated GA loader (the C-17 amendment)") covers only the Google Analytics loader — it does not currently mention Sentry Replay at all (grepped the plan file for `Replay`/`replayIntegration`/`replaysSessionSampleRate`: zero matches). Extending Phase D (or adding a new phase/step) to cover Replay gating is a scope decision for the Owner, not something this investigation resolves.
