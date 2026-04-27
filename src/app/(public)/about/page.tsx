import type { Metadata } from "next";
import { BrandPageHero } from "@/components/sections/BrandPageHero";
import { FinalCtaSection } from "@/components/sections/FinalCtaSection";
import { ImageTextSection } from "@/components/sections/ImageTextSection";
import { ProcessStepsSection } from "@/components/sections/ProcessStepsSection";
import { StandardsAccordionSection } from "@/components/sections/StandardsAccordionSection";
import { TeamCardsSection } from "@/components/sections/TeamCardsSection";
import { TimelineSection } from "@/components/sections/TimelineSection";
import { TrustProofSection } from "@/components/sections/TrustProofSection";
import { aboutPageContent } from "@/content/pages/about";
import { StructuredData } from "@/lib/seo/StructuredData";
import { buildLocalBusinessJsonLd } from "@/lib/seo/jsonLd";
import { buildPageMetadata } from "@/lib/seo/metadata";

export function generateMetadata(): Metadata {
  return buildPageMetadata(aboutPageContent.seo);
}

export default function AboutPage() {
  return (
    <>
      <StructuredData data={buildLocalBusinessJsonLd()} />
      <BrandPageHero hero={aboutPageContent.hero} />
      <TrustProofSection items={aboutPageContent.proof.items} />
      <ImageTextSection
        title={aboutPageContent.whoWeAre.title}
        description={aboutPageContent.whoWeAre.description}
        image={aboutPageContent.whoWeAre.image}
        caption={aboutPageContent.whoWeAre.caption}
        cta={aboutPageContent.whoWeAre.cta}
      />
      <TeamCardsSection
        title={aboutPageContent.team.title}
        description={aboutPageContent.team.description}
        items={aboutPageContent.team.items}
      />
      <TrustProofSection
        title={aboutPageContent.comfort.title}
        description={aboutPageContent.comfort.description}
        items={aboutPageContent.comfort.items}
      />
      <StandardsAccordionSection
        title={aboutPageContent.standards.title}
        description={aboutPageContent.standards.description}
        items={aboutPageContent.standards.items}
        image={aboutPageContent.standards.image}
        caption={aboutPageContent.standards.caption}
      />
      <TimelineSection
        title={aboutPageContent.timeline.title}
        description={aboutPageContent.timeline.description}
        items={aboutPageContent.timeline.items}
      />
      <TrustProofSection
        title={aboutPageContent.appreciation.title}
        description={aboutPageContent.appreciation.description}
        items={aboutPageContent.appreciation.items}
      />
      <ProcessStepsSection
        title={aboutPageContent.process.title}
        description={aboutPageContent.process.description}
        items={aboutPageContent.process.items}
      />
      <FinalCtaSection content={aboutPageContent.cta} />
    </>
  );
}
