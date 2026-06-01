import { SectionContainer, SectionHeading } from "@/components/shared";
import type { AreaPage } from "@/content/pages/areaPages";
import { AreaIcon } from "./AreaIcon";

export function AreaWhy({ area }: { area: AreaPage }) {
  return (
    <SectionContainer tone="surface">
      <SectionHeading align="center" className="mx-auto" title={area.whyHeading} />
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {area.whyCards.map((card) => (
          <article
            key={card.title}
            className="group rounded-3xl bg-rahma-ivory p-7 transition duration-300 hover:-translate-y-1 hover:shadow-card"
          >
            <span className="flex size-14 items-center justify-center rounded-2xl bg-rahma-gold/20 text-rahma-charcoal transition group-hover:bg-rahma-gold">
              <AreaIcon name={card.icon} size={26} />
            </span>
            <h3 className="mt-6 text-lg font-semibold text-rahma-charcoal">{card.title}</h3>
            <p className="mt-3 text-sm leading-7 text-rahma-muted">{card.body}</p>
          </article>
        ))}
      </div>
    </SectionContainer>
  );
}
