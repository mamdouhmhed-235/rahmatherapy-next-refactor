import type { Metadata } from "next";
import { BenefitsSection } from "@/components/sections/BenefitsSection";
import { CtaSection } from "@/components/sections/CtaSection";
import { FaqSection } from "@/components/sections/FaqSection";
import { FeaturedQuoteSection } from "@/components/sections/FeaturedQuoteSection";
import { HeroSection } from "@/components/sections/HeroSection";
import { ServicesSection } from "@/components/sections/ServicesSection";
import { SplitFeatureSection } from "@/components/sections/SplitFeatureSection";
import { TestimonialsSection } from "@/components/sections/TestimonialsSection";
import { TrustSection } from "@/components/sections/TrustSection";
import { homePageContent } from "@/content/pages/home";
import { StructuredData } from "@/lib/seo/StructuredData";
import { buildHomePageJsonLd } from "@/lib/seo/jsonLd";
import { buildPageMetadata } from "@/lib/seo/metadata";

export function generateMetadata(): Metadata {
  return buildPageMetadata(homePageContent.seo);
}

export default function HomePage() {
  return (
    <>
      <StructuredData data={buildHomePageJsonLd(homePageContent)} />
      <HeroSection content={homePageContent.hero} />
      <ServicesSection
        title={homePageContent.services.title}
        items={homePageContent.services.items}
      />
      <TrustSection
        title={homePageContent.trust.title}
        items={homePageContent.trust.items}
      />
      <SplitFeatureSection
        title={homePageContent.about.title}
        description={homePageContent.about.description}
        image={homePageContent.about.image}
      />
      <BenefitsSection
        title={homePageContent.outcomes.title}
        items={homePageContent.outcomes.items}
        asideTitle={homePageContent.outcomes.asideTitle}
        asideDescription={homePageContent.outcomes.asideDescription}
      />
      <FeaturedQuoteSection content={homePageContent.featuredTestimonial} />
      <TestimonialsSection
        title={homePageContent.testimonials.title}
        items={homePageContent.testimonials.items}
      />
      <CtaSection content={homePageContent.cta} variant="home" />
      <FaqSection
        title={homePageContent.faq.title}
        items={homePageContent.faq.items}
      />
    </>
  );
}
