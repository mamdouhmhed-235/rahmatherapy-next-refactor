import type { LabeledText } from "@/types/content";

interface ProcessStepsSectionProps {
  title: string;
  description?: string;
  items: readonly LabeledText[];
}

export function ProcessStepsSection({ title, description, items }: ProcessStepsSectionProps) {
  return (
    <section className="bg-background py-16 md:py-24">
      <div className="padding-global">
        <div className="container-large">
          <div className="grid gap-10 md:grid-cols-[0.85fr_1.15fr]">
            <div>
              <h2 className="heading-style-h2">{title}</h2>
              {description ? <p className="mt-4 text-size-medium">{description}</p> : null}
            </div>
            <div className="grid gap-4">
              {items.map((item, index) => (
                <article key={item.title} className="grid gap-4 rounded-[0.5rem] border border-border bg-white p-6 sm:grid-cols-[3rem_1fr]">
                  <span className="flex size-12 items-center justify-center rounded-full bg-primary text-lg font-semibold text-white">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-xl font-semibold">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-foreground/72">{item.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
