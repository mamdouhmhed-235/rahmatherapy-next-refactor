// @vitest-environment jsdom
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
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";

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
  sentryMocks.replayIntegration.mockImplementation((options: unknown) => ({
    name: "Replay",
    options,
  }));
  sentryMocks.getReplay.mockReturnValue(undefined);
  navigationMocks.usePathname.mockReturnValue("/");
});

afterEach(() => {
  cleanup();
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

describe("SentryProvider", () => {
  it("starts Replay on a public route", async () => {
    await renderProviderAt("/");

    await waitFor(() =>
      expect(sentryMocks.addIntegration).toHaveBeenCalledTimes(1)
    );
    expect(sentryMocks.replayIntegration).toHaveBeenCalledTimes(1);
  });

  it("never starts Replay on a direct load of /booking/manage", async () => {
    await renderProviderAt(MANAGE_PATH);

    expect(sentryMocks.addIntegration).not.toHaveBeenCalled();
    expect(sentryMocks.replayIntegration).not.toHaveBeenCalled();
    // Error reporting still comes up on the blocked route.
    expect(sentryMocks.init).toHaveBeenCalledTimes(1);
  });

  it("stops a running Replay when a client-side navigation enters /booking/manage", async () => {
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
