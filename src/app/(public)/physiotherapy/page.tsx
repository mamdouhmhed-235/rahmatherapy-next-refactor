import type { Metadata } from "next";
import { CtaSection } from "@/components/sections/CtaSection";
import { FaqSection } from "@/components/sections/FaqSection";
import { FeaturedQuoteSection } from "@/components/sections/FeaturedQuoteSection";
import { PricingPlansSection } from "@/components/sections/PricingPlansSection";
import { RecoveryPathSection } from "@/components/sections/RecoveryPathSection";
import { ServiceBenefitsSection } from "@/components/sections/ServiceBenefitsSection";
import { ServiceHeroSection } from "@/components/sections/ServiceHeroSection";
import { ServiceOutcomesSection } from "@/components/sections/ServiceOutcomesSection";
import { ServiceProcessSection } from "@/components/sections/ServiceProcessSection";
import { ServiceStoriesSection } from "@/components/sections/ServiceStoriesSection";
import { ServiceTestimonialsSection } from "@/components/sections/ServiceTestimonialsSection";
import { physiotherapyPageContent } from "@/content/pages/physiotherapy";
import { StructuredData } from "@/lib/seo/StructuredData";
import { buildServicePageJsonLd } from "@/lib/seo/jsonLd";
import { buildPageMetadata } from "@/lib/seo/metadata";

export function generateMetadata(): Metadata {
  return buildPageMetadata(physiotherapyPageContent.seo);
}

export default function PhysiotherapyPage() {
  return (
    <>
      <StructuredData data={buildServicePageJsonLd(physiotherapyPageContent)} />
      <ServiceHeroSection content={physiotherapyPageContent.hero} />
      <ServiceBenefitsSection
        title={physiotherapyPageContent.benefits.title}
        items={physiotherapyPageContent.benefits.items}
      />
      <ServiceProcessSection
        title={physiotherapyPageContent.expectations.title}
        description={physiotherapyPageContent.expectations.description}
        items={physiotherapyPageContent.expectations.items}
        cta={physiotherapyPageContent.expectations.cta}
        image={physiotherapyPageContent.expectations.image}
        contentMinHeight="22.375rem"
      />
      <ServiceStoriesSection
        title={physiotherapyPageContent.stories.title}
        description={physiotherapyPageContent.stories.description}
        items={physiotherapyPageContent.stories.items}
      />
      <FeaturedQuoteSection content={physiotherapyPageContent.featuredTestimonial} />
      <RecoveryPathSection
        title={physiotherapyPageContent.recoveryPath.title}
        description={physiotherapyPageContent.recoveryPath.description}
        items={physiotherapyPageContent.recoveryPath.items}
      />
      <PricingPlansSection
        title={physiotherapyPageContent.pricing.title}
        plans={physiotherapyPageContent.pricing.plans}
      />
      <ServiceTestimonialsSection
        title={physiotherapyPageContent.testimonials.title}
        items={physiotherapyPageContent.testimonials.items}
      />
      <ServiceOutcomesSection
        title={physiotherapyPageContent.outcomes.title}
        description={physiotherapyPageContent.outcomes.description}
        image={physiotherapyPageContent.outcomes.image}
        items={physiotherapyPageContent.outcomes.items}
      />
      <CtaSection content={physiotherapyPageContent.cta} />
      <FaqSection
        title={physiotherapyPageContent.faq.title}
        items={physiotherapyPageContent.faq.items}
      />
    </>
  );
}
