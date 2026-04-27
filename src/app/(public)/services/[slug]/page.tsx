import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PackageBenefits } from "@/components/package-pages/PackageBenefits";
import { PackageFAQ } from "@/components/package-pages/PackageFAQ";
import { PackageFinalCTA } from "@/components/package-pages/PackageFinalCTA";
import { PackageHero } from "@/components/package-pages/PackageHero";
import { PackageIncludes } from "@/components/package-pages/PackageIncludes";
import { PackageSafety } from "@/components/package-pages/PackageSafety";
import { PackageSessionSteps } from "@/components/package-pages/PackageSessionSteps";
import { PackageSummaryCard } from "@/components/package-pages/PackageSummaryCard";
import { PackageWhoItsFor } from "@/components/package-pages/PackageWhoItsFor";
import { RelatedPackages } from "@/components/package-pages/RelatedPackages";
import { TreatmentBreakdown } from "@/components/package-pages/TreatmentBreakdown";
import { getPackagePage, packagePages } from "@/content/pages/packagePages";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return packagePages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getPackagePage(slug);

  if (!page) {
    return {};
  }

  return {
    title: page.seo.title,
    description: page.seo.description,
  };
}

export default async function PackagePage({ params }: PageProps) {
  const { slug } = await params;
  const page = getPackagePage(slug);

  if (!page) {
    notFound();
  }

  const numericPrice = page.price.replace(/[^0-9.]/g, "");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: page.title,
    provider: {
      "@type": "HealthAndBeautyBusiness",
      name: "Rahma Therapy",
      areaServed: "Luton",
      telephone: "07798897222",
    },
    areaServed: "Luton",
    offers: {
      "@type": "Offer",
      price: numericPrice,
      priceCurrency: "GBP",
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PackageHero page={page} />
      <PackageSummaryCard page={page} />
      <PackageWhoItsFor page={page} />
      <PackageIncludes page={page} />
      <TreatmentBreakdown page={page} />
      <PackageSessionSteps />
      <PackageBenefits page={page} />
      <PackageSafety />
      <PackageFAQ page={page} />
      <RelatedPackages page={page} />
      <PackageFinalCTA page={page} />
    </>
  );
}
