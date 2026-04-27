import { SectionContainer, SectionHeading } from "@/components/shared";
import type { PackagePage } from "@/content/pages/packagePages";

export function PackageWhoItsFor({ page }: { page: PackagePage }) {
  return (
    <SectionContainer tone="surface">
      <SectionHeading
        align="center"
        title="Is this package right for you?"
        description="A quick way to check whether this package matches what you want from your home appointment."
        className="mx-auto"
      />
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {page.fitCards.map((card) => (
          <article
            key={card.title}
            className="rounded-3xl border border-rahma-border bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-card"
          >
            <h3 className="text-xl font-semibold text-rahma-charcoal">{card.title}</h3>
            <p className="mt-3 text-sm leading-7 text-rahma-muted">{card.body}</p>
          </article>
        ))}
      </div>
    </SectionContainer>
  );
}
