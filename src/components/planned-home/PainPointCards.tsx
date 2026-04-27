import { SectionContainer, SectionHeading } from "@/components/shared";
import { homePainPoints } from "@/content/pages/plannedHome";
import { PlannedHomeImage } from "./PlannedHomeImage";

export function PainPointCards() {
  return (
    <SectionContainer tone="ivory">
      <SectionHeading
        align="center"
        title="What do you need help with today?"
        description="Most clients come to us when their body feels tight, heavy, stressed or overdue for a reset."
        className="mx-auto"
      />
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {homePainPoints.map((item) => (
          <article
            key={item.title}
            className="overflow-hidden rounded-3xl border border-rahma-border bg-white shadow-soft"
          >
            <div className="relative h-52">
              <PlannedHomeImage
                src={item.image}
                alt={item.alt}
                imageType={item.imageType}
              />
            </div>
            <div className="p-6">
              <h3 className="text-xl font-semibold text-rahma-charcoal">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-rahma-muted">{item.body}</p>
            </div>
          </article>
        ))}
      </div>
    </SectionContainer>
  );
}
