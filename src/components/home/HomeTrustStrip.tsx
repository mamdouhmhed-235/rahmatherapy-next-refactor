import Image from "next/image";
import { StarsRating } from "@/components/shared";

export function HomeTrustStrip() {
  return (
    <section className="border-y border-rahma-border bg-white px-5 pb-10 pt-14 sm:pb-12 sm:pt-16 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-rahma-muted">
          Qualified · Trusted · Rated
        </p>
        {/* Gap lives on this div (not the <p>'s margin): site-parity.css resets
            p/h margins to 0, which would zero any mb-* on the eyebrow. */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-5 sm:mt-10 sm:gap-x-12 lg:gap-x-16">
          <span className="inline-flex h-11 items-center">
            <Image
              src="/logos/cma-logo.jpg"
              alt="The Complementary Medical Association logo"
              width={150}
              height={60}
              unoptimized
              className="h-auto max-h-10 w-auto object-contain"
            />
          </span>
          <span
            aria-hidden="true"
            className="hidden h-9 w-px bg-rahma-border sm:inline-block"
          />
          <span className="inline-flex h-11 items-center rounded-lg bg-rahma-green px-3">
            <Image
              src="/logos/iphm-logo.svg"
              alt="International Practitioners of Holistic Medicine logo"
              width={134}
              height={32}
              unoptimized
              className="h-auto max-h-7 w-auto object-contain"
            />
          </span>
          <span
            aria-hidden="true"
            className="hidden h-9 w-px bg-rahma-border sm:inline-block"
          />
          <div className="inline-flex items-center gap-2.5">
            <StarsRating rating={5} label="Rated 5.0 out of 5 on Google" />
            <span className="text-sm font-semibold text-rahma-charcoal">
              5.0 on Google
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
