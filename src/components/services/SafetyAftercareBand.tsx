import { CheckCircle2 } from "lucide-react";
import { SectionContainer } from "@/components/shared";
import { serviceSafetyDisclaimer, serviceSafetyItems } from "@/content/pages/services";

export function SafetyAftercareBand() {
  return (
    <SectionContainer tone="green" width="wide">
      <div className="grid gap-12 lg:gap-14">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rahma-gold">
              Safety & aftercare
            </p>
            <h2 className="mt-4 max-w-2xl font-display text-3xl font-medium leading-tight text-white sm:text-4xl lg:text-5xl">
              Clean, careful and explained clearly.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-white/76 sm:text-lg">
              Because Rahma Therapy offers hijama and cupping in the home, every session
              is built around privacy, suitability and hygiene-led care.
            </p>
          </div>
          <div className="grid gap-x-5 gap-y-6 sm:grid-cols-2">
            {serviceSafetyItems.map((item) => (
              <div
                key={item}
                className="flex h-full items-start gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3"
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
            ))}
          </div>
        </div>
        <p className="mx-auto w-full max-w-5xl justify-self-center rounded-3xl border border-white/15 bg-white/10 p-5 text-sm leading-7 text-white/76">
          {serviceSafetyDisclaimer}
        </p>
      </div>
    </SectionContainer>
  );
}
