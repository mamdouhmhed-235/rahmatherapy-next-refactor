import Link from "next/link";
import { ResponsiveImage } from "@/components/media/ResponsiveImage";
import type { HeroSection } from "@/types/content";
import type { SiteImageKey } from "@/content/images";

interface BrandPageHeroProps {
  hero: HeroSection<SiteImageKey>;
}

export function BrandPageHero({ hero }: BrandPageHeroProps) {
  const images = hero.images ?? (hero.image ? [hero.image] : []);

  return (
    <section className="bg-background">
      <div className="padding-global">
        <div className="container-large">
          <div className="grid min-h-[calc(100svh-4.875rem)] gap-10 py-16 md:grid-cols-[0.95fr_1.05fr] md:items-center lg:py-20">
            <div className="max-w-3xl">
              {hero.eyebrow ? (
                <p className="mb-5 text-sm font-semibold uppercase tracking-[0.24em] text-primary">
                  {hero.eyebrow}
                </p>
              ) : null}
              <h1 className="heading-style-h1 text-foreground">
                {hero.title}
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-foreground/78 md:text-xl">
                {hero.description}
              </p>
              {hero.trustChips?.length ? (
                <ul className="mt-6 flex flex-wrap gap-2">
                  {hero.trustChips.map((chip) => (
                    <li
                      key={chip}
                      className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-primary"
                    >
                      {chip}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={hero.primaryCta.href}
                  className="button max-width-full-mobile-landscape w-button"
                  data-booking-trigger={hero.primaryCta.href.includes("book") ? "true" : undefined}
                >
                  {hero.primaryCta.label}
                </Link>
                {hero.secondaryCta ? (
                  <Link
                    href={hero.secondaryCta.href}
                    className="button is-secondary max-width-full-mobile-landscape w-button"
                  >
                    {hero.secondaryCta.label}
                  </Link>
                ) : null}
              </div>
            </div>

            {images.length > 0 ? (
              <div className="grid grid-cols-[0.85fr_0.65fr] items-end gap-4 overflow-hidden md:min-h-[34rem]">
                {images.slice(0, 2).map((image, index) => (
                  <div
                    key={`${image.image}-${index}`}
                    className={
                      index === 0
                        ? "relative h-[28rem] overflow-hidden rounded-[0.5rem] md:h-[36rem]"
                        : "relative h-[20rem] overflow-hidden rounded-[0.5rem] md:h-[28rem]"
                    }
                  >
                    <ResponsiveImage image={image} fill sizes="(max-width: 767px) 70vw, 36vw" />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
