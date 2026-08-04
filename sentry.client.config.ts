import * as Sentry from "@sentry/nextjs";
import type { Event } from "@sentry/nextjs";
import { scrubSentryEvent } from "./src/lib/observability/sentry-scrubbing";

// `/booking/manage` receives the customer's booking-management bearer token as
// a URL query parameter (`?token=...` — src/app/booking/manage/page.tsx).
// Session Replay copies `window.location` verbatim into `replay_event.urls[]`,
// into `replay_event.request.url` (HttpContext `preprocessEvent`) and into the
// recording's navigation frames — and none of those reach `beforeSend`, because
// Replay bypasses the client's event pipeline entirely. Evidence:
// redesign/evidence/C-18/sentry-replay-investigation.md.
//
// So Replay is no longer an unconditional `Sentry.init` integration: it is
// started per route by `syncSessionReplay()` below and is never started on a
// blocked path. Error reporting is untouched and stays on for every route.
const REPLAY_BLOCKED_PATH = "/booking/manage";

/**
 * True for `/booking/manage` and anything beneath it, with or without the
 * trailing slash Next.js adds (`trailingSlash: true`, next.config.ts).
 */
export function isReplayBlockedPath(pathname: string): boolean {
  const normalised = pathname.replace(/\/+$/, "");
  return (
    normalised === REPLAY_BLOCKED_PATH ||
    normalised.startsWith(`${REPLAY_BLOCKED_PATH}/`)
  );
}

/** Drop the query string (i.e. the token) from a URL on a blocked path. */
function redactBlockedUrl(value: string): string {
  const queryStart = value.search(/[?#]/);
  const base = queryStart === -1 ? value : value.slice(0, queryStart);
  const pathname = base.replace(/^[a-z][a-z\d+.-]*:\/\/[^/]*/i, "");
  return isReplayBlockedPath(pathname) ? base : value;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enableLogs: true,
  beforeSend: scrubSentryEvent,
  integrations: [],
});

// `beforeSend` is gated behind `isErrorEvent()`, so it never sees a
// `replay_event`; event processors do run on one. This covers the only case in
// which a replay can hold a blocked URL at all: a client-side navigation onto
// `/booking/manage`, where the SDK records the target URL synchronously with
// `history.pushState`, before any React effect can respond.
Sentry.addEventProcessor((event) => {
  if (event.type !== "replay_event") return event;

  const replayEvent = event as Event & { urls?: string[] };
  if (Array.isArray(replayEvent.urls)) {
    replayEvent.urls = replayEvent.urls.map(redactBlockedUrl);
  }

  const request = replayEvent.request;
  if (request?.url) {
    request.url = redactBlockedUrl(request.url);
  }
  if (request?.headers && typeof request.headers.Referer === "string") {
    request.headers.Referer = redactBlockedUrl(request.headers.Referer);
  }

  return event;
});

/**
 * Start Session Replay when the route allows it, and never on a blocked one.
 *
 * `SentryProvider` calls this on mount and on every client-side route change:
 * the root layout does not remount across App Router transitions, so without
 * this a Replay session started on a public page would follow the visitor onto
 * `/booking/manage` and record its URL.
 */
export function syncSessionReplay(pathname: string): void {
  const replay = Sentry.getReplay();

  if (isReplayBlockedPath(pathname)) {
    // A direct load of a blocked path never gets here with a replay to stop —
    // the integration is not in `Sentry.init`, so nothing was ever started.
    // This only bites after a client-side navigation, where `stop()` force-
    // flushes in session mode; the event processor above and
    // `beforeAddRecordingEvent` below are what make that flush safe to send.
    void replay?.stop();
    return;
  }

  // Already added — and if it was stopped on a blocked path, deliberately left
  // stopped for the remainder of this page's life.
  if (replay) return;

  Sentry.addIntegration(
    Sentry.replayIntegration({
      // Only custom frames (breadcrumbs, performance spans) reach this hook —
      // which is exactly where a navigation writes its target URL.
      beforeAddRecordingEvent: (event) =>
        JSON.stringify(event.data).includes(REPLAY_BLOCKED_PATH) ? null : event,
    })
  );
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
