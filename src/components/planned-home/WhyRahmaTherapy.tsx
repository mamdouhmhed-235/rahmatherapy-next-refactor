import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionContainer, SectionHeading } from "@/components/shared";
import { whyRahmaItems } from "@/content/pages/plannedHome";
import { HomeIcon } from "./HomeIcon";

export function WhyRahmaTherapy() {
  return (
    <SectionContainer tone="green" width="wide" className="overflow-hidden">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.25fr] lg:items-center">
        <div>
          <SectionHeading
            eyebrow="Why Rahma Therapy"
            title="Why clients choose Rahma Therapy"
            description="Private treatment at home, explained clearly and delivered by qualified therapists who understand comfort, modesty and care."
            inverse
          />
          <p className="mt-6 max-w-xl text-base leading-7 text-white/78">
            When your body already feels tight or tired, travelling to a clinic can feel
            like another task. Rahma Therapy brings the treatment setup to you, checks
            suitability first, and talks you through the session before anything begins.
          </p>
          <Link
            href="/about"
            className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-rahma-gold px-6 text-sm font-semibold text-rahma-charcoal transition hover:bg-[#ffc252] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto"
          >
            About Rahma Therapy
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {whyRahmaItems.map((item) => (
            <article
              key={item.title}
              className="rounded-3xl border border-white/14 bg-white/[0.07] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.18)] backdrop-blur"
            >
              <div className="mb-5 flex size-11 items-center justify-center rounded-full bg-rahma-gold text-rahma-charcoal">
                <HomeIcon name={item.icon} />
              </div>
              <h3 className="text-lg font-semibold text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/75">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </SectionContainer>
  );
}
