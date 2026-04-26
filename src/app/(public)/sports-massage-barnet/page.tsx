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
import { sportsMassageBarnetPageContent } from "@/content/pages/sportsMassageBarnet";
import { StructuredData } from "@/lib/seo/StructuredData";
import { buildServicePageJsonLd } from "@/lib/seo/jsonLd";
import { buildPageMetadata } from "@/lib/seo/metadata";

export function generateMetadata(): Metadata {
  return buildPageMetadata(sportsMassageBarnetPageContent.seo);
}

export default function SportsMassagePage() {
  return (
    <>
      <StructuredData data={buildServicePageJsonLd(sportsMassageBarnetPageContent)} />
      <ServiceHeroSection
        content={sportsMassageBarnetPageContent.hero}
        variant="sports-massage"
      />
      <ServiceBenefitsSection
        title={sportsMassageBarnetPageContent.benefits.title}
        items={sportsMassageBarnetPageContent.benefits.items}
        variant="sports-massage"
      />
      <ServiceProcessSection
        title={sportsMassageBarnetPageContent.expectations.title}
        description={sportsMassageBarnetPageContent.expectations.description}
        items={sportsMassageBarnetPageContent.expectations.items}
        cta={sportsMassageBarnetPageContent.expectations.cta}
        image={sportsMassageBarnetPageContent.expectations.image}
        contentMinHeight="20.6875rem"
      />
      <ServiceStoriesSection
        title={sportsMassageBarnetPageContent.stories.title}
        description={sportsMassageBarnetPageContent.stories.description}
        items={sportsMassageBarnetPageContent.stories.items}
      />
      <FeaturedQuoteSection content={sportsMassageBarnetPageContent.featuredTestimonial} />
      <RecoveryPathSection
        title={sportsMassageBarnetPageContent.recoveryPath.title}
        description={sportsMassageBarnetPageContent.recoveryPath.description}
        items={sportsMassageBarnetPageContent.recoveryPath.items}
      />
      <PricingPlansSection
        title={sportsMassageBarnetPageContent.pricing.title}
        plans={sportsMassageBarnetPageContent.pricing.plans}
      />
      <ServiceTestimonialsSection
        title={sportsMassageBarnetPageContent.testimonials.title}
        items={sportsMassageBarnetPageContent.testimonials.items}
      />
      <ServiceOutcomesSection
        title={sportsMassageBarnetPageContent.outcomes.title}
        description={sportsMassageBarnetPageContent.outcomes.description}
        image={sportsMassageBarnetPageContent.outcomes.image}
        items={sportsMassageBarnetPageContent.outcomes.items}
      />
      <CtaSection content={sportsMassageBarnetPageContent.cta} />
      <FaqSection
        title={sportsMassageBarnetPageContent.faq.title}
        items={sportsMassageBarnetPageContent.faq.items}
      />
    </>
  );
}
