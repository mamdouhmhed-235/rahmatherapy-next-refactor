// F9 guard — performance transactions must be scrubbed, not just error events.
//
// ⛔ WHY. `beforeSend` only ever sees ERROR events. Sentry also samples
// PERFORMANCE transactions, and those carry the request URL. `/booking/manage`
// receives the customer's booking-management bearer token as a query parameter
// (src/app/booking/manage/page.tsx), and anyone holding that token can view and
// change that booking. At tracesSampleRate 0.1 in production a regression here
// would leak steadily rather than once.
//
// The fix (commit 58c22ad, 2026-08-17) added `beforeSendTransaction:
// scrubSentryEvent` to all three runtime configs and WORKS. What it never
// shipped was a test: gate 02 deleted the line from all three and the suite
// stayed at 2523/2523 green. The cause is structural — vitest.config.ts includes
// only `src/**` and `scripts/**`, so the three root-level `sentry.*.config.ts`
// files sit outside the test estate entirely.
//
// ⛔ This file reaches them by relative path rather than widening the vitest
// include, which would also sweep in next.config.ts and every other root config.
// SentryProvider.test.tsx already uses the same route for the client config.
//
// The client config is covered in SentryProvider.test.tsx instead of here: it
// also imports the consent store and calls registerReplayGate on import, and
// that file already has the whole surface mocked correctly. Duplicating it here
// would be fragile for no gain.

import { beforeEach, describe, expect, it, vi } from "vitest";

const sentryMocks = vi.hoisted(() => ({
  init: vi.fn(),
  addEventProcessor: vi.fn(),
  addIntegration: vi.fn(),
  replayIntegration: vi.fn(),
  getReplay: vi.fn(),
  captureRouterTransitionStart: vi.fn(),
  makeNodeTransport: vi.fn(),
  createTransport: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => sentryMocks);

const CONFIGS = [
  ["server", () => import("../../../../sentry.server.config")],
  ["edge", () => import("../../../../sentry.edge.config")],
] as const;

const TOKEN = "3f8a1c02-5b7e-4d19-9a6f-2c4e8b1d7a35";
// ⛔ rahmatherapy.example, NOT the live origin. canonical-domain.test.ts scans
// test files and comments too, and fails if the real origin is hard-coded
// anywhere but the one module that owns it (gotchas 92 and 127). The host is
// irrelevant to what this file proves.
const MANAGE_URL = `https://rahmatherapy.example/booking/manage?token=${TOKEN}`;

describe.each(CONFIGS)("%s Sentry config", (_name, loadConfig) => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("registers beforeSendTransaction, not only beforeSend", async () => {
    await loadConfig();

    expect(sentryMocks.init).toHaveBeenCalledTimes(1);
    const options = sentryMocks.init.mock.calls[0][0];

    expect(typeof options.beforeSend).toBe("function");
    // ⛔ the assertion gate 02 proved was missing everywhere
    expect(typeof options.beforeSendTransaction).toBe("function");
  });

  it("actually removes a booking-management token from a transaction URL", async () => {
    // A type check alone would pass against an empty function, so this feeds the
    // hook a realistic transaction and demands the token be gone.
    await loadConfig();
    const { beforeSendTransaction } = sentryMocks.init.mock.calls[0][0];

    const scrubbed = beforeSendTransaction({
      type: "transaction",
      transaction: "/booking/manage",
      request: { url: MANAGE_URL },
    });

    const serialised = JSON.stringify(scrubbed);
    expect(serialised).not.toContain(TOKEN);
    // non-vacuity: the event must still exist and still name the route, so a
    // hook that simply returned null would not pass this
    expect(serialised).toContain("/booking/manage");
  });

  it("scrubs a manage token wherever it appears in the event", async () => {
    await loadConfig();
    const { beforeSendTransaction } = sentryMocks.init.mock.calls[0][0];

    const scrubbed = beforeSendTransaction({
      type: "transaction",
      transaction: `GET ${MANAGE_URL}`,
      request: { url: MANAGE_URL, headers: { Referer: MANAGE_URL } },
      contexts: { trace: { data: { "http.url": MANAGE_URL } } },
    });

    // ⛔ Whole-payload check. The risk is the token reaching Sentry by ANY
    // route, not only the field we happened to think of.
    expect(JSON.stringify(scrubbed)).not.toContain(TOKEN);
  });
});
