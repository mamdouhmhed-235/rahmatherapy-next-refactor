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
import { hijamaPageContent } from "@/content/pages/hijama";
import { StructuredData } from "@/lib/seo/StructuredData";
import { buildServicePageJsonLd } from "@/lib/seo/jsonLd";
import { buildPageMetadata } from "@/lib/seo/metadata";

export function generateMetadata(): Metadata {
  return buildPageMetadata(hijamaPageContent.seo);
}

export default function HijamaPage() {
  return (
    <>
      <StructuredData data={buildServicePageJsonLd(hijamaPageContent)} />
      <ServiceHeroSection content={hijamaPageContent.hero} variant="hijama" />
      <ServiceBenefitsSection
        title={hijamaPageContent.benefits.title}
        items={hijamaPageContent.benefits.items}
        variant="hijama"
      />
      <ServiceProcessSection
        title={hijamaPageContent.expectations.title}
        description={hijamaPageContent.expectations.description}
        items={hijamaPageContent.expectations.items}
        cta={hijamaPageContent.expectations.cta}
        image={hijamaPageContent.expectations.image}
        contentMinHeight="20.6875rem"
      />
      <ServiceStoriesSection
        title={hijamaPageContent.stories.title}
        description={hijamaPageContent.stories.description}
        items={hijamaPageContent.stories.items}
      />
      <FeaturedQuoteSection content={hijamaPageContent.featuredTestimonial} />
      <RecoveryPathSection
        title={hijamaPageContent.recoveryPath.title}
        description={hijamaPageContent.recoveryPath.description}
        items={hijamaPageContent.recoveryPath.items}
      />
      <PricingPlansSection
        title={hijamaPageContent.pricing.title}
        plans={hijamaPageContent.pricing.plans}
      />
      <ServiceTestimonialsSection
        title={hijamaPageContent.testimonials.title}
        items={hijamaPageContent.testimonials.items}
      />
      <ServiceOutcomesSection
        title={hijamaPageContent.outcomes.title}
        description={hijamaPageContent.outcomes.description}
        image={hijamaPageContent.outcomes.image}
        items={hijamaPageContent.outcomes.items}
      />
      <CtaSection content={hijamaPageContent.cta} />
      <FaqSection
        title={hijamaPageContent.faq.title}
        items={hijamaPageContent.faq.items}
      />
    </>
  );
}
