import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import type { AreaPage } from "@/content/pages/areaPages";
import { AreaImage } from "./AreaImage";

export function AreaFinalCTA({ area }: { area: AreaPage }) {
  return (
    <section className="bg-rahma-ivory px-5 pt-16 pb-16 sm:px-6 sm:pt-20 sm:pb-20 lg:px-8 lg:pt-24 lg:pb-24">
      <div className="mx-auto max-w-7xl">
        <div className="relative min-h-[440px] overflow-hidden rounded-3xl bg-rahma-charcoal shadow-card">
          <AreaImage
            src="/images/areas/area-cta-v2.jpg"
            alt={`Private mobile therapy in ${area.name}, Luton`}
            imageType="Relaxed wellness/treatment image suitable for dark overlay."
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to right, rgba(20,74,120,0.94), rgba(20,74,120,0.78), rgba(20,74,120,0.42))",
            }}
          />
          <div className="relative z-10 flex min-h-[440px] max-w-3xl flex-col justify-center p-6 text-white sm:p-10 lg:p-14">
            <h2 className="font-display text-4xl font-medium leading-tight sm:text-5xl">{area.finalCta.heading}</h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/80 sm:text-lg">{area.finalCta.body}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
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
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/35 px-6 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                <MessageCircle aria-hidden="true" size={17} />
                {area.whatsappCta}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
