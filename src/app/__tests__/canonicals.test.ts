import type { Metadata } from "next";
import { describe, expect, it } from "vitest";
import { SITE_URL } from "@/content/site/site-url";
import { packagePages } from "@/content/pages/packagePages";
import { areaSpokes } from "@/content/pages/areaPages";

import { metadata as home } from "../(public)/home/page";
import { metadata as about } from "../(public)/about/page";
import { metadata as services } from "../(public)/services/page";
import { metadata as reviews } from "../(public)/reviews/page";
import { metadata as faqs } from "../(public)/faqs-aftercare/page";
import { metadata as privacy } from "../(public)/privacy/page";
import { metadata as cookies } from "../(public)/cookies/page";
import { generateMetadata as packageMetadata } from "../(public)/services/[slug]/page";
import { generateMetadata as areaMetadata } from "../(public)/areas/[slug]/page";
import { generateMetadata as areasHubMetadata } from "../(public)/areas/page";

/**
 * Canonical coverage (SEO-AEO-GEO-IMPLEMENTATION.md Phase 3).
 *
 * Two failure modes are guarded here:
 *   1. A public page shipping with NO canonical — the state 11 of 18 routes
 *      were in before this phase.
 *   2. A canonical missing its trailing slash. next.config.ts sets
 *      trailingSlash: true, so a slashless canonical would disagree with both
 *      the page's own URL and its sitemap entry — which Google explicitly warns
 *      against ("don't specify different URLs as canonical for the same page
 *      using different canonicalization techniques").
 */

// Use Next's own Metadata type — a hand-rolled shape is not assignable to it,
// because `alternates` may legitimately be null as well as undefined.
const canonicalOf = (m: Metadata) => m.alternates?.canonical as string | undefined;

const STATIC_PAGES: Array<[string, Metadata]> = [
  ["/home/", home],
  ["/about/", about],
  ["/services/", services],
  ["/reviews/", reviews],
  ["/faqs-aftercare/", faqs],
  ["/privacy/", privacy],
  ["/cookies/", cookies],
];

describe("canonical coverage", () => {
  it.each(STATIC_PAGES)("%s self-canonicalises to the absolute URL", (path, m) => {
    expect(canonicalOf(m)).toBe(`${SITE_URL}${path}`);
  });

  it("the /areas hub self-canonicalises", () => {
    expect(canonicalOf(areasHubMetadata())).toBe(`${SITE_URL}/areas/`);
  });

  it.each(packagePages.map((p) => p.slug))(
    "/services/%s/ self-canonicalises",
    async (slug) => {
      const m = await packageMetadata({ params: Promise.resolve({ slug }) });
      expect(canonicalOf(m)).toBe(`${SITE_URL}/services/${slug}/`);
    },
  );

  it.each(areaSpokes.map((a) => a.slug))("/areas/%s/ self-canonicalises", async (slug) => {
    const m = await areaMetadata({ params: Promise.resolve({ slug }) });
    expect(canonicalOf(m)).toBe(`${SITE_URL}/areas/${slug}/`);
  });
});

describe("canonical hygiene", () => {
  it("every static canonical carries a trailing slash", () => {
    for (const [, m] of STATIC_PAGES) {
      expect(canonicalOf(m)).toMatch(/\/$/);
    }
  });

  it("every canonical is absolute on the one canonical origin", () => {
    for (const [, m] of STATIC_PAGES) {
      expect(canonicalOf(m)?.startsWith(`${SITE_URL}/`)).toBe(true);
    }
  });

  it("no canonical carries a query string", () => {
    // A canonical built from searchParams instead of the route path would make
    // ?booking=1 and ?utm_source=x self-canonicalise, manufacturing the very
    // duplicates this phase removes.
    for (const [, m] of STATIC_PAGES) {
      expect(canonicalOf(m)).not.toContain("?");
    }
  });
});
