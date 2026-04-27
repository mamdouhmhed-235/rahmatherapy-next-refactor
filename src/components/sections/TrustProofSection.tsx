import type { LabeledText, StatCard } from "@/types/content";

interface TrustProofSectionProps {
  title?: string;
  description?: string;
  items: readonly (LabeledText | StatCard)[];
}

function hasValue(item: LabeledText | StatCard): item is StatCard {
  return "value" in item;
}

export function TrustProofSection({ title, description, items }: TrustProofSectionProps) {
  return (
    <section className="bg-background py-12 md:py-16">
      <div className="padding-global">
        <div className="container-large">
          {title ? (
            <div className="mb-8 max-w-3xl">
              <h2 className="heading-style-h2">{title}</h2>
              {description ? <p className="mt-4 text-size-medium">{description}</p> : null}
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((item) => (
              <article key={hasValue(item) ? item.label : item.title} className="rounded-[0.5rem] border border-border bg-white p-6">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
                  {hasValue(item) ? item.value : item.label}
                </p>
                <h3 className="mt-3 text-2xl font-semibold">
                  {hasValue(item) ? item.label : item.title}
                </h3>
                {item.description ? <p className="mt-3 text-sm leading-6 text-foreground/70">{item.description}</p> : null}
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
