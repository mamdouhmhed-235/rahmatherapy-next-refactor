import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { SectionContainer, SectionHeading } from "@/components/shared";
import type { PackagePage } from "@/content/pages/packagePages";

export function PackageBenefits({ page }: { page: PackagePage }) {
  return (
    <SectionContainer tone="sand">
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
            className="rounded-3xl border border-rahma-border bg-white p-6 shadow-card"
          >
            <h3 className="text-lg font-semibold text-rahma-charcoal">{card.title}</h3>
            <p className="mt-3 text-sm leading-7 text-rahma-muted">{card.body}</p>
          </article>
        ))}
      </div>
      {page.benefits.comparison ? (
        <div className="mt-10 rounded-3xl border border-rahma-border bg-white p-6 shadow-card sm:p-8">
          <h3 className="text-2xl font-semibold text-rahma-charcoal">
            {page.benefits.comparison.heading}
          </h3>
          <div className="mt-6 grid gap-8 md:grid-cols-2 md:divide-x md:divide-rahma-border">
            {page.benefits.comparison.columns.map((column, index) => (
              <div key={column.heading} className={index === 1 ? "md:pl-8" : undefined}>
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
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="mt-10 flex justify-center border-t border-rahma-border pt-8">
        <Link
          href={page.bookingHref}
          data-booking-trigger="true"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-rahma-gold px-6 text-sm font-semibold text-rahma-charcoal-strong transition hover:bg-[#ffc252] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue"
        >
          {page.bookingCta}
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </div>
    </SectionContainer>
  );
}
