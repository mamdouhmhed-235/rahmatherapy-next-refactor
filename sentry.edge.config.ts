import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "./src/lib/observability/sentry-scrubbing";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  enableLogs: true,
  beforeSend: scrubSentryEvent,
  // F9 (2026-08-17): `beforeSend` only sees ERROR events. Performance
  // transactions carry the request URL, and `/booking/manage?token=...` would
  // otherwise reach Sentry unscrubbed at tracesSampleRate 0.1 in production.
  beforeSendTransaction: scrubSentryEvent,
});
