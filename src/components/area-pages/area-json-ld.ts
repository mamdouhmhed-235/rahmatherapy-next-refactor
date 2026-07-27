import type { AreaPage } from "@/content/pages/areaPages";
import { SITE_URL } from "@/content/site/site-url";

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
    serviceType: "Hijama, cupping and massage therapy",
    provider: {
      "@id": `${SITE_URL}/#business`,
      "@type": "HealthAndBeautyBusiness",
      name: "Rahma Therapy",
      telephone: "+447798897222",
      areaServed: "Luton and surrounding areas",
    },
    areaServed: { "@type": "Place", name: `${area.name}, Luton` },
  };

  const breadcrumbItems = [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
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
