import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionContainer, SectionHeading } from "@/components/shared";
import type { AreaPage } from "@/content/pages/areaPages";
import { homePackages } from "@/content/pages/home";
import { cn } from "@/lib/utils";
import { AreaImage } from "./AreaImage";

// Real Rahma Therapy service photos, mapped per package type then varied per
// area so no two pages show the same set (avoids doorway-page image cloning).
const PHOTO = {
  dry1: "/images/areas/services/p-img4167.jpg",
  dry2: "/images/areas/services/p-img4169-v2.jpg",
  dry3: "/images/areas/services/p-img4171.jpg",
  dry4: "/images/areas/services/p-img4150.jpg",
  wet1: "/images/areas/services/p-img4174.jpg",
  wet2: "/images/areas/services/p-img4173.jpg",
  wet3: "/images/areas/services/p-dji205048.jpg",
  fire: "/images/areas/services/p-img4120.jpg",
  massageA: "/images/areas/services/p-img4155.jpg",
  massageB: "/images/areas/services/p-img4156.jpg",
  massageC: "/images/areas/services/p-dji203046.jpg",
} as const;

const AREA_PKG_IMAGE: Record<string, Record<string, string>> = {
  "bury-park": { "supreme-combo": PHOTO.dry2, "hijama-package": PHOTO.wet1, "fire-package": PHOTO.fire, "massage-30": PHOTO.massageB, "massage-60": PHOTO.massageA },
  luton: { "supreme-combo": PHOTO.dry1, "hijama-package": PHOTO.wet2, "fire-package": PHOTO.fire, "massage-30": PHOTO.massageB, "massage-60": PHOTO.massageA },
  leagrave: { "supreme-combo": PHOTO.dry3, "hijama-package": PHOTO.wet3, "fire-package": PHOTO.fire, "massage-30": PHOTO.massageB, "massage-60": PHOTO.massageC },
  stopsley: { "supreme-combo": PHOTO.dry4, "hijama-package": PHOTO.wet2, "fire-package": PHOTO.fire, "massage-30": PHOTO.massageC, "massage-60": PHOTO.massageA },
  dunstable: { "supreme-combo": PHOTO.dry2, "hijama-package": PHOTO.wet1, "fire-package": PHOTO.fire, "massage-30": PHOTO.massageB, "massage-60": PHOTO.massageC },
  "houghton-regis": { "supreme-combo": PHOTO.dry1, "hijama-package": PHOTO.wet1, "fire-package": PHOTO.fire, "massage-30": PHOTO.massageB, "massage-60": PHOTO.massageA },
};

export function AreaPackages({ area }: { area: AreaPage }) {
  const byId = Object.fromEntries(homePackages.map((pkg) => [pkg.id, pkg]));
  const ordered = area.packageOrder.map((id) => byId[id]).filter(Boolean);
  const areaImgs = AREA_PKG_IMAGE[area.slug] ?? {};

  return (
    <SectionContainer tone="ivory" width="wide">
      <SectionHeading
        align="center"
        className="mx-auto"
        title={area.packagesHeading}
        description={area.packagesSubheading}
      />
      <div className="mt-12 grid gap-5 lg:grid-cols-12">
        {ordered.map((pkg, index) => {
          const featured = index < 2;
          const src = areaImgs[pkg.id] ?? pkg.image;
          const badge =
            index === 0
              ? area.name.length > 10
                ? "Most booked here"
                : `Most booked in ${area.name}`
              : pkg.badge;

          return (
            <article
              key={pkg.id}
              className={cn(
                "group relative min-h-[400px] overflow-hidden rounded-3xl bg-rahma-green shadow-card sm:min-h-[440px]",
                featured ? "lg:col-span-6 lg:min-h-[470px]" : "lg:col-span-4"
              )}
            >
              <Link href={pkg.href} className="absolute inset-0 z-10" aria-label={`View ${pkg.title}`} />
              <AreaImage
                src={src}
                alt={pkg.alt}
                imageType={pkg.imageType}
                className="transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/10" />
              <span className="absolute left-6 top-6 z-30 max-w-[60%] rounded-full bg-rahma-gold px-3 py-1 text-xs font-semibold uppercase leading-tight tracking-[0.14em] text-rahma-charcoal sm:left-7 sm:top-7">
                {badge}
              </span>
              <strong className="absolute right-6 top-6 z-30 shrink-0 rounded-full bg-white px-4 py-2 text-lg font-semibold text-rahma-green shadow-sm sm:right-7 sm:top-7">
                {pkg.price}
              </strong>
              <div className="absolute inset-0 z-20 flex flex-col justify-end p-6 text-white sm:p-7">
                <h3
                  className={cn(
                    "text-2xl font-semibold leading-tight text-white",
                    featured ? "max-w-md" : "max-w-xs"
                  )}
                >
                  {pkg.title}
                </h3>
                <p
                  className={cn(
                    "mt-3 text-sm leading-7 text-white/80",
                    featured ? "max-w-md" : "max-w-[18rem]"
                  )}
                >
                  {pkg.body}
                </p>
                <div className="relative z-30 mt-6 flex flex-wrap gap-3">
                  <Link
                    href={pkg.bookingHref}
                    data-booking-trigger="true"
                    className="inline-flex min-h-12 items-center gap-2 rounded-full bg-rahma-gold px-5 text-sm font-semibold text-rahma-charcoal transition hover:bg-[#ffc252]"
                  >
                    Book this package
                    <ArrowRight aria-hidden="true" size={16} />
                  </Link>
                  <Link
                    href={pkg.href}
                    className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white/15 px-5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/25"
                  >
                    Details
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </SectionContainer>
  );
}
