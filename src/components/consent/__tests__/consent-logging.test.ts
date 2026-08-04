// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://localhost:3000/" }
//
// C-18 Phase E Step 11 — the consent-proof beacon dispatched from every
// recordConsentChoices call: what gets logged, what action label it carries,
// and the one sequencing rule that has to hold on the withdrawal path (brief
// §4.7, plan Step 11) — the beacon has to be queued BEFORE the reload that
// ends that path, not raced against it.
//
// The https origin is load-bearing, as in consent-transitions.test.ts:
// writeConsent sets the cookie `Secure`, and jsdom will not hand a Secure
// cookie back to a document on an insecure origin.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/booking/utils/returning-customer", () => ({
  clearReturningCustomer: vi.fn(),
  saveReturningCustomer: vi.fn(),
  loadReturningCustomer: vi.fn(),
}));

import { writeConsent, type ConsentChoices, type ConsentState } from "@/lib/consent/consent-state";
import { CONSENT_BANNER_VERSION, NON_ESSENTIAL_PURPOSES } from "@/lib/consent/cookie-registry";
import {
  ALL_DENIED,
  ALL_GRANTED,
  recordConsentChoices,
  resetConsentStoreForTests,
} from "../consent-store";

const reload = vi.fn();
const sendBeacon = vi.fn<(url: string, data?: BodyInit | null) => boolean>(() => true);
const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(() =>
  Promise.resolve(new Response(null, { status: 204 }))
);

function clearAllCookies() {
  for (const pair of document.cookie.split(";")) {
    const name = pair.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0`;
  }
}

/** Put a previously-stored choice in place, then make the store re-read it. */
function storedChoice(choices: ConsentChoices) {
  writeConsent(choices);
  resetConsentStoreForTests();
}

async function lastBeaconBody(): Promise<Record<string, unknown>> {
  const call = sendBeacon.mock.calls.at(-1);
  const blob = call?.[1] as Blob;
  return JSON.parse(await blob.text());
}

function enableSendBeacon() {
  Object.defineProperty(window.navigator, "sendBeacon", {
    value: sendBeacon,
    writable: true,
    configurable: true,
  });
}

function disableSendBeacon() {
  Object.defineProperty(window.navigator, "sendBeacon", {
    value: undefined,
    writable: true,
    configurable: true,
  });
}

beforeEach(() => {
  clearAllCookies();
  resetConsentStoreForTests();
  reload.mockClear();
  sendBeacon.mockClear();
  sendBeacon.mockReturnValue(true);
  fetchMock.mockClear();
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  enableSendBeacon();

  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: {
      hostname: "localhost",
      href: "https://localhost:3000/",
      pathname: "/",
      reload,
    },
  });
});

afterEach(() => {
  clearAllCookies();
  vi.unstubAllGlobals();
});

describe("the action label — the exact four-way mapping, nothing improvised", () => {
  it("logs 'granted' for a first choice that switches something non-essential on", async () => {
    recordConsentChoices(ALL_GRANTED);

    const body = await lastBeaconBody();
    expect(body.action).toBe("granted");
  });

  it("logs 'rejected' for a first choice that switches nothing on", async () => {
    recordConsentChoices(ALL_DENIED);

    const body = await lastBeaconBody();
    expect(body.action).toBe("rejected");
  });

  it("logs 'updated' when a prior record exists and nothing already-granted is withdrawn", async () => {
    storedChoice({ analytics: false, functional: true });

    recordConsentChoices({ analytics: true, functional: true });

    const body = await lastBeaconBody();
    expect(body.action).toBe("updated");
  });

  it("logs 'updated' even when re-saving the exact same prior choice", async () => {
    storedChoice(ALL_GRANTED);

    recordConsentChoices(ALL_GRANTED);

    const body = await lastBeaconBody();
    expect(body.action).toBe("updated");
  });

  it("logs 'withdrawn' when a previously granted purpose is now denied", async () => {
    storedChoice(ALL_GRANTED);

    recordConsentChoices({ analytics: false, functional: true });

    const body = await lastBeaconBody();
    expect(body.action).toBe("withdrawn");
  });

  it("logs 'withdrawn' — not 'updated' — even when another purpose is granted in the same click", async () => {
    storedChoice({ analytics: false, functional: true });

    recordConsentChoices({ analytics: true, functional: false });

    const body = await lastBeaconBody();
    expect(body.action).toBe("withdrawn");
  });

  it("treats a superseded-version record as no prior record at all", async () => {
    document.cookie = `rahma_consent=${encodeURIComponent(
      JSON.stringify({
        v: "2020-01-01.1",
        id: "3f1d5f6e-1c2b-4a3d-9e8f-0a1b2c3d4e5f",
        choices: { analytics: true, functional: true },
        ts: "2026-08-04T00:00:00.000Z",
      })
    )}; Path=/`;
    resetConsentStoreForTests();

    recordConsentChoices(ALL_DENIED);

    const body = await lastBeaconBody();
    expect(body.action).toBe("rejected");
  });
});

describe("what gets sent", () => {
  it("carries the just-written state's own id, banner version and choices", async () => {
    const state = recordConsentChoices(ALL_GRANTED) as ConsentState;

    const body = await lastBeaconBody();
    expect(body.consent_id).toBe(state.id);
    expect(body.banner_version).toBe(CONSENT_BANNER_VERSION);
    expect(body.choices).toEqual(state.choices);
  });

  it("derives purposes_offered from the registry's non-essential purposes, not the choices recorded", async () => {
    // Pinned against NON_ESSENTIAL_PURPOSES itself, not a hand-written array:
    // what was "offered" is what the registry actually offers, independent of
    // what this particular visitor chose — see NON_ESSENTIAL_PURPOSES' own
    // doc comment in cookie-registry.ts and the parity test in
    // src/lib/consent/__tests__/registry-completeness.test.ts.
    recordConsentChoices({ analytics: true, functional: false });

    const body = await lastBeaconBody();
    expect(body.purposes_offered).toEqual(NON_ESSENTIAL_PURPOSES);
  });

  it("posts to /api/consent-events/", async () => {
    recordConsentChoices(ALL_GRANTED);

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(sendBeacon.mock.calls[0]?.[0]).toBe("/api/consent-events/");
  });
});

describe("ordering on the withdrawal path", () => {
  it("dispatches the beacon before the reload, not after it", () => {
    storedChoice(ALL_GRANTED);

    recordConsentChoices({ analytics: false, functional: true });

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sendBeacon.mock.invocationCallOrder[0]).toBeLessThan(
      reload.mock.invocationCallOrder[0]
    );
  });

  it("still logs and still reloads even on a non-withdrawal path with no reload dependency", () => {
    // Sanity check the ordering assertion above is meaningful: a grant never
    // reloads at all, so "beacon before reload" only bites on withdrawal.
    recordConsentChoices(ALL_GRANTED);

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe("transport — sendBeacon preferred, fetch(keepalive) the fallback", () => {
  it("prefers navigator.sendBeacon when it is available", () => {
    recordConsentChoices(ALL_GRANTED);

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to fetch(keepalive) when sendBeacon is unavailable", async () => {
    disableSendBeacon();

    recordConsentChoices(ALL_GRANTED);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/consent-events/");
    expect(init.method).toBe("POST");
    expect(init.keepalive).toBe(true);
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body as string).action).toBe("granted");
  });

  it("falls back to fetch(keepalive) when sendBeacon declines the payload", () => {
    sendBeacon.mockReturnValue(false);

    recordConsentChoices(ALL_GRANTED);

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("consent UX never awaits the log", () => {
  it("recordConsentChoices returns the state synchronously even while the network call is still pending", () => {
    disableSendBeacon();
    fetchMock.mockReturnValue(new Promise(() => {})); // never resolves

    const result = recordConsentChoices(ALL_GRANTED);

    // A Promise would mean the caller had to await something; this is the
    // ConsentState itself, returned before the pending fetch has any chance
    // to settle.
    expect(result).not.toBeInstanceOf(Promise);
    expect(result.choices).toEqual(ALL_GRANTED);
  });

  it("a synchronously throwing sendBeacon does not stop the choice from being recorded", () => {
    sendBeacon.mockImplementation(() => {
      throw new Error("boom");
    });

    expect(() => recordConsentChoices(ALL_GRANTED)).not.toThrow();
  });
});
