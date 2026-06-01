import { SectionContainer, SectionHeading } from "@/components/shared";
import type { AreaPage } from "@/content/pages/areaPages";
import { AreaIcon } from "./AreaIcon";

export function AreaIntro({ area }: { area: AreaPage }) {
  const intro = area.intro;

  return (
    <SectionContainer tone="surface" width="wide">
      <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-14">
        <div className="max-w-2xl">
          <SectionHeading eyebrow={`Serving ${area.name}`} title={intro.heading} />
          {/* flex gap (not space-y): the global reset zeroes the <p> margins space-y relies on. */}
          <div className="mt-6 flex flex-col gap-4">
            {intro.paragraphs.map((paragraph, index) => (
              <p key={index} className="text-base leading-8 text-rahma-muted sm:text-[1.0625rem]">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
        <ul className="grid list-none gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {intro.facts.map((fact) => (
            <li
              key={fact.label}
              className="flex items-start gap-4 rounded-2xl border border-rahma-border bg-rahma-ivory px-5 py-4 shadow-sm"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-rahma-green shadow-sm">
                <AreaIcon name={fact.icon} size={20} />
              </span>
              <span className="self-center text-sm font-medium leading-6 text-rahma-charcoal sm:text-base">
                {fact.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </SectionContainer>
  );
}
