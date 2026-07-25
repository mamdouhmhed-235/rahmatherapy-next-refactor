import { CheckCircle2 } from "lucide-react";
import { SectionContainer } from "@/components/shared";
import type { AreaPage } from "@/content/pages/areaPages";
import { homeSafetyItems } from "@/content/pages/home";
import { AreaImage } from "./AreaImage";

export function AreaSafetyBand({ area }: { area: AreaPage }) {
  return (
    <SectionContainer tone="green" width="wide">
      <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white">
            Safety, hygiene &amp; suitability
          </p>
          <h2 className="mt-4 max-w-2xl font-display text-3xl font-medium leading-tight text-white sm:text-4xl lg:text-5xl">
            Clean, careful and explained first.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-8 text-white/80 sm:text-lg">
            {`Before anything begins in your ${area.name} home, your therapist checks suitability, talks you through the treatment and confirms you're comfortable. Because hijama and cupping are involved, hygiene and aftercare are built into every visit.`}
          </p>
          <div className="mt-8 grid gap-x-4 gap-y-4 sm:grid-cols-2">
            {homeSafetyItems.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
                <CheckCircle2 aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-rahma-gold" />
                <span className="text-sm font-medium leading-6 text-white/85">{item}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative min-h-[360px] overflow-hidden rounded-3xl bg-rahma-charcoal shadow-card lg:min-h-[460px]">
          <AreaImage
            src="/images/packages/safety-band.jpg"
            alt="Clean cupping and hijama equipment laid out for a Rahma Therapy home visit"
            imageType="Clean cups, towels, gloves, oils, single-use items."
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        </div>
      </div>
      {/* Spacing lives on a div wrapper: the global site-parity reset zeroes <p> margins. */}
      <div className="mt-10">
        <p className="mx-auto max-w-2xl rounded-3xl border border-white/15 bg-white/10 p-5 text-center text-sm leading-7 text-white/80">
          Rahma Therapy provides complementary wellness treatments and does not diagnose or replace medical care. If you
          have a medical condition, take medication, are pregnant, or are unsure whether treatment is suitable, please
          speak to a healthcare professional before booking.
        </p>
      </div>
    </SectionContainer>
  );
}
