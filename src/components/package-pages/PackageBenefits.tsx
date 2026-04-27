import { CheckCircle2 } from "lucide-react";
import { SectionContainer, SectionHeading } from "@/components/shared";
import type { PackagePage } from "@/content/pages/packagePages";

export function PackageBenefits({ page }: { page: PackagePage }) {
  return (
    <SectionContainer tone="surface">
      <SectionHeading
        align="center"
        title={page.benefits.heading}
        description={page.benefits.subheading}
        className="mx-auto"
      />
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {page.benefits.cards.map((card) => (
          <article
            key={card.title}
            className="rounded-3xl border border-rahma-border bg-white p-6 shadow-sm"
          >
            <h3 className="text-lg font-semibold text-rahma-charcoal">{card.title}</h3>
            <p className="mt-3 text-sm leading-7 text-rahma-muted">{card.body}</p>
          </article>
        ))}
      </div>
      {page.benefits.comparison ? (
        <div className="mt-10 rounded-3xl border border-rahma-border bg-rahma-ivory p-6 shadow-sm">
          <h3 className="text-2xl font-semibold text-rahma-charcoal">
            {page.benefits.comparison.heading}
          </h3>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {page.benefits.comparison.columns.map((column) => (
              <article key={column.heading} className="rounded-3xl bg-white p-5">
                <h4 className="text-lg font-semibold text-rahma-green">
                  {column.heading}
                </h4>
                <ul className="mt-4 grid gap-3">
                  {column.items.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-rahma-muted">
                      <CheckCircle2
                        aria-hidden="true"
                        size={17}
                        className="mt-0.5 shrink-0 text-rahma-green"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </SectionContainer>
  );
}
