"use client";

// C-18 Phase C — the consent store: one module-level source of truth for
// "what has this visitor chosen", plus the panel's open/closed state.
//
// WHY A MODULE STORE AND NOT A REACT PROVIDER. Wrapping the (public) tree in a
// client provider would push every public page's children through a client
// component boundary; src/app/(public)/layout.tsx is a server component and the
// 15 prerendered public pages depend on it staying that way. A module-level
// store needs no provider: the banner subscribes, and so does Phase D's gated
// GoogleAnalytics loader, without either of them having to share an ancestor.
//
// WHY THE SNAPSHOT HAS THREE STATES. `undefined` means "not read yet on this
// client" and is what the server snapshot returns; `null` means "read, and
// there is no consent to rely on"; a ConsentState means "read, and this is the
// choice". Collapsing the first two would make the server render a banner for
// everyone, which then has to disappear again for a visitor who already chose —
// a flash of a banner at a visitor who already answered the question. Rendering
// nothing until the cookie has been read is the only way to avoid it while the
// page stays static (the cookie cannot be read during the render — see
// ConsentScripts.tsx for the full reasoning).
import { useSyncExternalStore } from "react";
import {
  clearGaCookies,
  readConsent,
  writeConsent,
  type ConsentChoices,
  type ConsentState,
} from "@/lib/consent/consent-state";
import type { CookiePurpose } from "@/lib/consent/cookie-registry";

/**
 * Every purpose a visitor can actually choose — the registry minus "essential".
 *
 * Type-only, deliberately: this module is imported by the banner, which is on
 * every public page, and the panel — which is loaded on demand — is the only
 * thing that needs the registry's contents. Pulling COOKIE_REGISTRY in here
 * would put all six items' descriptions into every public page's first load.
 */
export type GatedPurpose = Exclude<CookiePurpose, "essential">;

/**
 * No pre-ticks. Every non-essential purpose starts denied, and silence stays
 * denied: a visitor who never answers is in exactly this state forever.
 */
export const ALL_DENIED: ConsentChoices = { analytics: false, functional: false };
export const ALL_GRANTED: ConsentChoices = { analytics: true, functional: true };

/** `undefined` until the cookie has been read on this client. */
export type ConsentSnapshot = ConsentState | null | undefined;

let snapshot: ConsentSnapshot;
let hasRead = false;
const consentListeners = new Set<() => void>();

let panelOpen = false;
const panelListeners = new Set<() => void>();

function notify(listeners: Set<() => void>) {
  for (const listener of listeners) listener();
}

export function subscribeConsent(listener: () => void): () => void {
  consentListeners.add(listener);
  return () => {
    consentListeners.delete(listener);
  };
}

/**
 * The current choice. Reads `document.cookie` once, on the first call after
 * hydration, and caches it — useSyncExternalStore requires a snapshot that only
 * changes when subscribers are notified.
 */
export function getConsentSnapshot(): ConsentSnapshot {
  if (!hasRead) {
    hasRead = true;
    snapshot = readConsent(document.cookie);
  }
  return snapshot;
}

/** Always `undefined`: the server cannot know, and must not guess. */
export function getServerConsentSnapshot(): ConsentSnapshot {
  return undefined;
}

export function subscribeConsentPanel(listener: () => void): () => void {
  panelListeners.add(listener);
  return () => {
    panelListeners.delete(listener);
  };
}

export function getConsentPanelOpen(): boolean {
  return panelOpen;
}

export function getServerConsentPanelOpen(): boolean {
  return false;
}

export function openConsentPanel(): void {
  if (panelOpen) return;
  panelOpen = true;
  notify(panelListeners);
}

export function closeConsentPanel(): void {
  if (!panelOpen) return;
  panelOpen = false;
  notify(panelListeners);
}

/** Is this purpose granted right now? Anything other than a stored `true` is no. */
export function hasConsentFor(purpose: GatedPurpose): boolean {
  return getConsentSnapshot()?.choices[purpose] === true;
}

/**
 * Session Replay's route-aware gate — `syncSessionReplay` from
 * sentry.client.config.ts, registered by that module when `SentryProvider`
 * loads it (on mount, on every route). Undefined until then, which is
 * self-consistent: the same module is the only thing that ever starts Replay,
 * so if it has not loaded there is nothing running to stop.
 *
 * WHY A REGISTRATION AND NOT AN IMPORT. This module is in every public page's
 * first-load bundle and the Sentry SDK must not be. The obvious
 * `await import("../../../sentry.client.config")` here was written and MEASURED
 * first: +1.98 kB gzipped on /home, because the extra async boundary made
 * Turbopack split the layout's client code into one more chunk, and 16
 * separately-gzipped streams compress worse than 15. C-18's budget is +5 kB
 * gzipped and Phase C had already spent 4.68 kB of it, so that was not
 * affordable. Inverting the dependency leaves the reference in the Sentry
 * chunk, which is lazy already, and costs this bundle nothing — and it keeps
 * the withdrawal sequence synchronous with the click.
 */
type ReplayGate = (pathname: string) => void;
let replayGate: ReplayGate | undefined;

export function registerReplayGate(gate: ReplayGate): void {
  replayGate = gate;
}

// Same optional-chained posture as SuccessScreen.tsx: an ad-blocker, or a page
// whose inline consent script never ran, must not turn a consent click into a
// thrown error.
function consentModeUpdate(analyticsStorage: "granted" | "denied") {
  (window as { gtag?: (...args: unknown[]) => void }).gtag?.("consent", "update", {
    analytics_storage: analyticsStorage,
  });
}

/** The four proof-log actions — matches consent_events.action's CHECK constraint. */
type ConsentEventAction = "granted" | "rejected" | "updated" | "withdrawn";

/**
 * C-18 Phase E Step 10's route. Same path regardless of environment; the
 * route itself always answers 204 and never blocks the caller (brief §4.7) —
 * see src/app/api/consent-events/route.ts.
 */
const CONSENT_EVENTS_ENDPOINT = "/api/consent-events/";

/**
 * C-18 Phase E Step 11 — what to log for a choice, decided the same way
 * applyChoiceTransition (below) decides what to DO about one: by comparing
 * against the previously stored choice, never the new one alone.
 *
 *   - Any purpose that was granted and is now denied is a withdrawal, even if
 *     another purpose was granted in the same click.
 *   - Otherwise, no prior record at all is a first choice: 'granted' if
 *     anything non-essential was switched on, 'rejected' if nothing was.
 *   - Otherwise a prior record existed and nothing was withdrawn: 'updated'.
 */
function determineConsentAction(
  hadPriorRecord: boolean,
  previous: ConsentChoices,
  next: ConsentChoices
): ConsentEventAction {
  const purposes = Object.keys(next) as Array<keyof ConsentChoices>;

  if (purposes.some((purpose) => previous[purpose] && !next[purpose])) {
    return "withdrawn";
  }

  if (!hadPriorRecord) {
    return purposes.some((purpose) => next[purpose]) ? "granted" : "rejected";
  }

  return "updated";
}

/**
 * Fire-and-forget: the consent-proof beacon. navigator.sendBeacon is
 * preferred because it is designed to survive the page going away, which
 * matters on the withdrawal path below — this is called BEFORE
 * applyChoiceTransition, which is what performs that path's
 * window.location.reload(), specifically so the beacon is queued before the
 * reload begins rather than raced against it. fetch(keepalive) is the
 * fallback for contexts without sendBeacon, or when it declines the payload.
 * Never throws, and never awaited by the caller — a slow or down logging
 * endpoint must never affect consent UX (brief §4.7).
 *
 * purposes_offered is Object.keys(state.choices), not a hand-typed list:
 * ConsentChoices has exactly one key per non-essential CookiePurpose by
 * construction (see the interface's own doc-comment in consent-state.ts —
 * adding a purpose to the registry means adding a key there), so this can
 * never drift from what ConsentPreferencesPanel.tsx's own GATED_PURPOSES
 * renders. Importing COOKIE_REGISTRY itself here to derive the same list
 * would pull its per-cookie descriptions into this module — see the
 * GatedPurpose note above for why that import is avoided in this file.
 */
function logConsentEvent(action: ConsentEventAction, state: ConsentState): void {
  const body = JSON.stringify({
    consent_id: state.id,
    banner_version: state.v,
    purposes_offered: Object.keys(state.choices),
    choices: state.choices,
    action,
  });

  try {
    const queued =
      typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function"
        ? navigator.sendBeacon(
            CONSENT_EVENTS_ENDPOINT,
            new Blob([body], { type: "application/json" })
          )
        : false;

    if (!queued) {
      void fetch(CONSENT_EVENTS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => undefined);
    }
  } catch {
    // A logging failure must never surface as a consent-flow error.
  }
}

/**
 * C-18 Phase C Step 7 — what a choice actually does, decided by comparing it
 * with the PREVIOUS stored choice rather than with the new one alone.
 *
 * The distinction matters in both directions. Rejecting on a first visit is not
 * a withdrawal: nothing was ever granted, ConsentScripts already established
 * default-denied, and firing a denied update plus a reload at someone who has
 * just said "no thanks" would be gratuitous. Re-saving a choice that did not
 * change is not an event either. Only a real transition does anything.
 *
 * Absent or unreadable consent counts as denied, so the gate fails closed:
 * silence is never consent.
 */
async function applyChoiceTransition(previous: ConsentChoices, next: ConsentChoices) {
  // Functional first, and awaited, because the analytics branch below may
  // reload the page out from under it. The import is deferred rather than
  // top-level so the booking feature's zod-backed contact helpers stay out of
  // every public page's bundle — they are needed only at the moment someone
  // withdraws this one purpose.
  if (previous.functional && !next.functional) {
    const { clearReturningCustomer } = await import(
      "@/features/booking/utils/returning-customer"
    );
    clearReturningCustomer();
  }

  if (next.analytics === previous.analytics) return;

  if (next.analytics) {
    // Google Analytics mounts immediately: GoogleAnalytics.tsx subscribes to
    // this store, so the notify() above has already re-rendered it and gtag.js
    // is loading — no navigation needed (brief §2.2). Sentry Session Replay
    // starts at the next route change instead, when SentryProvider re-runs
    // syncSessionReplay and finds the grant. Starting it here as well would
    // pull the Sentry chunk into the click handler to begin recording a page
    // that is already half over; a grant is a permission, not a promise to
    // start this instant. A withdrawal is the direction that has to be
    // immediate, and it is — see below.
    consentModeUpdate("granted");
    return;
  }

  // Withdrawal: tell Google to stop, delete what it already stored, stop Sentry
  // Session Replay, then reload so nothing already on the page can keep running.
  consentModeUpdate("denied");
  clearGaCookies();

  // WHY REPLAY IS STOPPED HERE RATHER THAN LEFT TO THE RELOAD (C-18 Phase D).
  // Read out of the pinned package, @sentry-internal/replay@10.51.0,
  // build/npm/cjs/index.js:
  //   - The public `stop()` (:10090) calls the container's
  //     `stop({ forceFlush: recordingMode === 'session' })`. There is no
  //     discard-without-sending option on either API.
  //   - The container's `stop()` (:8876) is synchronous up to the flush:
  //     `_removeListeners()` (:8900) — which drops the `visibilitychange`
  //     handler registered at :9329 — then `stopRecording()` (:8901) and
  //     `_debouncedFlush.cancel()` (:8903). Only then, and only when
  //     forceFlush, does it `await _flush({force:true})` (:8906).
  //   - In BUFFER mode — the ~90% path, since replaysSessionSampleRate is 0.1
  //     (mode chosen at :8726) — forceFlush is false, so the whole of stop()
  //     runs synchronously and transmits NOTHING: the buffer is destroyed
  //     unsent (:8911) and the sticky `sentryReplaySession` key is removed
  //     (:8916 -> deleteSession :6076).
  //   - In SESSION mode there is no way to discard what is already buffered.
  //     But NOT calling stop() does not avoid that send either: the reload
  //     hides the document, and the visibilitychange listener runs
  //     `_doChangeToBackgroundTasks` (:9377) -> `conditionalFlush()` (:9074),
  //     which flushes the same buffer. stop() therefore transmits no more than
  //     doing nothing, and less content, because recording is halted before the
  //     flush rather than continuing until unload.
  // DISCLOSED RESIDUAL: for a session-mode visitor a final flush of
  // already-buffered data happens either way. Nothing at this SDK version
  // prevents it; the gate is what stops the next visit being recorded at all.
  //
  // The gate is re-run rather than a stop being called directly, so that one
  // function decides whether Replay may run — and it is re-run now, with the
  // new cookie already written, so it takes the deny branch.
  replayGate?.(window.location.pathname);

  window.location.reload();
}

/**
 * Records a choice: writes the consent cookie, updates every subscriber so the
 * banner goes away without a reload, and then applies whatever the change
 * actually means.
 */
export function recordConsentChoices(choices: ConsentChoices): ConsentState {
  const previousSnapshot = getConsentSnapshot();
  const previous = previousSnapshot?.choices ?? ALL_DENIED;
  const state = writeConsent(choices);

  hasRead = true;
  snapshot = state;
  notify(consentListeners);

  // Logged before applyChoiceTransition, which is what performs the
  // withdrawal path's window.location.reload() — see logConsentEvent for why
  // that ordering is load-bearing rather than incidental.
  logConsentEvent(
    determineConsentAction(previousSnapshot != null, previous, state.choices),
    state
  );

  void applyChoiceTransition(previous, state.choices);

  return state;
}

/**
 * Test-only. Module state outlives a single test, so a suite that renders the
 * banner more than once needs a way back to "this client has read nothing".
 */
export function resetConsentStoreForTests(): void {
  snapshot = undefined;
  hasRead = false;
  panelOpen = false;
  consentListeners.clear();
  panelListeners.clear();
}

/**
 * Test-only, and deliberately separate from resetConsentStoreForTests above:
 * this suite's storedChoice() helper calls that function mid-test (to make the
 * store re-read a just-written cookie), and every withdrawal test relies on
 * the gate registered in beforeEach still being there afterwards. Only the one
 * test that needs an unregistered gate — proving a withdrawal survives
 * SentryProvider.tsx's dynamic import never resolving (its `.then()` has no
 * `.catch()`, so a blocked/failed chunk load leaves replayGate permanently
 * undefined for that page) — should call this.
 */
export function unregisterReplayGateForTests(): void {
  replayGate = undefined;
}

export function useConsent(): ConsentSnapshot {
  return useSyncExternalStore(subscribeConsent, getConsentSnapshot, getServerConsentSnapshot);
}

export function useConsentPanelOpen(): boolean {
  return useSyncExternalStore(
    subscribeConsentPanel,
    getConsentPanelOpen,
    getServerConsentPanelOpen
  );
}
