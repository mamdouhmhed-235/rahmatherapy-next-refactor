import type { Metadata } from "next";
import { AftercareTabs } from "@/components/faqs-aftercare/AftercareTabs";
import { BeforeAppointment } from "@/components/faqs-aftercare/BeforeAppointment";
import { FaqCategoryAccordions } from "@/components/faqs-aftercare/FaqCategoryAccordions";
import { FaqsAftercareFinalCTA } from "@/components/faqs-aftercare/FaqsAftercareFinalCTA";
import { FaqsAftercareHero } from "@/components/faqs-aftercare/FaqsAftercareHero";
import { QuickAnswersStrip } from "@/components/faqs-aftercare/QuickAnswersStrip";
import { SafetySuitability } from "@/components/faqs-aftercare/SafetySuitability";
import { WhenToGetAdvice } from "@/components/faqs-aftercare/WhenToGetAdvice";
import { faqCategories } from "@/content/pages/faqsAftercare";
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

/**
 * FAQPage markup for all 31 questions.
 *
 * ⚠️ Expect NO Google search appearance from this. FAQ rich results were
 * withdrawn from Google Search on 2026-05-07 and the documentation removed on
 * 2026-06-15; this site was already ineligible from 2023-09-14, when the
 * feature was limited to government and health sites. So the deprecation costs
 * nothing that was ever available here. It ships because it is valid, inert and
 * cheap, and non-Google consumers may still parse it — never budget a benefit
 * against it, and never write an acceptance criterion referencing the retired
 * Search Console FAQ report or Rich Results Test FAQ check.
 *
 * ⛔ Do NOT substitute QAPage. Its live documentation forbids that verbatim for
 * pages with multiple questions, and names a self-written FAQ page as an
 * invalid use case.
 *
 * Every question below is now present in the served HTML and reachable through
 * a visible, keyboard-operable tab and accordion — which is what makes marking
 * it up legitimate under the "don't mark up content that is not visible to
 * readers" rule.
 */
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqCategories.flatMap((category) =>
    category.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    }))
  ),
};

export default function FaqsAftercarePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
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
