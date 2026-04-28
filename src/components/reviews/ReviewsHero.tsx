import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { rahmaGoogleReviews } from "@/lib/content/reviews";
import { ReviewsImage } from "./ReviewsImage";
import { ReviewerAvatar } from "./ReviewerAvatar";
import { StarRating } from "./StarRating";

const heroReviewIds = ["review-002", "review-003", "review-014"] as const;
type HeroReview = (typeof rahmaGoogleReviews)[number];

export function ReviewsHero() {
  const heroReviews = heroReviewIds
    .map((id) => rahmaGoogleReviews.find((review) => review.id === id))
    .filter((review): review is HeroReview => Boolean(review));

  return (
    <section className="overflow-hidden bg-rahma-ivory px-5 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1fr_0.9fr]">
        <div className="relative z-10">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rahma-green">
            Google review highlights
          </p>
          <h1 className="mt-5 max-w-4xl font-display text-5xl font-medium leading-[1.02] text-rahma-charcoal sm:text-6xl lg:text-7xl">
            Real reviews from clients across Luton.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-rahma-muted">
            From first-time hijama clients to female therapist bookings, massage sessions
            and mobile home visits — read what people say about Rahma Therapy in their
            own words.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="?booking=1"
              data-booking-trigger="true"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-rahma-green px-6 text-sm font-semibold !text-white transition hover:bg-rahma-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue"
            >
              Book a home session
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
            <Link
              href="#review-wall"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-rahma-border bg-white px-6 text-sm font-semibold text-rahma-green transition hover:border-rahma-green/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue"
            >
              Explore reviews
            </Link>
          </div>
          <p className="mt-7 text-sm font-semibold text-rahma-green">
            Serving Luton since 2020 • 500+ clients supported • Male and female therapists
            available
          </p>
        </div>

        <div className="relative min-h-[520px]">
          <div className="absolute -right-8 top-2 h-60 w-60 rounded-full bg-rahma-gold/20 blur-3xl" />
          <div className="absolute -left-8 bottom-8 h-72 w-72 rounded-full bg-rahma-blue/10 blur-3xl" />
          <div className="absolute inset-x-6 top-0 h-[360px] overflow-hidden rounded-3xl border border-white/70 shadow-card">
            <ReviewsImage
              src="/images/reviews/reviews-hero.webp"
              alt="Rahma Therapy mobile treatment setup for client reviews"
              imageType="Clean premium mobile therapy setup, massage couch, cups, towels, calm home environment"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-b from-rahma-charcoal/20 via-transparent to-rahma-charcoal/45" />
          </div>
          <div className="relative z-10 flex min-h-[520px] flex-col justify-end gap-4 pt-40">
            {heroReviews.map((review, index) => (
              <article
                key={review.id}
                className="ml-auto w-[92%] rounded-3xl border border-rahma-border bg-white/95 p-5 shadow-card backdrop-blur sm:w-[82%]"
                style={{ transform: `translateX(-${index * 18}px)` }}
              >
                <div className="flex items-start gap-4">
                  <ReviewerAvatar name={review.reviewerName} />
                  <div>
                    <StarRating rating={review.rating} />
                    <p className="mt-2 text-base font-semibold text-rahma-charcoal">
                      {review.reviewerName}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-rahma-muted">
                      “{review.shortExcerpt}”
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
