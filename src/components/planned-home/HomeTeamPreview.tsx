import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionContainer, SectionHeading } from "@/components/shared";
import { homeTeamMembers } from "@/content/pages/plannedHome";
import { PlannedHomeImage } from "./PlannedHomeImage";

export function HomeTeamPreview() {
  return (
    <SectionContainer tone="ivory" width="wide">
      <SectionHeading
        align="center"
        title="Qualified therapists you can feel comfortable with"
        description="Rahma Therapy is led by Nadimur Rahman, Minhaj Rahman and a qualified female therapist, with private same-gender care available for female clients."
        className="mx-auto"
      />
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {homeTeamMembers.map((member) => (
          <article
            key={member.name}
            className="overflow-hidden rounded-3xl border border-rahma-border bg-white shadow-sm"
          >
            <div className="relative h-72 overflow-hidden bg-rahma-green">
              <PlannedHomeImage
                src={member.image}
                alt={member.alt}
                imageType={member.imageType}
                className="transition-transform duration-700 hover:scale-105"
              />
            </div>
            <div className="p-6">
              <h3 className="text-xl font-semibold text-rahma-charcoal">{member.name}</h3>
              <p className="mt-1 text-sm font-semibold text-rahma-green">{member.role}</p>
              <p className="mt-4 text-sm leading-6 text-rahma-muted">{member.body}</p>
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
