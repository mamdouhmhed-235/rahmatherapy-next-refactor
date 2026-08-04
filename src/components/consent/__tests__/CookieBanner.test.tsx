// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://localhost:3000/" }
//
// C-18 Phase C — first-layer behaviour.
//
// The https origin is load-bearing, exactly as in consent-state.test.ts:
// writeConsent sets the cookie `Secure`, and jsdom will not hand a Secure
// cookie back to a document on an insecure origin, so every "did the click
// record the choice" assertion would fail here for a reason unrelated to the
// component.
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CONSENT_COOKIE, readConsent } from "@/lib/consent/consent-state";
import { CONSENT_BANNER_VERSION } from "@/lib/consent/cookie-registry";
import { CookieBanner } from "../CookieBanner";
import { getServerConsentSnapshot, resetConsentStoreForTests } from "../consent-store";

const ID = "3f1d5f6e-1c2b-4a3d-9e8f-0a1b2c3d4e5f";
const TS = "2026-08-04T00:00:00.000Z";

function setRawConsentCookie(payload: unknown) {
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(payload))}; Path=/`;
}

function clearAllCookies() {
  for (const pair of document.cookie.split(";")) {
    const name = pair.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0`;
  }
}

function banner() {
  return screen.queryByRole("region", { name: "Cookie choices" });
}

beforeEach(() => {
  clearAllCookies();
  resetConsentStoreForTests();
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  cleanup();
  clearAllCookies();
});

describe("banner visibility", () => {
  it("asks the question when no choice has been recorded", () => {
    render(<CookieBanner />);
    expect(banner()).toBeTruthy();
  });

  it("stays away once a valid current-version choice exists", () => {
    setRawConsentCookie({
      v: CONSENT_BANNER_VERSION,
      id: ID,
      choices: { analytics: false, functional: false },
      ts: TS,
    });

    render(<CookieBanner />);
    expect(banner()).toBeNull();
  });

  it("asks again when the stored record is malformed", () => {
    document.cookie = `${CONSENT_COOKIE}=not-json; Path=/`;
    render(<CookieBanner />);
    expect(banner()).toBeTruthy();
  });

  it("asks again when the stored record is from an older banner version", () => {
    setRawConsentCookie({
      v: "2020-01-01.1",
      id: ID,
      choices: { analytics: true, functional: true },
      ts: TS,
    });

    render(<CookieBanner />);
    expect(banner()).toBeTruthy();
  });

  it("renders nothing on the server, so a returning visitor never sees it flash", () => {
    // The server cannot know what this visitor chose — the pages are edge-cached
    // and one visitor's answer must never be baked into another's HTML. So the
    // server snapshot is "unknown", not "no consent", and unknown renders
    // nothing at all rather than a banner that has to disappear again.
    expect(getServerConsentSnapshot()).toBeUndefined();
    expect(renderToStaticMarkup(<CookieBanner />)).toBe("");
  });
});

describe("first-layer parity (ICO: refusing must be as easy as accepting)", () => {
  it("renders Accept all and Reject all from the same component, label the only difference", () => {
    render(<CookieBanner />);

    const accept = screen.getByRole("button", { name: "Accept all" });
    const reject = screen.getByRole("button", { name: "Reject all" });

    expect(accept.tagName).toBe(reject.tagName);
    expect(accept.className).toBe(reject.className);
    expect(accept.getAttribute("type")).toBe(reject.getAttribute("type"));
    expect(accept.hasAttribute("disabled")).toBe(reject.hasAttribute("disabled"));
    // Same parent, so neither is buried a level deeper than the other.
    expect(accept.parentElement).toBe(reject.parentElement);
  });

  it("costs one click each", async () => {
    const user = userEvent.setup();
    render(<CookieBanner />);

    await user.click(screen.getByRole("button", { name: "Reject all" }));

    expect(readConsent(document.cookie)?.choices).toEqual({
      analytics: false,
      functional: false,
    });
    expect(banner()).toBeNull();
  });
});

describe("recording a first-layer choice", () => {
  it("Accept all grants every purpose and dismisses the banner without a reload", async () => {
    const user = userEvent.setup();
    render(<CookieBanner />);

    await user.click(screen.getByRole("button", { name: "Accept all" }));

    const stored = readConsent(document.cookie);
    expect(stored?.choices).toEqual({ analytics: true, functional: true });
    expect(stored?.v).toBe(CONSENT_BANNER_VERSION);
    expect(banner()).toBeNull();
  });

  it("Reject all denies every purpose", async () => {
    const user = userEvent.setup();
    render(<CookieBanner />);

    await user.click(screen.getByRole("button", { name: "Reject all" }));

    expect(readConsent(document.cookie)?.choices).toEqual({
      analytics: false,
      functional: false,
    });
  });
});

describe("no cookie wall", () => {
  it("does not lock scrolling, dim the page, or make itself a dialog", () => {
    render(<CookieBanner />);

    expect(document.body.style.overflow).toBe("");
    expect(document.documentElement.style.overflow).toBe("");
    expect(screen.queryByRole("dialog")).toBeNull();

    const region = banner();
    expect(region).toBeTruthy();
    // The full-width fixed wrapper must not swallow clicks meant for the page
    // behind it; only the card itself takes pointer events.
    expect(region?.className).toContain("pointer-events-none");
    expect(region?.firstElementChild?.className).toContain("pointer-events-auto");
  });
});
