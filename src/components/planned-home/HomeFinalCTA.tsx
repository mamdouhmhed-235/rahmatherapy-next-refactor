import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { PlannedHomeImage } from "./PlannedHomeImage";

export function HomeFinalCTA() {
  return (
    <section className="bg-rahma-ivory px-5 pb-16 sm:px-6 sm:pb-20 lg:px-8 lg:pb-24">
      <div className="mx-auto max-w-[88rem]">
        <div className="relative min-h-[460px] overflow-hidden rounded-3xl bg-rahma-charcoal shadow-card">
          <PlannedHomeImage
            src="/images/home/home-final-cta.webp"
            alt="Private mobile therapy session with Rahma Therapy"
            imageType="Calm premium treatment/wellness image with space for dark overlay."
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#081f1c]/94 via-[#081f1c]/78 to-[#081f1c]/46" />
          <div className="relative z-10 flex min-h-[460px] max-w-3xl flex-col justify-center p-6 text-white sm:p-10 lg:p-14">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rahma-gold">
              Book at home
            </p>
            <h2 className="mt-4 font-display text-4xl font-medium leading-tight sm:text-5xl lg:text-6xl">
              Ready to feel lighter at home?
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/80 sm:text-lg">
              Book a private hijama, cupping or massage session with Rahma Therapy in
              Luton. Tell us what you need, choose your therapist option and we’ll guide
              you to the right package.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="?booking=1"
                data-booking-trigger="true"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-rahma-gold px-6 text-sm font-semibold text-rahma-charcoal transition hover:bg-[#ffc252] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Book now
                <ArrowRight aria-hidden="true" size={16} />
              </Link>
              <Link
                href="https://wa.me/447798897222"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/35 px-6 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <MessageCircle aria-hidden="true" size={17} />
                Ask on WhatsApp
              </Link>
            </div>
            <p className="mt-7 text-sm font-semibold text-white/72">
              Packages from £40 • Mobile across Luton • Male and female therapists
              available
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
