"use client";

import Script from "next/script";
import { useConsent } from "./consent/consent-store";

// C-18 Phase D Step 8 — the consent gate C-17 left a marker for.
//
// TWO CONDITIONS, both required, neither weakened:
//   1. C-17's original check, unchanged in meaning: a measurement id must be
//      configured AND NODE_ENV must be "production". GA_ID stays a
//      module-level constant because Next only inlines a NEXT_PUBLIC_* value
//      where it can see the literal member expression at build time.
//   2. The visitor's stored choice must actually grant analytics — read
//      through the Phase C consent store rather than document.cookie directly,
//      so that a grant made during this page's lifetime notifies this
//      component and mounts gtag WITHOUT a navigation (brief §2.2 grant flow).
//
// FAIL-CLOSED. The store's snapshot is `undefined` before the cookie has been
// read and `null` when there is nothing to rely on; only an explicit stored
// `true` passes. Silence is never consent.
//
// THE SERVER RENDER EMITS NOTHING, for anyone. getServerConsentSnapshot()
// returns `undefined` by construction (consent-store.ts), so no prerendered
// HTML ever contains gtag markup. That is deliberate twice over: consent is
// per-visitor state and these pages are CDN-cached, so baking one visitor's
// state into the HTML would hand it to the next visitor; and reading the
// cookie during the render would opt the whole (public) route group out of
// static generation (Owner decision 5, progress §3.2).
//
// BASIC CONSENT MODE (brief §2.2, acceptance #1). This component is the only
// place in the app that names a Google host, so before a grant there is no
// Google code on the page at all — zero requests to any Google host, not
// merely cookieless ones. The registry's standing rule keeps it that way: a
// new tag ships through this gate or not at all.
//
// NOT MOUNTED ON /booking/manage, and it must never be. That route carries the
// customer's booking-management bearer token in the query string and GA4's
// default page_location is window.location.href, so a mount there would send a
// live credential to Google. C-17 shipped that mount, an independent verifier
// caught it, and it was removed;
// src/app/booking/__tests__/no-google-analytics.test.ts fails if it comes back.
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export function GoogleAnalytics() {
  const consent = useConsent();

  if (!GA_ID || process.env.NODE_ENV !== "production") return null;
  if (consent?.choices.analytics !== true) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      {/* The stub is kept from C-17 so this script does not depend on
          ConsentScripts having run. When it has — which is always, on the
          layouts this mounts from — dataLayer already holds the default-denied
          call and the grant's update, so gtag.js reads the right state the
          moment it evaluates. Nothing explaining that belongs INSIDE the
          template literal: its contents ship to the browser verbatim. */}
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  );
}
