import Link from "next/link";
import { ResponsiveImage } from "@/components/media/ResponsiveImage";
import type { TreatmentCard } from "@/types/content";
import type { SiteImageKey } from "@/content/images";

interface TreatmentMosaicSectionProps {
  title: string;
  description?: string;
  items: readonly TreatmentCard<SiteImageKey>[];
}

export function TreatmentMosaicSection({ title, description, items }: TreatmentMosaicSectionProps) {
  return (
    <section className="bg-background py-16 md:py-24">
      <div className="padding-global">
        <div className="container-large">
          <div className="mb-10 max-w-3xl">
            <h2 className="heading-style-h2">{title}</h2>
            {description ? <p className="mt-4 text-size-medium">{description}</p> : null}
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <article key={item.title} className="overflow-hidden rounded-[0.5rem] border border-border bg-white">
                {item.image ? (
                  <div className="relative h-64 overflow-hidden">
                    <ResponsiveImage image={item.image} fill sizes="(max-width: 767px) 100vw, 33vw" />
                  </div>
                ) : null}
                <div className="p-6">
                  <h3 className="text-2xl font-semibold">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-foreground/72">{item.description}</p>
                  {item.href && item.ctaLabel ? (
                    <Link href={item.href} className="mt-5 inline-flex font-semibold text-primary">
                      {item.ctaLabel}
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
