import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionContainer, SectionHeading } from "@/components/shared";
import { homeTeamMembers } from "@/content/pages/home";
import { HomeImage } from "./HomeImage";

export function HomeTeamPreview() {
  return (
    <SectionContainer tone="ivory" width="wide">
      <SectionHeading align="center" title="Meet the team" className="mx-auto" />
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {homeTeamMembers.map((member) => (
          <article
            key={member.name}
            className="flex flex-col overflow-hidden rounded-3xl border border-rahma-border bg-white shadow-sm"
          >
            <div className="relative h-[340px] overflow-hidden bg-rahma-green">
              <HomeImage
                src={member.image}
                alt={member.alt}
                imageType={member.imageType}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            </div>
            <div className="flex flex-1 flex-col p-6">
              <h3 className="text-xl font-semibold text-rahma-charcoal">{member.name}</h3>
              <p className="mt-1 text-sm font-semibold text-rahma-green">{member.role}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="mt-10 flex justify-center">
        <Link
          href="/about"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-rahma-green px-6 text-sm font-semibold text-white transition hover:bg-rahma-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue"
        >
          Meet the team
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </div>
    </SectionContainer>
  );
}
