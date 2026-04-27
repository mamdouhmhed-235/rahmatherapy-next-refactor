import { SectionContainer, SectionHeading } from "@/components/shared";
import { trustCards } from "@/content/pages/about";
import { AboutIcon } from "./AboutIcon";

export function TrustSnapshot() {
  return (
    <SectionContainer tone="surface">
      <SectionHeading
        align="center"
        title="The questions clients ask before booking — answered clearly."
        description="When someone comes to your home for hijama, cupping or massage, trust matters. Here is how Rahma Therapy keeps the experience professional, respectful and comfortable."
        className="mx-auto"
      />
      <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {trustCards.map((card) => (
          <article
            key={card.title}
            className="rounded-3xl border border-rahma-border bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-card"
          >
            <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-rahma-ivory text-rahma-green">
              <AboutIcon name={card.icon} />
            </div>
            <h3 className="text-xl font-semibold text-rahma-charcoal">{card.title}</h3>
            <p className="mt-3 text-sm leading-7 text-rahma-muted">{card.body}</p>
          </article>
        ))}
      </div>
    </SectionContainer>
  );
}
