import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { SectionContainer, SectionHeading } from "@/components/shared";
import { getAreaPage, type AreaPage } from "@/content/pages/areaPages";

// Spoke -> nearby spokes + hub. Renders only when present (spoke pages).
export function AreaNearby({ area }: { area: AreaPage }) {
  if (!area.nearby || !area.nearby.length) return null;

  const places = area.nearby
    .map((slug) => {
      const a = getAreaPage(slug);
      return a ? { slug, name: a.name, note: (a.eyebrow || "").split("·").pop()?.trim() ?? "" } : null;
    })
    .filter((place): place is { slug: string; name: string; note: string } => Boolean(place));

  if (!places.length) return null;

  return (
    <SectionContainer tone="surface" width="wide">
      <SectionHeading
        align="center"
        className="mx-auto"
        eyebrow="Nearby"
        title={`We also cover the areas around ${area.name}`}
        description="Not quite in your area? We're mobile across Luton and the surrounding towns — here are some of the places we visit nearby."
      />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {places.map((place) => (
          <Link
            key={place.slug}
            href={`/areas/${place.slug}`}
            className="group flex items-center justify-between gap-4 rounded-2xl border border-rahma-border bg-rahma-ivory px-6 py-5 transition duration-300 hover:-translate-y-0.5 hover:border-rahma-green/40 hover:shadow-card"
          >
            <span className="flex items-center gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-rahma-green shadow-sm">
                <MapPin aria-hidden="true" size={20} />
              </span>
              <span>
                <span className="block text-base font-semibold text-rahma-charcoal">{place.name}</span>
                <span className="mt-0.5 block text-sm text-rahma-muted">{place.note}</span>
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
      <div className="mt-8 text-center">
        <Link
          href="/areas"
          className="inline-flex items-center gap-2 text-sm font-semibold text-rahma-green transition hover:text-rahma-charcoal"
        >
          See all areas we serve across Luton
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </div>
    </SectionContainer>
  );
}
