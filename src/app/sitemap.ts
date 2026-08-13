import type { MetadataRoute } from "next";
import { areaSpokes } from "@/content/pages/areaPages";
import { packagePages } from "@/content/pages/packagePages";
import { siteUrl } from "@/content/site/site-url";

/**
 * The public sitemap: 18 URLs, one per indexable customer-facing page.
 *
 * ── Trailing slashes ────────────────────────────────────────────────────────
 * next.config.ts sets `trailingSlash: true`, so every indexed URL carries one.
 * A sitemap entry without the slash would 308 on every fetch, and would also
 * disagree with the page's own canonical — which Google explicitly warns
 * against ("don't specify different URLs as canonical for the same page using
 * different canonicalization techniques"). Build every path from `siteUrl()`
 * so the origin stays defined in exactly one place (canonical-domain.test.ts
 * fails the suite on a second literal).
 *
 * ── No <priority>, no <changefreq> ──────────────────────────────────────────
 * Google ignores both ("Google ignores <priority> and <changefreq> values")
 * and so does Bing. `MetadataRoute.Sitemap` will happily emit them if the
 * fields are populated, so the correct action is to leave them out entirely.
 *
 * ── No <lastmod>, deliberately ──────────────────────────────────────────────
 * Google's trust in lastmod is binary and site-wide: "we either trust it or we
 * don't." A build-time `new Date()` would restamp all 18 URLs on every deploy
 * and forfeit the field permanently — and deriving it from git is unreliable
 * here, because Cloudflare Workers Builds clones shallow, so a per-file
 * `git log` returns HEAD's date for every file. Omitting lastmod is Google's
 * own recommended fallback when an accurate date is not available. Adding it
 * back is a freshness task with its own committed date source, not a
 * discovery task.
 *
 * ── What is deliberately NOT here ───────────────────────────────────────────
 * A sitemap should list only canonical, indexable URLs — no redirects, no
 * 404s, no robots-blocked or noindexed pages. Excluded, each verified:
 *   /                       308 → /home/        (redirect)
 *   /areas/luton/           308 → /areas/       (redirect)
 *   /booking/manage/        noindex             (token-bearing, Phase 1)
 *   /admin/**               307 → login         (auth-gated + noindex)
 *   /api/**                 405                 (POST-only handlers)
 */

const CORE_PATHS = [
  "/home/",
  "/about/",
  "/services/",
  "/reviews/",
  "/faqs-aftercare/",
  "/privacy/",
  "/cookies/",
  "/areas/",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const packagePaths = packagePages.map((page) => `/services/${page.slug}/`);
  // areaSpokes already excludes the "luton" slug, whose URL 308s to /areas/.
  const areaPaths = areaSpokes.map((area) => `/areas/${area.slug}/`);

  return [...CORE_PATHS, ...packagePaths, ...areaPaths].map((path) => ({
    url: siteUrl(path),
  }));
}
