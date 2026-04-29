import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionContainer, SectionHeading } from "@/components/shared";
import { homePackages } from "@/content/pages/home";
import { cn } from "@/lib/utils";
import { HomeImage } from "./HomeImage";

export function HomePackageCards() {
  return (
    <SectionContainer tone="surface">
      <SectionHeading
        align="center"
        title="Choose your home treatment package"
        description="Clear packages, simple pricing and private appointments across Luton."
        className="mx-auto"
      />
      <div className="mt-12 grid gap-5 lg:grid-cols-12">
        {homePackages.map((item) => {
          const isFeatured = item.featured;

          return (
            <article
              key={item.id}
              className={cn(
                "group relative min-h-[400px] overflow-hidden rounded-3xl bg-rahma-green shadow-card",
                isFeatured ? "lg:col-span-6 lg:min-h-[470px]" : "lg:col-span-4"
              )}
            >
              <Link href={item.href} className="absolute inset-0 z-10" aria-label={item.cta} />
              <HomeImage
                src={item.image}
                alt={item.alt}
                imageType={item.imageType}
                className="transition-transform duration-700 group-hover:scale-105 [&_[role=img]>div:last-child]:hidden"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />
              <div className="absolute inset-0 z-20 flex flex-col justify-end p-6 text-white sm:p-7">
                <span className="absolute left-6 top-6 rounded-full bg-rahma-gold px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-rahma-charcoal sm:left-7 sm:top-7">
                  {item.badge}
                </span>
                <strong className="absolute right-6 top-6 shrink-0 rounded-full bg-white px-4 py-2 text-lg font-semibold text-rahma-green shadow-sm sm:right-7 sm:top-7">
                  {item.price}
                </strong>
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
                      {item.title}
                    </h3>
                    <p
                      className={cn(
                        "mt-3 text-sm leading-6 text-white/80",
                        isFeatured ? "max-w-md" : "max-w-[18rem]"
                      )}
                    >
                      {item.body}
                    </p>
                  </div>
                  <div className="relative z-30 mt-5 flex flex-wrap gap-3">
                    <Link
                      href={item.href}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-rahma-green transition hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-gold"
                    >
                      {item.cta}
                      <ArrowRight aria-hidden="true" size={16} />
                    </Link>
                    <Link
                      href={item.bookingHref}
                      data-booking-trigger="true"
                      className="inline-flex min-h-11 items-center rounded-full border border-white/35 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rahma-gold"
                    >
                      Book this package
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <div className="mt-10 flex flex-col items-center gap-4 text-center">
        <p className="text-lg font-semibold text-rahma-charcoal">
          Not sure which package is right for you?
        </p>
        <Link
          href="/services#compare-packages"
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-rahma-green px-6 text-sm font-semibold text-white transition hover:bg-rahma-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue"
        >
          Compare all packages
        </Link>
      </div>
    </SectionContainer>
  );
}
