import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { SectionContainer, SectionHeading } from "@/components/shared";
import type { AreaPage } from "@/content/pages/areaPages";

export function AreaMap({ area }: { area: AreaPage }) {
  const map = area.map;

  return (
    <SectionContainer tone="ivory" width="wide">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-14">
        <div className="max-w-xl">
          <SectionHeading eyebrow="Where we cover" title={map.heading} description={map.body} />
          <ul className="mt-7 flex list-none flex-wrap gap-2.5">
            {map.coverage.map((place) => (
              <li
                key={place}
                className="inline-flex items-center gap-1.5 rounded-full border border-rahma-border bg-white px-3.5 py-1.5 text-sm font-medium text-rahma-charcoal"
              >
                <MapPin aria-hidden="true" size={14} className="text-rahma-green" />
                {place}
              </li>
            ))}
          </ul>
          <Link
            href={area.bookingHref}
            data-booking-trigger="true"
            className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-rahma-green px-6 text-sm font-semibold text-white transition hover:bg-rahma-charcoal"
          >
            {area.bookingCta}
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
        <div className="relative min-h-[340px] overflow-hidden rounded-3xl border border-rahma-border bg-white shadow-card lg:min-h-[420px]">
          <iframe
            title={`Map of ${area.name}, Luton`}
            src={map.embedSrc}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="absolute inset-0 h-full w-full"
            style={{ border: 0 }}
          />
        </div>
      </div>
    </SectionContainer>
  );
}
