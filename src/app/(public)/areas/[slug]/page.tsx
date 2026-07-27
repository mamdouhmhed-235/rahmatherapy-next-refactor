import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { AreaPage } from "@/components/area-pages/AreaPage";
import { buildAreaJsonLd } from "@/components/area-pages/area-json-ld";
import { areaSpokes, getAreaPage } from "@/content/pages/areaPages";
import { siteUrl } from "@/content/site/site-url";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return areaSpokes.map((area) => ({ slug: area.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const area = getAreaPage(slug);

  if (!area || area.slug === "luton") {
    return {};
  }

  return {
    title: area.seo.title,
    description: area.seo.description,
    alternates: {
      canonical: siteUrl(`/areas/${area.slug}/`),
    },
  };
}

export default async function AreaSpokePage({ params }: PageProps) {
  const { slug } = await params;

  // Luton is the hub and lives at /areas — consolidate to one canonical URL
  // with a permanent (308) redirect so any equity to /areas/luton is preserved.
  if (slug === "luton") {
    permanentRedirect("/areas/");
  }

  const area = getAreaPage(slug);

  if (!area) {
    notFound();
  }

  const jsonLd = buildAreaJsonLd(area, { isHub: false });

  return (
    <>
      {jsonLd.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <AreaPage area={area} />
    </>
  );
}
