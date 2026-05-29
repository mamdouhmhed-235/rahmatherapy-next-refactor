import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ReviewsImage } from "./ReviewsImage";

export function ReviewsHero() {
  return (
    <section className="overflow-hidden bg-rahma-ivory px-5 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1fr_0.9fr]">
        <div className="relative z-10">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rahma-green">
            Google reviews
          </p>
          <h1 className="mt-5 max-w-4xl font-display text-5xl font-medium leading-[1.02] text-rahma-charcoal sm:text-6xl lg:text-7xl">
            Real words from real Luton clients.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-rahma-muted">
            Hijama, cupping, massage, home visits — in their own words.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="?booking=1"
              data-booking-trigger="true"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-rahma-gold px-6 text-sm font-semibold text-rahma-charcoal transition hover:bg-[#ffc252] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue"
            >
              Book a home session
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
            <Link
              href="#review-wall"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-rahma-border bg-white px-6 text-sm font-semibold text-rahma-green transition hover:border-rahma-green/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue"
            >
              Explore reviews
            </Link>
          </div>
        </div>

        <div className="relative min-h-[420px] overflow-hidden rounded-3xl border border-white/70 shadow-card">
          <ReviewsImage
            src="/images/reviews/reviews-hero.webp"
            alt="Rahma Therapy mobile treatment setup for client reviews"
            imageType="Clean premium mobile therapy setup, massage couch, cups, towels, calm home environment"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-rahma-charcoal/20 via-transparent to-rahma-charcoal/50" />
        </div>
      </div>
    </section>
  );
}
