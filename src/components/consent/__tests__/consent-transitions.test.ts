// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://localhost:3000/" }
//
// C-18 Phase C Step 7 — what a choice does, and just as importantly what it
// does not do. Every case here is a transition FROM the previously stored
// choice, because that is the only thing that distinguishes "refused on a first
// visit" (nothing to undo, no signal to send) from "withdrew a grant" (stop it,
// delete what it stored, reload).
//
// The https origin is load-bearing — see consent-state.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/booking/utils/returning-customer", () => ({
  clearReturningCustomer: vi.fn(),
  saveReturningCustomer: vi.fn(),
  loadReturningCustomer: vi.fn(),
}));

import { CONSENT_COOKIE, writeConsent, type ConsentChoices } from "@/lib/consent/consent-state";
import { clearReturningCustomer } from "@/features/booking/utils/returning-customer";
import {
  ALL_DENIED,
  ALL_GRANTED,
  recordConsentChoices,
  resetConsentStoreForTests,
} from "../consent-store";

const reload = vi.fn();
const gtag = vi.fn();

function cookieNames(): string[] {
  return document.cookie
    .split(";")
    .map((pair) => pair.split("=")[0]?.trim() ?? "")
    .filter(Boolean);
}

function clearAllCookies() {
  for (const name of cookieNames()) {
    document.cookie = `${name}=; Path=/; Max-Age=0`;
  }
}

/** Put a previously-stored choice in place, then make the store re-read it. */
function storedChoice(choices: ConsentChoices) {
  writeConsent(choices);
  resetConsentStoreForTests();
}

function analyticsUpdates(): string[] {
  return gtag.mock.calls
    .filter((call) => call[0] === "consent" && call[1] === "update")
    .map((call) => (call[2] as { analytics_storage: string }).analytics_storage);
}

beforeEach(() => {
  clearAllCookies();
  resetConsentStoreForTests();
  reload.mockClear();
  gtag.mockClear();
  vi.mocked(clearReturningCustomer).mockClear();

  (window as { gtag?: unknown }).gtag = gtag;
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { hostname: "localhost", href: "https://localhost:3000/", reload },
  });
});

afterEach(() => {
  clearAllCookies();
  delete (window as { gtag?: unknown }).gtag;
});

describe("granting", () => {
  it("Accept all from nothing tells Consent Mode analytics is granted", () => {
    recordConsentChoices(ALL_GRANTED);

    expect(analyticsUpdates()).toEqual(["granted"]);
    expect(reload).not.toHaveBeenCalled();
  });

  it("turning analytics on from a stored refusal tells Consent Mode too", () => {
    storedChoice({ analytics: false, functional: true });

    recordConsentChoices({ analytics: true, functional: true });

    expect(analyticsUpdates()).toEqual(["granted"]);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe("refusing on a first visit is not a withdrawal", () => {
  it("Reject all from nothing fires no Consent Mode update at all", () => {
    recordConsentChoices(ALL_DENIED);

    // The default-denied that ConsentScripts already established still stands;
    // there is nothing to revoke and nothing to reload for.
    expect(gtag).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(clearReturningCustomer).not.toHaveBeenCalled();
  });

  it("still records the refusal", () => {
    recordConsentChoices(ALL_DENIED);
    expect(cookieNames()).toContain(CONSENT_COOKIE);
  });
});

describe("withdrawing analytics", () => {
  it("denies, deletes the _ga cookies, and reloads — in that order", () => {
    document.cookie = "_ga=GA1.1.123.456; Path=/";
    document.cookie = "_ga_ABC123=GS1.1.789; Path=/";
    document.cookie = "_gali=keep-me; Path=/";
    storedChoice(ALL_GRANTED);

    recordConsentChoices({ analytics: false, functional: true });

    expect(analyticsUpdates()).toEqual(["denied"]);
    expect(cookieNames()).not.toContain("_ga");
    expect(cookieNames()).not.toContain("_ga_ABC123");
    expect(cookieNames()).toContain("_gali");
    expect(reload).toHaveBeenCalledTimes(1);
    expect(gtag.mock.invocationCallOrder[0]).toBeLessThan(reload.mock.invocationCallOrder[0]);
  });
});

describe("withdrawing functional", () => {
  it("clears the stored contact details and does not reload", async () => {
    storedChoice(ALL_GRANTED);

    recordConsentChoices({ analytics: true, functional: false });

    await vi.waitFor(() => expect(clearReturningCustomer).toHaveBeenCalledTimes(1));
    // Nothing was loaded on the strength of functional consent, so there is
    // nothing a reload would clean up.
    expect(reload).not.toHaveBeenCalled();
    expect(gtag).not.toHaveBeenCalled();
  });

  it("clears them before the reload when analytics is withdrawn in the same click", async () => {
    storedChoice(ALL_GRANTED);

    recordConsentChoices(ALL_DENIED);

    await vi.waitFor(() => expect(clearReturningCustomer).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(analyticsUpdates()).toEqual(["denied"]);
    expect(
      vi.mocked(clearReturningCustomer).mock.invocationCallOrder[0]
    ).toBeLessThan(reload.mock.invocationCallOrder[0]);
  });
});

describe("a purpose that did not change does nothing", () => {
  it("re-saving the same grant fires no update and no reload", () => {
    storedChoice(ALL_GRANTED);

    recordConsentChoices(ALL_GRANTED);

    expect(gtag).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(clearReturningCustomer).not.toHaveBeenCalled();
  });

  it("re-saving the same refusal fires nothing either", () => {
    storedChoice(ALL_DENIED);

    recordConsentChoices(ALL_DENIED);

    expect(gtag).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(clearReturningCustomer).not.toHaveBeenCalled();
  });

  it("changing only functional leaves analytics alone", async () => {
    storedChoice({ analytics: true, functional: false });

    recordConsentChoices({ analytics: true, functional: true });

    expect(gtag).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(clearReturningCustomer).not.toHaveBeenCalled();
  });
});

describe("a stale record is treated as no consent, not as a grant", () => {
  it("does not fire a withdrawal when the stored record's version no longer matches", () => {
    document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(
      JSON.stringify({
        v: "2020-01-01.1",
        id: "3f1d5f6e-1c2b-4a3d-9e8f-0a1b2c3d4e5f",
        choices: { analytics: true, functional: true },
        ts: "2026-08-04T00:00:00.000Z",
      })
    )}; Path=/`;
    resetConsentStoreForTests();

    recordConsentChoices(ALL_DENIED);

    expect(gtag).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});
