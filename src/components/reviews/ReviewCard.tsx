"use client";

import { useState } from "react";
import type { RahmaReview } from "@/lib/content/reviews";
import { cn } from "@/lib/utils";
import { ReviewerAvatar } from "./ReviewerAvatar";
import { StarRating } from "./StarRating";

interface ReviewCardProps {
  review: RahmaReview;
}

function formatCategoryLabel(value: string) {
  return value
    .split("-")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" & ")
    .replace("Professional & Explained", "Professional & explained")
    .replace("First & Time", "First-time")
    .replace("Home & Visits", "Home visits")
    .replace("Pain & Recovery", "Pain & recovery")
    .replace("Female & Therapist", "Female therapist")
    .replace("Hijama & Cupping", "Hijama & cupping")
    .replace("Supreme & Combo & Graston", "Supreme Combo / Graston")
    .replace("Repeat & Clients", "Repeat clients");
}

export function ReviewCard({ review }: ReviewCardProps) {
  const [buttonExpanded, setButtonExpanded] = useState(false);
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const expanded = buttonExpanded || hoverExpanded;
  const primaryCategory = review.categories[0] ?? "general";
  const text = expanded ? review.text : review.shortExcerpt || review.text;
  const reviewTextId = `${review.id}-text`;

  return (
    <article
      onMouseEnter={() => setHoverExpanded(true)}
      onMouseLeave={() => setHoverExpanded(false)}
      className="break-inside-avoid rounded-3xl border border-rahma-border bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <StarRating rating={review.rating} />
        <span className="rounded-full bg-rahma-ivory px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-rahma-green">
          {formatCategoryLabel(primaryCategory)}
        </span>
      </div>

      <div className="mt-5 flex items-center gap-4">
        <ReviewerAvatar name={review.reviewerName} />
        <div>
          <h3 className="font-semibold text-rahma-charcoal">{review.reviewerName}</h3>
          <p className="text-sm text-rahma-muted">{review.dateLabel || "Google Review"}</p>
        </div>
      </div>

      <p
        id={reviewTextId}
        className="mt-5 whitespace-pre-line text-base leading-7 text-rahma-charcoal"
      >
        “{text}”
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {review.serviceTags.slice(0, 4).map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-rahma-border bg-white px-3 py-1 text-xs font-medium text-rahma-muted"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between gap-4">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-rahma-muted">
          Google Review
        </span>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={reviewTextId}
          onClick={() => setButtonExpanded((current) => !current)}
          className={cn(
            "rounded-full text-sm font-semibold text-rahma-green underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue",
            expanded ? "text-rahma-charcoal" : "text-rahma-green"
          )}
        >
          {expanded ? "Show less" : "Read full review"}
        </button>
      </div>
    </article>
  );
}
