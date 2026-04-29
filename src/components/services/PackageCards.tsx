import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { SectionContainer, SectionHeading } from "@/components/shared";
import { servicePackages } from "@/content/pages/services";
import { cn } from "@/lib/utils";
import { ServicesImage } from "./ServicesImage";

export function PackageCards() {
  return (
    <SectionContainer tone="ivory" width="wide">
      <SectionHeading
        align="center"
        title="Choose your treatment package"
        description="Each package is built around a different need — from classic hijama to full recovery-style combinations. Prices are simple and the therapist comes to you."
        className="mx-auto"
      />
      <div className="mt-12 grid gap-5 lg:grid-cols-12">
        {servicePackages.map((service, index) => (
          <article
            key={service.id}
            className={cn(
              "group relative min-h-[800px] overflow-hidden rounded-3xl bg-rahma-green shadow-card sm:min-h-[700px] lg:min-h-[680px]",
              index < 2 ? "lg:col-span-6" : "lg:col-span-4"
            )}
          >
            <ServicesImage
              src={service.image}
              alt={service.alt}
              imageType={service.imageType}
              className="transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/50 to-black/10" />
            <div className="absolute inset-0 z-10 flex flex-col justify-end p-6 text-white sm:p-7">
              <div className="flex min-h-full flex-col justify-end">
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-full bg-rahma-gold px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-rahma-charcoal">
                    {service.badge}
                  </span>
                  <strong className="shrink-0 rounded-full bg-white px-4 py-2 text-lg font-semibold text-rahma-green shadow-sm">
                    {service.price}
                  </strong>
                </div>
                <div className="mt-5 lg:min-h-[128px]">
                  <h3 className="text-2xl font-semibold leading-tight text-white">
                    {service.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-white/82">
                    {service.shortDescription}
                  </p>
                </div>
                <div className="mt-5 rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                  <p className="text-sm font-semibold text-white">Includes:</p>
                  <ul className="mt-3 grid gap-2">
                    {service.includes.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2 text-sm text-white/78"
                      >
                        <CheckCircle2
                          aria-hidden="true"
                          size={16}
                          className="mt-0.5 shrink-0 text-rahma-gold"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-4 rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                  <p className="text-sm font-semibold text-white">Best for:</p>
                  <p className="mt-2 text-sm leading-6 text-white/78">
                    {service.bestFor}
                  </p>
                </div>
                <div className="mt-auto flex flex-col gap-3 pt-6 sm:flex-row">
                  <Link
                    href={service.href}
                    className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-white px-5 text-center text-sm font-semibold text-rahma-green transition hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-gold"
                  >
                    {service.cta}
                    <ArrowRight aria-hidden="true" size={16} />
                  </Link>
                  <Link
                    href={service.bookingHref}
                    data-booking-trigger="true"
                    className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-white/35 px-5 text-center text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rahma-gold"
                  >
                    {service.bookingCta}
                  </Link>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </SectionContainer>
  );
}
