// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://localhost:3000/" }
//
// Credential guard (C-18). `/booking/manage` carries the customer's
// booking-management bearer token in the URL query string (see
// src/app/booking/manage/page.tsx). Sentry Session Replay copies
// `window.location` verbatim into `replay_event.urls[]`, into
// `replay_event.request.url` and into navigation frames of the recording, and
// none of those pass through `beforeSend`/`scrubSentryEvent` — Replay bypasses
// the client event pipeline (redesign/evidence/C-18/sentry-replay-investigation.md).
//
// These tests pin the property that matters: Replay is never started on
// `/booking/manage`, neither on a direct load nor after a client-side
// navigation from a public page — while error reporting still initialises
// everywhere.
//
// C-18 Phase D adds the second gate, Owner decision 1: on the public surface
// Replay also needs the visitor's analytics consent. The credential guard is
// tested to hold INDEPENDENTLY of consent — a grant must not unblock the manage
// route — because that is the interaction a future edit is most likely to break.
//
// The https origin is load-bearing, as in the consent suites: writeConsent sets
// the cookie `Secure`, and jsdom will not hand a Secure cookie back to a
// document on an insecure origin.
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { CONSENT_COOKIE } from "@/lib/consent/consent-state";
import { CONSENT_BANNER_VERSION } from "@/lib/consent/cookie-registry";

const sentryMocks = vi.hoisted(() => ({
  init: vi.fn(),
  addEventProcessor: vi.fn(),
  addIntegration: vi.fn(),
  replayIntegration: vi.fn(),
  getReplay: vi.fn(),
  captureRouterTransitionStart: vi.fn(),
}));

const navigationMocks = vi.hoisted(() => ({ usePathname: vi.fn() }));

vi.mock("@sentry/nextjs", () => sentryMocks);
vi.mock("next/navigation", () => navigationMocks);

const MANAGE_PATH = "/booking/manage/";
const TOKEN_URL = `https://rahmatherapy.example${MANAGE_PATH}?token=SECRET-TOKEN`;
const ID = "3f1d5f6e-1c2b-4a3d-9e8f-0a1b2c3d4e5f";
const TS = "2026-08-04T00:00:00.000Z";

function setRawConsentCookie(payload: unknown) {
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(payload))}; Path=/`;
}

function grantAnalytics() {
  setRawConsentCookie({
    v: CONSENT_BANNER_VERSION,
    id: ID,
    choices: { analytics: true, functional: true },
    ts: TS,
  });
}

function refuseAnalytics() {
  setRawConsentCookie({
    v: CONSENT_BANNER_VERSION,
    id: ID,
    choices: { analytics: false, functional: true },
    ts: TS,
  });
}

function clearAllCookies() {
  for (const pair of document.cookie.split(";")) {
    const name = pair.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0`;
  }
}

// Each test re-evaluates the config module so that its one-shot `Sentry.init`
// and `Sentry.addEventProcessor` side effects are observable in isolation.
async function loadConfig() {
  vi.resetModules();
  return import("../../../sentry.client.config");
}

async function renderProviderAt(pathname: string) {
  navigationMocks.usePathname.mockReturnValue(pathname);
  vi.resetModules();
  const { SentryProvider } = await import("../SentryProvider");
  const view = render(<SentryProvider />);
  // `syncSessionReplay` always asks for the current replay first, so this is
  // the signal that the provider's deferred import has resolved and run.
  await waitFor(() => expect(sentryMocks.getReplay).toHaveBeenCalled());
  return { ...view, SentryProvider };
}

beforeEach(() => {
  vi.clearAllMocks();
  clearAllCookies();
  sentryMocks.replayIntegration.mockImplementation((options: unknown) => ({
    name: "Replay",
    options,
  }));
  sentryMocks.getReplay.mockReturnValue(undefined);
  navigationMocks.usePathname.mockReturnValue("/");
});

afterEach(() => {
  cleanup();
  clearAllCookies();
});

describe("Sentry client config", () => {
  it("initialises error reporting with no Replay integration", async () => {
    await loadConfig();

    expect(sentryMocks.init).toHaveBeenCalledTimes(1);
    const options = sentryMocks.init.mock.calls[0][0];
    expect(options.integrations).toEqual([]);
    expect(typeof options.beforeSend).toBe("function");
    expect(sentryMocks.replayIntegration).not.toHaveBeenCalled();
  });

  it("blocks /booking/manage and nothing that merely looks like it", async () => {
    const { isReplayBlockedPath } = await loadConfig();

    expect(isReplayBlockedPath("/booking/manage")).toBe(true);
    expect(isReplayBlockedPath("/booking/manage/")).toBe(true);
    expect(isReplayBlockedPath("/booking/manage/cancel/")).toBe(true);
    expect(isReplayBlockedPath("/")).toBe(false);
    expect(isReplayBlockedPath("/services/")).toBe(false);
    expect(isReplayBlockedPath("/booking/manage-anything/")).toBe(false);
  });

  it("redacts the token from replay_event URLs but leaves error events alone", async () => {
    await loadConfig();

    const processEvent = sentryMocks.addEventProcessor.mock.calls[0][0];
    const replayEvent = processEvent(
      {
        type: "replay_event",
        urls: [TOKEN_URL, `${MANAGE_PATH}?token=SECRET-TOKEN`, "/services/"],
        request: { url: TOKEN_URL, headers: { Referer: TOKEN_URL } },
      },
      {}
    );

    expect(JSON.stringify(replayEvent)).not.toContain("SECRET-TOKEN");
    expect(replayEvent.urls).toEqual([
      `https://rahmatherapy.example${MANAGE_PATH}`,
      MANAGE_PATH,
      "/services/",
    ]);
    expect(replayEvent.request.url).toBe(
      `https://rahmatherapy.example${MANAGE_PATH}`
    );

    // Error events stay untouched — `beforeSend`/`scrubSentryEvent` owns those.
    const errorEvent = { message: "boom", request: { url: TOKEN_URL } };
    expect(processEvent(errorEvent, {})).toBe(errorEvent);
  });

  it("drops recording frames that reference the manage route", async () => {
    grantAnalytics();
    const { syncSessionReplay } = await loadConfig();
    syncSessionReplay("/");

    const { beforeAddRecordingEvent } =
      sentryMocks.replayIntegration.mock.calls[0][0];

    const navigationFrame = {
      type: 5,
      timestamp: 1,
      data: {
        tag: "performanceSpan",
        payload: {
          op: "navigation.push",
          description: `${MANAGE_PATH}?token=SECRET-TOKEN`,
        },
      },
    };
    expect(beforeAddRecordingEvent(navigationFrame)).toBeNull();

    const clickFrame = {
      type: 5,
      timestamp: 1,
      data: { tag: "breadcrumb", payload: { category: "ui.click" } },
    };
    expect(beforeAddRecordingEvent(clickFrame)).toBe(clickFrame);
  });
});

describe("SentryProvider — the credential guard, consent or no consent", () => {
  it("never starts Replay on a direct load of /booking/manage", async () => {
    await renderProviderAt(MANAGE_PATH);

    expect(sentryMocks.addIntegration).not.toHaveBeenCalled();
    expect(sentryMocks.replayIntegration).not.toHaveBeenCalled();
    // Error reporting still comes up on the blocked route.
    expect(sentryMocks.init).toHaveBeenCalledTimes(1);
  });

  it("still never starts Replay on /booking/manage when analytics consent IS granted", async () => {
    // The regression that matters most. Consent is about analytics; the manage
    // route is about a bearer token in the URL. A visitor saying yes to
    // analytics has not agreed to hand their booking credential to Sentry, so
    // the two gates are independent and the blocked path wins outright.
    grantAnalytics();
    await renderProviderAt(MANAGE_PATH);

    expect(sentryMocks.addIntegration).not.toHaveBeenCalled();
    expect(sentryMocks.replayIntegration).not.toHaveBeenCalled();
    expect(sentryMocks.init).toHaveBeenCalledTimes(1);
  });

  it("stops a running Replay when a client-side navigation enters /booking/manage", async () => {
    grantAnalytics();
    const { rerender, SentryProvider } = await renderProviderAt("/");
    await waitFor(() =>
      expect(sentryMocks.addIntegration).toHaveBeenCalledTimes(1)
    );

    // The App Router keeps the root layout mounted, so the session started on
    // `/` is still running when the manage route is entered.
    const runningReplay = { name: "Replay", stop: vi.fn(() => Promise.resolve()) };
    sentryMocks.getReplay.mockReturnValue(runningReplay);
    navigationMocks.usePathname.mockReturnValue(MANAGE_PATH);
    rerender(<SentryProvider />);

    await waitFor(() => expect(runningReplay.stop).toHaveBeenCalledTimes(1));
    expect(sentryMocks.addIntegration).toHaveBeenCalledTimes(1);
  });
});

describe("SentryProvider — the analytics consent gate (C-18 Phase D)", () => {
  it("starts Replay on a public route once analytics consent is granted", async () => {
    grantAnalytics();
    await renderProviderAt("/");

    await waitFor(() =>
      expect(sentryMocks.addIntegration).toHaveBeenCalledTimes(1)
    );
    expect(sentryMocks.replayIntegration).toHaveBeenCalledTimes(1);
  });

  it("does not start Replay on a public route when no choice has been made", async () => {
    await renderProviderAt("/");

    expect(sentryMocks.addIntegration).not.toHaveBeenCalled();
    expect(sentryMocks.replayIntegration).not.toHaveBeenCalled();
    // Error reporting is untouched by the consent question (Owner decision 1).
    expect(sentryMocks.init).toHaveBeenCalledTimes(1);
  });

  it("does not start Replay on a public route when analytics is refused", async () => {
    refuseAnalytics();
    await renderProviderAt("/services/");

    expect(sentryMocks.addIntegration).not.toHaveBeenCalled();
  });

  it("does not start Replay on a grant from a superseded banner version", async () => {
    setRawConsentCookie({
      v: "2020-01-01.1",
      id: ID,
      choices: { analytics: true, functional: true },
      ts: TS,
    });
    await renderProviderAt("/");

    expect(sentryMocks.addIntegration).not.toHaveBeenCalled();
  });

  it("stops a Replay that is running when the gate no longer allows it", async () => {
    // The withdrawal path: the consent store rewrites the cookie and calls
    // syncSessionReplay again for the page the visitor is already on.
    grantAnalytics();
    const { syncSessionReplay } = await loadConfig();
    const runningReplay = { name: "Replay", stop: vi.fn(() => Promise.resolve()) };
    sentryMocks.getReplay.mockReturnValue(runningReplay);

    refuseAnalytics();
    syncSessionReplay("/");

    expect(runningReplay.stop).toHaveBeenCalledTimes(1);
    expect(sentryMocks.addIntegration).not.toHaveBeenCalled();
  });
});

describe("the consent gate is scoped to the public surface", () => {
  it("treats every non-admin route as needing consent, and /admin as not", async () => {
    const { replayRequiresConsent } = await loadConfig();

    expect(replayRequiresConsent("/")).toBe(true);
    expect(replayRequiresConsent("/services/")).toBe(true);
    expect(replayRequiresConsent("/cookies/")).toBe(true);
    expect(replayRequiresConsent("/booking/manage/")).toBe(true);
    // Not admin, despite the prefix — the boundary is a path segment.
    expect(replayRequiresConsent("/administrator/")).toBe(true);

    expect(replayRequiresConsent("/admin")).toBe(false);
    expect(replayRequiresConsent("/admin/")).toBe(false);
    expect(replayRequiresConsent("/admin/login/")).toBe(false);
    expect(replayRequiresConsent("/admin/dashboard/")).toBe(false);
  });

  it("keeps staff error-replay running on /admin with no consent record at all", async () => {
    // Deliberate, and documented in sentry.client.config.ts and in the
    // sentryReplaySession registry entry: the banner is mounted from
    // (public)/layout.tsx only, so a consent record can never be written on
    // /admin. Gating there would switch staff error-replay off permanently with
    // no way to switch it back on.
    await renderProviderAt("/admin/dashboard/");

    await waitFor(() =>
      expect(sentryMocks.addIntegration).toHaveBeenCalledTimes(1)
    );
  });
});
