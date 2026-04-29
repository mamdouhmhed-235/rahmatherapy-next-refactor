import { CheckCircle2 } from "lucide-react";
import { SectionContainer } from "@/components/shared";
import type { PackagePage } from "@/content/pages/packagePages";
import { cn } from "@/lib/utils";

export function PackageSummaryCard({ page }: { page: PackagePage }) {
  return (
    <SectionContainer tone="ivory" className="py-10 sm:py-12 lg:py-14">
      <article className="grid gap-8 rounded-3xl border border-rahma-border bg-white p-6 shadow-sm sm:p-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12 lg:p-10 xl:gap-16">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-rahma-green">
            Quick package summary
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-rahma-charcoal">
            {page.title}
          </h2>
          <div className="mt-6 flex flex-wrap gap-3">
            <span className="rounded-full bg-rahma-gold px-4 py-2 text-lg font-semibold text-rahma-charcoal">
              {page.summary.price}
            </span>
            {page.summary.duration ? (
              <span className="rounded-full border border-rahma-border px-4 py-2 text-sm font-semibold text-rahma-green">
                {page.summary.duration}
              </span>
            ) : null}
          </div>
          <div className="mt-10 space-y-7">
            <div>
              <p className="text-sm font-semibold text-rahma-charcoal">Best for</p>
              <p className="mt-3 text-sm leading-7 text-rahma-muted">
                {page.summary.bestFor}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-rahma-charcoal">
                Therapist option
              </p>
              <p className="mt-3 text-sm leading-7 text-rahma-muted">
                {page.summary.therapistOption}
              </p>
            </div>
          </div>
        </div>
        <div className="lg:pt-1">
          <p className="text-sm font-semibold text-rahma-charcoal">
            {page.summary.includesHeading ?? "What’s included"}
          </p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {page.summary.includes.map((item, index) => {
              const isCenteredFinalItem =
                page.summary.includes.length % 2 === 1 &&
                index === page.summary.includes.length - 1;

              return (
                <li
                  key={item}
                  className={cn(
                    "flex min-h-16 items-center gap-3 rounded-2xl bg-rahma-ivory px-5 py-4 text-sm text-rahma-muted",
                    isCenteredFinalItem &&
                      "sm:col-span-2 sm:mx-auto sm:w-[calc((100%-1rem)/2)]"
                  )}
                >
                  <CheckCircle2
                    aria-hidden="true"
                    size={17}
                    className="shrink-0 text-rahma-green"
                  />
                  <span>{item}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </article>
    </SectionContainer>
  );
}
