import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionContainer, SectionHeading } from "@/components/shared";
import type { PackagePage } from "@/content/pages/packagePages";

export function RelatedPackages({ page }: { page: PackagePage }) {
  return (
    <SectionContainer tone="ivory">
      <SectionHeading
        align="center"
        title="Related packages"
        description="Compare this package with other Rahma Therapy options before booking."
        className="mx-auto"
      />
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {page.relatedPackages.map((related) => (
          <article
            key={related.href}
            className="rounded-3xl border border-rahma-border bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-card"
          >
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-xl font-semibold text-rahma-charcoal">
                {related.title}
              </h3>
              <strong className="shrink-0 text-lg text-rahma-green">{related.price}</strong>
            </div>
            <p className="mt-4 text-sm leading-7 text-rahma-muted">{related.body}</p>
            <Link
              href={related.href}
              className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-rahma-green px-5 text-sm font-semibold text-white transition hover:bg-rahma-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue"
            >
              {related.cta}
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </article>
        ))}
      </div>
    </SectionContainer>
  );
}
