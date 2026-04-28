import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HomeImage } from "./HomeImage";

const trustPills = [
  "Packages from £40",
  "Serving Luton since 2020",
  "500+ clients supported",
  "Female therapist available",
] as const;

export function HomeHero() {
  return (
    <section className="bg-rahma-ivory px-4 pb-14 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[88rem]">
        <div className="relative min-h-[620px] overflow-hidden rounded-3xl bg-rahma-green shadow-elevated sm:min-h-[680px]">
          <HomeImage
            src="/images/home/home-hero.avif"
            alt="Rahma Therapy mobile hijama cupping and massage treatment at home in Luton"
            imageType="Large premium home-treatment image: therapist providing massage or preparing cupping in a calm home setting. No blood. No unsafe flame."
            priority
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(31,47,43,0.92)_0%,rgba(31,47,43,0.74)_42%,rgba(31,47,43,0.24)_72%,rgba(31,47,43,0.42)_100%)]" />
          <div className="relative z-10 flex min-h-[620px] flex-col justify-end p-6 text-white sm:min-h-[680px] sm:p-10 lg:p-14">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rahma-gold">
                Mobile hijama, cupping & massage in Luton
              </p>
              <h1 className="mt-5 max-w-4xl text-4xl font-medium leading-[1.02] tracking-normal sm:text-6xl lg:text-7xl">
                Feel lighter, looser and more at ease — without leaving home.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-white/82 sm:text-lg">
                Private home treatments for back pain, neck and shoulder tension,
                muscle tightness, stress, gym recovery and general wellness —
                delivered by CMA and IPHM qualified male and female therapists.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="?booking=1"
                  data-booking-trigger="true"
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-rahma-green transition hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-gold"
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
            <div className="mt-10 flex flex-wrap gap-3">
              {trustPills.map((pill) => (
                <span
                  key={pill}
                  className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white"
                >
                  {pill}
                </span>
              ))}
            </div>
            <figure className="mt-8 max-w-md rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
              <blockquote className="text-lg font-medium">
                “Everything was explained clearly and I felt comfortable throughout.”
              </blockquote>
              <figcaption className="mt-3 text-sm text-white/70">
                Google review highlight
              </figcaption>
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
}
