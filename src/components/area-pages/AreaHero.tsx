import Link from "next/link";
import { ArrowRight, CalendarDays, Home, MapPin, MessageCircle } from "lucide-react";
import type { AreaPage } from "@/content/pages/areaPages";
import { AreaImage } from "./AreaImage";

export function AreaHero({ area }: { area: AreaPage }) {
  return (
    <section className="overflow-hidden bg-gradient-to-b from-rahma-ivory to-white px-5 py-10 sm:px-6 md:py-14 lg:px-8 lg:py-20">
      <div className="mx-auto grid max-w-7xl gap-7 md:grid-cols-[0.95fr_1.05fr] md:items-center lg:gap-10">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 rounded-full bg-rahma-green/10 px-4 py-1.5 text-sm font-semibold uppercase tracking-[0.14em] text-rahma-green">
            <MapPin aria-hidden="true" size={15} strokeWidth={2.4} />
            {area.eyebrow}
          </p>
          {/* Margins live on wrapper divs: the global site-parity reset zeroes <h1>/<p> margins. */}
          <div className="mt-6 lg:mt-7">
            <h1 className="max-w-3xl font-display text-3xl font-medium leading-[1.06] text-rahma-charcoal sm:text-5xl md:text-4xl lg:text-6xl">
              {area.h1}
            </h1>
          </div>
          <div className="mt-5 lg:mt-6">
            <p className="max-w-2xl text-base leading-7 text-rahma-muted sm:text-lg sm:leading-8">
              {area.subheading}
            </p>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3 sm:mt-7">
            <span className="rounded-full bg-rahma-gold px-5 py-2 text-lg font-semibold text-rahma-charcoal">
              {area.priceFrom}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-rahma-border bg-white px-5 py-2 text-sm font-semibold text-rahma-green">
              <CalendarDays aria-hidden="true" size={16} />
              {area.heroNote}
            </span>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:mt-8">
            <Link
              href={area.bookingHref}
              data-booking-trigger="true"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-rahma-gold px-6 text-sm font-semibold text-rahma-charcoal transition hover:bg-[#ffc252]"
            >
              {area.bookingCta}
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
            <a
              href={area.whatsappHref}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-rahma-green/30 bg-white px-6 text-sm font-semibold text-rahma-green transition hover:border-rahma-green"
            >
              <MessageCircle aria-hidden="true" size={17} />
              {area.whatsappCta}
            </a>
          </div>
        </div>
        <div className="relative min-h-[300px] overflow-hidden rounded-3xl bg-rahma-green shadow-card sm:min-h-[380px] lg:min-h-[560px]">
          <AreaImage src={area.heroImage} alt={area.heroAlt} imageType={area.heroImageType} priority />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6 flex items-center gap-3 text-white">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur">
              <Home aria-hidden="true" size={20} />
            </span>
            <p className="text-sm font-medium leading-6 text-white/90">
              We bring the full treatment setup to your home in {area.name}.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
