import { siteUrl } from "@/content/site/site-url";

/**
 * BreadcrumbList JSON-LD from a trail of crumbs.
 *
 * Paths carry their trailing slash (next.config.ts sets `trailingSlash`), so
 * every `item` matches the page's own canonical and sitemap entry — Google
 * warns against the same page being named by different URLs across different
 * canonicalisation techniques.
 */
export function buildBreadcrumbJsonLd(trail: ReadonlyArray<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: siteUrl(crumb.path),
    })),
  };
}

/** Every trail starts at the homepage, which lives at /home/ rather than /. */
export const HOME_CRUMB = { name: "Home", path: "/home/" } as const;
