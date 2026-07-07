import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ServicesImage } from "./ServicesImage";

export function ServicesHero() {
  return (
    <section className="overflow-hidden bg-gradient-to-b from-rahma-ivory to-white px-5 py-12 sm:px-6 md:py-14 lg:px-8 lg:py-20">
      <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[0.95fr_1.05fr] md:items-center lg:gap-10">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rahma-green">
            Packages & pricing
          </p>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-medium leading-[1.04] text-rahma-charcoal sm:text-5xl md:text-4xl lg:text-6xl">
            Mobile hijama, cupping and massage in Luton.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-rahma-muted sm:text-lg">
            Five packages for muscle tension, recovery, stress and general wellness
            — from £40. We come to you.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="?booking=1"
              data-booking-trigger="true"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-rahma-gold px-6 text-sm font-semibold text-rahma-charcoal transition hover:bg-[#ffc252] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue"
            >
              Book a home session
            </Link>
            <Link
              href="#compare-packages"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-rahma-green/30 bg-white px-6 text-sm font-semibold text-rahma-green transition hover:border-rahma-green focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue"
            >
              View packages
              <ArrowRight aria-hidden="true" size={17} />
            </Link>
          </div>
        </div>
        <div className="relative min-h-[320px] overflow-hidden rounded-3xl bg-rahma-green shadow-card sm:min-h-[360px] lg:min-h-[560px]">
          <ServicesImage
            src="/images/services/services-hero-v1.jpg"
            alt="Rahma Therapy mobile hijama cupping and massage setup in Luton"
            imageType="Premium mobile therapy setup: massage bed, cups, oils, towels, therapist preparing equipment."
            priority
          />
        </div>
      </div>
    </section>
  );
}
