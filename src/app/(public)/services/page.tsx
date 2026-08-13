import type { Metadata } from "next";
import { PackageCards } from "@/components/services/PackageCards";
import { PackageComparison } from "@/components/services/PackageComparison";
import { PackageFinder } from "@/components/services/PackageFinder";
import { ServicesFinalCTA } from "@/components/services/ServicesFinalCTA";
import { ServicesHero } from "@/components/services/ServicesHero";
import { TreatmentMethods } from "@/components/services/TreatmentMethods";
import { siteUrl } from "@/content/site/site-url";

export const metadata: Metadata = {
  title: "Services | Mobile Hijama, Cupping & Massage in Luton",
  description:
    "Rahma Therapy’s mobile hijama, cupping and massage packages in Luton: the Supreme Combo, Hijama Package, Fire Package and massage therapy options from £40.",
  alternates: {
    canonical: siteUrl("/services/"),
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "HealthAndBeautyBusiness",
  name: "Rahma Therapy",
  description:
    "Mobile hijama, cupping and massage therapy packages in Luton with CMA and IPHM qualified male and female therapists.",
  areaServed: "Luton",
  telephone: "07798897222",
  url: siteUrl("/services/"),
  makesOffer: [
    {
      "@type": "Offer",
      name: "Supreme Combo Package",
      price: "55",
      priceCurrency: "GBP",
    },
    {
      "@type": "Offer",
      name: "Hijama Package",
      price: "45",
      priceCurrency: "GBP",
    },
    {
      "@type": "Offer",
      name: "Fire Package",
      price: "40",
      priceCurrency: "GBP",
    },
    {
      "@type": "Offer",
      name: "Massage Therapy — 30 mins",
      price: "40",
      priceCurrency: "GBP",
    },
    {
      "@type": "Offer",
      name: "Massage Therapy — 1 hour",
      price: "60",
      priceCurrency: "GBP",
    },
  ],
};

export default function ServicesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ServicesHero />
      <PackageCards />
      <PackageFinder />
      <PackageComparison />
      <TreatmentMethods />
      <ServicesFinalCTA />
    </>
  );
}
