import { SectionContainer, SectionHeading, StarsRating } from "@/components/shared";
import type { AreaPage } from "@/content/pages/areaPages";

export function AreaReviews({ area }: { area: AreaPage }) {
  return (
    <SectionContainer tone="surface" width="wide">
      <SectionHeading align="center" className="mx-auto" eyebrow="Real client reviews" title={area.reviewsHeading} />
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {area.reviews.map((review) => (
          <figure
            key={review.reviewer}
            className="flex h-full flex-col rounded-3xl border border-rahma-border bg-white p-6 shadow-card"
          >
            <StarsRating rating={review.rating} />
            <blockquote className="mt-4 flex-1 text-sm leading-7 text-rahma-muted">“{review.text}”</blockquote>
            <figcaption className="mt-5 border-t border-rahma-border/70 pt-4">
              <p className="text-sm font-semibold text-rahma-charcoal">{review.reviewer}</p>
              <p className="mt-1 text-xs font-medium uppercase tracking-[0.1em] text-rahma-green">{review.tag}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </SectionContainer>
  );
}
