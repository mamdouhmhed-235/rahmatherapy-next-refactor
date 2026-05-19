// Next.js v15+ instrumentation hook — wires the per-runtime Sentry configs
// at server startup. @sentry/nextjs v8+ (v10.51.0 here) requires this file at
// the project root; without it, `sentry.server.config.ts` and
// `sentry.edge.config.ts` are bundled by `withSentryConfig` but their
// `Sentry.init()` calls never execute at runtime, so the SDK never establishes
// a transport client and captured events have nowhere to ship.
//
// Diagnosed during engineering pause Session 5a (Layer 1 L1-a/L1-b). The
// build-time wrapper still emits `__SENTRY_ERROR_LOCAL_VARIABLES__` markers
// into error stacks, which is why server errors APPEARED to be captured in
// the dev terminal — but with no runtime init, the SDK never POSTs to Sentry.
//
// Canonical wiring per Sentry's @sentry/nextjs docs:
//   - `register()` is called once at Next.js startup. Dispatch by runtime so
//     each config only loads in the matching environment.
//   - `onRequestError = Sentry.captureRequestError` is the Next.js v15+ hook
//     for uncaught route-handler errors (the path our /sentry-test throw
//     travels through).

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
