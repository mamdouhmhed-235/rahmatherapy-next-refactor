import Link from "next/link";
import { ResponsiveImage } from "@/components/media/ResponsiveImage";
import type { PackageCard } from "@/types/content";
import type { SiteImageKey } from "@/content/images";

interface PackageCardsSectionProps {
  id?: string;
  title: string;
  description?: string;
  packages: readonly PackageCard<SiteImageKey>[];
  note?: string;
}

export function PackageCardsSection({
  id,
  title,
  description,
  packages,
  note,
}: PackageCardsSectionProps) {
  return (
    <section id={id} className="bg-background py-16 md:py-24">
      <div className="padding-global">
        <div className="container-large">
          <div className="mb-10 max-w-3xl">
            <h2 className="heading-style-h2">{title}</h2>
            {description ? <p className="mt-4 text-size-medium">{description}</p> : null}
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {packages.map((item) => (
              <article
                key={item.id}
                className="flex min-h-full flex-col overflow-hidden rounded-[0.5rem] border border-border bg-white"
              >
                {item.image ? (
                  <div className="relative h-56 overflow-hidden">
                    <ResponsiveImage
                      image={item.image}
                      fill
                      sizes="(max-width: 767px) 100vw, 25vw"
                    />
                  </div>
                ) : null}
                <div className="flex grow flex-col p-6">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-2xl font-semibold">
                      {item.title}
                    </h3>
                    {item.badge ? (
                      <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em]">
                        {item.badge}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-4 text-3xl font-semibold text-primary">
                    {item.priceLabel}
                  </p>
                  <p className="mt-4 text-sm leading-6 text-foreground/72">
                    {item.description}
                  </p>
                  {item.suitableFor ? (
                    <p className="mt-4 rounded-[0.75rem] bg-muted p-3 text-sm font-semibold leading-6 text-foreground/78">
                      {item.suitableFor}
                    </p>
                  ) : null}
                  <ul className="mt-5 grid gap-2 text-sm text-foreground/78">
                    {item.includes.map((include) => (
                      <li key={include} className="flex gap-2">
                        <span aria-hidden="true">✓</span>
                        <span>{include}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={item.cta.href}
                    className="button mt-6 w-button"
                    data-booking-trigger="true"
                  >
                    {item.cta.label}
                  </Link>
                </div>
              </article>
            ))}
          </div>
          {note ? <p className="mt-6 text-sm text-foreground/70">{note}</p> : null}
        </div>
      </div>
    </section>
  );
}
