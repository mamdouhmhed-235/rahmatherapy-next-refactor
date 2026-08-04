import { CONSENT_COOKIE } from "@/lib/consent/consent-state";
import { CONSENT_BANNER_VERSION } from "@/lib/consent/cookie-registry";

// C-18 Phase B Step 4 — Google Consent Mode v2, default-denied, first thing on
// the page.
//
// MECHANISM (locked by decision D16 / finding C18-F1): a plain inline
// <script> rendered through dangerouslySetInnerHTML from a SERVER component.
// Deliberately NOT next/script with strategy="beforeInteractive" — Next 16.2.4
// only honours that in the root layout (src/app/layout.tsx), which is
// do-not-touch. Inline content was never the problem; placement was.
//
// WHY THE COOKIE IS READ IN THE BROWSER AND NOT ON THE SERVER (Owner decision,
// 2026-08-04). Reading it here with cookies() from next/headers would:
//   (a) bake ONE visitor's consent state into HTML that Cloudflare edge-caches
//       and can then serve to a DIFFERENT visitor, and
//   (b) opt the whole (public) route group out of static generation — in Next
//       16.2.4 any cookies() call reaches throwToInterruptStaticGeneration
//       (node_modules/next/dist/server/request/cookies.js:88).
// (a) is the correctness reason and (b) is the price the framework charges to
// make (a) safe. Reading document.cookie inside this same inline script is both
// correct behind a shared cache and free of any dynamic API, so the 15
// prerendered public pages stay prerendered.
//
// The read still happens at script PARSE time — before hydration, before any
// React effect, and before any Google code exists on the page at all — so a
// returning visitor who granted analytics never has a window in which their
// state reads as denied. No client component, no useEffect, zero external
// requests.
//
// wait_for_update:500 gives an in-page consent update half a second to arrive
// before any tag that did load acts on the defaults.

const DEFAULT_DENIED = `window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{'ad_storage':'denied','analytics_storage':'denied','ad_user_data':'denied','ad_personalization':'denied','wait_for_update':500});`;

const RESTORE_GRANTED = `gtag('consent','update',{'analytics_storage':'granted'});`;

// THE SECOND-SOURCE-OF-TRUTH RISK, AND WHAT HOLDS IT SHUT. An inline script is
// a string: it cannot import, so the rules below are unavoidably a second copy
// of readConsent() in src/lib/consent/consent-state.ts, and a copy that drifts
// would grant or withhold consent on different rules than the rest of the app —
// silently. Three things keep the copies honest:
//   1. The cookie NAME and the banner VERSION are interpolated from their single
//      definitions. Neither literal is ever retyped here.
//   2. The rules are deliberately the SAME rules, in the same order — exact
//      cookie-name match (not a substring: `not_rahma_consent` must not match),
//      percent-decode with the raw value as fallback, JSON.parse, then v / id /
//      ts / choices / every key of ConsentChoices. readConsent's `id` and `ts`
//      checks are included for that reason alone: without them a hand-made
//      cookie carrying only {v, choices} would be honoured here and rejected
//      everywhere else. The same argument is why `choices.functional` is
//      type-checked here even though Consent Mode has no functional signal:
//      readConsent rejects a record that does not carry every purpose, so a
//      script that granted on {analytics:true} alone would grant on a record
//      the rest of the app treats as no consent at all — and the banner would
//      then be shown to someone whose analytics had already been turned on.
//   3. __tests__/ConsentScripts.test.tsx evaluates this exact emitted string
//      against readConsent() over one shared corpus of cookie values and asserts
//      they agree on every entry. If either side's rules move, that test fails.
//
// Everything is wrapped in try/catch and falls through to denied: an uncaught
// JSON parse error in a page's first script would be a page-breaking error for
// every visitor, and denied is the safe direction to fail in. The IIFE keeps the
// parse locals off `window`.
//
// Both interpolated constants are internal build-time literals, never visitor
// input, so nothing can escape the <script> element through them.
const READ_COOKIE = `(function(){try{
var n=${JSON.stringify(CONSENT_COOKIE)},p=document.cookie.split(';'),r=null;
for(var i=0;i<p.length;i++){var q=p[i].indexOf('=');if(q<0)continue;if(p[i].slice(0,q).trim()!==n)continue;r=p[i].slice(q+1).trim();break;}
if(!r)return;
var d;try{d=decodeURIComponent(r);}catch(_d){d=r;}
var s=JSON.parse(d);
if(s&&typeof s==='object'&&s.v===${JSON.stringify(CONSENT_BANNER_VERSION)}&&typeof s.id==='string'&&s.id&&typeof s.ts==='string'&&s.ts&&s.choices&&typeof s.choices.analytics==='boolean'&&typeof s.choices.functional==='boolean'&&s.choices.analytics===true){${RESTORE_GRANTED}}
}catch(_e){}})();`;

/**
 * The emitted script body. Exported for its equivalence test, which has to
 * evaluate the very string that ships rather than a re-derivation of it.
 */
export const CONSENT_SCRIPT = `${DEFAULT_DENIED}\n${READ_COOKIE}`;

export function ConsentScripts() {
  return <script id="consent-default" dangerouslySetInnerHTML={{ __html: CONSENT_SCRIPT }} />;
}
