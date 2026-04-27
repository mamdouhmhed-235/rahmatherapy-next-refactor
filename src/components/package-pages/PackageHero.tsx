import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import type { PackagePage } from "@/content/pages/packagePages";
import { PackageImage } from "./PackageImage";

const trustPills = [
  "Mobile across Luton",
  "CMA & IPHM qualified",
  "Male & female therapists",
  "Aftercare included",
] as const;

export function PackageHero({ page }: { page: PackagePage }) {
  return (
    <section className="bg-gradient-to-b from-rahma-ivory to-white px-5 py-14 sm:px-6 lg:px-8 lg:py-20">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rahma-green">
            {page.eyebrow}
          </p>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-medium leading-[1.04] text-rahma-charcoal sm:text-5xl lg:text-6xl">
            {page.h1}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-rahma-muted sm:text-lg">
            {page.subheading}
          </p>
          <p className="mt-5 max-w-2xl text-base leading-8 text-rahma-muted">
            {page.openingCopy}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-rahma-gold px-5 py-2 text-lg font-semibold text-rahma-charcoal">
              {page.price}
            </span>
            {page.duration ? (
              <span className="rounded-full border border-rahma-border bg-white px-5 py-2 text-sm font-semibold text-rahma-green">
                {page.duration}
              </span>
            ) : null}
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={page.bookingHref}
              data-booking-trigger="true"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-rahma-green px-6 text-sm font-semibold text-white transition hover:bg-rahma-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue"
            >
              {page.bookingCta}
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
            <Link
              href={page.whatsappHref}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-rahma-green/30 bg-white px-6 text-sm font-semibold text-rahma-green transition hover:border-rahma-green focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue"
            >
              <MessageCircle aria-hidden="true" size={17} />
              {page.whatsappCta}
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            {trustPills.map((pill) => (
              <span
                key={pill}
                className="rounded-full border border-rahma-border bg-white px-4 py-2 text-sm font-medium text-rahma-charcoal shadow-sm"
              >
                {pill}
              </span>
            ))}
          </div>
        </div>
        <div className="relative min-h-[430px] overflow-hidden rounded-3xl bg-rahma-green shadow-card sm:min-h-[560px]">
          <PackageImage
            src={page.heroImage}
            alt={page.heroAlt}
            imageType={page.heroImageType}
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/12 to-transparent" />
          <div className="absolute inset-x-5 bottom-5 rounded-3xl border border-white/15 bg-rahma-charcoal/78 p-5 text-white backdrop-blur-sm sm:inset-x-6 sm:bottom-6">
            <p className="text-sm font-semibold text-rahma-gold">
              {page.heroOverlayTitle}
            </p>
            <p className="mt-2 text-sm leading-6 text-white/78">
              {page.heroOverlayText}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
