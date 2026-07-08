import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { SectionContainer, SectionHeading } from "@/components/shared";
import type { AreaPage } from "@/content/pages/areaPages";

// Umbrella -> spoke pages. Renders only when present (Luton hub).
export function AreaLinks({ area }: { area: AreaPage }) {
  const block = area.areaLinks;
  if (!block || !block.links.length) return null;

  return (
    <SectionContainer tone="surface" width="wide">
      <SectionHeading
        align="center"
        className="mx-auto"
        eyebrow="Areas we serve"
        title={block.heading}
        description={block.body}
      />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {block.links.map((link) => (
          <Link
            key={link.name}
            href={link.href}
            className="group flex items-center justify-between gap-4 rounded-2xl border border-rahma-border bg-rahma-ivory px-6 py-5 transition duration-300 hover:-translate-y-0.5 hover:border-rahma-green/40 hover:shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue"
          >
            <span className="flex items-center gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-rahma-green shadow-soft">
                <MapPin aria-hidden="true" size={20} />
              </span>
              <span>
                <span className="block text-base font-semibold text-rahma-charcoal">{link.name}</span>
                <span className="mt-0.5 block text-sm text-rahma-muted">{link.note}</span>
              </span>
            </span>
            <ArrowRight
              aria-hidden="true"
              size={18}
              className="shrink-0 text-rahma-green transition group-hover:translate-x-1"
            />
          </Link>
        ))}
      </div>
    </SectionContainer>
  );
}
