// C-18 Phase B — the consent cookie: reading it, writing it, and the
// GA-cookie cleanup a withdrawal has to perform.
//
// The choice lives in a first-party COOKIE rather than localStorage on
// purpose (brief §2.2): a cookie rides the document request, so the server can
// read it while rendering and put the correct Consent Mode state into the
// page's first inline script — no client effect, no flash of the wrong state —
// and the browser enforces the expiry for us.
//
// writeConsent() is called from the consent store
// (src/components/consent/consent-store.ts) when a visitor answers the banner
// or saves from the preferences panel — the only two places a choice is
// recorded. readConsent() is what the two consent-gated loaders act on:
// src/components/GoogleAnalytics.tsx (through the store) and Session Replay's
// route gate in sentry.client.config.ts (directly).
import { CONSENT_BANNER_VERSION } from "./cookie-registry";

/**
 * The visitor's answer for every non-essential purpose in the registry —
 * CookiePurpose minus "essential", which is never a choice.
 *
 * One key per purpose, not a partial map: a record that omits a purpose is a
 * record that cannot say whether the visitor was ever asked about it, so
 * `readConsent` rejects it outright rather than guessing. Adding a purpose to
 * COOKIE_REGISTRY therefore means adding a key here, adding it to the inline
 * script's guard in src/components/consent/ConsentScripts.tsx, and bumping
 * CONSENT_BANNER_VERSION so every stored record is re-collected.
 */
export interface ConsentChoices {
  analytics: boolean;
  functional: boolean;
}

export interface ConsentState {
  /** Banner version in force when the choice was made; a bump invalidates it. */
  v: string;
  /** Pseudonymous id — minted once, then preserved across later choices. */
  id: string;
  choices: ConsentChoices;
  /** ISO timestamp of the choice. */
  ts: string;
}

export const CONSENT_COOKIE = "rahma_consent";

/** ~6 months — the ICO's recommended re-prompt interval (brief §1). */
export const CONSENT_MAX_AGE_S = 60 * 60 * 24 * 182;

const EXPIRED_DATE = "Thu, 01 Jan 1970 00:00:00 GMT";

function cookieNameOf(pair: string): string {
  const separator = pair.indexOf("=");
  return (separator === -1 ? pair : pair.slice(0, separator)).trim();
}

function readRawCookie(cookieString: string, name: string): string | null {
  for (const pair of cookieString.split(";")) {
    const separator = pair.indexOf("=");
    if (separator === -1) continue;
    if (cookieNameOf(pair) !== name) continue;
    return pair.slice(separator + 1).trim();
  }
  return null;
}

// writeConsent percent-encodes the JSON payload because it contains commas,
// which are not safe in a raw cookie value. Server-side cookie APIs
// (next/headers) may hand the value back already decoded, so decoding is
// attempted and the raw string used on failure — decoding an already-decoded
// payload is a no-op here, since the payload never contains a literal "%".
function decodeCookieValue(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Parses the cookie without applying the version check, so `writeConsent` can
 * still recover the pseudonymous id from a consent record that a banner-version
 * bump has invalidated.
 */
function parseConsentCookie(cookieString: string | null | undefined): ConsentState | null {
  if (!cookieString) return null;

  const raw = readRawCookie(cookieString, CONSENT_COOKIE);
  if (!raw) return null;

  let value: unknown;
  try {
    value = JSON.parse(decodeCookieValue(raw));
  } catch {
    return null;
  }

  if (typeof value !== "object" || value === null) return null;
  const { v, id, choices, ts } = value as Record<string, unknown>;
  if (typeof v !== "string" || !v) return null;
  if (typeof id !== "string" || !id) return null;
  if (typeof ts !== "string" || !ts) return null;
  if (typeof choices !== "object" || choices === null) return null;

  const { analytics, functional } = choices as Record<string, unknown>;
  if (typeof analytics !== "boolean") return null;
  if (typeof functional !== "boolean") return null;

  return { v, id, choices: { analytics, functional }, ts };
}

/**
 * The visitor's current, still-valid choice, or null.
 *
 * Null on absent, malformed, or version-mismatched — all three mean the same
 * thing operationally: there is no consent to rely on, so the banner shows and
 * nothing non-essential runs. Expiry needs no check here; it rides the cookie's
 * own Max-Age, so an expired record is simply absent.
 *
 * Takes a cookie string rather than touching `document` so the same function
 * serves the server render (`next/headers`) and the client.
 */
export function readConsent(cookieString: string | null | undefined): ConsentState | null {
  const parsed = parseConsentCookie(cookieString);
  if (!parsed) return null;
  // A version bump means the visitor agreed to a different set of words, so
  // the old answer cannot be relied on — treated exactly like no consent.
  if (parsed.v !== CONSENT_BANNER_VERSION) return null;
  return parsed;
}

/**
 * Records a choice in the consent cookie and returns what was stored.
 * Client-only — it writes `document.cookie`.
 */
export function writeConsent(choices: ConsentChoices): ConsentState {
  const existing = parseConsentCookie(document.cookie);

  const state: ConsentState = {
    v: CONSENT_BANNER_VERSION,
    // Preserved even when the stored version no longer matches: re-asking the
    // question does not make this a different visitor, and the consent-proof
    // log (Phase E) needs the old and new events to join up. A fresh id is
    // minted only when there is no prior cookie at all.
    id: existing?.id ?? crypto.randomUUID(),
    choices: { analytics: choices.analytics, functional: choices.functional },
    ts: new Date().toISOString(),
  };

  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(
    JSON.stringify(state)
  )}; Path=/; Max-Age=${CONSENT_MAX_AGE_S}; SameSite=Lax; Secure`;

  return state;
}

/**
 * The domains a `_ga*` deletion must be attempted against, in order — `null`
 * meaning "write no Domain attribute at all".
 *
 * Why a matrix rather than one write: a browser only removes a cookie when the
 * expiring Set-Cookie matches its name, Path AND Domain. gtag.js sets `_ga` and
 * `_ga_<CONTAINER>` with `Domain=.rahmatherapy.uk` — the registrable domain,
 * with a leading dot — whatever host served the page. A deletion written with
 * no Domain attribute creates a *host-only* cookie of the same name instead of
 * removing anything, and the original keeps being sent. Getting this wrong is
 * silent: "withdraw consent" appears to work while the cookies stay put.
 *
 *   host www.rahmatherapy.uk -> null                  (host-only variant)
 *                               www.rahmatherapy.uk   (current host)
 *                               .www.rahmatherapy.uk  (dotted current host)
 *                               rahmatherapy.uk       (registrable domain)
 *                               .rahmatherapy.uk      <- what GA actually sets
 *   host rahmatherapy.uk     -> null, rahmatherapy.uk, .rahmatherapy.uk
 *   host localhost           -> null only — a single-label host cannot carry a
 *                               Domain attribute.
 *
 * The single-label tail (`uk`) is never emitted: it is a public suffix and the
 * browser would reject it. Path is always `/`, which is what gtag.js uses.
 *
 * Exported for its unit test: jsdom pins the hostname to a single label, so the
 * multi-label matrix that actually matters in production is only reachable here.
 */
export function gaCookieClearDomains(hostname: string): (string | null)[] {
  const domains: (string | null)[] = [null];
  const labels = hostname.split(".");

  for (let index = 0; index + 1 < labels.length; index += 1) {
    const domain = labels.slice(index).join(".");
    domains.push(domain, `.${domain}`);
  }

  return domains;
}

// `_ga` exactly, or a `_ga_<CONTAINER>` per-property cookie. Deliberately not a
// substring or prefix test: `_gali`, `my_ga` and the like belong to someone
// else and must survive a withdrawal untouched.
function isGaCookieName(name: string): boolean {
  return name === "_ga" || name.startsWith("_ga_");
}

/**
 * Deletes Google Analytics' `_ga` and `_ga_*` cookies — the withdrawal path's
 * "actually stop it" step (brief §2.5). Client-only.
 */
export function clearGaCookies(): void {
  const names = new Set(document.cookie.split(";").map(cookieNameOf).filter(isGaCookieName));
  const domains = gaCookieClearDomains(window.location.hostname);

  for (const name of names) {
    for (const domain of domains) {
      document.cookie = `${name}=; Path=/; Max-Age=0; Expires=${EXPIRED_DATE}${
        domain ? `; Domain=${domain}` : ""
      }`;
    }
  }
}
