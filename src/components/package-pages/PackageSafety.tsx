import { CheckCircle2 } from "lucide-react";
import { SectionContainer } from "@/components/shared";
import { packageSafetyDisclaimer, packageSafetyItems } from "@/content/pages/packagePages";
import { PackageImage } from "./PackageImage";

export function PackageSafety() {
  return (
    <SectionContainer tone="green" width="wide">
      <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rahma-gold">
            Safety, hygiene & suitability
          </p>
          <h2 className="mt-4 max-w-2xl font-display text-3xl font-medium leading-tight text-white sm:text-4xl lg:text-5xl">
            Clean, careful and suitable for you.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-8 text-white/76 sm:text-lg">
            Before your session begins, your therapist checks suitability, explains the
            treatment and confirms you are comfortable. Because some treatments involve
            cupping or hijama, hygiene and aftercare are built into the process.
          </p>
          <div className="mt-8 grid gap-x-4 gap-y-5 sm:grid-cols-2">
            {packageSafetyItems.map((item) => (
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
        <div className="relative min-h-[420px] overflow-hidden rounded-3xl bg-rahma-charcoal shadow-card">
          <PackageImage
            src="/images/packages/safety-equipment.webp"
            alt="Clean cupping and massage equipment for a Rahma Therapy session"
            imageType="Clean cups, towels, gloves, oils, equipment."
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/62 via-black/10 to-transparent" />
        </div>
      </div>
      <div className="pt-14 lg:pt-16">
        <p className="rounded-3xl border border-white/15 bg-white/10 p-5 text-sm leading-7 text-white/76">
          {packageSafetyDisclaimer}
        </p>
      </div>
    </SectionContainer>
  );
}
