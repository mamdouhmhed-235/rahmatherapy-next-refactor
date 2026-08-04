import * as Sentry from "@sentry/nextjs";
import type { Event } from "@sentry/nextjs";
import { scrubSentryEvent } from "./src/lib/observability/sentry-scrubbing";
import { readConsent } from "./src/lib/consent/consent-state";
import { registerReplayGate } from "./src/components/consent/consent-store";

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

const ADMIN_PATH = "/admin";

function normalisePath(pathname: string): string {
  return pathname.replace(/\/+$/, "");
}

/**
 * True for `/booking/manage` and anything beneath it, with or without the
 * trailing slash Next.js adds (`trailingSlash: true`, next.config.ts).
 */
export function isReplayBlockedPath(pathname: string): boolean {
  const normalised = normalisePath(pathname);
  return (
    normalised === REPLAY_BLOCKED_PATH ||
    normalised.startsWith(`${REPLAY_BLOCKED_PATH}/`)
  );
}

/**
 * True for `/admin` and everything beneath it, with or without the trailing
 * slash Next.js adds.
 *
 * Owner decision 9 (progress §3 #9, 2026-08-04) — superseding Owner decision
 * 1 for this one route group: Session Replay is switched OFF on `/admin`
 * entirely, not consent-gated there. Staff never see the consent banner (it
 * mounts only from `(public)/layout.tsx`), so a "gate" on admin could never
 * be satisfied — it would just be an elaborate way of disabling Replay while
 * dressing it up as a choice. `/admin` holds the most sensitive data in the
 * system (client records, health notes, safeguarding notes); text is masked
 * by default, but layout, click paths and record UUIDs in the URL are still
 * captured and uploaded to a third party, so it is turned off plainly
 * instead. Error reporting is untouched — `Sentry.init` above runs on every
 * route regardless, admin included.
 */
function isAdminPath(pathname: string): boolean {
  const normalised = normalisePath(pathname);
  return normalised === ADMIN_PATH || normalised.startsWith(`${ADMIN_PATH}/`);
}

/**
 * Which routes Session Replay needs analytics consent for — C-18 Phase D,
 * Owner decision 1 (progress §3): Replay is registered in the cookie registry
 * as an `analytics` item and gated behind that choice.
 *
 * `/admin` answers `false` here, but no longer for Phase D's reason. Owner
 * decision 9 turns Replay off on `/admin` outright — checked by `isAdminPath`
 * above, unconditionally, before `syncSessionReplay` ever asks this function
 * — so "does starting Replay here need consent" has no live answer for admin:
 * nothing ever starts there for consent to gate. `false` is kept rather than
 * flipped to `true`, since "needs consent" would misstate admin as a route a
 * grant could unlock.
 *
 * Everything else — the whole `(public)` group, `/booking/*`, 404s — is gated.
 * Unrecognised paths fall on the gated side, which is the fail-closed one.
 */
export function replayRequiresConsent(pathname: string): boolean {
  return !isAdminPath(pathname);
}

/**
 * The visitor's stored analytics choice, read through `readConsent` — the same
 * parser the banner, the panel and the gated GA loader use, so there is exactly
 * one definition of what a valid grant looks like. Anything else (absent,
 * malformed, or from a superseded banner version) is not a grant.
 */
function hasAnalyticsConsent(): boolean {
  return readConsent(document.cookie)?.choices.analytics === true;
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
 * Start Session Replay when the route AND the visitor's consent allow it, and
 * never on a blocked one — `/booking/manage` (the credential leak, Phase 0)
 * or `/admin` (Owner decision 9, off outright).
 *
 * `SentryProvider` calls this on mount and on every client-side route change:
 * the root layout does not remount across App Router transitions, so without
 * this a Replay session started on a public page would follow the visitor onto
 * `/booking/manage` or `/admin` and keep recording there. C-18 Phase D adds the
 * consent arm to the same route-aware decision rather than a second mechanism,
 * and the consent store calls this function again when a choice changes.
 *
 * Nothing here touches error reporting: `Sentry.init` above is what captures
 * errors, it runs on every route, and Owner decisions 1 and 9 both keep it
 * ungated for everyone. Only the replay recording is affected.
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

  if (isAdminPath(pathname)) {
    // Owner decision 9: off entirely, not a consent question — see
    // isAdminPath's doc comment above. A running session that a client-side
    // navigation carries onto /admin (from a public page) is stopped the same
    // way a stale session on /booking/manage is: deliberately, so a page-view
    // no admin visitor ever agreed to is never uploaded.
    void replay?.stop();
    return;
  }

  if (replayRequiresConsent(pathname) && !hasAnalyticsConsent()) {
    // No grant: never start. The `stop()` is for the withdrawal case, where the
    // consent store calls this again after rewriting the cookie — see
    // src/components/consent/consent-store.ts for what `stop()` does and does
    // not transmit at this pinned SDK version.
    void replay?.stop();
    return;
  }

  // Already added — and if it was stopped on a blocked path or a withdrawal,
  // deliberately left stopped for the remainder of this page's life.
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

// A choice made in the preferences panel has to reach Replay without waiting
// for a navigation — a withdrawal in particular, which must stop recording
// before the page reloads. The consent store cannot import this module (it is
// on every public page and the Sentry SDK is not), so the dependency is
// inverted: this module hands the store its gate as soon as SentryProvider
// loads it. See the comment on registerReplayGate for the measurement that
// settled the direction.
registerReplayGate(syncSessionReplay);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
