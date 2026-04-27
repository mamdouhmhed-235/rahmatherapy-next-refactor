import type { TimelineItem } from "@/types/content";

interface TimelineSectionProps {
  title: string;
  description?: string;
  items: readonly TimelineItem[];
}

export function TimelineSection({ title, description, items }: TimelineSectionProps) {
  return (
    <section className="bg-background py-16 md:py-24">
      <div className="padding-global">
        <div className="container-large">
          <div className="mb-10 max-w-3xl">
            <h2 className="heading-style-h2">{title}</h2>
            {description ? <p className="mt-4 text-size-medium">{description}</p> : null}
          </div>
          <ol className="grid gap-4">
            {items.map((item) => (
              <li key={`${item.date}-${item.title}`} className="grid gap-4 rounded-[0.5rem] border border-border bg-white p-6 md:grid-cols-[10rem_1fr]">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">{item.date}</p>
                <div>
                  <h3 className="text-2xl font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-foreground/72">{item.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
