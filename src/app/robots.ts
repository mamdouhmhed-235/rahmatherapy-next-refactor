import type { MetadataRoute } from "next";
import { siteUrl } from "@/content/site/site-url";

/**
 * robots.txt.
 *
 * ── Disallow controls CRAWLING, not INDEXING ────────────────────────────────
 * "Google can't index the content of pages which are disallowed for crawling,
 * but it may still index the URL and show it in search results without a
 * snippet." So Disallow is the wrong instrument for keeping a page out of the
 * index — `noindex` is, and `noindex` only works on pages that stay crawlable.
 *
 * ⛔ Never add a Disallow for a path that also carries `noindex`. The crawler
 * would never fetch the page, never see the directive, and the URL could stay
 * indexed with no way to remove it short of a manual Search Console request.
 * That is strictly worse than doing nothing. The pages noindexed in Phase 1 —
 * /booking/manage and the three middleware-exempt /admin auth routes — are
 * therefore deliberately absent from the list below.
 *
 * ── Why /admin is NOT disallowed ────────────────────────────────────────────
 * It is already auth-gated by src/middleware.ts, and nothing on the public site
 * links to it. Listing it here would be the first public advertisement that the
 * path exists, in exchange for nothing: crawl budget is irrelevant at this size
 * (Google's guide applies from ~10,000 pages; this site has 20).
 *
 * ── AI crawlers are deliberately allowed ────────────────────────────────────
 * `User-agent: *` permits them all, and that is intended. "AI crawler" is not
 * one thing: GPTBot and ClaudeBot are *training* crawlers, but OAI-SearchBot
 * and Claude-SearchBot are the ones that build the indexes answer engines cite
 * from. Blocking those would cost exactly the AI visibility this workstream is
 * for. No AI-specific rules are needed — adding them could only subtract.
 *
 * ⚠️ Cloudflare currently serves a managed robots.txt (its Content Signals
 * preamble, ~24 comment lines, no directives). It PREPENDS rather than
 * replaces, so after deploy the live file will show those comments above these
 * rules — that is expected and benign, since every parser ignores comments.
 * Verify the deploy by checking the `Sitemap:` line is present, not by
 * expecting a clean file, and do not disable the managed file.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        // POST-only route handlers; a crawler's GET returns 405 regardless.
        "/api/",
        // Sentry's tunnel route (next.config.ts `tunnelRoute`), not a page.
        "/monitoring",
      ],
    },
    // Always derive the origin from siteUrl(). canonical-domain.test.ts asserts
    // that site-url.ts is the ONLY file under src/ carrying the literal origin,
    // so writing it out here — even inside a comment — fails the suite.
    sitemap: siteUrl("/sitemap.xml"),
  };
}
