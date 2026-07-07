import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import type { PackagePage } from "@/content/pages/packagePages";
import { PackageImage } from "./PackageImage";

export function PackageFinalCTA({ page }: { page: PackagePage }) {
  return (
    <section className="bg-rahma-ivory px-5 pt-16 pb-16 sm:px-6 sm:pt-20 sm:pb-20 lg:px-8 lg:pt-24 lg:pb-24">
      <div className="mx-auto max-w-7xl">
        <div className="relative min-h-[440px] overflow-hidden rounded-3xl bg-rahma-charcoal shadow-card">
          <PackageImage
            src="/images/areas/services/p-img4174.jpg"
            alt="Private mobile therapy session with Rahma Therapy"
            imageType="Relaxed wellness/treatment image suitable for dark overlay."
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#144a78]/94 via-[#144a78]/78 to-[#144a78]/42" />
          <div className="relative z-10 flex min-h-[440px] max-w-3xl flex-col justify-center p-6 text-white sm:p-10 lg:p-14">
            <h2 className="font-display text-4xl font-medium leading-tight sm:text-5xl">
              {page.finalCta.heading}
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/80 sm:text-lg">
              {page.finalCta.body}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={page.bookingHref}
                data-booking-trigger="true"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-rahma-gold px-6 text-sm font-semibold text-rahma-charcoal transition hover:bg-[#ffc252] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Book this package
                <ArrowRight aria-hidden="true" size={16} />
              </Link>
              <Link
                href={page.whatsappHref}
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
