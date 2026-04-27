import type { Metadata } from "next";
import { AftercareTabs } from "@/components/faqs-aftercare/AftercareTabs";
import { BeforeAppointment } from "@/components/faqs-aftercare/BeforeAppointment";
import { FaqCategoryAccordions } from "@/components/faqs-aftercare/FaqCategoryAccordions";
import { FaqsAftercareFinalCTA } from "@/components/faqs-aftercare/FaqsAftercareFinalCTA";
import { FaqsAftercareHero } from "@/components/faqs-aftercare/FaqsAftercareHero";
import { QuickAnswersStrip } from "@/components/faqs-aftercare/QuickAnswersStrip";
import { SafetySuitability } from "@/components/faqs-aftercare/SafetySuitability";
import { WhenToGetAdvice } from "@/components/faqs-aftercare/WhenToGetAdvice";

export const metadata: Metadata = {
  title: "FAQs & Aftercare | Hijama, Cupping & Massage in Luton | Rahma Therapy",
  description:
    "Find clear answers and aftercare guidance for Rahma Therapy’s mobile hijama, cupping and massage appointments in Luton, including preparation, suitability, therapist options and package FAQs.",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "HealthAndBeautyBusiness",
  name: "Rahma Therapy",
  description:
    "Mobile hijama, cupping and massage therapy in Luton with CMA and IPHM qualified male and female therapists.",
  areaServed: "Luton",
  telephone: "07798897222",
  url: "https://rahmatherapy.co.uk/faqs-aftercare",
  sameAs: ["https://www.instagram.com/rahmatherapyluton/"],
};

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
