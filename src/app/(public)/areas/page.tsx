import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AreaPage } from "@/components/area-pages/AreaPage";
import { buildAreaJsonLd } from "@/components/area-pages/area-json-ld";
import { getAreaPage } from "@/content/pages/areaPages";
import { siteUrl } from "@/content/site/site-url";

// The hub: Luton acts as the /areas landing page and links down to the spokes.
const hubArea = getAreaPage("luton");

export function generateMetadata(): Metadata {
  if (!hubArea) {
    return {};
  }

  return {
    title: hubArea.seo.title,
    description: hubArea.seo.description,
    alternates: {
      canonical: siteUrl("/areas/"),
    },
  };
}

export default function AreasHubPage() {
  if (!hubArea) {
    notFound();
  }

  const jsonLd = buildAreaJsonLd(hubArea, { isHub: true });

  return (
    <>
      {jsonLd.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <AreaPage area={hubArea} />
    </>
  );
}
