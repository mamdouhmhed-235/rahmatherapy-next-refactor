import { describe, expect, it } from "vitest";
import robots from "../robots";
import sitemap from "../sitemap";
import { SITE_URL } from "@/content/site/site-url";
import { areaSpokes } from "@/content/pages/areaPages";
import { packagePages } from "@/content/pages/packagePages";

/**
 * Guards for the discovery surface (SEO-AEO-GEO-IMPLEMENTATION.md Phase 2).
 *
 * The failure this file exists to catch is a URL that is listed in the sitemap
 * AND disallowed in robots.txt — a direct contradiction that tells Google to
 * index something it is simultaneously forbidden to fetch. It is the most
 * likely way this pair regresses, because the two files are edited separately.
 */

const entries = sitemap();
const urls = entries.map((e) => e.url);

const disallowRules = () => {
  const { rules } = robots();
  const group = Array.isArray(rules) ? rules[0] : rules;
  const raw = group.disallow ?? [];
  return Array.isArray(raw) ? raw : [raw];
};

describe("sitemap", () => {
  it("lists exactly the 18 indexable public URLs", () => {
    // 8 core + 5 packages + 5 area spokes. Derived, not hard-coded, so adding
    // an area or package cannot silently leave the sitemap behind.
    expect(urls).toHaveLength(8 + packagePages.length + areaSpokes.length);
    expect(urls).toHaveLength(18);
  });

  it("every URL is absolute and on the canonical origin", () => {
    for (const url of urls) {
      expect(url.startsWith(`${SITE_URL}/`)).toBe(true);
    }
  });

  it("every URL carries a trailing slash (next.config trailingSlash: true)", () => {
    // Without this, every sitemap URL 308s and disagrees with its own canonical.
    const missing = urls.filter((u) => !u.endsWith("/"));
    expect(missing).toEqual([]);
  });

  it("contains no duplicates", () => {
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("omits priority and changefreq entirely — Google and Bing ignore both", () => {
    for (const entry of entries) {
      expect(entry).not.toHaveProperty("priority");
      expect(entry).not.toHaveProperty("changeFrequency");
    }
  });

  it("omits lastmod rather than guessing it", () => {
    // Google's trust in lastmod is binary and site-wide; a build-stamped date
    // would restamp all 18 URLs every deploy and forfeit the field.
    for (const entry of entries) {
      expect(entry).not.toHaveProperty("lastModified");
    }
  });

  it("excludes redirects, noindexed and auth-gated URLs", () => {
    const forbidden = [
      "/areas/luton/", // 308 -> /areas/
      "/booking/manage", // noindex (Phase 1)
      "/admin", // auth-gated + noindex
      "/api/",
    ];
    for (const fragment of forbidden) {
      expect(urls.some((u) => u.includes(fragment))).toBe(false);
    }
    // "/" alone 308s to /home/; the sitemap must list /home/, not the bare root.
    expect(urls).not.toContain(`${SITE_URL}/`);
    expect(urls).toContain(`${SITE_URL}/home/`);
  });
});

describe("robots", () => {
  it("points at the sitemap on the canonical origin", () => {
    expect(robots().sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });

  it("allows all user agents, including AI search crawlers", () => {
    const { rules } = robots();
    const group = Array.isArray(rules) ? rules[0] : rules;
    expect(group.userAgent).toBe("*");
    expect(group.allow).toBe("/");
  });

  it("does not disallow /admin — auth-gates it instead of advertising it", () => {
    expect(disallowRules().some((r) => r.includes("admin"))).toBe(false);
  });

  it("does not disallow any noindexed path", () => {
    // ⛔ The trap: a page that is both Disallowed and noindexed can never have
    // its noindex read, so it stays indexable. These paths carry noindex, so
    // they must stay crawlable.
    const noindexed = ["/booking/manage", "/admin/login", "/admin/password-reset"];
    for (const path of noindexed) {
      expect(disallowRules().some((rule) => path.startsWith(rule.replace(/\/$/, "")))).toBe(false);
    }
  });
});

describe("sitemap and robots do not contradict each other", () => {
  it("no sitemap URL is disallowed in robots.txt", () => {
    const rules = disallowRules();
    const conflicts = urls.filter((url) => {
      const path = new URL(url).pathname;
      return rules.some((rule) => path.startsWith(rule));
    });
    expect(conflicts).toEqual([]);
  });
});
