import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionContainer, SectionHeading } from "@/components/shared";
import { whyRahmaItems } from "@/content/pages/home";
import { HomeIcon } from "./HomeIcon";

export function WhyRahmaTherapy() {
  return (
    <SectionContainer tone="ivory" width="wide" className="overflow-hidden">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.25fr] lg:items-center">
        <div>
          <SectionHeading
            eyebrow="Why us"
            title="Why people choose us"
            description="Private, qualified care — explained clearly, delivered respectfully."
          />
          <p className="mt-6 max-w-xl text-base leading-7 text-rahma-muted">
            When your body already feels tight, the last thing you need is a drive
            to a clinic. We come to you, check suitability first, and explain
            everything before we begin.
          </p>
          <Link
            href="/about"
            className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-rahma-gold px-6 text-sm font-semibold text-rahma-charcoal transition hover:bg-[#ffc252] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue sm:w-auto"
          >
            About the team
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {whyRahmaItems.map((item) => (
            <article
              key={item.title}
              className="rounded-3xl border border-rahma-border bg-white p-5 shadow-sm"
            >
              <div className="mb-5 flex size-11 items-center justify-center rounded-full bg-rahma-gold text-rahma-charcoal">
                <HomeIcon name={item.icon} />
              </div>
              <h3 className="text-lg font-semibold text-rahma-charcoal">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-rahma-muted">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </SectionContainer>
  );
}
