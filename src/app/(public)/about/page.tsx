import type { Metadata } from "next";
import { AboutFinalCTA } from "@/components/about/AboutFinalCTA";
import { AboutHero } from "@/components/about/AboutHero";
import { AboutStatsStrip } from "@/components/about/AboutStatsStrip";
import { BrandStory } from "@/components/about/BrandStory";
import { TeamProfiles } from "@/components/about/TeamProfiles";
import { teamMembers } from "@/content/pages/about";
import { HOME_CRUMB, buildBreadcrumbJsonLd } from "@/content/site/breadcrumb";
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

// The shared business entity, plus the team this page actually shows. Each
// therapist is named and their qualification stated in the visible copy, so the
// markup describes the page rather than adding claims to it. This is what makes
// "female therapist in Luton" — a real customer query — machine-readable.
const jsonLd = {
  ...businessJsonLd,
  employee: teamMembers.map((member) => ({
    "@type": "Person",
    name: member.name,
    jobTitle: member.role,
    image: siteUrl(member.image),
  })),
};

const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  HOME_CRUMB,
  { name: "About", path: "/about/" },
]);

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <AboutHero />
      <AboutStatsStrip />
      <BrandStory />
      <TeamProfiles />
      <AboutFinalCTA />
    </>
  );
}
