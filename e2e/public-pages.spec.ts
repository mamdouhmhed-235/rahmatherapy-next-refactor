// ⛔ GATE 08 PHASE P1 — THE PUBLIC WEBSITE. Cases E08-93, E08-94, E08-95.
//
// This is the customer-facing half of the site: the pages a stranger who has
// never heard of the clinic actually lands on. Ten of the twelve page files
// here had never been opened by a test of any kind. The two that had were only
// ever used as doorways into the booking dialog — nobody had ever asserted the
// pages themselves render.
//
// ⛔ EVERY EXPECTATION BELOW WAS MEASURED, NOT ASSUMED.
//
// Session B rebuilt the entire persona spec after finding that every single one
// of its inherited expectations was wrong (03-tests/08-e2e-personas/RESULT.md).
// So nothing here is taken from a plan document. `scripts/recon-public-pages.mjs`
// and `scripts/recon-public-probe2.mjs` visited all 21 URLs first and PRINTED
// what is there; these assertions are written from that output. Where an obvious
// check turned out not to work, the reason is recorded at the check rather than
// the check being quietly dropped.
//
// ── The surface, counted from the source ────────────────────────────────────
//
//   12 page files under src/app/(public)/ and src/app/booking/manage/
//   -> 21 distinct URLs, because two of those files are dynamic routes:
//        /services/[slug]  x5 packages
//        /areas/[slug]     x5 spokes + the "luton" slug, which 308s to the hub
//   -> of those 21, 18 are indexable and are exactly what src/app/sitemap.ts
//      advertises. The other three are excluded there, each for a stated
//      reason, and this spec checks those reasons hold.

import { expect, test, type Page, type Response } from "@playwright/test";
import { hasBaseUrl } from "./helpers";

// ── The routes, written out by hand ─────────────────────────────────────────
//
// ⛔ Deliberately NOT imported from src/content. A spec that derives its route
// list from the same module the app renders from agrees with itself by
// construction: delete a package and both sides shrink together, and the test
// still passes while a page silently disappears from the website. The sitemap
// test further down is the one place that reads the app's own list — and its
// job is precisely to compare that list against this one.
const PACKAGE_SLUGS = [
  "supreme-combo-package",
  "hijama-package",
  "fire-cupping-package",
  "massage-therapy-30-mins",
  "massage-therapy-1-hour",
] as const;

const AREA_SPOKES = ["bury-park", "leagrave", "stopsley", "dunstable", "houghton-regis"] as const;

/** The 18 indexable URLs, with the title observed on each. */
const INDEXABLE: ReadonlyArray<{ path: string; title: string }> = [
  { path: "/home/", title: "Rahma Therapy | Mobile Hijama, Cupping & Massage in Luton" },
  { path: "/about/", title: "About Rahma Therapy | Mobile Hijama, Cupping & Massage in Luton" },
  { path: "/services/", title: "Services | Mobile Hijama, Cupping & Massage in Luton" },
  {
    path: "/services/supreme-combo-package/",
    title: "Supreme Combo | Mobile Cupping, Hijama & Massage in Luton",
  },
  { path: "/services/hijama-package/", title: "Hijama Package in Luton | Private Mobile Wet Cupping" },
  {
    path: "/services/fire-cupping-package/",
    title: "Fire Cupping Package in Luton | Mobile Cupping Without Hijama",
  },
  {
    path: "/services/massage-therapy-30-mins/",
    title: "30-Min Mobile Massage Therapy in Luton | Rahma Therapy",
  },
  {
    path: "/services/massage-therapy-1-hour/",
    title: "1-Hour Mobile Massage Therapy in Luton | Rahma Therapy",
  },
  { path: "/reviews/", title: "Rahma Therapy Reviews | Hijama, Cupping & Massage in Luton" },
  { path: "/faqs-aftercare/", title: "FAQs & Aftercare | Hijama, Cupping & Massage in Luton" },
  { path: "/privacy/", title: "Privacy Policy — Rahma Therapy" },
  { path: "/cookies/", title: "Cookies & Site Storage | Rahma Therapy" },
  { path: "/areas/", title: "Mobile Hijama, Cupping & Massage in Luton | At-Home Therapy" },
  {
    path: "/areas/bury-park/",
    title: "Hijama & Cupping in Bury Park, Luton | At-Home Wet Cupping",
  },
  {
    path: "/areas/leagrave/",
    title: "Mobile Massage, Cupping & Hijama in Leagrave, Luton | At-Home Recovery",
  },
  {
    path: "/areas/stopsley/",
    title: "Relaxing Mobile Massage & Therapy in Stopsley, Luton | At-Home Wellness",
  },
  {
    path: "/areas/dunstable/",
    title: "Mobile Massage, Cupping & Hijama in Dunstable | At-Home Therapy",
  },
  {
    path: "/areas/houghton-regis/",
    title: "At-Home Massage, Cupping & Hijama in Houghton Regis | Mobile Therapy",
  },
];

/** Observed price and duration per package, from src/content/pages/packagePages.ts. */
const PACKAGE_FACTS: Record<string, { price: string; duration: string }> = {
  "supreme-combo-package": { price: "£55", duration: "Confirm at booking" },
  "hijama-package": { price: "£45", duration: "Confirm at booking" },
  "fire-cupping-package": { price: "£40", duration: "Confirm at booking" },
  "massage-therapy-30-mins": { price: "£40", duration: "30 minutes" },
  "massage-therapy-1-hour": { price: "£60", duration: "1 hour" },
};

// ── What "the page is actually styled" means here ───────────────────────────
//
// ⚠️ The obvious check does not work, and finding that out is why it is written
// down rather than silently replaced. `getComputedStyle(document.body)
// .backgroundColor` is `rgba(0, 0, 0, 0)` — fully transparent — on ALL 21 URLs,
// styled or not, because the site paints its ground on <html>. Asserting on
// <body> would have passed identically against a page with no stylesheet at
// all: a check that cannot fail is not a check.
//
// The real ground is `--rahma-ivory` (#f7f3ec) applied to <html>. An unstyled
// document has neither that background nor any custom property, so both halves
// below distinguish styled from unstyled.
const EXPECTED_HTML_BACKGROUND = "rgb(247, 243, 236)";

// ── The one network failure that is allowed, and why ────────────────────────
//
// ⛔ Named, not ignored. Seven pages in the first sweep logged a 429 from
// `/monitoring/` — Sentry's tunnel route (next.config.ts `tunnelRoute`). Before
// classifying it, probe 2 read the response in full: the tunnel itself returns
// `308` (trailingSlash) then `200 {}` from `server: nginx, via: 1.1 google`,
// i.e. Sentry's own ingest answering through it. The 429s are therefore Sentry
// rate-limiting this DSN, not the local route failing.
//
// ⚠️ Recorded for the observability gate, NOT swallowed: a rate-limited DSN
// means error events are being DROPPED. That is a monitoring question, not a
// question about whether this page renders, so it does not fail this gate — but
// it must not vanish either.
//
// ⛔ Everything else counts. If a hero image starts 404ing, this list does not
// cover it and the test goes red.
const ALLOWED_FAILING_URL = /\/monitoring/;

// ⚠️ CAUGHT BY RUNNING BOTH VIEWPORTS, AND WORTH RECORDING.
//
// The first version filtered the Sentry tunnel out of the failed-REQUEST list
// only. That passed cleanly on desktop and failed on 14 of 18 pages on mobile —
// not because mobile differs, but because Sentry's rate limit is time-windowed,
// so whether the 429 fires at all depends on when the run happens. A spec that
// passes or fails by the clock is worse than no spec: it teaches whoever sees it
// go red to re-run until it is green.
//
// The console side cannot be filtered by URL, because Chrome's message for a
// failed subresource is the bare text "Failed to load resource: the server
// responded with a status of 429 (Too Many Requests)" — it carries no URL at
// all. So this drops that whole CLASS of console message, and nothing is lost by
// it: every failing subresource is already caught by `failedRequests`, which
// does carry the URL and does distinguish the Sentry tunnel from a broken image.
// What survives here is what only the console can tell us — React errors,
// hydration mismatches, thrown exceptions.
const RESOURCE_FAILURE_CONSOLE_MESSAGE = /^Failed to load resource:/;

type PageHealth = {
  status: number | null;
  finalPath: string;
  title: string;
  h1Count: number;
  h1Text: string;
  canonical: string | null;
  robots: string | null;
  hasHeader: boolean;
  hasFooter: boolean;
  htmlBackground: string;
  brandTokenResolves: boolean;
  placeholderImages: string[];
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
};

/**
 * Open a URL and report everything worth knowing about it in one pass.
 *
 * One visit, many assertions — the dev server compiles each route on its first
 * visit and these are the first visits most of these routes have ever had, so
 * re-opening a page per assertion would multiply the slowest part of the run by
 * the number of things being checked.
 */
async function measure(page: Page, path: string): Promise<PageHealth> {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];

  const onConsole = (message: { type: () => string; text: () => string }) => {
    if (message.type() !== "error") return;
    const text = message.text();
    // See RESOURCE_FAILURE_CONSOLE_MESSAGE — this class is covered, with its URL
    // intact, by the response listener below.
    if (RESOURCE_FAILURE_CONSOLE_MESSAGE.test(text)) return;
    consoleErrors.push(text.slice(0, 200));
  };
  const onPageError = (error: Error) => pageErrors.push(String(error).slice(0, 200));
  const onResponse = (response: Response) => {
    if (response.status() >= 400 && !ALLOWED_FAILING_URL.test(response.url())) {
      failedRequests.push(`${response.status()} ${response.url()}`);
    }
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("response", onResponse);

  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  // Let hydration run, so a client-side crash surfaces as a pageerror rather
  // than being missed by measuring the server-rendered HTML alone.
  await page.waitForTimeout(1200);

  const dom = await page.evaluate((expectedToken: string) => ({
    title: document.title,
    h1Count: document.querySelectorAll("h1").length,
    h1Text: document.querySelector("h1")?.textContent?.trim() ?? "",
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null,
    robots: document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? null,
    hasHeader: Boolean(document.querySelector("header")),
    hasFooter: Boolean(document.querySelector("footer")),
    htmlBackground: getComputedStyle(document.documentElement).backgroundColor,
    brandTokenResolves:
      getComputedStyle(document.documentElement).getPropertyValue(expectedToken).trim().length > 0,
    // See MISSING IMAGES below. Reports the INTENDED file path, so a failure
    // names the photo that is missing rather than just counting them.
    placeholderImages: Array.from(
      document.querySelectorAll('[role="img"][aria-label*="PLACEHOLDER IMAGE"]'),
    ).map((element) => (element.getAttribute("aria-label") ?? "").replace(/^.*Intended file:\s*/, "")),
  }), "--rahma-green");

  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  page.off("response", onResponse);

  return {
    status: response ? response.status() : null,
    finalPath: new URL(page.url()).pathname,
    ...dom,
    consoleErrors,
    pageErrors,
    failedRequests,
  };
}

/** The assertions every public page must satisfy, whatever else it is. */
function expectHealthy(health: PageHealth, path: string) {
  expect(health.status, `${path} did not return 200`).toBe(200);

  // ⛔ ROOT CAUSE BEFORE SYMPTOM, and this order was arrived at by testing it.
  //
  // Planting a throw in a client component rendered by the public layout made
  // this function fail on "should have exactly one <h1>" — true, but useless.
  // The page had no <h1> because Next had replaced it with the dev error
  // overlay, and the actual message ("planted hydration failure") was sitting
  // unread in `pageErrors`. Anyone reading that failure would have gone looking
  // for a missing heading.
  //
  // An uncaught exception during hydration is a broken page even when the
  // server-rendered HTML looks perfect, so it is checked first.
  expect(health.pageErrors, `${path} threw during hydration`).toEqual([]);

  // Exactly one <h1>. Zero is a page with no heading for a screen reader or a
  // search engine to anchor on; more than one is the ambiguity that produces.
  expect(health.h1Count, `${path} should have exactly one <h1>`).toBe(1);
  expect(health.h1Text.length, `${path} has an empty <h1>`).toBeGreaterThan(0);

  // Stylesheet actually applied — see EXPECTED_HTML_BACKGROUND above for why
  // this reads <html> and not <body>.
  expect(health.htmlBackground, `${path} rendered without the site stylesheet`).toBe(
    EXPECTED_HTML_BACKGROUND,
  );
  expect(health.brandTokenResolves, `${path} did not resolve the brand design tokens`).toBe(true);

  expect(health.failedRequests, `${path} has failing subresources`).toEqual([]);

  // ── MISSING IMAGES ────────────────────────────────────────────────────────
  //
  // ⛔ This assertion exists because the obvious one did not work, and the
  // reason is worth more than the assertion.
  //
  // Pointing a package hero at a file that does not exist left the spec GREEN.
  // The first reading — "the spec cannot see a broken image" — was wrong.
  // `PackageImage` consults a build-time manifest (src/lib/media/image-manifest.ts)
  // and, when a path is not in it, renders a LABELLED PLACEHOLDER instead of an
  // <img>. So a missing photo NEVER produces a failing request; the network is
  // the wrong place to look for it entirely.
  //
  // ⚠️ That is good behaviour, not a bug: a visitor sees a designed panel rather
  // than a browser's broken-image icon. But it means a photo can vanish from the
  // live site without a single error anywhere — which is precisely the sort of
  // silent degradation this whole gate exists to catch.
  //
  // Measured 2026-08-20: ZERO placeholders across all 18 public pages. The
  // customer-facing site is fully photographed. Pinning that at zero turns "a
  // photo went missing" into a red test.
  expect(
    health.placeholderImages,
    `${path} is showing ${health.placeholderImages.length} placeholder image(s) instead of real photography`,
  ).toEqual([]);
}

test.describe("E08-93/94/95 — the public website", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run.");
  test.describe.configure({ mode: "serial" });

  // ⚠️ NOT a performance statement, and must never be read as one. The dev
  // server compiles each route the first time it is requested, and this spec is
  // the first thing that has ever requested most of them. Gate 14 owns speed,
  // and it measures the BUILT site.
  test.setTimeout(300_000);

  test("E08-93 — all 18 indexable pages render, styled, with their own title and canonical", async ({
    page,
  }) => {
    const problems: string[] = [];
    const titlesSeen = new Map<string, string>();

    for (const route of INDEXABLE) {
      const health = await measure(page, route.path);
      expectHealthy(health, route.path);

      // No silent redirect: a page that quietly lands somewhere else is not the
      // page the sitemap is advertising.
      expect(health.finalPath, `${route.path} redirected away`).toBe(route.path);

      // ⚠️ COLLECTED, not thrown — and that ordering was arrived at by testing
      // it. Planting /about/'s title on /reviews/ originally aborted the loop
      // here, on the pinned-title check, so the duplicate-title check below
      // never ran and was left as a guard nobody had ever seen fail. Collecting
      // means one run reports BOTH facts, and names both pages.
      if (health.title !== route.title) {
        problems.push(`${route.path} title is ${JSON.stringify(health.title)}, expected ${JSON.stringify(route.title)}`);
      }

      // Self-referential canonical on the production origin. ⛔ Not the dev
      // origin: src/content/site/site-url.ts is a pure constant precisely so a
      // localhost canonical can never ship.
      expect(health.canonical, `${route.path} canonical`).toBe(
        `https://rahmatherapy.uk${route.path}`,
      );

      // Indexable means indexable — no stray noindex on a page meant to rank.
      expect(health.robots, `${route.path} carries a robots directive`).toBeNull();

      // The marketing chrome. Both come from src/app/(public)/layout.tsx, so a
      // missing one means the layout did not wrap this route.
      expect(health.hasHeader, `${route.path} has no site header`).toBe(true);
      expect(health.hasFooter, `${route.path} has no site footer`).toBe(true);

      const duplicate = titlesSeen.get(health.title);
      if (duplicate) problems.push(`${route.path} shares its title with ${duplicate}`);
      titlesSeen.set(health.title, route.path);

      if (health.consoleErrors.length > 0) {
        // Reported and asserted below, but collected first so ONE run names
        // every offending page instead of stopping at the first.
        problems.push(`${route.path} console: ${JSON.stringify(health.consoleErrors)}`);
      }
    }

    // ⛔ Two pages sharing a title is a real SEO defect — it is what search
    // engines use to tell one result from another — and it is the exact failure
    // copy-pasting a metadata block produces.
    expect(problems, `${problems.length} page-level problem(s)`).toEqual([]);

    // ⚠️ Stated honestly: with all 18 titles pinned above, this can only fail if
    // two pages genuinely converge on one title — which the pins would also
    // catch. It earns its place as the check that survives a maintainer adding a
    // 19th route by copy-pasting a row, where the pin would agree with itself.
    expect(titlesSeen.size, "all 18 titles should be distinct").toBe(18);
  });

  test("E08-93 — the three non-indexable URLs behave as documented", async ({ page, request }) => {
    // ⛔ Read the RAW status. page.goto() follows redirects, so it can only ever
    // report the 200 at the end of the chain — which is what a broken redirect
    // looks like too.
    const root = await request.get("/", { maxRedirects: 0 });
    expect(root.status(), "/ should permanently redirect").toBe(308);
    expect(root.headers()["location"], "/ should land on the canonical homepage").toBe("/home/");

    const luton = await request.get("/areas/luton/", { maxRedirects: 0 });
    expect(luton.status(), "/areas/luton/ should permanently redirect").toBe(308);
    expect(luton.headers()["location"], "/areas/luton/ should consolidate onto the hub").toBe(
      "/areas/",
    );

    // The customer's manage link. Reached WITHOUT a token it must still render
    // a real page rather than crash — that is what a customer sees when a link
    // is truncated by their mail client.
    const manage = await measure(page, "/booking/manage/");
    expectHealthy(manage, "/booking/manage/");
    expect(manage.title).toBe("Manage Booking - Rahma Therapy");

    // ⛔ noindex, and NO canonical. Both matter: this URL carries a booking
    // token, and a canonical would advertise a customer's link.
    expect(manage.robots, "/booking/manage/ must be noindex").toBe("noindex");
    expect(manage.canonical, "/booking/manage/ must not advertise a canonical").toBeNull();

    // ⚠️ Deliberately NOT the marketing chrome — this route sits outside the
    // (public) layout group. Asserted, so that "no header" stays a decision
    // rather than becoming an accident.
    expect(manage.hasHeader, "/booking/manage/ should not carry the marketing header").toBe(false);
    expect(manage.hasFooter, "/booking/manage/ should not carry the marketing footer").toBe(false);

    // A token that is not a token must be refused as gracefully as no token.
    const badToken = await measure(page, "/booking/manage/?token=not-a-real-token");
    expectHealthy(badToken, "/booking/manage/?token=<invalid>");
    expect(badToken.robots).toBe("noindex");
  });

  test("E08-94 — the six area pages, including the hub consolidation", async ({ page }) => {
    // The hub and its five spokes each have to be a page in their own right —
    // that is the entire point of having six of them rather than one.
    const hub = await measure(page, "/areas/");
    expectHealthy(hub, "/areas/");

    const spokeTitles = new Set<string>([hub.title]);

    for (const slug of AREA_SPOKES) {
      const path = `/areas/${slug}/`;
      const health = await measure(page, path);
      expectHealthy(health, path);
      expect(health.canonical, `${path} canonical`).toBe(`https://rahmatherapy.uk${path}`);

      // Each spoke must name its own area in its heading. Five near-identical
      // pages that differ only in a URL are what a search engine treats as one
      // page — and the business paid for six.
      const areaWords = slug.split("-").map((word) => word.toLowerCase());
      const heading = health.h1Text.toLowerCase();
      for (const word of areaWords) {
        expect(heading, `${path} <h1> does not name the area`).toContain(word);
      }

      expect(spokeTitles.has(health.title), `${path} reuses another area's title`).toBe(false);
      spokeTitles.add(health.title);
    }

    expect(spokeTitles.size, "hub + 5 spokes should be 6 distinct titles").toBe(6);

    // The consolidation, end to end: /areas/luton/ must not merely redirect, it
    // must land on the hub AND inherit the hub's canonical. A redirect that
    // lands somewhere carrying its own canonical would split the ranking the
    // redirect exists to combine.
    const luton = await measure(page, "/areas/luton/");
    expect(luton.status, "/areas/luton/ should end at 200").toBe(200);
    expect(luton.finalPath, "/areas/luton/ should land on the hub").toBe("/areas/");
    expect(luton.canonical, "the hub's canonical must survive the redirect").toBe(
      "https://rahmatherapy.uk/areas/",
    );
    expect(luton.title, "the hub's title must survive the redirect").toBe(hub.title);
  });

  test("E08-95 — each service page shows its own price and duration", async ({ page }) => {
    for (const slug of PACKAGE_SLUGS) {
      const path = `/services/${slug}/`;
      const facts = PACKAGE_FACTS[slug];
      const health = await measure(page, path);
      expectHealthy(health, path);

      // ⛔ SCOPED to the hero section, on purpose. Every package page also
      // renders a "related packages" strip carrying OTHER packages' prices, so
      // an unscoped search for "£40" would pass on a page that shows the wrong
      // price in its own hero — the exact defect this case exists to catch.
      // (The related-package prices are separately-authored duplicates; that
      // they can drift is finding M6, and belongs to gate 03.)
      const hero = page.locator("h1").locator("xpath=ancestor::section[1]");
      await expect(hero, `${path} hero section`).toHaveCount(1);

      await expect(
        hero.getByText(facts.price, { exact: true }),
        `${path} should show its own price ${facts.price} in the hero`,
      ).toBeVisible();

      await expect(
        hero.getByText(facts.duration, { exact: true }),
        `${path} should show its duration "${facts.duration}" in the hero`,
      ).toBeVisible();

      // The booking door has to be on the page, or the page cannot do its job.
      //
      // ⚠️ SCOPED TO THE HERO, and the reason is the whole point of running both
      // viewports. The first version used `[data-booking-trigger]`.first(),
      // which passed on desktop and failed on mobile — and it would have been
      // very easy to write that up as "the booking button disappears on
      // phones". It does not. Measured: a package page carries SIX booking
      // triggers, and DOM order puts two navbar links first. One of those is
      // `display:none` under the collapsed hamburger on mobile (correct), and
      // one sits in a `visibility:hidden` menu drawer at BOTH widths (also
      // correct). `.first()` was asking about the nav, not about the page.
      //
      // The hero CTA — the one a customer actually presses — is visible at both
      // widths, and that is what this asserts.
      await expect(
        hero.locator("[data-booking-trigger]"),
        `${path} hero has no booking trigger`,
      ).toBeVisible();
    }
  });

  test("the sitemap advertises exactly the 18 URLs that exist and are indexable", async ({
    request,
  }) => {
    // ⛔ This is the ONE check that reads the app's own list, and the circularity
    // that would ruin any other test is the point of this one: its whole job is
    // to compare what the app TELLS Google against what this spec has just
    // proven is there. A page that 404s but is still advertised, or a page that
    // exists but was dropped from the sitemap, is invisible from either side
    // alone.
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);

    const advertised = [...(await response.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (match) => match[1],
    );

    const expected = INDEXABLE.map((route) => `https://rahmatherapy.uk${route.path}`);

    // ⛔ Contents BEFORE count, deliberately. Dropping a page from the sitemap
    // first produced only "Expected 18, Received 17" — true, red, and useless:
    // it does not say WHICH page vanished, which is the only thing anyone
    // reading the failure needs. The set comparison names it. The count stays as
    // a backstop for the case where two changes cancel out.
    expect([...advertised].sort(), "sitemap contents").toEqual([...expected].sort());
    expect(advertised.length, "sitemap URL count").toBe(18);

    // ⛔ And the three exclusions, asserted rather than trusted: a redirect or a
    // noindex page in a sitemap is a crawl error on every fetch.
    for (const excluded of [
      "https://rahmatherapy.uk/",
      "https://rahmatherapy.uk/areas/luton/",
      "https://rahmatherapy.uk/booking/manage/",
    ]) {
      expect(advertised, `${excluded} must not be advertised`).not.toContain(excluded);
    }

    // robots.txt must not block what the sitemap advertises — the classic
    // own-goal where a page is submitted for indexing and disallowed at once.
    const robots = await request.get("/robots.txt");
    expect(robots.status()).toBe(200);
    const robotsText = await robots.text();
    expect(robotsText).toContain("Sitemap: https://rahmatherapy.uk/sitemap.xml");
    for (const disallowed of robotsText.matchAll(/^Disallow:\s*(\S+)$/gm)) {
      const blocked = disallowed[1];
      for (const url of advertised) {
        expect(
          new URL(url).pathname.startsWith(blocked),
          `robots.txt blocks ${url} via "Disallow: ${blocked}"`,
        ).toBe(false);
      }
    }
  });
});
