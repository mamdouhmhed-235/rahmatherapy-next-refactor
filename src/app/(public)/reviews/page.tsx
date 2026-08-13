import type { Metadata } from "next";
import { FeaturedReviewsMosaic } from "@/components/reviews/FeaturedReviewsMosaic";
import { LeaveReviewCTA } from "@/components/reviews/LeaveReviewCTA";
import { ReviewsExplorer } from "@/components/reviews/ReviewsExplorer";
import { ReviewsFinalCTA } from "@/components/reviews/ReviewsFinalCTA";
import { ReviewsHero } from "@/components/reviews/ReviewsHero";
import { ReviewsStatsStrip } from "@/components/reviews/ReviewsStatsStrip";
import { ReviewThemeHighlights } from "@/components/reviews/ReviewThemeHighlights";
import { businessJsonLd } from "@/content/site/business-node";
import { siteUrl } from "@/content/site/site-url";

export const metadata: Metadata = {
  title: "Rahma Therapy Reviews | Hijama, Cupping & Massage in Luton",
  description:
    "Read Google review highlights from Rahma Therapy clients across Luton, including hijama, cupping, massage, female therapist appointments and mobile home visits.",
  alternates: {
    canonical: siteUrl("/reviews/"),
  },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: siteUrl("/home/"),
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Reviews",
      item: siteUrl("/reviews/"),
    },
  ],
};

export default function ReviewsPage() {
  return (
    <>
      {/*
        The business entity. This page carries the most content on the site and
        emitted only a breadcrumb before. Deliberately NO aggregateRating and no
        Review objects: Google does not show review rich results for reviews an
        entity hosts about itself, and its guidelines rule out editor-curated
        ratings. The real rating stays authoritative via `sameAs` on this node,
        which points at the Google listing linked from this page.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(businessJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <ReviewsHero />
      <ReviewsStatsStrip />
      <FeaturedReviewsMosaic />
      <ReviewsExplorer />
      <ReviewThemeHighlights />
      <LeaveReviewCTA />
      <ReviewsFinalCTA />
    </>
  );
}
