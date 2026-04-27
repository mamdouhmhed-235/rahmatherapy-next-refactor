import { CheckCircle2 } from "lucide-react";
import {
  faqsAftercareDisclaimer,
  suitabilityItems,
} from "@/content/pages/faqsAftercare";
import { SectionContainer } from "@/components/shared";
import { FaqsAftercareImage } from "./FaqsAftercareImage";

export function SafetySuitability() {
  return (
    <SectionContainer tone="green" width="wide">
      <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rahma-gold">
            Safety & suitability
          </p>
          <h2 className="mt-4 max-w-2xl font-display text-3xl font-medium leading-tight text-white sm:text-4xl lg:text-5xl">
            Safety and suitability come first.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-8 text-white/76 sm:text-lg">
            Not every treatment is right for every client. Before your session, we ask
            questions to understand whether hijama, cupping, massage or IASTM-style work
            is suitable for you.
          </p>
          <p className="mt-8 rounded-3xl border border-white/15 bg-white/10 p-5 text-sm leading-7 text-white/76">
            {faqsAftercareDisclaimer}
          </p>
        </div>
        <div>
          <div className="relative min-h-[340px] overflow-hidden rounded-3xl bg-rahma-charcoal shadow-card">
            <FaqsAftercareImage
              src="/images/faqs-aftercare/safety-suitability.webp"
              alt="Clean cupping and massage equipment prepared for safe treatment"
              imageType="Clean equipment, gloves, towels, cups and professional treatment setup."
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/62 via-black/10 to-transparent" />
            <span className="absolute bottom-6 left-6 rounded-full bg-white px-4 py-2 text-sm font-semibold text-rahma-green shadow-sm">
              Suitability first
            </span>
          </div>
          <p className="mt-6 text-sm font-semibold text-rahma-gold">
            Tell us before booking if you:
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {suitabilityItems.map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3"
              >
                <CheckCircle2
                  aria-hidden="true"
                  size={18}
                  className="mt-0.5 shrink-0 text-rahma-gold"
                />
                <span className="text-sm font-medium leading-6 text-white/84">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionContainer>
  );
}
