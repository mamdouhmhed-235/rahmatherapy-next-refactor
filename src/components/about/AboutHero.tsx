import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AboutImage } from "./AboutImage";

const trustPills = [
  "Serving Luton since 2020",
  "500+ clients supported",
  "CMA & IPHM qualified",
  "Male & female therapists",
] as const;

export function AboutHero() {
  return (
    <section className="overflow-hidden bg-gradient-to-b from-rahma-ivory to-white px-5 py-14 sm:px-6 lg:px-8 lg:py-20">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rahma-green">
            About Rahma Therapy
          </p>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-medium leading-[1.04] text-rahma-charcoal sm:text-5xl lg:text-6xl">
            Private mobile therapy, built around trust.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-rahma-muted sm:text-lg">
            Rahma Therapy provides mobile hijama, cupping and massage across Luton for
            adults who want professional treatment in the comfort of home. Since 2020,
            our CMA and IPHM qualified team has supported 500+ clients with muscle
            tension, stiffness, stress, recovery and general wellness.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="?booking=1"
              data-booking-trigger="true"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-rahma-green px-6 text-sm font-semibold text-white transition hover:bg-rahma-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue"
            >
              Book a home session
            </Link>
            <Link
              href="/services"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-rahma-green/30 bg-white px-6 text-sm font-semibold text-rahma-green transition hover:border-rahma-green focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue"
            >
              View treatments
              <ArrowRight aria-hidden="true" size={17} />
            </Link>
          </div>
          <div className="mt-8 flex max-w-full flex-wrap gap-3">
            {trustPills.map((pill) => (
              <span
                key={pill}
                className="max-w-full rounded-full border border-rahma-border bg-white px-4 py-2 text-sm font-medium text-rahma-charcoal shadow-sm"
              >
                {pill}
              </span>
            ))}
          </div>
        </div>
        <div className="relative min-h-[430px] overflow-hidden rounded-3xl bg-rahma-green shadow-card sm:min-h-[560px] lg:min-h-[600px]">
          <AboutImage
            src="/images/about/about-hero-team.webp"
            alt="Rahma Therapy mobile hijama and massage therapists in Luton"
            imageType="Rahma Therapy therapists in clean professional clothing. Ideally Nadimur, Minhaj and female therapist."
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/12 to-transparent" />
          <div className="absolute inset-x-5 bottom-5 rounded-3xl border border-white/15 bg-rahma-charcoal/78 p-5 text-white backdrop-blur-sm sm:inset-x-6 sm:bottom-6">
            <p className="text-sm font-semibold text-rahma-gold">
              Male & female therapists available
            </p>
            <p className="mt-2 text-sm leading-6 text-white/78">
              Private home appointments across Luton
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
