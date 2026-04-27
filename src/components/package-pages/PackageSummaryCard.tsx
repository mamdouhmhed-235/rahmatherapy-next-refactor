import { CheckCircle2 } from "lucide-react";
import { SectionContainer } from "@/components/shared";
import type { PackagePage } from "@/content/pages/packagePages";

export function PackageSummaryCard({ page }: { page: PackagePage }) {
  return (
    <SectionContainer tone="ivory" className="py-10 sm:py-12 lg:py-14">
      <article className="grid gap-6 rounded-3xl border border-rahma-border bg-white p-6 shadow-sm lg:grid-cols-[0.8fr_1.2fr] lg:p-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-rahma-green">
            Quick package summary
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-rahma-charcoal">
            {page.title}
          </h2>
          <div className="mt-5 flex flex-wrap gap-3">
            <span className="rounded-full bg-rahma-gold px-4 py-2 text-lg font-semibold text-rahma-charcoal">
              {page.summary.price}
            </span>
            {page.summary.duration ? (
              <span className="rounded-full border border-rahma-border px-4 py-2 text-sm font-semibold text-rahma-green">
                {page.summary.duration}
              </span>
            ) : null}
          </div>
          <p className="mt-5 text-sm font-semibold text-rahma-charcoal">Best for</p>
          <p className="mt-2 text-sm leading-7 text-rahma-muted">
            {page.summary.bestFor}
          </p>
          <p className="mt-5 text-sm font-semibold text-rahma-charcoal">
            Therapist option
          </p>
          <p className="mt-2 text-sm leading-7 text-rahma-muted">
            {page.summary.therapistOption}
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold text-rahma-charcoal">
            {page.summary.includesHeading ?? "What’s included"}
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {page.summary.includes.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 rounded-2xl bg-rahma-ivory px-4 py-3 text-sm text-rahma-muted"
              >
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
      </article>
    </SectionContainer>
  );
}
