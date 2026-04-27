import { CheckCircle2 } from "lucide-react";
import { SectionContainer } from "@/components/shared";
import { safetyDisclaimer, safetyItems } from "@/content/pages/about";
import { AboutImage } from "./AboutImage";

export function SafetyStandards() {
  return (
    <SectionContainer tone="surface" width="wide">
      <div className="grid gap-10 lg:grid-cols-[1fr_0.95fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rahma-green">
            Safety & hygiene
          </p>
          <h2 className="mt-4 max-w-3xl font-display text-3xl font-medium leading-tight text-rahma-charcoal sm:text-4xl lg:text-5xl">
            Professional standards from first message to aftercare.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-8 text-rahma-muted sm:text-lg">
            Your comfort and safety are part of the session — not an add-on. Before
            treatment, we ask about your needs and suitability, explain the treatment
            clearly, and confirm what will happen before we begin.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {safetyItems.map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-2xl border border-rahma-border bg-rahma-ivory px-4 py-3"
              >
                <CheckCircle2
                  aria-hidden="true"
                  size={18}
                  className="mt-0.5 shrink-0 text-rahma-green"
                />
                <span className="text-sm font-medium leading-6 text-rahma-charcoal">
                  {item}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-6 rounded-3xl border border-rahma-border bg-white p-5 text-sm leading-7 text-rahma-muted shadow-sm">
            {safetyDisclaimer}
          </p>
        </div>
        <div className="relative min-h-[420px] overflow-hidden rounded-3xl bg-rahma-green shadow-card">
          <AboutImage
            src="/images/about/clean-cupping-equipment.webp"
            alt="Clean cupping equipment prepared for a Rahma Therapy session"
            imageType="Clean cupping cups, gloves, towels and treatment tools. No blood or graphic imagery."
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
        </div>
      </div>
    </SectionContainer>
  );
}
