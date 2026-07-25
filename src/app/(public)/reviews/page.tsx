import type { Metadata } from "next";
import { FeaturedReviewsMosaic } from "@/components/reviews/FeaturedReviewsMosaic";
import { LeaveReviewCTA } from "@/components/reviews/LeaveReviewCTA";
import { ReviewsExplorer } from "@/components/reviews/ReviewsExplorer";
import { ReviewsFinalCTA } from "@/components/reviews/ReviewsFinalCTA";
import { ReviewsHero } from "@/components/reviews/ReviewsHero";
import { ReviewsStatsStrip } from "@/components/reviews/ReviewsStatsStrip";
import { ReviewThemeHighlights } from "@/components/reviews/ReviewThemeHighlights";

export const metadata: Metadata = {
  title: "Reviews | Rahma Therapy Luton",
  description:
    "Read Google review highlights from Rahma Therapy clients across Luton, including hijama, cupping, massage, female therapist appointments and mobile home visits.",
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://rahmatherapy.co.uk/",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Reviews",
      item: "https://rahmatherapy.co.uk/reviews",
    },
  ],
};

export default function ReviewsPage() {
  return (
    <>
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
