import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { ReviewsImage } from "./ReviewsImage";

export function ReviewsFinalCTA() {
  return (
    <section className="bg-rahma-ivory px-5 pt-10 pb-16 sm:px-6 sm:pt-12 sm:pb-20 lg:px-8 lg:pt-16 lg:pb-24">
      <div className="mx-auto max-w-[88rem]">
        <div className="relative min-h-[460px] overflow-hidden rounded-3xl bg-rahma-charcoal shadow-card">
          <ReviewsImage
            src="/images/reviews/reviews-final-cta-v1.jpg"
            alt="Private mobile therapy session with Rahma Therapy in Luton"
            imageType="Calm private treatment/wellness image with space for overlay"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-rahma-charcoal/94 via-rahma-charcoal/80 to-rahma-charcoal/46" />
          <div className="relative z-10 flex min-h-[460px] max-w-3xl flex-col justify-center p-6 text-white sm:p-10 lg:p-14">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rahma-gold">
              Book with confidence
            </p>
            <h2 className="mt-4 font-display text-4xl font-medium leading-tight sm:text-5xl lg:text-6xl">
              Ready to add yours?
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/80 sm:text-lg">
              Choose a private home session for hijama, cupping, massage or a combination
              package.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="?booking=1"
                data-booking-trigger="true"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-rahma-gold px-6 text-sm font-semibold text-rahma-charcoal-strong transition hover:bg-[#ffc252] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Book now
                <ArrowRight aria-hidden="true" size={16} />
              </Link>
              <Link
                href="https://wa.me/447798897222"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/35 px-6 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <MessageCircle aria-hidden="true" size={17} />
                Ask on WhatsApp
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
