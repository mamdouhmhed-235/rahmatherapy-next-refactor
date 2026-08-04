"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ConsentActionButton } from "./ConsentActionButton";
import { ConsentPreferencesPanel } from "./ConsentPreferencesPanel";
import {
  ALL_DENIED,
  ALL_GRANTED,
  openConsentPanel,
  recordConsentChoices,
  useConsent,
} from "./consent-store";

// C-18 Phase C Step 5 — the first layer, plus the one mount point for the
// preferences panel and the two ways of opening it.
//
// NO COOKIE WALL (brief §2.3, user requirement 6). The banner is a bottom-
// anchored card, not an overlay: no backdrop, no scroll lock, no `inert` on the
// page behind it. The fixed wrapper is `pointer-events-none` so the transparent
// margin around the card never swallows a click meant for the page underneath;
// only the card itself takes pointer events.
//
// Z-ORDER (C18-F4; the panel's values are in ConsentPreferencesPanel.tsx):
//   banner 900 — above the site header (100, src/styles/site-parity.css:384),
//   its hamburger button (101) and the custom scrollbar (45); below the skip
//   link (1000, src/app/(public)/layout.tsx) and below the booking dialog's
//   backdrop (9998) and popup (9999). The banner sitting under the booking
//   dialog is the accepted posture: it is unreachable while that dialog is
//   open, and it must never overlay the dialog's action row.
//
// WHY NOTHING IS RENDERED UNTIL THE COOKIE HAS BEEN READ: see consent-store.ts.
// `undefined` is "not read yet" and renders nothing, so a visitor who already
// answered never sees the banner flash up and disappear.
const COOKIE_SETTINGS_TRIGGER = '[data-cookie-settings-trigger="true"]';
const COOKIE_SETTINGS_PARAM = "cookie-settings";

// BUNDLE. Banner + panel together measure +15.3 kB raw on every public page
// (home's prerendered script set: 832.6 -> 847.9 kB), about 4.7 kB gzipped at
// this bundle's own measured 3.2:1 ratio — inside the brief's ~4-5 kB estimate
// and its +5 kB ceiling. The brief allows lazy-loading "if measured heavy";
// measured, it is not. Deferring the panel behind next/dynamic was tried and
// saved 4.7 kB raw (~1.5 kB gzipped) in exchange for a settings control that
// does nothing visible while its chunk downloads — a bad trade on a control
// whose whole job is to be reachable.

function BannerCard() {
  return (
    <section
      aria-label="Cookie choices"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[900] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3"
    >
      {/* The entrance is CSS, and `motion-reduce:animate-none` is the whole of
          its prefers-reduced-motion handling. The public-page convention is
          framer-motion's useReducedMotion (MotionStep, AftercareTabs,
          PackageFinder), and it was built that way first — but those components
          sit on individual pages, whereas this one is in the (public) layout,
          so its imports land in every public page's first load. Measured, the
          hook cost 0.6 kB raw there: small, but it is a JS subscription doing
          what one media query already does, and the media query cannot be out
          of date on first paint. */}
      <div className="pointer-events-auto mx-auto flex max-w-3xl animate-in flex-col gap-4 rounded-2xl border border-rahma-border bg-rahma-ivory p-4 shadow-elevated duration-300 fade-in-0 slide-in-from-bottom-4 motion-reduce:animate-none sm:p-5">
        {/* Says only what is true today. Both non-essential purposes now
            genuinely wait for an answer — functional since Phase C, analytics
            since Phase D — so this sentence says so plainly instead of the
            "not everything waits for your answer yet" caveat it carried while
            that was still the case. It names the two purposes rather than
            claiming "nothing else runs", which would over-reach: the linked
            page carries the one narrow exception (staff-only admin pages). */}
        <p className="text-sm leading-6 text-rahma-charcoal">
          We store a few things on your device to make this site work. Analytics, and
          remembering your details for next time, wait for your answer.{" "}
          <Link
            href="/cookies/"
            className="font-semibold text-rahma-green underline underline-offset-2"
          >
            What we store, and what your choice changes
          </Link>
          .
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <ConsentActionButton onClick={() => recordConsentChoices(ALL_GRANTED)}>
            Accept all
          </ConsentActionButton>
          <ConsentActionButton onClick={() => recordConsentChoices(ALL_DENIED)}>
            Reject all
          </ConsentActionButton>
          {/* `appearance-none border-0 bg-transparent` is load-bearing, not
              tidiness: this project loads tailwindcss/theme.css and
              tailwindcss/utilities.css but no preflight (src/app/globals.css),
              so a <button> with no explicit border or background renders with
              the user agent's own grey fill and outset border. The two action
              buttons happen to escape it by setting both; this one has to say
              so. */}
          <button
            type="button"
            onClick={openConsentPanel}
            className="inline-flex min-h-11 flex-1 appearance-none items-center justify-center rounded-full border-0 bg-transparent px-6 py-2 text-sm font-semibold text-rahma-green underline underline-offset-4 transition-colors duration-[var(--motion-duration-fast)] hover:text-rahma-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue sm:flex-none"
          >
            Cookie settings
          </button>
        </div>
      </div>
    </section>
  );
}

export function CookieBanner() {
  const consent = useConsent();

  // Two ways in, both wired here rather than on the pages that offer them, so a
  // link only needs the marker attribute (or the query parameter) and nothing
  // has to become a client component to open the panel. The /cookies page's
  // "change your choices" link already carries both; Phase F's footer link will
  // need neither a component nor a change here.
  useEffect(() => {
    const params = new URL(window.location.href).searchParams;
    if (params.get(COOKIE_SETTINGS_PARAM) === "1") {
      openConsentPanel();
    }
  }, []);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest(COOKIE_SETTINGS_TRIGGER)) return;

      event.preventDefault();
      openConsentPanel();
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return (
    <>
      {consent === null ? <BannerCard /> : null}
      <ConsentPreferencesPanel />
    </>
  );
}
