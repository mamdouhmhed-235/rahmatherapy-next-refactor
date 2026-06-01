import { SectionContainer, SectionHeading } from "@/components/shared";
import type { AreaPage } from "@/content/pages/areaPages";
import { homeProcessSteps } from "@/content/pages/home";

export function AreaProcess({ area }: { area: AreaPage }) {
  return (
    <SectionContainer tone="ivory" width="wide">
      <SectionHeading
        align="center"
        className="mx-auto"
        title={`How a home visit in ${area.name} works`}
        description="Four simple steps, from booking to aftercare."
      />
      <div className="relative mt-14">
        <div
          className="absolute top-7 hidden h-0.5 bg-rahma-border lg:block"
          style={{ right: "calc(12.5% + 1.75rem)", left: "calc(12.5% + 1.75rem)" }}
        />
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {homeProcessSteps.map((step) => (
            <div key={step.number} className="relative flex flex-col items-center text-center">
              <div className="relative z-10 flex size-14 items-center justify-center rounded-full bg-rahma-green font-display text-base font-semibold text-white ring-8 ring-rahma-ivory">
                {step.number}
              </div>
              <h3 className="mt-5 text-lg font-semibold text-rahma-charcoal">{step.title}</h3>
              <p className="mt-2 max-w-[15rem] text-sm leading-6 text-rahma-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </SectionContainer>
  );
}
