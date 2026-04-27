import type { Metadata } from "next";
import { AftercareTabsSection } from "@/components/sections/AftercareTabsSection";
import { BrandPageHero } from "@/components/sections/BrandPageHero";
import { FaqSearchSection } from "@/components/sections/FaqSearchSection";
import { FinalCtaSection } from "@/components/sections/FinalCtaSection";
import { ImageTextSection } from "@/components/sections/ImageTextSection";
import { TrustProofSection } from "@/components/sections/TrustProofSection";
import { faqsAftercarePageContent } from "@/content/pages/faqsAftercare";
import { StructuredData } from "@/lib/seo/StructuredData";
import { buildFaqJsonLd, buildLocalBusinessJsonLd } from "@/lib/seo/jsonLd";
import { buildPageMetadata } from "@/lib/seo/metadata";

export function generateMetadata(): Metadata {
  return buildPageMetadata(faqsAftercarePageContent.seo);
}

export default function FaqsAftercarePage() {
  return (
    <>
      <StructuredData
        data={[
          buildLocalBusinessJsonLd(),
          buildFaqJsonLd(faqsAftercarePageContent.faq.items),
        ]}
      />
      <BrandPageHero hero={faqsAftercarePageContent.hero} />
      <TrustProofSection
        title={faqsAftercarePageContent.reassurance.title}
        items={faqsAftercarePageContent.reassurance.items}
      />
      <ImageTextSection
        title={faqsAftercarePageContent.beforeAppointment.title}
        description={faqsAftercarePageContent.beforeAppointment.description}
        image={faqsAftercarePageContent.beforeAppointment.image}
      />
      <TrustProofSection items={faqsAftercarePageContent.beforeAppointment.items} />
      <AftercareTabsSection
        title={faqsAftercarePageContent.aftercare.title}
        description={faqsAftercarePageContent.aftercare.description}
        tabs={faqsAftercarePageContent.aftercare.tabs}
      />
      <FaqSearchSection
        title={faqsAftercarePageContent.faq.title}
        description={faqsAftercarePageContent.faq.description}
        categories={faqsAftercarePageContent.faq.categories}
        items={faqsAftercarePageContent.faq.items}
      />
      <TrustProofSection
        title={faqsAftercarePageContent.safety.title}
        description={faqsAftercarePageContent.safety.description}
        items={faqsAftercarePageContent.safety.items}
      />
      <FinalCtaSection content={faqsAftercarePageContent.unsureCta} />
      <FinalCtaSection content={faqsAftercarePageContent.cta} />
    </>
  );
}
