import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "./src/lib/observability/sentry-scrubbing";

// Custom fetch-based transport — workaround for getsentry/sentry-javascript#18871
// (makeNodeTransport silently drops events with Next.js 16 + Turbopack). The
// default transport uses http.request + stream pipe inside suppressTracing(),
// which interacts badly with Turbopack's async-context handling so stream
// callbacks never fire. Replacing with fetch() bypasses the broken path.
//
// Content-Type must be set explicitly — Sentry's makeNodeTransport writes it
// at the body-write step rather than in options.headers, so passing
// options.headers straight through (as the original #18871 workaround posts
// suggest) yields an envelope without Content-Type and Sentry rejects with 400.
function makeFetchTransport(options: Parameters<typeof Sentry.makeNodeTransport>[0]) {
  return Sentry.createTransport(options, async (request) => {
    const response = await fetch(options.url, {
      method: "POST",
      body: request.body as BodyInit,
      headers: {
        ...((options.headers as Record<string, string>) ?? {}),
        "Content-Type": "application/x-sentry-envelope",
      },
    });
    return {
      statusCode: response.status,
      headers: {
        "x-sentry-rate-limits": response.headers.get("X-Sentry-Rate-Limits"),
        "retry-after": response.headers.get("Retry-After"),
      },
    };
  });
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  includeLocalVariables: process.env.NODE_ENV === "development",
  enableLogs: true,
  transport: makeFetchTransport,
  beforeSend: scrubSentryEvent,
});
