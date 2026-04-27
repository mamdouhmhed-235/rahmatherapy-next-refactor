"use client";

import { useMemo, useState } from "react";
import { SectionHeading } from "@/components/shared";
import type { RahmaReview, ReviewCategorySlug } from "@/lib/content/reviews";
import { rahmaGoogleReviews } from "@/lib/content/reviews";
import { ReviewFilters } from "./ReviewFilters";
import { ReviewWall } from "./ReviewWall";

const pageSize = 24;

function matchesSearch(review: RahmaReview, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  const haystack = [
    review.reviewerName,
    review.text,
    review.inferredServiceCategory,
    review.categories.join(" "),
    review.serviceTags.join(" "),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

export function ReviewsExplorer() {
  const [selectedCategory, setSelectedCategory] = useState<ReviewCategorySlug>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(pageSize);

  const filteredReviews = useMemo(() => {
    return rahmaGoogleReviews
      .filter((review) => review.visibleByDefault)
      .filter((review) => selectedCategory === "all" || review.categories.includes(selectedCategory))
      .filter((review) => matchesSearch(review, searchQuery))
      .sort((a, b) => a.displayPriority - b.displayPriority);
  }, [selectedCategory, searchQuery]);

  const hasActiveFilters = selectedCategory !== "all" || searchQuery.trim().length > 0;

  function clearFilters() {
    setSelectedCategory("all");
    setSearchQuery("");
    setVisibleCount(pageSize);
  }

  function updateCategory(category: ReviewCategorySlug) {
    setSelectedCategory(category);
    setVisibleCount(pageSize);
  }

  function updateSearch(query: string) {
    setSearchQuery(query);
    setVisibleCount(pageSize);
  }

  return (
    <section id="review-wall" className="bg-white px-5 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            title="Every client story, in their own words."
            description="Filter by service, concern or experience — or keep scrolling through the full wall of Rahma Therapy reviews."
          />
          <p className="max-w-md rounded-3xl border border-rahma-border bg-rahma-ivory p-5 text-sm leading-6 text-rahma-muted">
            Reviews reflect individual client experiences. Rahma Therapy provides
            complementary wellness treatments and does not diagnose or replace medical care.
          </p>
        </div>

        <div className="mt-10">
          <ReviewFilters
            selectedCategory={selectedCategory}
            searchQuery={searchQuery}
            onCategoryChange={updateCategory}
            onSearchChange={updateSearch}
          />
          <ReviewWall
            reviews={filteredReviews}
            visibleCount={visibleCount}
            onLoadMore={() => setVisibleCount((current) => current + pageSize)}
            onClearFilters={clearFilters}
            hasActiveFilters={hasActiveFilters}
          />
        </div>
      </div>
    </section>
  );
}
