// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://localhost:3000/" }
//
// C-17's env gate + C-18 Phase D's consent gate, tested together because the
// component's contract is that BOTH must pass. The plan names one case
// explicitly (§1 Step 8): consent denied renders null even in production with
// the measurement id set — i.e. the gate is real, not a comment.
//
// No @testing-library/jest-dom in this repo (see BookingRowActions.test.tsx
// / MobileStickyActionBar.test.tsx for the established convention) — assert
// via plain DOM properties/attributes, not `toBeEmptyDOMElement()`-style
// matchers.
//
// The https origin is load-bearing, as in the consent suites: writeConsent sets
// the cookie `Secure`, and jsdom will not hand a Secure cookie back to a
// document on an insecure origin.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { CONSENT_COOKIE } from "@/lib/consent/consent-state";
import { CONSENT_BANNER_VERSION } from "@/lib/consent/cookie-registry";

const GA_MEASUREMENT_ID = "G-TEST123";
const ID = "3f1d5f6e-1c2b-4a3d-9e8f-0a1b2c3d4e5f";
const TS = "2026-08-04T00:00:00.000Z";

// `GoogleAnalytics` reads `NEXT_PUBLIC_GA_MEASUREMENT_ID` into a module-level
// constant (required so Next.js can statically inline it at build time), so
// each test re-imports the module after stubbing env vars to force a fresh
// evaluation of that constant. The consent store is re-imported from the same
// reset graph, so the instance the component subscribes to is the one the test
// drives.
async function loadFreshModules() {
  vi.resetModules();
  const ga = await import("../GoogleAnalytics");
  const store = await import("../consent/consent-store");
  return { GoogleAnalytics: ga.GoogleAnalytics, store };
}

function setRawConsentCookie(payload: unknown) {
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(payload))}; Path=/`;
}

function grantAnalytics() {
  setRawConsentCookie({
    v: CONSENT_BANNER_VERSION,
    id: ID,
    choices: { analytics: true, functional: true },
    ts: TS,
  });
}

function denyAnalytics() {
  setRawConsentCookie({
    v: CONSENT_BANNER_VERSION,
    id: ID,
    choices: { analytics: false, functional: true },
    ts: TS,
  });
}

function clearAllCookies() {
  for (const pair of document.cookie.split(";")) {
    const name = pair.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0`;
  }
}

function gtagLoader() {
  return document.querySelector(
    `script[src="https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}"]`
  );
}

function productionWithMeasurementId() {
  vi.stubEnv("NODE_ENV", "production");
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = GA_MEASUREMENT_ID;
}

beforeEach(() => {
  clearAllCookies();
});

afterEach(() => {
  cleanup();
  clearAllCookies();
  vi.unstubAllEnvs();
  delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  document.querySelectorAll("script[data-nscript]").forEach((el) => el.remove());
});

describe("GoogleAnalytics — C-17's environment gate (semantics preserved)", () => {
  it("renders null when NEXT_PUBLIC_GA_MEASUREMENT_ID is unset, consent or no consent", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    grantAnalytics();

    const { GoogleAnalytics } = await loadFreshModules();
    const { container } = render(<GoogleAnalytics />);

    expect(container.firstChild).toBeNull();
    expect(document.querySelector("script[data-nscript]")).toBeNull();
  });

  it("renders null when NODE_ENV is not production, consent or no consent", async () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = GA_MEASUREMENT_ID;
    grantAnalytics();

    const { GoogleAnalytics } = await loadFreshModules();
    const { container } = render(<GoogleAnalytics />);

    expect(container.firstChild).toBeNull();
    expect(document.querySelector("script[data-nscript]")).toBeNull();
  });
});

describe("GoogleAnalytics — C-18's consent gate", () => {
  it("renders null when analytics consent is refused, EVEN in production with the id set", async () => {
    productionWithMeasurementId();
    denyAnalytics();

    const { GoogleAnalytics } = await loadFreshModules();
    render(<GoogleAnalytics />);

    expect(gtagLoader()).toBeNull();
    expect(document.getElementById("ga-init")).toBeNull();
  });

  it("renders null when no choice has been recorded — silence is not consent", async () => {
    productionWithMeasurementId();

    const { GoogleAnalytics } = await loadFreshModules();
    render(<GoogleAnalytics />);

    expect(gtagLoader()).toBeNull();
  });

  it("renders null when the stored record is malformed", async () => {
    productionWithMeasurementId();
    document.cookie = `${CONSENT_COOKIE}=not-json; Path=/`;

    const { GoogleAnalytics } = await loadFreshModules();
    render(<GoogleAnalytics />);

    expect(gtagLoader()).toBeNull();
  });

  it("renders null when the grant belongs to a superseded banner version", async () => {
    // The visitor agreed to a different set of words; readConsent treats that
    // as no consent, and so must the loader.
    productionWithMeasurementId();
    setRawConsentCookie({
      v: "2020-01-01.1",
      id: ID,
      choices: { analytics: true, functional: true },
      ts: TS,
    });

    const { GoogleAnalytics } = await loadFreshModules();
    render(<GoogleAnalytics />);

    expect(gtagLoader()).toBeNull();
  });

  it("renders both gtag scripts when the id is set, NODE_ENV is production AND analytics is granted", async () => {
    productionWithMeasurementId();
    grantAnalytics();

    const { GoogleAnalytics } = await loadFreshModules();
    const { container } = render(<GoogleAnalytics />);

    expect(container.firstChild).toBeNull(); // next/script inserts via effect, not inline JSX
    expect(gtagLoader()).not.toBeNull();

    const initScript = document.getElementById("ga-init");
    expect(initScript).not.toBeNull();
    expect(initScript?.textContent).toContain(`gtag('config', '${GA_MEASUREMENT_ID}')`);
  });

  it("mounts gtag on an in-session grant, with no navigation and no reload", async () => {
    // The grant flow of brief §2.2: the store notifies, this component
    // re-renders, and gtag.js is fetched on the page the visitor is already on.
    //
    // A DISTINCT MEASUREMENT ID, deliberately. next/script keeps a module-level
    // `LoadCache` keyed by `id || src` (next/dist/client/script.js:36-37,70-72)
    // and skips insertion for a key it has already loaded. vi.resetModules()
    // does not clear it, because next/script is an externalised dependency
    // rather than part of the Vite module graph — so reusing the id the test
    // above already mounted would make this one silently vacuous. That also
    // rules out asserting on the inline "ga-init" script here: its cache key is
    // its id, which cannot vary. The remote loader is the assertion that
    // matters anyway — it is the request to Google.
    const inSessionId = "G-INSESSION1";
    vi.stubEnv("NODE_ENV", "production");
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = inSessionId;

    const { GoogleAnalytics, store } = await loadFreshModules();
    render(<GoogleAnalytics />);

    const loader = () =>
      document.querySelector(
        `script[src="https://www.googletagmanager.com/gtag/js?id=${inSessionId}"]`
      );
    expect(loader()).toBeNull();

    act(() => {
      store.recordConsentChoices(store.ALL_GRANTED);
    });

    await waitFor(() => expect(loader()).not.toBeNull());
  });

  it("emits nothing at all on the server, for anyone", async () => {
    // The consent state is client-only by construction (Owner decision 5): the
    // pages are CDN-cached, so one visitor's grant must never be baked into
    // HTML served to the next.
    productionWithMeasurementId();
    grantAnalytics();

    const { GoogleAnalytics } = await loadFreshModules();
    const { renderToStaticMarkup } = await import("react-dom/server");

    expect(renderToStaticMarkup(<GoogleAnalytics />)).toBe("");
  });
});
