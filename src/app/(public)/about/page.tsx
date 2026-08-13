import type { Metadata } from "next";
import { AboutFinalCTA } from "@/components/about/AboutFinalCTA";
import { AboutHero } from "@/components/about/AboutHero";
import { AboutStatsStrip } from "@/components/about/AboutStatsStrip";
import { BrandStory } from "@/components/about/BrandStory";
import { TeamProfiles } from "@/components/about/TeamProfiles";
import { businessJsonLd } from "@/content/site/business-node";
import { siteUrl } from "@/content/site/site-url";

export const metadata: Metadata = {
  title: "About Rahma Therapy | Mobile Hijama, Cupping & Massage in Luton",
  description:
    "A CMA and IPHM qualified mobile hijama, cupping and massage team serving Luton since 2020, with male and female therapists and private home appointments.",
  alternates: {
    canonical: siteUrl("/about/"),
  },
};

const jsonLd = businessJsonLd;

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <AboutHero />
      <AboutStatsStrip />
      <BrandStory />
      <TeamProfiles />
      <AboutFinalCTA />
    </>
  );
}
