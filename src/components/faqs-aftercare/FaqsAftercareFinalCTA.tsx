import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { FaqsAftercareImage } from "./FaqsAftercareImage";

export function FaqsAftercareFinalCTA() {
  return (
    <section className="bg-white px-5 pb-16 sm:px-6 sm:pb-20 lg:px-8 lg:pb-24">
      <div className="mx-auto max-w-7xl">
        <div className="relative min-h-[440px] overflow-hidden rounded-3xl bg-rahma-charcoal shadow-card">
          <FaqsAftercareImage
            src="/images/faqs-aftercare/final-cta.webp"
            alt="Private home therapy session with Rahma Therapy"
            imageType="Calm home treatment or wellness image with space for dark overlay."
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1F2F2B]/94 via-[#1F2F2B]/78 to-[#1F2F2B]/46" />
          <div className="relative z-10 flex min-h-[440px] max-w-3xl flex-col justify-center p-6 text-white sm:p-10 lg:p-14">
            <h2 className="font-display text-4xl font-medium leading-tight sm:text-5xl">
              Still have a question before booking?
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/80 sm:text-lg">
              Tell us what you are considering, your preferred therapist option and
              anything we should know about your health or comfort. We’ll help you choose
              the right package.
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
                href="https://wa.me/447798897222?text=Assalamu%20alaykum%2C%20I%20have%20a%20question%20before%20booking%20a%20Rahma%20Therapy%20session%20in%20Luton."
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/35 px-6 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <MessageCircle aria-hidden="true" size={17} />
                Ask on WhatsApp
              </Link>
            </div>
            <p className="mt-7 text-sm font-semibold text-white/72">
              Mobile across Luton • Male and female therapists • Aftercare included
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
