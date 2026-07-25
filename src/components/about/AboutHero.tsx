import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AboutImage } from "./AboutImage";

export function AboutHero() {
  return (
    <section className="overflow-hidden bg-gradient-to-b from-rahma-ivory to-white px-5 py-14 sm:px-6 lg:px-8 lg:py-20">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rahma-green">
            About us
          </p>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-medium leading-[1.04] text-rahma-charcoal sm:text-5xl lg:text-6xl">
            Serving Luton and surrounding since 2020
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-rahma-muted sm:text-lg">
            CMA and IPHM qualified therapists to assist where you are most
            comfortable
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="?booking=1"
              data-booking-trigger="true"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-rahma-gold px-6 text-sm font-semibold text-rahma-charcoal-strong transition hover:bg-[#ffc252] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue"
            >
              Book an appointment
            </Link>
            <Link
              href="/services"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-rahma-green/30 bg-white px-6 text-sm font-semibold text-rahma-green transition hover:border-rahma-green focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue"
            >
              View packages
              <ArrowRight aria-hidden="true" size={17} />
            </Link>
          </div>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-rahma-green shadow-card">
          <AboutImage
            src="/images/about/about-hero-v3.jpg"
            alt="Rahma Therapy mobile therapy team arriving at a home in Luton with treatment kit"
            imageType="Rahma Therapy therapists in clean professional clothing. Ideally Nadimur, Minhaj and female therapist."
            priority
            fetchPriority="high"
          />
        </div>
      </div>
    </section>
  );
}
