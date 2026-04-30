import type { Metadata } from "next";
import { HomeAppointmentProcess } from "@/components/home/HomeAppointmentProcess";
import { HomeFAQPreview } from "@/components/home/HomeFAQPreview";
import { HomeFinalCTA } from "@/components/home/HomeFinalCTA";
import { HomeHero } from "@/components/home/HomeHero";
import { HomePackageCards } from "@/components/home/HomePackageCards";
import { HomeReviewCarousel } from "@/components/home/HomeReviewCarousel";
import { HomeSafetyAftercare } from "@/components/home/HomeSafetyAftercare";
import { HomeTeamPreview } from "@/components/home/HomeTeamPreview";
import { HomeTrustStrip } from "@/components/home/HomeTrustStrip";
import { PainPointCards } from "@/components/home/PainPointCards";
import { WhyRahmaTherapy } from "@/components/home/WhyRahmaTherapy";

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

export default function HomePage() {
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
