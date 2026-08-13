import { contactLinks } from "@/content/site/contact";
import { siteIdentity } from "@/content/site/identity";
import { siteUrl } from "@/content/site/site-url";
import { socialLinks } from "@/content/site/social";
import { googleReviewsUrl } from "@/lib/content/reviews";

/**
 * The ONE business entity, shared by every page that describes the business.
 *
 * ── Why this module exists ──────────────────────────────────────────────────
 * Six places used to describe the business independently and disagreed with
 * each other: two telephone formats (`+447798897222` on /home and the area
 * pages, bare `07798897222` on four others), four different `url` values (each
 * page pointed at itself rather than at the business), `priceRange` on one page
 * only, and `sameAs` on two. To a conformant parser that is five anonymous,
 * conflicting businesses rather than one.
 *
 * ── Ordering trap ───────────────────────────────────────────────────────────
 * ⛔ Normalising the facts and introducing the `@id` must happen TOGETHER. RDF
 * merge is additive, so giving conflicting nodes a shared identifier first
 * would fuse the contradictions into one entity asserting both phone numbers.
 *
 * ── @id is in-page only ─────────────────────────────────────────────────────
 * Google documents `@id` as an *in-page* node identifier and has never
 * documented resolving one to a node defined at a different URL. So every page
 * emits this node IN FULL; the shared `@id` buys consistency for consumers that
 * do merge graphs, not cross-page resolution. Never replace an emission with a
 * bare `{ "@id": … }` reference.
 *
 * The identifier is absolute on purpose. A bare "#business" is a relative IRI
 * and resolves against the document, so it would mean a *different* entity on
 * every page — silently defeating the point.
 *
 * ── Only what the pages visibly show ────────────────────────────────────────
 * Google's structured-data policy forbids marking up content that is not
 * visible to readers, and the Owner's copy is frozen, so every property here is
 * one the site already displays: the phone number and email are in the footer
 * of every page, the price range spans the visible package prices (£40–£60),
 * and the Google listing is a real link on /reviews.
 *
 * Deliberately ABSENT, because the pages do not state them:
 *   openingHoursSpecification · paymentAccepted · currenciesAccepted
 *   knowsLanguage · foundingDate · streetAddress
 */

/** Stable, absolute identifier for the business entity. */
export const businessNodeId = siteUrl("/#business");

export const businessNode = {
  "@type": "HealthAndBeautyBusiness",
  "@id": businessNodeId,
  name: siteIdentity.name,
  description: siteIdentity.defaultDescription,
  // The business's own URL, not the current page's — this is one entity.
  url: siteUrl("/home/"),
  // E.164, matching the tel: href the whole site already links.
  telephone: contactLinks.phone.href.replace(/^tel:/, ""),
  email: contactLinks.email.value,
  areaServed: siteIdentity.serviceArea,
  // Spans the visible package prices: £40 (Fire / 30-min) to £60 (1 hour).
  priceRange: "£40-£60",
  /**
   * No `streetAddress`: this is a mobile/outcall business with no premises open
   * to the public, and Google Business Profile requires a service-area business
   * to hide its address. Fabricating one would risk suspension. Google lists
   * `address` as required for LocalBusiness, so a truthful locality-level
   * address is the honest middle path — verify in the Rich Results Test, and
   * fall back to `Organization` (which documents no required properties) if a
   * partial address is rejected.
   */
  address: {
    "@type": "PostalAddress",
    addressLocality: "Luton",
    addressRegion: "Bedfordshire",
    addressCountry: "GB",
  },
  /**
   * The documented cross-source entity signal. The Google listing carries the
   * real rating at its authoritative source, which is why no aggregateRating is
   * emitted here: Google does not show review rich results for reviews an
   * entity hosts about itself, and its guidelines rule out editor-curated
   * ratings outright.
   */
  sameAs: [...socialLinks.map((link) => link.href), googleReviewsUrl],
};

/** Standalone JSON-LD document for the business, for a page-level script tag. */
export const businessJsonLd = {
  "@context": "https://schema.org",
  ...businessNode,
};
