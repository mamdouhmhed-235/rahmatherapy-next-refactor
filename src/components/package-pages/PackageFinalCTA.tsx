import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import type { PackagePage } from "@/content/pages/packagePages";
import { PackageImage } from "./PackageImage";

export function PackageFinalCTA({ page }: { page: PackagePage }) {
  return (
    <section className="bg-rahma-ivory px-5 pb-16 sm:px-6 sm:pb-20 lg:px-8 lg:pb-24">
      <div className="mx-auto max-w-7xl">
        <div className="relative min-h-[440px] overflow-hidden rounded-3xl bg-rahma-charcoal shadow-card">
          <PackageImage
            src="/images/packages/final-cta.webp"
            alt="Private mobile therapy session with Rahma Therapy"
            imageType="Relaxed wellness/treatment image suitable for dark overlay."
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#081f1c]/94 via-[#081f1c]/78 to-[#081f1c]/42" />
          <div className="relative z-10 flex min-h-[440px] max-w-3xl flex-col justify-center p-6 text-white sm:p-10 lg:p-14">
            <h2 className="font-display text-4xl font-medium leading-tight sm:text-5xl">
              {page.finalCta.heading}
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/80 sm:text-lg">
              {page.finalCta.body}
            </p>
            <p className="mt-4 text-sm leading-6 text-white/72">
              Private home appointments available across Luton with male and female
              therapists.
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
