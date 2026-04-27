import Link from "next/link";
import type { ActionLink, LabeledText } from "@/types/content";

interface RecommendationCardsSectionProps {
  title: string;
  description?: string;
  items: readonly LabeledText[];
  cta?: ActionLink;
}

export function RecommendationCardsSection({
  title,
  description,
  items,
  cta,
}: RecommendationCardsSectionProps) {
  return (
    <section className="bg-background py-16 md:py-24">
      <div className="padding-global">
        <div className="container-large">
          <div className="mb-10 max-w-3xl">
            <h2 className="heading-style-h2">{title}</h2>
            {description ? <p className="mt-4 text-size-medium">{description}</p> : null}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {items.map((item) => (
              <article key={item.title} className="rounded-[0.5rem] border border-border bg-white p-6">
                <h3 className="text-2xl font-semibold">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-foreground/72">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
          {cta ? (
            <Link
              href={cta.href}
              className="button mt-8 w-button"
              data-booking-trigger={cta.href.includes("book") ? "true" : undefined}
            >
              {cta.label}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
