import type { Metadata } from "next";
import { BrandPageHero } from "@/components/sections/BrandPageHero";
import { FinalCtaSection } from "@/components/sections/FinalCtaSection";
import { PackageCardsSection } from "@/components/sections/PackageCardsSection";
import { ProcessStepsSection } from "@/components/sections/ProcessStepsSection";
import { RecommendationCardsSection } from "@/components/sections/RecommendationCardsSection";
import { TreatmentMosaicSection } from "@/components/sections/TreatmentMosaicSection";
import { TrustProofSection } from "@/components/sections/TrustProofSection";
import { servicesPageContent } from "@/content/pages/services";
import { StructuredData } from "@/lib/seo/StructuredData";
import { buildLocalBusinessJsonLd } from "@/lib/seo/jsonLd";
import { buildPageMetadata } from "@/lib/seo/metadata";

export function generateMetadata(): Metadata {
  return buildPageMetadata(servicesPageContent.seo);
}

export default function ServicesPage() {
  return (
    <>
      <StructuredData data={buildLocalBusinessJsonLd()} />
      <BrandPageHero hero={servicesPageContent.hero} />
      <TrustProofSection
        title={servicesPageContent.intro.title}
        description={servicesPageContent.intro.description}
        items={servicesPageContent.intro.items}
      />
      <PackageCardsSection
        id="popular-packages"
        title={servicesPageContent.popularPackages.title}
        description={servicesPageContent.popularPackages.description}
        packages={servicesPageContent.popularPackages.packages}
      />
      <TreatmentMosaicSection
        title={servicesPageContent.treatments.title}
        description={servicesPageContent.treatments.description}
        items={servicesPageContent.treatments.items}
      />
      <RecommendationCardsSection
        title={servicesPageContent.guidance.title}
        description={servicesPageContent.guidance.description}
        items={servicesPageContent.guidance.items}
        cta={servicesPageContent.guidance.cta}
      />
      <ProcessStepsSection
        title={servicesPageContent.visitIncludes.title}
        description={servicesPageContent.visitIncludes.description}
        items={servicesPageContent.visitIncludes.items}
      />
      <PackageCardsSection
        title={servicesPageContent.pricing.title}
        description={servicesPageContent.pricing.description}
        packages={servicesPageContent.pricing.packages}
        note={servicesPageContent.pricing.note}
      />
      <TrustProofSection
        title={servicesPageContent.trust.title}
        description={servicesPageContent.trust.description}
        items={servicesPageContent.trust.items}
      />
      <FinalCtaSection content={servicesPageContent.cta} />
    </>
  );
}
