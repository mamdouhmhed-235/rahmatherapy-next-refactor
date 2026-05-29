import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionContainer, SectionHeading } from "@/components/shared";
import { servicePackages } from "@/content/pages/services";
import { cn } from "@/lib/utils";
import { ServicesImage } from "./ServicesImage";

export function PackageCards() {
  return (
    <SectionContainer tone="ivory" width="wide">
      <SectionHeading
        align="center"
        title="Five packages. Pick yours."
        description="Different needs, different packages. The therapist comes to you."
        className="mx-auto"
      />
      <div className="mt-12 grid gap-5 lg:grid-cols-12">
        {servicePackages.map((service, index) => {
          const isFeatured = index < 2;

          return (
            <article
              key={service.id}
              className={cn(
                "group relative min-h-[400px] overflow-hidden rounded-3xl bg-rahma-green shadow-card",
                isFeatured ? "lg:col-span-6 lg:min-h-[470px]" : "lg:col-span-4"
              )}
            >
              <Link
                href={service.href}
                className="absolute inset-0 z-10"
                aria-label={service.cta}
              />
              <ServicesImage
                src={service.image}
                alt={service.alt}
                imageType={service.imageType}
                className="transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />
              <span className="absolute left-6 top-6 z-30 rounded-full bg-rahma-gold px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-rahma-charcoal sm:left-7 sm:top-7">
                {service.badge}
              </span>
              <strong className="absolute right-6 top-6 z-30 shrink-0 rounded-full bg-white px-4 py-2 text-lg font-semibold text-rahma-green shadow-sm sm:right-7 sm:top-7">
                {service.price}
              </strong>
              <div className="absolute inset-0 z-20 flex flex-col justify-end p-6 text-white sm:p-7">
                <div
                  className={cn(
                    "flex min-h-full flex-col justify-end",
                    isFeatured ? "lg:max-w-[92%]" : "lg:max-w-full"
                  )}
                >
                  <div
                    className={cn(
                      "mt-5",
                      isFeatured ? "lg:min-h-[92px]" : "lg:min-h-[124px]"
                    )}
                  >
                    <h3
                      className={cn(
                        "text-2xl font-semibold leading-tight",
                        isFeatured ? "max-w-md" : "max-w-xs"
                      )}
                    >
                      {service.title}
                    </h3>
                    <p
                      className={cn(
                        "mt-3 text-sm leading-6 text-white/80",
                        isFeatured ? "max-w-md" : "max-w-[18rem]"
                      )}
                    >
                      {service.shortDescription}
                    </p>
                  </div>
                  <div className="relative z-30 mt-5 flex flex-wrap gap-3">
                    <Link
                      href={service.href}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-rahma-green transition hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-gold"
                    >
                      {service.cta}
                      <ArrowRight aria-hidden="true" size={16} />
                    </Link>
                    <Link
                      href={service.bookingHref}
                      data-booking-trigger="true"
                      className="inline-flex min-h-11 items-center rounded-full border border-white/35 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rahma-gold"
                    >
                      {service.bookingCta}
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </SectionContainer>
  );
}
