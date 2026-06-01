import Link from "next/link";
import { ArrowRight } from "lucide-react";

const trustPills = [
  "From £40",
  "Since 2020",
  "500+ Luton clients",
  "Male & female therapists",
] as const;

export function HomeHero() {
  return (
    <section className="relative min-h-[calc(100svh_-_var(--site-header-height))] overflow-hidden bg-rahma-charcoal">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster="/images/home/homepage-hero-poster-v2.jpg"
      >
        <source src="/videos/homepage-hero-v2.mp4" type="video/mp4" />
      </video>
      {/* Neutral (non-blue) scrim for white-text legibility. Two soft gradients —
          a left lean (text is left-aligned) plus a bottom anchor — kept smooth so
          they read as a cinematic vignette, not a hard dark panel. The flame /
          daylight on the right stays visible. */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.72)_0%,rgba(0,0,0,0.42)_30%,rgba(0,0,0,0.12)_60%,transparent_88%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.6)_0%,rgba(0,0,0,0.22)_32%,transparent_62%)]" />
      <div className="relative z-10 flex min-h-[calc(100svh_-_var(--site-header-height))] flex-col justify-end px-5 pb-16 pt-28 text-white sm:px-6 sm:pb-20 lg:px-8">
        <div className="mx-auto w-full max-w-[88rem]">
          <div className="max-w-3xl min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rahma-gold">
              Mobile hijama, cupping & massage
            </p>
            {/* Margins on a wrapper <div>, not the h1/<p>: site-parity.css's
                unlayered reset zeroes margin utilities placed on p/h elements. */}
            <div className="mt-6">
              <h1 className="max-w-4xl font-display text-4xl font-medium leading-[1.02] tracking-normal sm:text-6xl lg:text-7xl">
                Back, neck and shoulder pain — sorted at home in Luton.
              </h1>
            </div>
            <div className="mt-5 max-w-2xl">
              <p className="text-base leading-8 text-white/82 sm:text-lg">
                Hijama, cupping and massage in your own home — with a male or
                female therapist of your choice. From £40.
              </p>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="?booking=1"
                data-booking-trigger="true"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-rahma-gold px-6 text-sm font-semibold text-rahma-charcoal transition hover:bg-[#ffc252] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Book a home session
              </Link>
              <Link
                href="/services"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/35 px-6 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-gold"
              >
                View packages
                <ArrowRight aria-hidden="true" size={17} />
              </Link>
            </div>
          </div>
          <div className="mt-10 flex max-w-full flex-wrap gap-3">
            {trustPills.map((pill) => (
              <span
                key={pill}
                className="max-w-full rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white"
              >
                {pill}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
