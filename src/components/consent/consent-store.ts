"use client";

// C-18 Phase C — the consent store: one module-level source of truth for
// "what has this visitor chosen", plus the panel's open/closed state.
//
// WHY A MODULE STORE AND NOT A REACT PROVIDER. Wrapping the (public) tree in a
// client provider would push every public page's children through a client
// component boundary; src/app/(public)/layout.tsx is a server component and the
// 15 prerendered public pages depend on it staying that way. A module-level
// store needs no provider: the banner subscribes, and Phase D's consent-gated
// loaders will subscribe to this same store without either of them having to
// share an ancestor.
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

/**
 * Records a choice: writes the consent cookie and updates every subscriber, so
 * the banner goes away without a reload.
 */
export function recordConsentChoices(choices: ConsentChoices): ConsentState {
  const state = writeConsent(choices);

  hasRead = true;
  snapshot = state;
  notify(consentListeners);

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
