import type { AreaPage } from "@/content/pages/areaPages";
import { businessNode } from "@/content/site/business-node";
import { SITE_URL } from "@/content/site/site-url";

/**
 * The `areaServed` place for an area page.
 *
 * This used to be `{ "@type": "Place", name: `${area.name}, Luton` }` for every
 * area, which asserted two things that are false: that Dunstable and Houghton
 * Regis are in Luton (they are separate towns in Central Bedfordshire), and —
 * on the hub, where `area.name` is already "Luton" — the string "Luton, Luton".
 * The visible titles were always correct; only this machine-readable layer was
 * wrong. See `AreaPlaceType`.
 */
function buildAreaServed(area: AreaPage) {
  const LUTON = { "@type": "City", name: "Luton" } as const;
  const REGION = { addressRegion: "Bedfordshire", addressCountry: "GB" } as const;

  if (area.placeType === "district") {
    // A district inside Luton — say so explicitly rather than by string suffix.
    return {
      "@type": "Place",
      name: area.name,
      containedInPlace: LUTON,
    };
  }

  // "city" (Luton itself) and "town" (Dunstable, Houghton Regis) are both
  // free-standing places. Neither is contained in the other.
  return {
    "@type": "City",
    name: area.name,
    address: { "@type": "PostalAddress", addressLocality: area.name, ...REGION },
  };
}

// Service + BreadcrumbList JSON-LD, reproduced exactly from the prototype
// (area.html inline script). The hub (/areas) drops the trailing breadcrumb
// item so the crumb ends at "Areas we serve".
export function buildAreaJsonLd(area: AreaPage, { isHub }: { isHub: boolean }) {
  // The app uses trailingSlash: true, so the indexed URLs carry a trailing slash.
  const url = isHub ? `${SITE_URL}/areas/` : `${SITE_URL}/areas/${area.slug}/`;
  const description = area.seo.description;

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `Mobile hijama, cupping and massage in ${area.name}`,
    description,
    url,
    // An array, not one blended phrase, so "cupping" and "massage" are
    // separately addressable entities per place rather than a single string a
    // consumer has to parse apart.
    serviceType: ["Cupping therapy", "Massage therapy", "Hijama (wet cupping)"],
    provider: businessNode,
    areaServed: buildAreaServed(area),
  };

  const breadcrumbItems = [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/home/` },
    { "@type": "ListItem", position: 2, name: "Areas we serve", item: `${SITE_URL}/areas/` },
  ];

  if (!isHub) {
    breadcrumbItems.push({ "@type": "ListItem", position: 3, name: area.name, item: url });
  }

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems,
  };

  return [serviceSchema, breadcrumbSchema];
}
