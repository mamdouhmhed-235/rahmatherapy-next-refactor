import type { Metadata } from "next";
import { AftercareTabs } from "@/components/faqs-aftercare/AftercareTabs";
import { BeforeAppointment } from "@/components/faqs-aftercare/BeforeAppointment";
import { FaqCategoryAccordions } from "@/components/faqs-aftercare/FaqCategoryAccordions";
import { FaqsAftercareFinalCTA } from "@/components/faqs-aftercare/FaqsAftercareFinalCTA";
import { FaqsAftercareHero } from "@/components/faqs-aftercare/FaqsAftercareHero";
import { QuickAnswersStrip } from "@/components/faqs-aftercare/QuickAnswersStrip";
import { SafetySuitability } from "@/components/faqs-aftercare/SafetySuitability";
import { WhenToGetAdvice } from "@/components/faqs-aftercare/WhenToGetAdvice";
import { businessJsonLd } from "@/content/site/business-node";
import { siteUrl } from "@/content/site/site-url";

export const metadata: Metadata = {
  title: "FAQs & Aftercare | Hijama, Cupping & Massage in Luton",
  description:
    "Answers and aftercare guidance for Rahma Therapy’s mobile hijama, cupping and massage appointments in Luton: preparation, suitability and therapist options.",
  alternates: {
    canonical: siteUrl("/faqs-aftercare/"),
  },
};

const jsonLd = businessJsonLd;

export default function FaqsAftercarePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <FaqsAftercareHero />
      <QuickAnswersStrip />
      <BeforeAppointment />
      <AftercareTabs />
      <SafetySuitability />
      <FaqCategoryAccordions />
      <WhenToGetAdvice />
      <FaqsAftercareFinalCTA />
    </>
  );
}
