import { cookies } from "next/headers";
import { CONSENT_COOKIE, readConsent } from "@/lib/consent/consent-state";

// C-18 Phase B Step 4 — Google Consent Mode v2, default-denied, first thing on
// the page.
//
// MECHANISM (locked by decision D16 / finding C18-F1): a plain inline
// <script> rendered through dangerouslySetInnerHTML from a SERVER component.
// Deliberately NOT next/script with strategy="beforeInteractive" — Next 16.2.4
// only honours that in the root layout (src/app/layout.tsx), which is
// do-not-touch. Inline content was never the problem; placement was.
//
// ORDERING: this renders first in (public)/layout.tsx, so it is the first
// script *content* in the streamed HTML — everything before it is Next's own
// async runtime-chunk <script src> tags in <head>. That is a weaker guarantee
// than pre-hydration, and it is enough here for one reason: no Google code
// exists on the page at all until the consent-gated loader mounts it (Phase D),
// so "default before Google" holds by construction rather than by racing.
//
// wait_for_update:500 gives an in-page consent update half a second to arrive
// before any tag that did load acts on the defaults.
//
// First-party inline only. This component makes ZERO external requests.

const DEFAULT_DENIED = `window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{'ad_storage':'denied','analytics_storage':'denied','ad_user_data':'denied','ad_personalization':'denied','wait_for_update':500});`;

const RESTORE_GRANTED = `gtag('consent','update',{'analytics_storage':'granted'});`;

export async function ConsentScripts() {
  const cookieStore = await cookies();
  const stored = cookieStore.get(CONSENT_COOKIE)?.value;

  // Rebuilt into a cookie-header fragment so one reader serves both sides.
  // readConsent percent-decodes and tolerates an already-decoded value, which
  // is what a server-side cookie API may hand back.
  const consent = stored ? readConsent(`${CONSENT_COOKIE}=${stored}`) : null;

  // A returning visitor who granted analytics gets the update in this SAME
  // script, not from a client effect: by the time anything else on the page
  // runs, the state is already correct, so there is no window in which their
  // consent reads as denied.
  const script = consent?.choices.analytics
    ? `${DEFAULT_DENIED}\n${RESTORE_GRANTED}`
    : DEFAULT_DENIED;

  return <script id="consent-default" dangerouslySetInnerHTML={{ __html: script }} />;
}
