// @vitest-environment jsdom
//
// C-18 Phase B Step 4 — the consent script's tests.
//
// The centre of this file is the EQUIVALENCE suite. ConsentScripts emits an
// inline <script> as a string, and a string cannot import readConsent() from
// src/lib/consent/consent-state.ts — so the cookie rules inside it are a second
// copy of rules that already exist in TypeScript. A drifting copy would grant or
// withhold analytics consent on different rules than the rest of the app, and it
// would do so silently. So: one corpus of cookie strings, run through BOTH the
// emitted script and readConsent(), asserted to agree on every entry, and each
// entry additionally pinned to the answer it is supposed to get (so the two
// cannot pass by being wrong together).
//
// The script under test is the exact string that ships (CONSENT_SCRIPT), not a
// re-derivation of it.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONSENT_COOKIE, readConsent } from "@/lib/consent/consent-state";
import { CONSENT_BANNER_VERSION } from "@/lib/consent/cookie-registry";
import { CONSENT_SCRIPT, ConsentScripts } from "../ConsentScripts";

const ID = "3f1d5f6e-1c2b-4a3d-9e8f-0a1b2c3d4e5f";
const TS = "2026-08-04T00:00:00.000Z";

/** How writeConsent() actually stores a payload: percent-encoded JSON. */
function cookie(payload: unknown): string {
  return `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(payload))}`;
}

const GRANTED = {
  v: CONSENT_BANNER_VERSION,
  id: ID,
  choices: { analytics: true, functional: true },
  ts: TS,
};

/**
 * Replaces `document.cookie`'s getter for the duration of `fn`, so a corpus
 * entry reaches the script byte for byte. Going through jsdom's cookie jar
 * would silently normalise (or reject) the deliberately hostile entries below.
 */
function withCookieString<T>(cookieString: string, fn: () => T): T {
  Object.defineProperty(document, "cookie", {
    configurable: true,
    get: () => cookieString,
    set: () => {},
  });
  try {
    return fn();
  } finally {
    delete (document as unknown as Record<string, unknown>).cookie;
  }
}

/** Every gtag() call the emitted script makes, in order, for a given cookie header. */
function runScript(cookieString: string): unknown[][] {
  return withCookieString(cookieString, () => {
    const globals = window as unknown as Record<string, unknown>;
    delete globals.dataLayer;
    delete globals.gtag;

    new Function(CONSENT_SCRIPT)();

    const layer = (globals.dataLayer ?? []) as ArrayLike<ArrayLike<unknown>>;
    return Array.from(layer).map((entry) => Array.from(entry));
  });
}

/** Did the script move analytics_storage to granted? */
function scriptGrants(cookieString: string): boolean {
  return runScript(cookieString).some(
    (call) =>
      call[0] === "consent" &&
      call[1] === "update" &&
      (call[2] as { analytics_storage?: string } | undefined)?.analytics_storage === "granted"
  );
}

/** The same question, asked of the TypeScript reader the rest of the app uses. */
function readerGrants(cookieString: string): boolean {
  return readConsent(cookieString)?.choices.analytics === true;
}

// One corpus, two readers. `grants` is what BOTH must answer.
const CORPUS: { name: string; cookie: string; grants: boolean }[] = [
  // --- the five states named in the brief ---
  { name: "valid, analytics granted", cookie: cookie(GRANTED), grants: true },
  {
    name: "valid, analytics rejected",
    cookie: cookie({ ...GRANTED, choices: { analytics: false, functional: false } }),
    grants: false,
  },
  {
    name: "version-mismatched (otherwise perfect)",
    cookie: cookie({ ...GRANTED, v: "2020-01-01.1" }),
    grants: false,
  },
  { name: "malformed — not JSON at all", cookie: `${CONSENT_COOKIE}=not-json`, grants: false },
  { name: "absent — no cookies whatsoever", cookie: "", grants: false },

  // --- absence, in its other disguises ---
  { name: "absent — other cookies only", cookie: "other=1; another=2", grants: false },
  { name: "absent — empty value", cookie: `${CONSENT_COOKIE}=`, grants: false },
  {
    name: "absent — a cookie whose name merely ends with ours",
    cookie: `not_${cookie(GRANTED)}`,
    grants: false,
  },
  {
    name: "absent — a cookie whose name merely starts with ours",
    cookie: `${CONSENT_COOKIE}_old=${encodeURIComponent(JSON.stringify(GRANTED))}`,
    grants: false,
  },

  // --- malformed, in its other disguises ---
  {
    name: "malformed — truncated JSON",
    cookie: `${CONSENT_COOKIE}=${encodeURIComponent('{"v":')}`,
    grants: false,
  },
  { name: "malformed — broken percent-encoding", cookie: `${CONSENT_COOKIE}=%E0%A4%A`, grants: false },
  { name: "malformed — a lone percent sign", cookie: `${CONSENT_COOKIE}=%`, grants: false },

  // --- well-formed JSON of the wrong shape ---
  // The `id` and `ts` entries are the reason the inline script checks those two
  // fields at all: without them the script would honour a payload the rest of
  // the app rejects.
  {
    name: "wrong shape — no id",
    cookie: cookie({
      v: CONSENT_BANNER_VERSION,
      choices: { analytics: true, functional: true },
      ts: TS,
    }),
    grants: false,
  },
  {
    name: "wrong shape — empty id",
    cookie: cookie({ ...GRANTED, id: "" }),
    grants: false,
  },
  {
    name: "wrong shape — no ts",
    cookie: cookie({
      v: CONSENT_BANNER_VERSION,
      id: ID,
      choices: { analytics: true, functional: true },
    }),
    grants: false,
  },
  { name: "wrong shape — empty ts", cookie: cookie({ ...GRANTED, ts: "" }), grants: false },
  {
    name: "wrong shape — analytics is the string 'yes'",
    cookie: cookie({ ...GRANTED, choices: { analytics: "yes", functional: true } }),
    grants: false,
  },
  {
    name: "wrong shape — analytics is 1",
    cookie: cookie({ ...GRANTED, choices: { analytics: 1, functional: true } }),
    grants: false,
  },
  { name: "wrong shape — no choices", cookie: cookie({ v: CONSENT_BANNER_VERSION, id: ID, ts: TS }), grants: false },
  { name: "wrong shape — choices is null", cookie: cookie({ ...GRANTED, choices: null }), grants: false },
  { name: "wrong shape — choices is a string", cookie: cookie({ ...GRANTED, choices: "yes" }), grants: false },
  { name: "wrong shape — version is a number", cookie: cookie({ ...GRANTED, v: 20260716 }), grants: false },
  { name: "wrong shape — payload is a JSON string", cookie: cookie("a string"), grants: false },
  { name: "wrong shape — payload is null", cookie: cookie(null), grants: false },
  { name: "wrong shape — payload is an array", cookie: cookie([GRANTED]), grants: false },

  // --- the second purpose (C-18 Phase C): choices now carries `functional` ---
  // Consent Mode has no functional signal, so it would be easy to let the
  // inline script ignore the key entirely. It must not: readConsent rejects a
  // record that does not carry every purpose, so a script that granted on
  // {analytics:true} alone would grant analytics on a record the rest of the
  // app reads as "no consent" — and would show the banner to a visitor whose
  // analytics it had just turned on.
  {
    name: "valid — analytics granted, functional denied",
    cookie: cookie({ ...GRANTED, choices: { analytics: true, functional: false } }),
    grants: true,
  },
  {
    name: "valid — analytics denied, functional granted",
    cookie: cookie({ ...GRANTED, choices: { analytics: false, functional: true } }),
    grants: false,
  },
  {
    name: "wrong shape — no functional, analytics granted",
    cookie: cookie({ v: CONSENT_BANNER_VERSION, id: ID, ts: TS, choices: { analytics: true } }),
    grants: false,
  },
  {
    name: "wrong shape — functional present, analytics missing",
    cookie: cookie({ v: CONSENT_BANNER_VERSION, id: ID, ts: TS, choices: { functional: true } }),
    grants: false,
  },
  {
    name: "wrong shape — functional is the string 'yes'",
    cookie: cookie({ ...GRANTED, choices: { analytics: true, functional: "yes" } }),
    grants: false,
  },
  {
    name: "wrong shape — functional is null",
    cookie: cookie({ ...GRANTED, choices: { analytics: true, functional: null } }),
    grants: false,
  },
  {
    name: "wrong shape — functional is 0",
    cookie: cookie({ ...GRANTED, choices: { analytics: true, functional: 0 } }),
    grants: false,
  },

  // --- a real grant, in the awkward places it can turn up ---
  { name: "granted, first of several cookies", cookie: `${cookie(GRANTED)}; a=1; b=2`, grants: true },
  { name: "granted, last of several cookies", cookie: `a=1; b=2; ${cookie(GRANTED)}`, grants: true },
  { name: "granted, in the middle", cookie: `a=1; ${cookie(GRANTED)}; b=2`, grants: true },
  {
    name: "granted, alongside a valueless pair with no '='",
    cookie: `flag; ${cookie(GRANTED)}`,
    grants: true,
  },
  {
    name: "granted, stored already-decoded",
    cookie: `${CONSENT_COOKIE}=${JSON.stringify(GRANTED)}`,
    grants: true,
  },
  {
    name: "granted, but a decoy of the same name comes first and wins",
    cookie: `${CONSENT_COOKIE}=not-json; ${cookie(GRANTED)}`,
    grants: false,
  },
];

describe("the emitted script and readConsent()", () => {
  it("agree on every cookie in the corpus", () => {
    for (const entry of CORPUS) {
      expect(scriptGrants(entry.cookie), entry.name).toBe(readerGrants(entry.cookie));
    }
  });

  it("both give the answer the corpus pins them to", () => {
    for (const entry of CORPUS) {
      expect(scriptGrants(entry.cookie), `script: ${entry.name}`).toBe(entry.grants);
      expect(readerGrants(entry.cookie), `readConsent: ${entry.name}`).toBe(entry.grants);
    }
  });
});

describe("consent defaults", () => {
  it("denies all four signals first, with wait_for_update, whatever the cookie says", () => {
    for (const entry of CORPUS) {
      const [first] = runScript(entry.cookie);
      expect(first?.slice(0, 2), entry.name).toEqual(["consent", "default"]);
      expect(first?.[2], entry.name).toEqual({
        ad_storage: "denied",
        analytics_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        wait_for_update: 500,
      });
    }
  });

  it("makes exactly one call when consent is not granted, and two when it is", () => {
    expect(runScript(cookie(GRANTED))).toHaveLength(2);
    expect(
      runScript(cookie({ ...GRANTED, choices: { analytics: false, functional: true } }))
    ).toHaveLength(1);
    expect(runScript("")).toHaveLength(1);
  });
});

describe("hostile input", () => {
  // A thrown error in the page's first script is a broken page for every
  // visitor, so the read is wrapped and falls through to denied. These are the
  // inputs most likely to throw: bad UTF-8 escapes for decodeURIComponent, and
  // anything JSON.parse chokes on.
  const HOSTILE = [
    ...CORPUS.map((entry) => entry.cookie),
    `${CONSENT_COOKIE}=%E0%A4%A`,
    `${CONSENT_COOKIE}=%%%`,
    `${CONSENT_COOKIE}=%C0%80`,
    `${CONSENT_COOKIE}=${encodeURIComponent("{unquoted:1}")}`,
    `${CONSENT_COOKIE}=${encodeURIComponent("[1,2")}`,
    `${CONSENT_COOKIE}=${encodeURIComponent("undefined")}`,
    `${CONSENT_COOKIE}=${encodeURIComponent('{"v":"' + CONSENT_BANNER_VERSION + '"')}`,
    `${CONSENT_COOKIE}==`,
    `${CONSENT_COOKIE}`,
    ";;;",
    "=",
    " ",
  ];

  it("never throws", () => {
    for (const cookieString of HOSTILE) {
      expect(() => runScript(cookieString), cookieString).not.toThrow();
    }
  });

  it("still establishes the denied defaults, and grants nothing", () => {
    for (const cookieString of HOSTILE.slice(CORPUS.length)) {
      const calls = runScript(cookieString);
      expect(calls, cookieString).toHaveLength(1);
      expect(calls[0]?.[1], cookieString).toBe("default");
    }
  });
});

describe("ConsentScripts", () => {
  const element = ConsentScripts();
  const props = element.props as {
    id?: string;
    src?: string;
    dangerouslySetInnerHTML?: { __html: string };
  };

  it("renders one inline script carrying exactly the emitted body", () => {
    expect(element.type).toBe("script");
    expect(props.id).toBe("consent-default");
    expect(props.dangerouslySetInnerHTML?.__html).toBe(CONSENT_SCRIPT);
    expect(props.src).toBeUndefined();
  });

  it("makes zero external requests", () => {
    expect(CONSENT_SCRIPT).not.toMatch(/https?:/);
    expect(CONSENT_SCRIPT).not.toMatch(/\b(fetch|XMLHttpRequest|importScripts|import\()/);
  });

  it("interpolates the shared constants rather than restating them", () => {
    expect(CONSENT_SCRIPT).toContain(JSON.stringify(CONSENT_COOKIE));
    expect(CONSENT_SCRIPT).toContain(JSON.stringify(CONSENT_BANNER_VERSION));
  });
});

describe("static generation", () => {
  // The public pages are edge-cached, so a per-visitor cookie must not be read
  // during the render: it would be baked into HTML served to someone else, and
  // in Next 16.2.4 it also opts the whole (public) group out of prerendering.
  // These two assertions are what keeps that from creeping back in.
  const SOURCE = readFileSync(join(process.cwd(), "src/components/consent/ConsentScripts.tsx"), "utf8");

  it("imports no dynamic server API", () => {
    const specifiers = [...SOURCE.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]);
    expect(specifiers).not.toContain("next/headers");
    expect(specifiers).toEqual([
      "@/lib/consent/consent-state",
      "@/lib/consent/cookie-registry",
    ]);
  });

  it("is a synchronous component, so nothing is awaited during render", () => {
    expect(ConsentScripts.constructor.name).toBe("Function");
  });
});
