import type { Metadata } from "next";
import { HomeAppointmentProcess } from "@/components/planned-home/HomeAppointmentProcess";
import { HomeFAQPreview } from "@/components/planned-home/HomeFAQPreview";
import { HomeFinalCTA } from "@/components/planned-home/HomeFinalCTA";
import { HomeHero } from "@/components/planned-home/HomeHero";
import { HomePackageCards } from "@/components/planned-home/HomePackageCards";
import { HomeReviewCarousel } from "@/components/planned-home/HomeReviewCarousel";
import { HomeSafetyAftercare } from "@/components/planned-home/HomeSafetyAftercare";
import { HomeTeamPreview } from "@/components/planned-home/HomeTeamPreview";
import { HomeTrustStrip } from "@/components/planned-home/HomeTrustStrip";
import { PainPointCards } from "@/components/planned-home/PainPointCards";
import { WhyRahmaTherapy } from "@/components/planned-home/WhyRahmaTherapy";

export const metadata: Metadata = {
  title: "Rahma Therapy | Mobile Hijama, Cupping & Massage in Luton",
  description:
    "Private mobile hijama, cupping and massage in Luton with CMA and IPHM qualified male and female therapists. Home appointments, packages from £40 and aftercare included.",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "HealthAndBeautyBusiness",
  name: "Rahma Therapy",
  areaServed: "Luton",
  url: "https://rahmatherapy.com/",
  telephone: "+447798897222",
  priceRange: "£40-£60",
  description:
    "Mobile hijama, cupping and massage therapy at home in Luton with male and female therapists.",
};

export default function PlannedHomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomeHero />
      <HomeTrustStrip />
      <PainPointCards />
      <HomePackageCards />
      <WhyRahmaTherapy />
      <HomeAppointmentProcess />
      <HomeReviewCarousel />
      <HomeTeamPreview />
      <HomeSafetyAftercare />
      <HomeFAQPreview />
      <HomeFinalCTA />
    </>
  );
}
