import { SectionContainer, SectionHeading } from "@/components/shared";
import { homePainPoints } from "@/content/pages/home";
import { HomeImage } from "./HomeImage";

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
            className="group relative flex min-h-[340px] overflow-hidden rounded-3xl border border-white/10 bg-rahma-charcoal shadow-soft sm:min-h-[360px]"
          >
            <div className="absolute inset-0">
              <HomeImage
                src={item.image}
                alt={item.alt}
                imageType={item.imageType}
                className="transition duration-500 group-hover:scale-[1.03]"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/78 via-black/25 to-black/5" />
            <div className="relative z-10 mt-auto p-6 text-white sm:p-7">
              <h3 className="max-w-sm text-2xl font-semibold leading-tight">{item.title}</h3>
              <p className="mt-3 max-w-sm text-sm leading-7 text-white/82">{item.body}</p>
            </div>
          </article>
        ))}
      </div>
    </SectionContainer>
  );
}
