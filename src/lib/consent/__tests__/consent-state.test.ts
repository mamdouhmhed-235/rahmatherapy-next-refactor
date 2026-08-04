// C-18 Phase B — Step 3 consent-state tests.
//
// @vitest-environment-options { "url": "https://localhost:3000/" }
//
// The https URL is load-bearing, not cosmetic: writeConsent sets the cookie
// `Secure`, and jsdom's cookie jar (correctly) refuses to hand a Secure cookie
// back to a document on an insecure origin. Under vitest's default
// http://localhost the round-trip and id-preservation cases would fail for a
// reason that has nothing to do with this module.
import { afterEach, describe, expect, it } from "vitest";
import { CONSENT_BANNER_VERSION } from "../cookie-registry";
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_S,
  clearGaCookies,
  gaCookieClearDomains,
  readConsent,
  writeConsent,
} from "../consent-state";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; Path=/`;
}

function cookieNames(): string[] {
  return document.cookie
    .split(";")
    .map((pair) => pair.split("=")[0]?.trim() ?? "")
    .filter(Boolean);
}

function clearAllCookies() {
  for (const name of cookieNames()) {
    document.cookie = `${name}=; Path=/; Max-Age=0`;
  }
}

/**
 * Records every string assigned to `document.cookie` while still applying it to
 * jsdom's jar. Needed because the attributes (`Secure`, `SameSite`, `Max-Age`,
 * `Domain`) are invisible to the `document.cookie` getter, and they are the
 * part of both writeConsent and clearGaCookies that has to be exactly right.
 */
function captureCookieWrites() {
  const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(document), "cookie");
  if (!descriptor?.get || !descriptor.set) throw new Error("document.cookie is not an accessor");

  const writes: string[] = [];
  Object.defineProperty(document, "cookie", {
    configurable: true,
    get: () => descriptor.get!.call(document),
    set: (value: string) => {
      writes.push(value);
      descriptor.set!.call(document, value);
    },
  });

  return {
    writes,
    restore: () => {
      delete (document as unknown as Record<string, unknown>).cookie;
    },
  };
}

afterEach(() => {
  clearAllCookies();
});

describe("readConsent", () => {
  it("round-trips a choice written by writeConsent", () => {
    const written = writeConsent({ analytics: true });
    const read = readConsent(document.cookie);

    expect(read).toEqual(written);
    expect(read?.v).toBe(CONSENT_BANNER_VERSION);
    expect(read?.choices.analytics).toBe(true);
    expect(read?.id).toMatch(UUID_PATTERN);
    expect(new Date(read?.ts ?? "").toString()).not.toBe("Invalid Date");
  });

  it("round-trips a rejection just as faithfully as a grant", () => {
    writeConsent({ analytics: false });
    expect(readConsent(document.cookie)?.choices.analytics).toBe(false);
  });

  it("returns null when the cookie is absent", () => {
    expect(readConsent("")).toBeNull();
    expect(readConsent(undefined)).toBeNull();
    expect(readConsent("other=1; another=2")).toBeNull();
  });

  it("returns null on malformed JSON", () => {
    expect(readConsent(`${CONSENT_COOKIE}=not-json`)).toBeNull();
    expect(readConsent(`${CONSENT_COOKIE}=${encodeURIComponent("{\"v\":")}`)).toBeNull();
  });

  it("returns null on a well-formed payload of the wrong shape", () => {
    const wrongShapes = [
      { v: CONSENT_BANNER_VERSION, id: "abc", ts: "2026-08-04T00:00:00.000Z" },
      { v: CONSENT_BANNER_VERSION, id: "abc", choices: { analytics: "yes" }, ts: "t" },
      { v: CONSENT_BANNER_VERSION, id: "", choices: { analytics: true }, ts: "t" },
      "a string",
      null,
    ];

    for (const shape of wrongShapes) {
      const value = encodeURIComponent(JSON.stringify(shape));
      expect(readConsent(`${CONSENT_COOKIE}=${value}`), JSON.stringify(shape)).toBeNull();
    }
  });

  it("returns null on a version mismatch, however valid the rest is", () => {
    const stale = {
      v: "2020-01-01.1",
      id: "3f1d5f6e-1c2b-4a3d-9e8f-0a1b2c3d4e5f",
      choices: { analytics: true },
      ts: "2026-08-04T00:00:00.000Z",
    };

    expect(readConsent(`${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(stale))}`)).toBeNull();
  });

  it("finds the consent cookie among others, in any position", () => {
    writeConsent({ analytics: true });
    const consentPair = document.cookie
      .split(";")
      .map((pair) => pair.trim())
      .find((pair) => pair.startsWith(`${CONSENT_COOKIE}=`));

    expect(consentPair).toBeDefined();
    expect(readConsent(`first=1; ${consentPair}; last=2`)?.choices.analytics).toBe(true);
    // A cookie whose name merely ends with the consent cookie's name must not
    // be mistaken for it.
    expect(readConsent(`not_${consentPair}`)).toBeNull();
  });
});

describe("writeConsent", () => {
  it("sets Path, Max-Age (~6 months), SameSite=Lax and Secure", () => {
    const capture = captureCookieWrites();
    try {
      writeConsent({ analytics: true });

      expect(capture.writes).toHaveLength(1);
      const written = capture.writes[0];
      expect(written).toContain(`${CONSENT_COOKIE}=`);
      expect(written).toContain("; Path=/");
      expect(written).toContain(`; Max-Age=${CONSENT_MAX_AGE_S}`);
      expect(written).toContain("; SameSite=Lax");
      expect(written).toContain("; Secure");
    } finally {
      capture.restore();
    }
  });

  it("uses the ICO-aligned ~6 month lifetime", () => {
    expect(CONSENT_MAX_AGE_S).toBe(60 * 60 * 24 * 182);
  });

  it("preserves the pseudonymous id across a re-write", () => {
    const first = writeConsent({ analytics: true });
    const second = writeConsent({ analytics: false });

    expect(second.id).toBe(first.id);
    expect(second.choices.analytics).toBe(false);
    expect(readConsent(document.cookie)?.id).toBe(first.id);
  });

  it("preserves the id even when the stored version no longer matches", () => {
    const stale = {
      v: "2020-01-01.1",
      id: "3f1d5f6e-1c2b-4a3d-9e8f-0a1b2c3d4e5f",
      choices: { analytics: true },
      ts: "2026-08-04T00:00:00.000Z",
    };
    setCookie(CONSENT_COOKIE, encodeURIComponent(JSON.stringify(stale)));
    // Precondition: that cookie is not honoured as consent.
    expect(readConsent(document.cookie)).toBeNull();

    const rewritten = writeConsent({ analytics: false });

    expect(rewritten.id).toBe(stale.id);
    expect(rewritten.v).toBe(CONSENT_BANNER_VERSION);
  });

  it("mints a fresh id when there is no prior cookie", () => {
    const first = writeConsent({ analytics: true });
    clearAllCookies();
    const second = writeConsent({ analytics: true });

    expect(second.id).toMatch(UUID_PATTERN);
    expect(second.id).not.toBe(first.id);
  });

  it("mints a fresh id when the prior cookie is unparseable", () => {
    setCookie(CONSENT_COOKIE, "not-json");
    expect(writeConsent({ analytics: true }).id).toMatch(UUID_PATTERN);
  });
});

describe("gaCookieClearDomains", () => {
  it("covers the host-only, current-host and registrable-domain variants, dotted and not", () => {
    expect(gaCookieClearDomains("www.rahmatherapy.uk")).toEqual([
      null,
      "www.rahmatherapy.uk",
      ".www.rahmatherapy.uk",
      "rahmatherapy.uk",
      // The one GA actually sets.
      ".rahmatherapy.uk",
    ]);
  });

  it("covers the apex domain when the site is served from it", () => {
    expect(gaCookieClearDomains("rahmatherapy.uk")).toEqual([
      null,
      "rahmatherapy.uk",
      ".rahmatherapy.uk",
    ]);
  });

  it("never emits the public-suffix tail on its own", () => {
    expect(gaCookieClearDomains("www.rahmatherapy.uk")).not.toContain("uk");
    expect(gaCookieClearDomains("www.rahmatherapy.uk")).not.toContain(".uk");
  });

  it("emits only the host-only variant for a single-label host", () => {
    expect(gaCookieClearDomains("localhost")).toEqual([null]);
  });
});

describe("clearGaCookies", () => {
  it("deletes _ga and every _ga_* cookie", () => {
    setCookie("_ga", "GA1.1.123.456");
    setCookie("_ga_ABC123", "GS1.1.789");
    setCookie("_ga_XYZ789", "GS1.1.987");

    clearGaCookies();

    expect(cookieNames()).not.toContain("_ga");
    expect(cookieNames()).not.toContain("_ga_ABC123");
    expect(cookieNames()).not.toContain("_ga_XYZ789");
  });

  it("leaves cookies whose names merely contain _ga alone", () => {
    setCookie("_ga", "GA1.1.123.456");
    setCookie("_gali", "keep-me");
    setCookie("my_ga", "keep-me");
    setCookie("_gat_something", "keep-me");
    setCookie(CONSENT_COOKIE, "keep-me");

    clearGaCookies();

    // Names, not substrings: "my_ga=" contains "_ga=", so a substring check
    // here would pass while the real cookie survived, or fail while it didn't.
    expect(cookieNames()).not.toContain("_ga");
    expect(cookieNames()).toEqual(
      expect.arrayContaining(["_gali", "my_ga", "_gat_something", CONSENT_COOKIE])
    );
  });

  it("writes one expiring cookie per name per domain variant, always at Path=/", () => {
    const capture = captureCookieWrites();
    try {
      setCookie("_ga", "GA1.1.123.456");
      setCookie("_ga_ABC123", "GS1.1.789");
      capture.writes.length = 0;

      clearGaCookies();

      // jsdom's hostname is a single label, so the matrix here is [null] —
      // one write per cookie name. The multi-label matrix is covered by the
      // gaCookieClearDomains tests above.
      expect(capture.writes).toHaveLength(2);
      for (const write of capture.writes) {
        expect(write).toContain("; Path=/");
        expect(write).toContain("; Max-Age=0");
        expect(write).toContain("; Expires=Thu, 01 Jan 1970 00:00:00 GMT");
        expect(write).not.toContain("; Domain=");
      }
      expect(capture.writes[0]).toContain("_ga=;");
      expect(capture.writes[1]).toContain("_ga_ABC123=;");
    } finally {
      capture.restore();
    }
  });

  it("does nothing when there are no GA cookies", () => {
    const capture = captureCookieWrites();
    try {
      setCookie(CONSENT_COOKIE, "keep-me");
      capture.writes.length = 0;

      clearGaCookies();

      expect(capture.writes).toHaveLength(0);
      expect(document.cookie).toContain(`${CONSENT_COOKIE}=keep-me`);
    } finally {
      capture.restore();
    }
  });
});
