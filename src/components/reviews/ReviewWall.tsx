"use client";

import type { RahmaReview } from "@/lib/content/reviews";
import { ReviewCard } from "./ReviewCard";

interface ReviewWallProps {
  reviews: RahmaReview[];
  visibleCount: number;
  onLoadMore: () => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

export function ReviewWall({
  reviews,
  visibleCount,
  onLoadMore,
  onClearFilters,
  hasActiveFilters,
}: ReviewWallProps) {
  const visibleReviews = reviews.slice(0, visibleCount);
  const hasMore = visibleCount < reviews.length;

  if (reviews.length === 0) {
    return (
      <div className="mt-8 rounded-3xl border border-rahma-border bg-rahma-ivory p-8 text-center">
        <p className="text-lg font-semibold text-rahma-charcoal">
          No reviews found for that search. Try a different keyword or clear the filters.
        </p>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-rahma-green px-5 text-sm font-semibold !text-white transition hover:bg-rahma-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue"
          >
            Clear filters
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {visibleReviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>

      <div className="mt-10 flex justify-center">
        {hasMore ? (
          <button
            type="button"
            onClick={onLoadMore}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-rahma-green px-7 text-sm font-semibold !text-white transition hover:bg-rahma-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue"
          >
            Load more reviews
          </button>
        ) : (
          <p className="rounded-full border border-rahma-border bg-rahma-ivory px-5 py-3 text-sm font-semibold text-rahma-green">
            You’ve reached the end of the review wall.
          </p>
        )}
      </div>
    </div>
  );
}
