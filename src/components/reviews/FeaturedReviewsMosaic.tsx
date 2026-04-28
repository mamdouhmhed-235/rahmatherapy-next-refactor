import { SectionContainer, SectionHeading } from "@/components/shared";
import { rahmaGoogleReviews } from "@/lib/content/reviews";
import { ReviewerAvatar } from "./ReviewerAvatar";
import { StarRating } from "./StarRating";

const featuredCards = [
  {
    id: "review-001",
    badge: "Home visit",
  },
  {
    id: "review-002",
    badge: "Mobile therapist",
  },
  {
    id: "review-003",
    badge: "Explained clearly",
  },
  {
    id: "review-008",
    badge: "First-time hijama",
  },
  {
    id: "review-014",
    badge: "Female therapist",
  },
] as const;

export function FeaturedReviewsMosaic() {
  const cards = featuredCards
    .map((card) => ({
      ...card,
      review: rahmaGoogleReviews.find((review) => review.id === card.id),
    }))
    .filter((card) => card.review);

  return (
    <SectionContainer tone="ivory">
      <SectionHeading
        align="center"
        title="The same themes come up again and again."
        description="Clients talk about feeling comfortable, having everything explained clearly, being seen at home, and trusting both male and female therapists."
        className="mx-auto"
      />
      <div className="mt-12 grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        {cards.map((card, index) => {
          const review = card.review;

          if (!review) {
            return null;
          }

          return (
            <article
              key={review.id}
              className={
                index === 0
                  ? "rounded-3xl border border-rahma-border bg-white p-7 shadow-card lg:row-span-2 lg:p-9"
                  : "rounded-3xl border border-rahma-border bg-white p-6 shadow-sm"
              }
            >
              <div className="flex items-start justify-between gap-4">
                <span className="rounded-full bg-rahma-gold/16 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-rahma-green">
                  {card.badge}
                </span>
                <StarRating rating={review.rating} />
              </div>
              <blockquote
                className={
                  index === 0
                    ? "mt-8 font-display text-3xl font-medium leading-tight text-rahma-charcoal sm:text-4xl"
                    : "mt-6 text-lg font-semibold leading-8 text-rahma-charcoal"
                }
              >
                “{review.shortExcerpt}”
              </blockquote>
              <div className="mt-8 flex items-center gap-4">
                <ReviewerAvatar name={review.reviewerName} />
                <div>
                  <p className="font-semibold text-rahma-charcoal">{review.reviewerName}</p>
                  <p className="text-sm text-rahma-muted">Google Review</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </SectionContainer>
  );
}
