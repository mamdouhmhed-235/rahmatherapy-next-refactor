import { CheckCircle2 } from "lucide-react";
import {
  faqsAftercareDisclaimer,
  suitabilityItems,
} from "@/content/pages/faqsAftercare";
import { SectionContainer } from "@/components/shared";
import { cn } from "@/lib/utils";
import { FaqsAftercareImage } from "./FaqsAftercareImage";

export function SafetySuitability() {
  return (
    <SectionContainer tone="green" width="wide">
      <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-start lg:gap-14">
        <div className="grid max-w-3xl gap-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rahma-gold">
            Safety & suitability
          </p>
          <h2 className="max-w-2xl font-display text-3xl font-medium leading-tight text-white sm:text-4xl lg:text-5xl">
            Safety and suitability come first.
          </h2>
          <p className="max-w-2xl text-base leading-8 text-white/76 sm:text-lg">
            Not every treatment is right for every client. Before your session, we ask
            questions to understand whether hijama, cupping, massage or IASTM-style work
            is suitable for you.
          </p>
          <p className="rounded-3xl border border-white/15 bg-white/10 p-5 text-sm leading-7 text-white/76 sm:p-6">
            {faqsAftercareDisclaimer}
          </p>
        </div>
        <div className="grid gap-7">
          <div className="relative min-h-[360px] overflow-hidden rounded-3xl bg-rahma-charcoal shadow-card">
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
          <div className="grid gap-4">
            <p className="text-sm font-semibold text-rahma-gold">
              Tell us before booking if you:
            </p>
            <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
              {suitabilityItems.map((item, index) => {
                const isCenteredFinalCard =
                  suitabilityItems.length % 2 === 1 &&
                  index === suitabilityItems.length - 1;

                return (
                  <div
                    key={item}
                    className={cn(
                      "flex h-full items-start gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3",
                      isCenteredFinalCard &&
                        "sm:col-span-2 sm:mx-auto sm:w-[calc((100%-1rem)/2)]"
                    )}
                  >
                    <CheckCircle2
                      aria-hidden="true"
                      size={18}
                      className="mt-0.5 shrink-0 text-rahma-gold"
                    />
                    <span className="text-sm font-medium leading-6 text-white/84">
                      {item}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </SectionContainer>
  );
}
